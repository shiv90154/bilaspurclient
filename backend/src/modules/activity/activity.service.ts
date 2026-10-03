import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

export interface ActivityEntry {
  actorId?: string | null;
  action: string; // e.g. "auth.login", "user.reset-device"
  entity: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
  ip?: string | null;
}

/** Writes the audit trail used by the admin dashboard "recent activity". */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Never throws: an audit failure must not break the user's request. */
  async log(entry: ActivityEntry): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          meta: entry.meta,
          ip: entry.ip ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write activity log: ${String(err)}`);
    }
  }
}
