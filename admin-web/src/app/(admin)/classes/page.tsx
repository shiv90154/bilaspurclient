import type { Metadata } from "next";
import { ClassesView } from "@/components/admin/classes-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Online classes" };

export default async function Page() {
  const user = await requireUser(["ADMIN", "FACULTY"]);
  return <ClassesView isAdmin={user.role === "ADMIN"} />;
}
