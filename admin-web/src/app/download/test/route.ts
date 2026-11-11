import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/config";
import { backendRequest } from "@/lib/server/session";

/**
 * Test build link for the client (dhiayurved.com/download/test): streams the newest test APK
 * ("1.7.0-test", uploaded on the admin panel's App test builds page). Students are never sent
 * here: the app's update check and /download only know the Play Store.
 */
export async function GET() {
  const meta = await backendRequest("/app-releases/test/download-url").catch(() => null);
  if (!meta?.ok) {
    return new NextResponse("No test build has been uploaded yet.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const { url } = (await meta.json()) as { url: string };
  const file = await fetch(`${BACKEND_URL}${url.replace(/^\/api/, "")}`, { cache: "no-store" });
  if (!file.ok || !file.body) return NextResponse.json({ code: "DOWNLOAD_FAILED" }, { status: 502 });

  const headers = new Headers({ "cache-control": "no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex" });
  for (const h of ["content-type", "content-length", "content-disposition"]) {
    const v = file.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(file.body, { status: 200, headers });
}
