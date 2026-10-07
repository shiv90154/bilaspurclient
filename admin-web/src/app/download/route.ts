import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/config";
import { backendRequest } from "@/lib/server/session";

/**
 * Public "Download app" link on the website: streams the newest APK, no login needed.
 * The backend hands out a short-lived signed link; the file is streamed through here so the
 * visitor never needs the API's own address.
 */
export async function GET() {
  const meta = await backendRequest("/app-releases/latest/download-url").catch(() => null);
  if (!meta?.ok) {
    // Relative on purpose: behind Nginx the request URL carries the internal host.
    return new Response(null, { status: 302, headers: { location: "/?app=soon#app" } });
  }
  const { url } = (await meta.json()) as { url: string };
  const file = await fetch(`${BACKEND_URL}${url.replace(/^\/api/, "")}`, { cache: "no-store" });
  if (!file.ok || !file.body) return NextResponse.json({ code: "DOWNLOAD_FAILED" }, { status: 502 });

  const headers = new Headers({ "cache-control": "no-store", "x-content-type-options": "nosniff" });
  for (const h of ["content-type", "content-length", "content-disposition"]) {
    const v = file.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(file.body, { status: 200, headers });
}
