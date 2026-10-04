import type { Metadata } from "next";
import { EnquiriesView } from "@/components/admin/enquiries-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Enquiries" };

export default async function Page() {
  const user = await requireUser(["ADMIN", "FACULTY"]);
  return <EnquiriesView canConvert={user.role === "ADMIN"} />;
}
