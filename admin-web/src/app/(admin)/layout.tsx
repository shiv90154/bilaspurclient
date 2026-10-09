import { AdminShell } from "@/components/admin/admin-shell";
import { getPublicInfo } from "@/lib/server/public-info";
import { requireUser } from "@/lib/server/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, info] = await Promise.all([requireUser(["ADMIN", "FACULTY"]), getPublicInfo()]);
  return (
    <AdminShell user={{ name: user.name, role: user.role }} maintenance={info.maintenanceMode}>
      {children}
    </AdminShell>
  );
}
