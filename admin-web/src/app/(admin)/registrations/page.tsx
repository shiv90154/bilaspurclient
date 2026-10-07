import type { Metadata } from "next";
import { RegistrationsView } from "@/components/admin/registrations-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Registrations" };

export default async function Page() {
  await requireUser(["ADMIN"]);
  return <RegistrationsView />;
}
