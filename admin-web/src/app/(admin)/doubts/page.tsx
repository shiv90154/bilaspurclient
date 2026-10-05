import type { Metadata } from "next";
import { DoubtsView } from "@/components/admin/doubts-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Doubts" };

export default async function Page() {
  const user = await requireUser(["ADMIN", "FACULTY"]);
  return <DoubtsView isAdmin={user.role === "ADMIN"} />;
}
