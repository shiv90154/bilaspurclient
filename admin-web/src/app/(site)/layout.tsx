import { headers } from "next/headers";
import { MaintenanceScreen } from "@/components/site/maintenance-screen";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getPublicInfo } from "@/lib/server/public-info";
import { hasSessionCookie } from "@/lib/server/session";

/** Legal pages stay open during maintenance: the Play Store listing links to them. */
const OPEN_IN_MAINTENANCE = new Set(["/privacy", "/terms", "/delete-account"]);

/** Public website: same navbar and footer on every page. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [info, h, signedIn] = await Promise.all([getPublicInfo(), headers(), hasSessionCookie()]);
  if (info.maintenanceMode && !OPEN_IN_MAINTENANCE.has(h.get("x-pathname") ?? "")) {
    return <MaintenanceScreen message={info.maintenanceMessage} />;
  }
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <SiteHeader signedIn={signedIn} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
