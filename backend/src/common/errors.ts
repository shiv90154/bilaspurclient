import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Machine readable error codes. Clients (Flutter / web) switch on `code`,
 * never on the human readable `message`.
 */
export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  SESSION_REPLACED: 'SESSION_REPLACED', // logged in on another device
  SESSION_REVOKED: 'SESSION_REVOKED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  STUDENT_NOT_ACTIVE: 'STUDENT_NOT_ACTIVE',
  DEVICE_ID_REQUIRED: 'DEVICE_ID_REQUIRED',
  DEVICE_BLOCKED: 'DEVICE_BLOCKED',
  DEVICE_LIMIT_REACHED: 'DEVICE_LIMIT_REACHED',
  FORBIDDEN_ROLE: 'FORBIDDEN_ROLE',
  PASSWORD_UNCHANGED: 'PASSWORD_UNCHANGED',
  WRONG_PASSWORD: 'WRONG_PASSWORD',
  STAFF_USE_WEB: 'STAFF_USE_WEB', // admin/faculty tried to log in to the student app
  DEMO_ACCOUNT: 'DEMO_ACCOUNT', // feature needs an approved (ACTIVE) student // change-password: the current password does not match
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export const unauthorized = (code: ErrorCodeValue, message: string) =>
  new UnauthorizedException({ statusCode: 401, code, message });

export const forbidden = (code: ErrorCodeValue, message: string) =>
  new ForbiddenException({ statusCode: 403, code, message });

export const badRequest = (code: ErrorCodeValue, message: string) =>
  new BadRequestException({ statusCode: 400, code, message });
