import type { Metadata } from "next";
import { QuestionBankView } from "@/components/admin/question-bank-view";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Question bank" };

export default async function Page() {
  const user = await requireUser(["ADMIN", "FACULTY"]);
  return <QuestionBankView isAdmin={user.role === "ADMIN"} />;
}
