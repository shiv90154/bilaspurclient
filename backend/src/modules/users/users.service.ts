import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { hashPassword } from '../../common/password.util.js';
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

  /**
   * For a student or teacher who forgot their password. Every session ends and a lockout is
   * cleared. Without a password in the request a random one is made and returned exactly once.
   */
  async resetPassword(admin: AuthUser, userId: string, password?: string) {
    if (userId === admin.id) {
      throw new BadRequestException('Use "Change password" for your own account');
    }
    await this.assertUserExists(userId);
    const generated = password ? undefined : randomBytes(9).toString('base64url');
    const passwordHash = await hashPassword(password ?? generated!);
    const now = new Date();
    const [, sessions] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
      }),
      this.prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revokedReason: SessionRevokeReason.PASSWORD_CHANGED },
      }),
    ]);
    await this.activity.log({
      actorId: admin.id,
      action: 'user.reset-password',
      entity: 'user',
      entityId: userId,
      meta: { sessionsRevoked: sessions.count },
    });
    return { sessionsRevoked: sessions.count, ...(generated && { temporaryPassword: generated }) };
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
  }
}
