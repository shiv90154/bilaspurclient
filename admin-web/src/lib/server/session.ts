/**
 * Server-only session helpers (route handlers + server components).
 *
 * The browser never sees an API token: access/refresh tokens live in httpOnly
 * cookies set here, and every API call goes through /api/backend/* which
 * attaches the bearer token. That keeps tokens out of reach of XSS.
 */
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL } from "../config";
import { ACCESS_COOKIE, REFRESH_COOKIE, ROLE_HOME } from "../constants";
import type { ApiErrorBody, AuthProfile, Role, TokenPair } from "../types";

const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const secure = process.env.NODE_ENV === "production";

// ───────────── cookies ─────────────

export function setSessionCookies(res: NextResponse, tokens: TokenPair) {
  const base = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
  res.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: tokens.expiresIn,
  });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
}

/** CSRF defence for state-changing requests: Origin must match our own. */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

// ───────────── talking to the backend ─────────────

export async function backendRequest(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<Response> {
  const { accessToken, headers: extra, ...rest } = init;
  const reqHeaders = new Headers(extra);
  if (accessToken) reqHeaders.set("authorization", `Bearer ${accessToken}`);
  return fetch(`${BACKEND_URL}${path}`, {
    ...rest,
    headers: reqHeaders,
    cache: "no-store",
  });
}

export async function readError(res: Response): Promise<ApiErrorBody> {
  return ((await res.json().catch(() => ({}))) ?? {}) as ApiErrorBody;
}

// ───────────── refresh (single flight) ─────────────

export type RefreshResult =
  | { ok: true; tokens: TokenPair }
  | { ok: false; code: string };

const inflight = new Map<string, Promise<RefreshResult>>();
const recent = new Map<string, { at: number; result: RefreshResult }>();
const RECENT_MS = 10_000;

async function callRefresh(refreshToken: string): Promise<RefreshResult> {
  try {
    const res = await backendRequest("/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (res.ok) return { ok: true, tokens: (await res.json()) as TokenPair };
    return { ok: false, code: (await readError(res)).code ?? "REFRESH_FAILED" };
  } catch {
    return { ok: false, code: "BACKEND_UNREACHABLE" };
  }
}

/**
 * Refresh tokens rotate and the backend treats a replayed one as theft, so
 * parallel requests that all notice an expired access token must share ONE
 * refresh call. Results are kept for a few seconds so late arrivals that still
 * carry the old cookie get the new tokens instead of triggering theft logic.
 */
export function refreshTokens(refreshToken: string): Promise<RefreshResult> {
  const now = Date.now();
  for (const [key, entry] of recent) {
    if (now - entry.at > RECENT_MS) recent.delete(key);
  }
  const cached = recent.get(refreshToken);
  if (cached) return Promise.resolve(cached.result);

  let pending = inflight.get(refreshToken);
  if (!pending) {
    pending = callRefresh(refreshToken)
      .then((result) => {
        if (result.ok || result.code !== "BACKEND_UNREACHABLE") {
          recent.set(refreshToken, { at: Date.now(), result });
        }
        return result;
      })
      .finally(() => inflight.delete(refreshToken));
    inflight.set(refreshToken, pending);
  }
  return pending;
}

// ───────────── for server components ─────────────

export type SessionState =
  | { status: "ok"; user: AuthProfile }
  | { status: "needs-refresh" }
  | { status: "anonymous"; reason?: string };

export async function getSessionUser(): Promise<SessionState> {
  const store = await cookies();
  const access = store.get(ACCESS_COOKIE)?.value;
  const refresh = store.get(REFRESH_COOKIE)?.value;

  if (!access) {
    return refresh ? { status: "needs-refresh" } : { status: "anonymous" };
  }

  try {
    const res = await backendRequest("/auth/me", { accessToken: access });
    if (res.ok) return { status: "ok", user: (await res.json()) as AuthProfile };
    const body = await readError(res);
    if (res.status === 401 && body.code === "TOKEN_EXPIRED" && refresh) {
      return { status: "needs-refresh" };
    }
    return { status: "anonymous", reason: body.code };
  } catch {
    return { status: "anonymous", reason: "BACKEND_UNREACHABLE" };
  }
}

/** Use at the top of a protected layout. Redirects instead of returning when not allowed. */
export async function requireUser(allowed: Role[]): Promise<AuthProfile> {
  const state = await getSessionUser();

  if (state.status === "needs-refresh") {
    const path = (await headers()).get("x-pathname") ?? "/";
    redirect(`/api/session/refresh?next=${encodeURIComponent(path)}`);
  }
  if (state.status === "anonymous") {
    redirect(state.reason ? `/login?reason=${state.reason}` : "/login");
  }
  if (!allowed.includes(state.user.role)) {
    redirect(ROLE_HOME[state.user.role]);
  }
  return state.user;
}
