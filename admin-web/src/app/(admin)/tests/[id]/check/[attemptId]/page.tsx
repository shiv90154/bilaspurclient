import type { Metadata } from "next";
import { AnswerCheck } from "@/components/admin/answer-check";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Check answers" };

export default async function Page({ params }: { params: Promise<{ id: string; attemptId: string }> }) {
  const [{ id, attemptId }] = await Promise.all([params, requireUser(["ADMIN", "FACULTY"])]);
  return <AnswerCheck testId={id} attemptId={attemptId} />;
}
