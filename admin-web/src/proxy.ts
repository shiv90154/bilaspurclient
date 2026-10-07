import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE } from "./lib/constants";

/**
 * Runs before every page request (not /api, not static files).
 * - sends visitors without a session to /login
 * - exposes the path to server components (used for post-refresh redirects)
 * Real authentication/role checks happen in the layouts (requireUser).
 */
const PUBLIC_PATHS = new Set(["/login", "/register", "/forgot-password", "/privacy", "/terms", "/delete-account"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Login and the legal pages (Play Store needs the privacy policy and the account deletion
  // page reachable without an account).
  const isPublic = PUBLIC_PATHS.has(pathname);
  const hasSession = request.cookies.has(REFRESH_COOKIE);

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
