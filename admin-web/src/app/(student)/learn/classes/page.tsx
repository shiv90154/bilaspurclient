import type { Metadata } from "next";
import { StudentClasses } from "@/components/student/student-classes";

export const metadata: Metadata = { title: "Classes" };

export default function Page() {
  return <StudentClasses />;
}
