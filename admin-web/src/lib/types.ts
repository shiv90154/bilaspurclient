export type Role = "ADMIN" | "FACULTY" | "STUDENT";

/** Mirrors `AuthProfile` returned by the backend (`GET /api/auth/me`). */
export interface AuthProfile {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  role: Role;
  studentId: string | null;
  watermark: { enabled: boolean; name: string; phone: string };
  /** A student who has not accepted the current terms yet; the student area asks first. */
  consentRequired: boolean;
  /** Self-registered, waiting for approval: demo content only. */
  demo: boolean;
  requestedCourse: { id: string; name: string } | null;
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
