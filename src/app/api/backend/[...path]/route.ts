import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/constants";
import {
  backendRequest,
  clearSessionCookies,
  isSameOrigin,
  readError,
  refreshTokens,
  setSessionCookies,
} from "@/lib/server/session";
import type { TokenPair } from "@/lib/types";

/**
 * Same-origin proxy to the Node API: /api/backend/students -> {BACKEND}/students.
 * Adds the bearer token from the httpOnly cookie and transparently refreshes it.
 */

type Ctx = { params: Promise<{ path: string[] }> };

const BODY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PASS_THROUGH_HEADERS = [
  "content-type",
  "content-disposition",
  "cache-control",
  "etag",
  "last-modified",
];

async function handle(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  if (path.some((seg) => seg === ".." || seg === "." || seg.includes("\\"))) {
    return NextResponse.json({ code: "BAD_PATH" }, { status: 400 });
  }
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return NextResponse.json({ code: "BAD_ORIGIN" }, { status: 403 });
  }

  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  let rotated: TokenPair | undefined;

  const refreshNow = async (): Promise<boolean> => {
    if (!refresh) return false;
    const result = await refreshTokens(refresh);
    if (!result.ok) return false;
    rotated = result.tokens;
    access = result.tokens.accessToken;
    return true;
  };

  if (!access && !(await refreshNow())) {
    const response = NextResponse.json({ code: "UNAUTHENTICATED" }, { status: 401 });
    clearSessionCookies(response);
    return response;
  }

  const body = BODY_METHODS.has(request.method)
    ? await request.arrayBuffer()
    : undefined;
  const target = `/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const contentType = request.headers.get("content-type");

  const send = () =>
    backendRequest(target, {
      method: request.method,
      accessToken: access,
      headers: contentType ? { "content-type": contentType } : undefined,
      body,
    });

  let upstream: Response;
  try {
    upstream = await send();
    if (upstream.status === 401 && !rotated) {
      const err = await readError(upstream.clone());
      if (err.code === "TOKEN_EXPIRED" && (await refreshNow())) {
        upstream = await send();
      }
    }
  } catch {
    return NextResponse.json({ code: "BACKEND_UNREACHABLE" }, { status: 502 });
  }

  // Decide this BEFORE the body stream is handed to the response (it locks it).
  let sessionGone = false;
  if (upstream.status === 401) {
    const err = await readError(upstream.clone());
    sessionGone = err.code !== "TOKEN_EXPIRED";
  }

  const headers = new Headers();
  for (const name of PASS_THROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  const noBody = upstream.status === 204 || upstream.status === 304;
  const response = new NextResponse(noBody ? null : upstream.body, {
    status: upstream.status,
    headers,
  });

  if (rotated) setSessionCookies(response, rotated);
  // The session itself is gone (logged in elsewhere, revoked, ...): drop cookies.
  if (sessionGone) clearSessionCookies(response);
  return response;
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
