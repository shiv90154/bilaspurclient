import type { Metadata } from "next";
import { TestsView } from "@/components/admin/tests-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Tests" };

export default async function Page() {
  await requireUser(["ADMIN", "FACULTY"]);
  return <TestsView />;
}
