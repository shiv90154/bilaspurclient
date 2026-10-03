import type { Role } from '../../generated/prisma/enums.js';

/** Attached to `request.user` by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  role: Role;
  sessionId: string;
  name: string;
}

/** Claims inside the short-lived access token. */
export interface AccessTokenPayload {
  sub: string; // user id
  role: Role;
  sid: string; // session id (checked against DB on every request)
}
