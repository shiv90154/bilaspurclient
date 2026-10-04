import type { Metadata } from "next";
import { StudentDetail } from "@/components/admin/student-detail";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Student" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, requireUser(["ADMIN", "FACULTY"])]);
  return <StudentDetail id={id} isAdmin={user.role === "ADMIN"} />;
}
