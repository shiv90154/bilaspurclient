import type { Metadata } from "next";
import { TestBuildsView } from "@/components/admin/test-builds-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "App test builds" };

export default async function Page() {
  await requireUser(["ADMIN"]);
  return <TestBuildsView />;
}
