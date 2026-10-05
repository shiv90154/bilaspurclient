import type { Metadata } from "next";
import { AppDownloadView } from "@/components/admin/app-download-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Mobile app" };

export default async function Page() {
  await requireUser(["ADMIN"]);
  return <AppDownloadView />;
}
