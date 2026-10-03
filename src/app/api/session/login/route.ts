import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  backendRequest,
  isSameOrigin,
  readError,
  setSessionCookies,
} from "@/lib/server/session";
import type { AuthProfile, TokenPair } from "@/lib/types";

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(100),
  password: z.string().min(6).max(128),
  deviceId: z.string().max(128).optional(),
  deviceName: z.string().max(100).optional(),
});

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ code: "BAD_ORIGIN" }, { status: 403 });
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Enter your phone/email and password" },
      { status: 400 },
    );
  }

  const forwarded = request.headers.get("x-forwarded-for");
  let res: Response;
  try {
    res = await backendRequest("/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(forwarded ? { "x-forwarded-for": forwarded } : {}),
        "user-agent": request.headers.get("user-agent") ?? "",
      },
      body: JSON.stringify({ ...parsed.data, platform: "WEB" }),
    });
  } catch {
    return NextResponse.json(
      { code: "BACKEND_UNREACHABLE", message: "Server is not reachable" },
      { status: 502 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(await readError(res), { status: res.status });
  }

  const { user, ...tokens } = (await res.json()) as TokenPair & {
    user: AuthProfile;
  };
  const response = NextResponse.json({ user });
  setSessionCookies(response, tokens);
  return response;
}
