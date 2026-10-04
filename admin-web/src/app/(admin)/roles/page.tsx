import type { Metadata } from "next";
import { FacultyView } from "@/components/admin/faculty-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Roles & Access" };

export default async function Page() {
  await requireUser(["ADMIN"]);
  return <FacultyView />;
}
