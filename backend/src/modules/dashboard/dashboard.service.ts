import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  ClassStatus,
  ContentStatus,
  DoubtStatus,
  EnquiryStatus,
  PaymentStatus,
  Role,
  StudentStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const DAY_MS = 24 * 3600_000;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  summary(user: AuthUser) {
    return user.role === Role.ADMIN ? this.adminSummary() : this.facultySummary(user);
  }

  private async adminSummary() {
    const now = new Date();
    const [
      students,
      activeStudents,
      faculty,
      batches,
      openEnquiries,
      followUpsDue,
      openDoubts,
      upcomingClasses,
      pendingPayments,
      recentActivity,
      materials,
      questions,
      liveNow,
      activeToday,
      activeWeek,
      pendingRegistrations,
    ] = await Promise.all([
      this.prisma.student.count({ where: { deletedAt: null } }),
      this.prisma.student.count({
        where: { deletedAt: null, status: StudentStatus.ACTIVE },
      }),
      this.prisma.faculty.count({ where: { user: { deletedAt: null } } }),
      this.prisma.batch.count({ where: { active: true } }),
      this.prisma.enquiry.count({
        where: { status: { notIn: [EnquiryStatus.CONVERTED, EnquiryStatus.LOST] } },
      }),
      this.prisma.enquiry.count({
        where: {
          status: { notIn: [EnquiryStatus.CONVERTED, EnquiryStatus.LOST] },
          followUpDate: { lte: now },
        },
      }),
      this.prisma.doubt.count({
        where: { status: { in: [DoubtStatus.OPEN, DoubtStatus.ASSIGNED] } },
      }),
      this.prisma.liveClass.count({
        where: { status: ClassStatus.SCHEDULED, startAt: { gte: now } },
      }),
      this.prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
      this.recentActivity(),
      this.prisma.material.count({ where: { status: ContentStatus.PUBLISHED } }),
      this.prisma.question.count({ where: { active: true } }),
      this.prisma.liveClass.count({
        where: { status: { not: ClassStatus.CANCELLED }, startAt: { lte: now }, endAt: { gt: now } },
      }),
      this.activeUsers(new Date(now.getTime() - DAY_MS)),
      this.activeUsers(new Date(now.getTime() - 7 * DAY_MS)),
      this.prisma.student.count({
        where: { deletedAt: null, status: StudentStatus.PENDING, registeredVia: { not: null } },
      }),
    ]);
    return {
      role: Role.ADMIN,
      counts: {
        students,
        activeStudents,
        faculty,
        activeBatches: batches,
        openEnquiries,
        followUpsDue,
        openDoubts,
        upcomingClasses,
        liveNow,
        materials,
        questions,
        activeToday,
        activeWeek,
        pendingRegistrations,
        pendingPayments,
      },
      recentActivity,
    };
  }

  /** Faculty see numbers only for the batches they are assigned to. */
  private async facultySummary(user: AuthUser) {
    const now = new Date();
    const myBatches: Prisma.BatchWhereInput = {
      faculty: { some: { faculty: { userId: user.id } } },
    };
    const [batches, students, openDoubts, upcomingClasses] = await Promise.all([
      this.prisma.batch.count({ where: { ...myBatches, active: true } }),
      this.prisma.student.count({
        where: { deletedAt: null, batches: { some: { batch: myBatches } } },
      }),
      this.prisma.doubt.count({
        where: {
          status: { in: [DoubtStatus.OPEN, DoubtStatus.ASSIGNED] },
          OR: [{ assignedToId: user.id }, { batch: myBatches }],
        },
      }),
      this.prisma.liveClass.count({
        where: {
          status: ClassStatus.SCHEDULED,
          startAt: { gte: now },
          faculty: { userId: user.id },
        },
      }),
    ]);
    return {
      role: Role.FACULTY,
      counts: { activeBatches: batches, students, openDoubts, upcomingClasses },
    };
  }

  /**
   * People who used the app or panel since `since`. A session's lastUsedAt moves on every token
   * refresh (about every 15 minutes of use), so this counts real use, not only fresh logins.
   */
  private activeUsers(since: Date) {
    return this.prisma.user.count({
      where: { deletedAt: null, sessions: { some: { lastUsedAt: { gte: since } } } },
    });
  }

  private recentActivity() {
    return this.prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
        actor: { select: { id: true, name: true } },
      },
    });
  }
}
