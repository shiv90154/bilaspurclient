import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth-user.js';
import { SessionRevokeReason } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async listDevices(userId: string) {
    await this.assertUserExists(userId);
    return this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        deviceId: true,
        name: true,
        platform: true,
        status: true,
        firstSeenAt: true,
        lastSeenAt: true,
      },
    });
  }

  /**
   * Admin override for the one-device rule: ends every session and forgets
   * all devices, so the student can log in on a new phone straight away.
   */
  async resetDevices(admin: AuthUser, userId: string) {
    await this.assertUserExists(userId);
    const [sessions, devices] = await this.prisma.$transaction([
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: SessionRevokeReason.ADMIN_RESET,
        },
      }),
      this.prisma.device.deleteMany({ where: { userId } }),
    ]);
    await this.activity.log({
      actorId: admin.id,
      action: 'user.reset-device',
      entity: 'user',
      entityId: userId,
      meta: { sessionsRevoked: sessions.count, devicesRemoved: devices.count },
    });
    return { sessionsRevoked: sessions.count, devicesRemoved: devices.count };
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
  }
}
