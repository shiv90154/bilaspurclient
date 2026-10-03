import type { Metadata } from "next";
import { StudentPlaceholder } from "@/components/student/student-notice";

export const metadata: Metadata = { title: "Classes" };

export default function Page() {
  return (
    <StudentPlaceholder
      title="Classes"
      phase="Phase 3"
      text="Upcoming and live classes for your batch, with a Join button. See docs/03-online-classes.md."
    />
  );
}
