import type { Metadata } from "next";
import { StudentPlaceholder } from "@/components/student/student-notice";

export const metadata: Metadata = { title: "Doubts" };

export default function Page() {
  return (
    <StudentPlaceholder
      title="Doubts"
      phase="Phase 2"
      text="Ask a doubt, follow the replies and track its status. See docs/05-student-doubts.md."
    />
  );
}
