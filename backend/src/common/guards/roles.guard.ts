import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ErrorCode, forbidden } from '../errors.js';
import type { AuthUser } from '../types/auth-user.js';
import type { Role } from '../../generated/prisma/enums.js';

/**
 * Global guard, runs after JwtAuthGuard. Role checks here are the coarse
 * gate; ownership checks (faculty only sees own batches, student only own
 * data) belong in the service layer.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!user || !required.includes(user.role)) {
      throw forbidden(
        ErrorCode.FORBIDDEN_ROLE,
        'You do not have permission to perform this action',
      );
    }
    return true;
  }
}
