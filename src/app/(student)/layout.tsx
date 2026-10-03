import { StudentShell } from "@/components/student/student-shell";
import { requireUser } from "@/lib/server/session";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["STUDENT"]);
  return <StudentShell user={{ name: user.name }}>{children}</StudentShell>;
}
