import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { Prisma } from '../../generated/prisma/client.js';
import {
  EnrollmentStatus,
  FeeStatus,
  PaymentMode,
  PaymentStatus,
  Role,
  StudentStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { escapeHtml } from '../account/otp.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { MailService } from '../mail/mail.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type {
  CreateFeePlanDto,
  ListPaymentsQueryDto,
  OfflinePaymentDto,
  UpdateFeePlanDto,
  VerifyPaymentDto,
} from './dto/fees.dto.js';
import { RazorpayService } from './razorpay.service.js';

/** Money is stored in rupees (Decimal); all sums are done in whole paise to avoid float drift. */
const paise = (v: Prisma.Decimal | number | string) => Math.round(Number(v) * 100);
const rupees = (p: number) => (p / 100).toFixed(2);

const PLAN_SELECT = {
  id: true,
  name: true,
  total: true,
  active: true,
  course: { select: { id: true, name: true, description: true } },
  batch: { select: { id: true, name: true, startDate: true, active: true } },
} satisfies Prisma.FeePlanSelect;

const PAYMENT_SELECT = {
  id: true,
  amount: true,
  mode: true,
  status: true,
  receiptNo: true,
  razorpayOrderId: true,
  razorpayPaymentId: true,
  notes: true,
  approvedAt: true,
  createdAt: true,
  approvedBy: { select: { name: true } },
  studentFee: {
    select: {
      id: true,
      total: true,
      discount: true,
      status: true,
      plan: { select: { id: true, name: true, course: { select: { name: true } }, batch: { select: { name: true } } } },
      student: { select: { id: true, admissionNo: true, user: { select: { name: true, phone: true, email: true } } } },
    },
  },
} satisfies Prisma.PaymentSelect;

interface WebhookPayment {
  id: string;
  order_id: string;
  amount: number;
  status: string;
}

@Injectable()
export class FeesService {
  private readonly logger = new Logger(FeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly activity: ActivityService,
    private readonly mail: MailService,
    private readonly settings: SettingsService,
  ) {}

  // ───────────── fee plans (what a student can buy) ─────────────

  /** Open plans for the website: active plan, course and batch. */
  async publicPlans() {
    const plans = await this.prisma.feePlan.findMany({
      where: { active: true, batch: { active: true }, course: { active: true } },
      orderBy: [{ course: { name: 'asc' } }, { total: 'asc' }],
      select: PLAN_SELECT,
    });
    return {
      onlinePayments: this.razorpay.enabled,
      plans: plans.map(({ active: _a, batch, ...p }) => ({ ...p, batch: batch && { id: batch.id, name: batch.name, startDate: batch.startDate } })),
    };
  }

  /** Same list for a signed-in student, with what they already joined or paid. */
  async plansForStudent(user: AuthUser) {
    const student = await this.studentOf(user);
    const [open, fees, joined] = await Promise.all([
      this.publicPlans(),
      this.prisma.studentFee.findMany({
        where: { studentId: student.id },
        select: { planId: true, total: true, discount: true, status: true, payments: { where: { status: PaymentStatus.PAID }, select: { amount: true } } },
      }),
      this.prisma.studentBatch.findMany({
        where: { studentId: student.id, status: EnrollmentStatus.ACTIVE },
        select: { batchId: true },
      }),
    ]);
    const inBatch = new Set(joined.map((j) => j.batchId));
    return {
      onlinePayments: open.onlinePayments,
      plans: open.plans.map((p) => {
        const fee = fees.find((f) => f.planId === p.id && f.status !== FeeStatus.WAIVED);
        const paid = fee ? fee.payments.reduce((s, x) => s + paise(x.amount), 0) : 0;
        const due = Math.max(0, paise(fee?.total ?? p.total) - paise(fee?.discount ?? 0) - paid);
        return {
          ...p,
          enrolled: !!p.batch && inBatch.has(p.batch.id) && student.status === StudentStatus.ACTIVE,
          paid: rupees(paid),
          due: rupees(due),
        };
      }),
    };
  }

  async listPlans() {
    return this.prisma.feePlan.findMany({
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      select: { ...PLAN_SELECT, createdAt: true, _count: { select: { fees: true } } },
    });
  }

  async createPlan(admin: AuthUser, dto: CreateFeePlanDto) {
    const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId }, select: { courseId: true, active: true } });
    if (!batch) throw new NotFoundException('Batch not found');
    if (!batch.active) throw new BadRequestException('Batch is archived');
    const plan = await this.prisma.feePlan.create({
      data: { name: dto.name.trim(), batchId: dto.batchId, courseId: batch.courseId, total: dto.total },
      select: PLAN_SELECT,
    });
    await this.activity.log({ actorId: admin.id, action: 'fee-plan.create', entity: 'fee-plan', entityId: plan.id, meta: { total: dto.total } });
    return plan;
  }

  async updatePlan(admin: AuthUser, id: string, dto: UpdateFeePlanDto) {
    try {
      const plan = await this.prisma.feePlan.update({
        where: { id },
        data: { name: dto.name?.trim(), total: dto.total, active: dto.active },
        select: PLAN_SELECT,
      });
      await this.activity.log({ actorId: admin.id, action: 'fee-plan.update', entity: 'fee-plan', entityId: id, meta: { ...dto } });
      return plan;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw new NotFoundException('Fee plan not found');
      throw err;
    }
  }

  // ───────────── online payment (Razorpay checkout on the website) ─────────────

  /** Step 1: the server fixes the amount and opens a Razorpay order for it. */
  async createOrder(user: AuthUser, planId: string) {
    const student = await this.studentOf(user);
    const plan = await this.prisma.feePlan.findFirst({
      where: { id: planId, active: true, batch: { active: true }, course: { active: true } },
      select: { id: true, name: true, total: true, batchId: true },
    });
    if (!plan) throw new NotFoundException('This course is not open for payment');

    const fee = await this.openFee(student.id, plan);
    const due = paise(fee.total) - paise(fee.discount) - (await this.paidOn(fee.id));
    if (due <= 0) throw new ConflictException({ statusCode: 409, code: 'ALREADY_PAID', message: 'This course is already paid' });

    const order = await this.razorpay.createOrder(due, fee.id.slice(0, 40), { studentId: student.id, planId: plan.id });
    await this.prisma.payment.create({
      data: { studentFeeId: fee.id, amount: rupees(due), mode: PaymentMode.RAZORPAY, razorpayOrderId: order.id },
    });
    return {
      keyId: this.razorpay.publicKeyId,
      orderId: order.id,
      amount: due,
      currency: 'INR',
      description: plan.name,
      prefill: { name: student.user.name, email: student.user.email ?? undefined, contact: student.user.phone },
    };
  }

  /** Step 2: the checkout's success callback. The signature proves Razorpay sent it. */
  async verify(user: AuthUser, dto: VerifyPaymentDto) {
    const student = await this.studentOf(user);
    const payment = await this.prisma.payment.findUnique({
      where: { razorpayOrderId: dto.razorpay_order_id },
      select: { id: true, status: true, studentFee: { select: { studentId: true } } },
    });
    if (!payment || payment.studentFee.studentId !== student.id) throw new NotFoundException('Payment not found');
    if (!this.razorpay.checkPaymentSignature(dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature)) {
      this.logger.warn(`Bad payment signature for ${dto.razorpay_order_id}`);
      throw new BadRequestException({ statusCode: 400, code: 'PAYMENT_SIGNATURE_INVALID', message: 'Payment could not be verified' });
    }
    await this.settle(payment.id, { razorpayPaymentId: dto.razorpay_payment_id });
    return this.payment(user, payment.id);
  }

  /**
   * Razorpay webhook (payment.captured / order.paid): the backup when the student closes the
   * tab before step 2. Signed with the webhook secret; every event is stored once.
   */
  async webhook(rawBody: Buffer | undefined, signature: string | undefined, eventId: string | undefined) {
    if (!rawBody || !signature || !this.razorpay.checkWebhookSignature(rawBody, signature)) {
      throw new BadRequestException({ statusCode: 400, code: 'WEBHOOK_SIGNATURE_INVALID', message: 'Invalid signature' });
    }
    const event = JSON.parse(rawBody.toString('utf8')) as {
      event: string;
      payload?: { payment?: { entity?: WebhookPayment } };
    };
    const entity = event.payload?.payment?.entity;
    const payment = entity?.order_id
      ? await this.prisma.payment.findUnique({ where: { razorpayOrderId: entity.order_id }, select: { id: true, amount: true } })
      : null;

    try {
      await this.prisma.paymentEvent.create({
        data: {
          eventId: eventId || `${event.event}:${entity?.id ?? 'none'}`,
          type: event.event,
          paymentId: payment?.id ?? null,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { ok: true, duplicate: true };
      throw err;
    }

    if ((event.event === 'payment.captured' || event.event === 'order.paid') && entity && payment) {
      if (entity.status !== 'captured' || entity.amount !== paise(payment.amount)) {
        this.logger.warn(`Webhook ${event.event} for ${entity.order_id} not settled: status ${entity.status}, amount ${entity.amount}`);
      } else {
        await this.settle(payment.id, { razorpayPaymentId: entity.id });
      }
    }
    return { ok: true };
  }

  // ───────────── offline entries (cash, UPI to the institute, cheque, bank transfer) ─────────────

  async recordOffline(admin: AuthUser, dto: OfflinePaymentDto) {
    const student = await this.prisma.student.findFirst({ where: { id: dto.studentId, deletedAt: null }, select: { id: true } });
    if (!student) throw new NotFoundException('Student not found');
    const plan = await this.prisma.feePlan.findUnique({ where: { id: dto.planId }, select: { id: true, total: true, batchId: true } });
    if (!plan) throw new NotFoundException('Fee plan not found');

    const fee = await this.openFee(student.id, plan);
    const due = paise(fee.total) - paise(fee.discount) - (await this.paidOn(fee.id));
    if (due <= 0) throw new ConflictException({ statusCode: 409, code: 'ALREADY_PAID', message: 'This fee is already fully paid' });
    if (paise(dto.amount) > due) throw new BadRequestException(`Amount is more than the balance due (₹${rupees(due)})`);

    const created = await this.prisma.payment.create({
      data: { studentFeeId: fee.id, amount: dto.amount, mode: dto.mode, notes: dto.notes?.trim() || null },
      select: { id: true },
    });
    await this.settle(created.id, { approvedById: admin.id, grantAccess: dto.grantAccess });
    return this.payment(admin, created.id);
  }

  // ───────────── reading ─────────────

  async list(q: ListPaymentsQueryDto): Promise<Paginated<unknown>> {
    const search = q.search?.trim();
    const where: Prisma.PaymentWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.mode && { mode: q.mode }),
      ...(search && {
        OR: [
          { receiptNo: { contains: search, mode: 'insensitive' } },
          { studentFee: { student: { user: { name: { contains: search, mode: 'insensitive' } } } } },
          { studentFee: { student: { user: { phone: { contains: search } } } } },
        ],
      }),
    };
    const [items, total, sum] = await this.prisma.$transaction([
      this.prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip: q.skip, take: q.limit, select: PAYMENT_SELECT }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.aggregate({ where: { ...where, status: PaymentStatus.PAID }, _sum: { amount: true } }),
    ]);
    return { items, page: q.page, limit: q.limit, total, paidTotal: sum._sum.amount ?? 0 } as Paginated<unknown>;
  }

  async mine(user: AuthUser) {
    const student = await this.studentOf(user);
    return this.prisma.payment.findMany({
      where: { studentFee: { studentId: student.id }, status: { in: [PaymentStatus.PAID, PaymentStatus.REFUNDED] } },
      orderBy: { createdAt: 'desc' },
      select: PAYMENT_SELECT,
    });
  }

  /** One payment (the receipt). Students only see their own. */
  async payment(user: AuthUser, id: string) {
    const p = await this.prisma.payment.findUnique({ where: { id }, select: PAYMENT_SELECT });
    if (!p) throw new NotFoundException('Payment not found');
    if (user.role === Role.STUDENT) {
      const student = await this.studentOf(user);
      if (p.studentFee.student.id !== student.id) throw new NotFoundException('Payment not found');
    } else if (user.role !== Role.ADMIN) {
      throw new ForbiddenException();
    }
    const institute = await this.settings.publicInfo();
    return { ...p, institute };
  }

  // ───────────── internals ─────────────

  private async studentOf(user: AuthUser) {
    if (user.role !== Role.STUDENT) throw new ForbiddenException('Only students can do this');
    const s = await this.prisma.student.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true, status: true, user: { select: { name: true, email: true, phone: true } } },
    });
    if (!s) throw new NotFoundException('Student profile not found');
    return s;
  }

  /** The student's fee row for this plan (a new one at today's price the first time). Paid once = done. */
  private async openFee(studentId: string, plan: { id: string; total: Prisma.Decimal }) {
    const existing = await this.prisma.studentFee.findFirst({
      where: { studentId, planId: plan.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, total: true, discount: true, status: true },
    });
    if (existing?.status === FeeStatus.PAID || existing?.status === FeeStatus.WAIVED) {
      throw new ConflictException({ statusCode: 409, code: 'ALREADY_PAID', message: 'This course is already paid' });
    }
    return existing ?? this.prisma.studentFee.create({
      data: { studentId, planId: plan.id, total: plan.total },
      select: { id: true, total: true, discount: true, status: true },
    });
  }

  private async paidOn(studentFeeId: string) {
    const agg = await this.prisma.payment.aggregate({ where: { studentFeeId, status: PaymentStatus.PAID }, _sum: { amount: true } });
    return paise(agg._sum.amount ?? 0);
  }

  /**
   * Marks a PENDING payment paid, exactly once (the verify call and the webhook may both arrive).
   * When the fee is fully paid (or the admin says so) the student joins the plan's batch and
   * becomes ACTIVE: the same effect as approving a registration.
   */
  private async settle(paymentId: string, opts: { razorpayPaymentId?: string; approvedById?: string; grantAccess?: boolean }) {
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        where: { id: paymentId, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.PAID,
          approvedAt: now,
          approvedById: opts.approvedById ?? null,
          razorpayPaymentId: opts.razorpayPaymentId,
          receiptNo: receiptNo(now, paymentId),
        },
      });
      if (count === 0) return null; // already settled

      const p = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        select: {
          amount: true,
          studentFee: { select: { id: true, total: true, discount: true, studentId: true, plan: { select: { name: true, batchId: true } } } },
        },
      });
      const fee = p.studentFee;
      const agg = await tx.payment.aggregate({ where: { studentFeeId: fee.id, status: PaymentStatus.PAID }, _sum: { amount: true } });
      const fullyPaid = paise(agg._sum.amount ?? 0) >= paise(fee.total) - paise(fee.discount);
      await tx.studentFee.update({ where: { id: fee.id }, data: { status: fullyPaid ? FeeStatus.PAID : FeeStatus.PARTIAL } });

      const unlock = (fullyPaid || !!opts.grantAccess) && !!fee.plan.batchId;
      if (unlock) {
        await tx.studentBatch.upsert({
          where: { studentId_batchId: { studentId: fee.studentId, batchId: fee.plan.batchId! } },
          create: { studentId: fee.studentId, batchId: fee.plan.batchId! },
          update: { status: EnrollmentStatus.ACTIVE },
        });
        await tx.student.update({ where: { id: fee.studentId }, data: { status: StudentStatus.ACTIVE, reviewNote: null } });
      }
      return { amount: p.amount, studentId: fee.studentId, planName: fee.plan.name, unlock };
    });
    if (!result) return;

    await this.activity.log({
      actorId: opts.approvedById ?? null,
      action: opts.approvedById ? 'payment.offline' : 'payment.online',
      entity: 'payment',
      entityId: paymentId,
      meta: { studentId: result.studentId, amount: String(result.amount), unlocked: result.unlock },
    });
    void this.notifyPaid(result.studentId, result.planName, String(result.amount), result.unlock);
  }

  private async notifyPaid(studentId: string, planName: string, amount: string, unlocked: boolean) {
    if (!this.mail.enabled) return;
    try {
      const s = await this.prisma.student.findUnique({ where: { id: studentId }, select: { user: { select: { name: true, email: true } } } });
      if (!s?.user.email) return;
      const { instituteName } = await this.settings.publicInfo();
      const lines = [
        `We received your payment of ₹${amount} for ${planName}. Thank you.`,
        unlocked ? 'Your course is now open. Sign in to the app again to see your classes, notes and tests.' : 'The balance can be paid later.',
        'Your receipt is in the Fees section of the web panel.',
      ];
      await this.mail.send({
        to: s.user.email,
        subject: `${instituteName}: payment received`,
        text: [`Hello ${s.user.name},`, '', ...lines, '', instituteName].join('\n'),
        html: `<p>Hello ${escapeHtml(s.user.name)},</p>${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}<p>${escapeHtml(instituteName)}</p>`,
      });
    } catch {
      // logged by MailService; a mail problem never undoes a payment
    }
  }
}

/** e.g. DHI-20261008-3F9A1C2B: date + start of the payment id (unique, no counter needed). */
function receiptNo(at: Date, paymentId: string) {
  const ist = new Date(at.getTime() + 330 * 60_000).toISOString().slice(0, 10).replace(/-/g, '');
  return `DHI-${ist}-${paymentId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
