import type { Metadata } from "next";
import { DeletionRequestsView } from "@/components/admin/deletion-requests-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Deletion requests" };

export default async function Page() {
  await requireUser(["ADMIN"]);
  return <DeletionRequestsView />;
}
