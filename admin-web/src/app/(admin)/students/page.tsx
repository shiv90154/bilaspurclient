import type { Metadata } from "next";
import { StudentsView } from "@/components/admin/students-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Students" };

export default async function Page() {
  const user = await requireUser(["ADMIN", "FACULTY"]);
  return <StudentsView canEdit={user.role === "ADMIN"} />;
}
