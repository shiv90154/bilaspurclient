import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClassStatus, EnrollmentStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

/** Reminder goes out when a class is at most this far away. */
export const REMINDER_LEAD_MS = 10 * 60_000;

/** Recipients of anything about a class: its active students and its teacher. */
export async function classAudience(prisma: PrismaService, classId: string): Promise<string[]> {
  const c = await prisma.liveClass.findUnique({
    where: { id: classId },
    select: {
      faculty: { select: { userId: true } },
      batch: {
        select: {
          students: {
            where: { status: EnrollmentStatus.ACTIVE },
            select: { student: { select: { userId: true } } },
          },
        },
      },
    },
  });
  if (!c) return [];
  const ids = c.batch.students.map((s) => s.student.userId);
  if (c.faculty) ids.push(c.faculty.userId);
  return ids;
}

const dayFmt = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
});

/** e.g. "Tue, 6 Oct, 5:30 pm" in IST — the institute's clock, whatever the server's TZ is. */
export const formatClassTime = (d: Date) => dayFmt.format(d);

@Injectable()
export class ClassRemindersService {
  private readonly logger = new Logger(ClassRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendDue() {
    if (!this.notifications.enabled) return;
    try {
      const now = new Date();
      const due = await this.prisma.liveClass.findMany({
        where: {
          status: ClassStatus.SCHEDULED,
          reminderSentAt: null,
          startAt: { gt: now, lte: new Date(now.getTime() + REMINDER_LEAD_MS) },
        },
        select: { id: true, title: true, startAt: true },
      });
      for (const c of due) {
        // Claim first so overlapping runs / multiple instances can't double-send.
        const claimed = await this.prisma.liveClass.updateMany({
          where: { id: c.id, reminderSentAt: null },
          data: { reminderSentAt: now },
        });
        if (claimed.count === 0) continue;
        const mins = Math.max(1, Math.round((c.startAt.getTime() - now.getTime()) / 60_000));
        await this.notifications.sendToUsers(await classAudience(this.prisma, c.id), {
          title: 'Class starting soon',
          body: `${c.title} starts in ${mins} min`,
          data: { type: 'class_reminder', classId: c.id },
        });
      }
    } catch (err) {
      this.logger.error('class reminders failed', err as Error);
    }
  }
}
