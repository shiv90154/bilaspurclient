import { NextResponse, type NextRequest } from "next/server";
import { backendRequest, isSameOrigin } from "@/lib/server/session";

/**
 * Public (no login) sign-up and forgot-password calls from /register and /forgot-password.
 * Only these backend routes are reachable this way; the visitor's IP is passed on so the
 * backend's per-IP rate limits apply to each person.
 */
const ALLOWED = new Set([
  "GET courses",
  "POST register/start",
  "POST register/resend",
  "POST register/verify",
  "POST password/forgot",
  "POST password/reset",
]);

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, ctx: Ctx) {
  const path = (await ctx.params).path.join("/");
  if (!ALLOWED.has(`${request.method} ${path}`)) return NextResponse.json({ code: "NOT_FOUND" }, { status: 404 });
  if (request.method !== "GET" && !isSameOrigin(request)) {
    return NextResponse.json({ code: "BAD_ORIGIN" }, { status: 403 });
  }
  const body = request.method === "GET" ? undefined : await request.text();
  if (body && body.length > 4000) return NextResponse.json({ message: "Too long" }, { status: 413 });
  const forwarded = request.headers.get("x-forwarded-for");
  try {
    const res = await backendRequest(`/account/${path}`, {
      method: request.method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(forwarded ? { "x-forwarded-for": forwarded } : {}),
      },
      body,
    });
    return new NextResponse(await res.text(), {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ code: "BACKEND_UNREACHABLE", message: "The server is not reachable right now." }, { status: 502 });
  }
}

export { handle as GET, handle as POST };
