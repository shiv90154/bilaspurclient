import type { Metadata } from "next";
import { VideosView } from "@/components/admin/videos-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Recorded videos" };

export default async function Page() {
  await requireUser(["ADMIN", "FACULTY"]);
  return <VideosView />;
}
