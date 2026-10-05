import type { Metadata } from "next";
import { MaterialsView } from "@/components/admin/materials-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Study material" };

export default async function Page() {
  await requireUser(["ADMIN", "FACULTY"]);
  return <MaterialsView />;
}
