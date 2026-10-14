import type { Metadata } from "next";
import { StudentDetail } from "@/components/admin/student-detail";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Student" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }, user] = await Promise.all([params, searchParams, requireUser(["ADMIN", "FACULTY"])]);
  return <StudentDetail id={id} isAdmin={user.role === "ADMIN"} initialTab={tab === "documents" ? "documents" : undefined} />;
}
