import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/constants";
import {
  backendRequest,
  clearSessionCookies,
  isSameOrigin,
} from "@/lib/server/session";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ code: "BAD_ORIGIN" }, { status: 403 });
  }

  // Best effort: end the session on the server, but always clear our cookies.
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  if (access) {
    await backendRequest("/auth/logout", {
      method: "POST",
      accessToken: access,
    }).catch(() => undefined);
  }

  const response = new NextResponse(null, { status: 204 });
  clearSessionCookies(response);
  return response;
}
