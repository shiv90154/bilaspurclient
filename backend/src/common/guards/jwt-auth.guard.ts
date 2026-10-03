import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ErrorCode, forbidden, unauthorized } from '../errors.js';
import type { AccessTokenPayload, AuthUser } from '../types/auth-user.js';
import {
  Role,
  SessionRevokeReason,
  StudentStatus,
  UserStatus,
} from '../../generated/prisma/enums.js';

/**
 * Global guard. A valid JWT is not enough: the session it belongs to must
 * still be active. That is what makes "login on a new device logs the old
 * device out" work immediately instead of when the access token expires.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();

    const token = this.extractBearerToken(request);
    if (!token) {
      throw unauthorized(ErrorCode.UNAUTHENTICATED, 'Missing access token');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        algorithms: ['HS256'],
      });
    } catch (err) {
      const expired = err instanceof Error && err.name === 'TokenExpiredError';
      throw unauthorized(
        expired ? ErrorCode.TOKEN_EXPIRED : ErrorCode.INVALID_TOKEN,
        expired ? 'Access token expired' : 'Invalid access token',
      );
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          include: { student: { select: { status: true } } },
        },
      },
    });

    if (!session || session.userId !== payload.sub) {
      throw unauthorized(ErrorCode.INVALID_TOKEN, 'Invalid access token');
    }
    if (session.revokedAt) {
      if (session.revokedReason === SessionRevokeReason.REPLACED) {
        throw unauthorized(
          ErrorCode.SESSION_REPLACED,
          'You were logged out because this account was used on another device',
        );
      }
      throw unauthorized(ErrorCode.SESSION_REVOKED, 'Session ended');
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw unauthorized(ErrorCode.SESSION_EXPIRED, 'Session expired');
    }

    const { user } = session;
    if (user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw forbidden(ErrorCode.ACCOUNT_DISABLED, 'Account is disabled');
    }
    if (
      user.role === Role.STUDENT &&
      user.student &&
      user.student.status !== StudentStatus.ACTIVE
    ) {
      throw forbidden(
        ErrorCode.STUDENT_NOT_ACTIVE,
        'Your account is not active. Please contact the institute.',
      );
    }

    request.user = {
      id: user.id,
      role: user.role,
      sessionId: session.id,
      name: user.name,
    };
    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' && token ? token : undefined;
  }
}
