import type { Metadata } from "next";
import { StudentDoubts } from "@/components/student/student-doubts";

export const metadata: Metadata = { title: "Doubts" };

export default function Page() {
  return <StudentDoubts />;
}
