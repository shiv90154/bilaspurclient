import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  ClassStatus,
  DoubtStatus,
  EnquiryStatus,
  PaymentStatus,
  Role,
  StudentStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';

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
