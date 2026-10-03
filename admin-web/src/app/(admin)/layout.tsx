import { AdminShell } from "@/components/admin/admin-shell";
import { requireUser } from "@/lib/server/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["ADMIN", "FACULTY"]);
  return <AdminShell user={{ name: user.name, role: user.role }}>{children}</AdminShell>;
}
