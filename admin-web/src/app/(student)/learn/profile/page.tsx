import type { Metadata } from "next";
import { StudentProfile } from "@/components/student/student-profile";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  await requireUser(["STUDENT"]);
  return <StudentProfile />;
}
