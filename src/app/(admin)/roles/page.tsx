import type { Metadata } from "next";
import { ModulePage } from "@/components/module-page";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Roles & Access" };

export default async function Page() {
  await requireUser(["ADMIN"]);
  return <ModulePage module="roles" />;
}
