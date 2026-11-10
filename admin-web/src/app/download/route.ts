import { SITE } from "@/lib/site";

/**
 * Old "Download app" link (WhatsApp messages, posters, and the Update button in older app
 * builds point here). The app is only on Google Play now, so this just sends people there.
 */
export function GET() {
  return new Response(null, { status: 302, headers: { location: SITE.playStore, "cache-control": "no-store" } });
}
