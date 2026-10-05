import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE } from "@/lib/constants";
import {
  clearSessionCookies,
  refreshTokens,
  setSessionCookies,
} from "@/lib/server/session";

/**
 * Server components cannot set cookies, so when they notice an expired access
 * token they redirect here. We refresh, set the cookies and send the user back.
 */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("next") ?? "/";
  const next =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";

  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const result = await refreshTokens(refresh);
  if (!result.ok) {
    const response = NextResponse.redirect(
      new URL(`/login?reason=${encodeURIComponent(result.code)}`, request.url),
    );
    clearSessionCookies(response);
    return response;
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  setSessionCookies(response, result.tokens);
  return response;
}
