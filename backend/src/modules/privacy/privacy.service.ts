import { randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Paginated } from '../../common/dto/pagination.dto.js';
import { hashPassword } from '../../common/password.util.js';
import { TERMS_VERSION } from '../../common/terms.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import {
  DeletionRequestSource,
  DeletionRequestStatus,
  Role,
  SessionRevokeReason,
  StudentStatus,
  UserStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { StorageService } from '../storage/storage.service.js';
import type {
  ConsentDto,
  ListDeletionRequestsQueryDto,
  WebDeletionRequestDto,
} from './dto/privacy.dto.js';

/**
 * Consent to the terms (DPDP Act: a guardian for minors) and account deletion requests
 * (Play Store: in-app option + public web page). Deleting an account removes personal data
 * and keeps only anonymous numbers (test scores, attendance) for the institute's statistics.
 */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  async info() {
    return { ...(await this.settings.publicInfo()), termsVersion: TERMS_VERSION };
  }

  /** Students must accept the current terms once; staff accept them through their contract. */
  async consentRequired(userId: string, role: Role): Promise<boolean> {
    if (role !== Role.STUDENT) return false;
    const found = await this.prisma.consent.findFirst({
      where: { userId, version: TERMS_VERSION },
      select: { id: true },
    });
    return !found;
  }

  async consent(user: AuthUser, dto: ConsentDto, ip?: string) {
    if (dto.version !== TERMS_VERSION) {
      throw new ConflictException('The terms were updated. Please read them again.');
    }
    const existing = await this.prisma.consent.findFirst({
      where: { userId: user.id, version: TERMS_VERSION },
      select: { acceptedAt: true },
    });
    if (existing) return { version: TERMS_VERSION, acceptedAt: existing.acceptedAt };
    const row = await this.prisma.consent.create({
      data: {
        userId: user.id,
        version: TERMS_VERSION,
        guardianAgree: dto.guardianAgree ?? false,
        guardianName: dto.guardianName?.trim() || null,
        ip: ip ?? null,
      },
    });
    await this.activity.log({ actorId: user.id, action: 'privacy.consent', entity: 'user', entityId: user.id, ip });
    return { version: row.version, acceptedAt: row.acceptedAt };
  }

  /** From the app's Profile screen: the signed-in student asks to delete their account. */
  async requestFromApp(user: AuthUser, reason?: string) {
    const record = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { name: true, phone: true },
    });
    return this.createRequest({
      userId: user.id,
      name: record.name,
      phone: record.phone,
      reason,
      source: DeletionRequestSource.APP,
    });
  }

  /**
   * From the public web page (Play Store asks for one that works without the app).
   * Answers the same whether or not the phone belongs to someone, so it cannot be used to
   * find out who studies here. The admin checks the person before deleting anything.
   */
  async requestFromWeb(dto: WebDeletionRequestDto) {
    const user = await this.prisma.user.findFirst({
      where: { phone: dto.phone, deletedAt: null },
      select: { id: true },
    });
    await this.createRequest({
      userId: user?.id ?? null,
      name: dto.name.trim(),
      phone: dto.phone,
      reason: dto.reason,
      source: DeletionRequestSource.WEB,
    });
    return { received: true };
  }

  private async createRequest(data: {
    userId: string | null;
    name: string;
    phone: string;
    reason?: string;
    source: DeletionRequestSource;
  }) {
    // One open request per phone is enough; repeat taps do not pile up.
    const open = await this.prisma.deletionRequest.findFirst({
      where: { phone: data.phone, status: DeletionRequestStatus.PENDING },
      select: { id: true, createdAt: true, status: true },
    });
    if (open) return open;
    const row = await this.prisma.deletionRequest.create({
      data: { ...data, reason: data.reason?.trim() || null },
      select: { id: true, createdAt: true, status: true },
    });
    await this.activity.log({
      actorId: data.userId,
      action: 'privacy.deletion-request',
      entity: 'deletion_request',
      entityId: row.id,
      meta: { source: data.source },
    });
    return row;
  }

  /** The signed-in user's own open request, so the app can show "requested on ...". */
  myRequest(user: AuthUser) {
    return this.prisma.deletionRequest.findFirst({
      where: { userId: user.id, status: DeletionRequestStatus.PENDING },
      select: { id: true, createdAt: true, status: true },
    });
  }

  async list(q: ListDeletionRequestsQueryDto): Promise<Paginated<unknown>> {
    const where = q.status ? { status: q.status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.deletionRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.limit,
        include: {
          user: { select: { id: true, role: true, student: { select: { id: true, admissionNo: true } } } },
        },
      }),
      this.prisma.deletionRequest.count({ where }),
    ]);
    return { items, page: q.page, limit: q.limit, total };
  }

  async reject(admin: AuthUser, id: string, note?: string) {
    const req = await this.pending(id);
    await this.prisma.deletionRequest.update({
      where: { id: req.id },
      data: { status: DeletionRequestStatus.REJECTED, note: note?.trim() || null, handledById: admin.id, handledAt: new Date() },
    });
    await this.activity.log({ actorId: admin.id, action: 'privacy.deletion-reject', entity: 'deletion_request', entityId: id });
    return { id, status: DeletionRequestStatus.REJECTED };
  }

  /**
   * Deletes the person's data: name, phone, email, address, guardian, photo, documents, devices
   * and sessions. Test attempts, attendance and doubts stay, attached to "Deleted student", so
   * batch statistics remain correct without identifying anyone.
   */
  async complete(admin: AuthUser, id: string, note?: string) {
    const req = await this.pending(id);
    if (!req.userId) {
      throw new BadRequestException('No account matches this phone number. Reject the request with a note instead.');
    }
    if (req.userId === admin.id) throw new BadRequestException('You cannot delete your own account here');
    const user = await this.prisma.user.findUnique({
      where: { id: req.userId },
      include: { student: { include: { documents: true } } },
    });
    if (!user) throw new NotFoundException('Account not found');
    if (user.role === Role.ADMIN) throw new BadRequestException('Admin accounts are not deleted this way');

    const now = new Date();
    const tag = randomBytes(6).toString('hex');
    const files = [
      ...(user.student?.documents.map((d) => d.fileKey) ?? []),
      ...(user.student?.photoKey ? [user.student.photoKey] : []),
    ];
    const s = user.student;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: s ? 'Deleted student' : 'Deleted user',
          phone: `deleted-${tag}`, // unique column; never a real number
          email: null,
          passwordHash: await hashPassword(randomBytes(24).toString('base64url')),
          status: UserStatus.INACTIVE,
          deletedAt: now,
        },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now, revokedReason: SessionRevokeReason.USER_DISABLED },
      }),
      this.prisma.device.deleteMany({ where: { userId: user.id } }),
      this.prisma.consent.updateMany({ where: { userId: user.id }, data: { guardianName: null, ip: null } }),
      ...(s
        ? [
            this.prisma.student.update({
              where: { id: s.id },
              data: {
                admissionNo: null,
                dob: null,
                gender: null,
                address: null,
                city: null,
                guardianName: null,
                guardianPhone: null,
                photoKey: null,
                notes: null,
                status: StudentStatus.DROPPED,
                deletedAt: s.deletedAt ?? now,
              },
            }),
            this.prisma.academicDetail.deleteMany({ where: { studentId: s.id } }),
            this.prisma.studentDocument.deleteMany({ where: { studentId: s.id } }),
            this.prisma.enquiry.updateMany({
              where: { convertedStudentId: s.id },
              data: { name: 'Deleted student', phone: `deleted-${tag}`, email: null, notes: null },
            }),
          ]
        : []),
      // Other requests from this phone held the number too.
      this.prisma.deletionRequest.updateMany({
        where: { phone: req.phone },
        data: { name: 'Deleted', phone: `deleted-${tag}`, reason: null },
      }),
      this.prisma.deletionRequest.update({
        where: { id: req.id },
        data: { status: DeletionRequestStatus.COMPLETED, note: note?.trim() || null, handledById: admin.id, handledAt: now },
      }),
    ]);

    for (const key of files) {
      try {
        await this.storage.remove(key);
      } catch (err) {
        this.logger.warn(`Could not delete file ${key}: ${String(err)}`);
      }
    }
    await this.activity.log({
      actorId: admin.id,
      action: 'privacy.deletion-complete',
      entity: 'user',
      entityId: user.id,
      meta: { requestId: id, filesRemoved: files.length },
    });
    return { id, status: DeletionRequestStatus.COMPLETED };
  }

  private async pending(id: string) {
    const req = await this.prisma.deletionRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== DeletionRequestStatus.PENDING) throw new ConflictException('This request was already handled');
    return req;
  }
}
