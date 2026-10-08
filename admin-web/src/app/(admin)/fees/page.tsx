import type { Metadata } from "next";
import { FeesView } from "@/components/admin/fees-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Fees & payments" };

export default async function Page() {
  await requireUser(["ADMIN"]);
  return <FeesView />;
}
