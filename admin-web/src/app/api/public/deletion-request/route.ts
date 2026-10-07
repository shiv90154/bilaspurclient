import { NextResponse, type NextRequest } from "next/server";
import { backendRequest, isSameOrigin } from "@/lib/server/session";

/**
 * The public account deletion form (/delete-account) posts here; no login needed.
 * Forwards to the backend with the visitor's IP so its rate limit applies per person.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ code: "BAD_ORIGIN" }, { status: 403 });
  }
  const body = await request.text();
  if (body.length > 4000) return NextResponse.json({ message: "Too long" }, { status: 413 });
  const forwarded = request.headers.get("x-forwarded-for");
  try {
    const res = await backendRequest("/privacy/deletion-request/public", {
      method: "POST",
      headers: { "content-type": "application/json", ...(forwarded ? { "x-forwarded-for": forwarded } : {}) },
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
