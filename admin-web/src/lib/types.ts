export type Role = "ADMIN" | "FACULTY" | "STUDENT";

/** Mirrors `AuthProfile` returned by the backend (`GET /api/auth/me`). */
export interface AuthProfile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  studentId: string | null;
  watermark: { name: string; phone: string };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

/** Error body shape used by the backend (see backend/src/common/errors.ts). */
export interface ApiErrorBody {
  statusCode?: number;
  code?: string;
  message?: string | string[];
}
