import type { Metadata } from "next";
import { SettingsView } from "@/components/admin/settings-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  const user = await requireUser(["ADMIN", "FACULTY"]);
  return <SettingsView isAdmin={user.role === "ADMIN"} />;
}
