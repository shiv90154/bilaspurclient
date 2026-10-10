import type { Metadata } from "next";
import { ReportsView } from "@/components/admin/reports-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Reports" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser(["ADMIN", "FACULTY"]);
  return <ReportsView isAdmin={user.role === "ADMIN"} initialTab={(await searchParams).tab} />;
}
