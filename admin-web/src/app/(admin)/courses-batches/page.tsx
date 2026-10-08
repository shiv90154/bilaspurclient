import type { Metadata } from "next";
import { CoursesView } from "@/components/admin/courses-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Courses & batches" };

export default async function Page() {
  const user = await requireUser(["ADMIN", "FACULTY"]);
  return <CoursesView canEdit={user.role === "ADMIN"} />;
}
