import type { Metadata } from "next";
import { AndroidOnlyNotice } from "@/components/student/student-notice";

export const metadata: Metadata = { title: "Notes" };

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[18px] font-bold">Notes</h1>
      <AndroidOnlyNotice what="Study notes" />
    </div>
  );
}
