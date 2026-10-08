import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE } from "./lib/constants";

/**
 * Runs before every page request (not /api, not static files).
 * - sends visitors without a session to /login
 * - exposes the path to server components (used for post-refresh redirects)
 * Real authentication/role checks happen in the layouts (requireUser).
 */
const PUBLIC_PATHS = new Set(["/", "/about", "/courses", "/features", "/app", "/contact", "/download", "/login", "/register", "/forgot-password", "/privacy", "/terms", "/delete-account"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // The public website, login and the legal pages (Play Store needs the privacy policy and the account deletion
  // page reachable without an account).
  const isPublic = PUBLIC_PATHS.has(pathname);
  const hasSession = request.cookies.has(REFRESH_COOKIE);

  if (!hasSession && !isPublic) {
    const login = new URL("/login", request.url);
    // Come back here after login (e.g. "Join now" on the website → /learn/fees?plan=…).
    if (pathname.startsWith("/learn")) login.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }

  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
