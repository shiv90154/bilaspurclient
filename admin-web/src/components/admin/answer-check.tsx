"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api, fileHref, type AnswerSheet } from "@/lib/api";
import { Badge, btnGhost, btnPrimary, ErrorNote, inputCls } from "@/components/ui";

/** The teacher reads one student's written answers and gives marks. */
export function AnswerCheck({ testId, attemptId }: { testId: string; attemptId: string }) {
  const sheet = useQuery({
    queryKey: ["answer-sheet", attemptId],
    queryFn: () => api<AnswerSheet>(`/tests/${testId}/attempts/${attemptId}`),
  });

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/tests/${testId}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-sub hover:text-ink">
        <ArrowLeft size={15} /> Back to the test
      </Link>
      {sheet.isPending && <p className="text-[13px] text-sub">Loading…</p>}
      <ErrorNote error={sheet.error} />
      {sheet.data && <Sheet testId={testId} data={sheet.data} />}
    </div>
  );
}

interface Mark {
  awarded: string;
  feedback: string;
}

function Sheet({ testId, data }: { testId: string; data: AnswerSheet }) {
  const qc = useQueryClient();
  const a = data.attempt;
  const [marks, setMarks] = useState<Record<string, Mark>>(() =>
    Object.fromEntries(
      data.questions.map((q) => [q.questionId, { awarded: q.awardedMarks?.toString() ?? "", feedback: q.feedback ?? "" }]),
    ),
  );
  const [localError, setLocalError] = useState("");
  const [saved, setSaved] = useState("");

  const save = useMutation({
    mutationFn: (done: boolean) =>
      api<AnswerSheet>(`/tests/${testId}/attempts/${a.id}/marks`, {
        method: "PUT",
        body: {
          done,
          marks: data.questions
            .filter((q) => marks[q.questionId]!.awarded.trim() !== "")
            .map((q) => ({
              questionId: q.questionId,
              awarded: Number(marks[q.questionId]!.awarded),
              feedback: marks[q.questionId]!.feedback.trim() || null,
            })),
        },
      }),
    onSuccess: (fresh, done) => {
      qc.setQueryData(["answer-sheet", a.id], fresh);
      void qc.invalidateQueries({ queryKey: ["test-results", testId] });
      setSaved(done ? "Checking finished. The student can see the result now." : "Marks saved.");
    },
  });

  const submit = (done: boolean) => {
    setSaved("");
    for (const q of data.questions) {
      const v = marks[q.questionId]!.awarded.trim();
      if (v === "") {
        if (done && q.answered) return setLocalError("Give marks to every answer before finishing.");
        continue;
      }
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > q.maxMarks) {
        return setLocalError(`Marks must be between 0 and ${q.maxMarks}.`);
      }
    }
    setLocalError("");
    save.mutate(done);
  };

  const given = data.questions.reduce((s, q) => s + (Number(marks[q.questionId]!.awarded) || 0), 0);
  const writtenMax = data.questions.reduce((s, q) => s + q.maxMarks, 0);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="break-words text-[20px] font-bold sm:text-[23px]">{a.name}</h1>
            {a.evaluation === "PENDING" ? <Badge tone="amber">To check</Badge> : <Badge tone="green">Checked</Badge>}
            {a.endReason === "LEFT_APP" && <Badge tone="red">Auto-submitted: left the app</Badge>}
            {a.endReason === "TIME_UP" && <Badge tone="gray">Auto-submitted: time up</Badge>}
          </div>
          <p className="mt-1 text-[13px] text-sub">
            {data.test.title} · {a.phone}
            {a.submittedAt && ` · submitted ${format(new Date(a.submittedAt), "d MMM yyyy, h:mm a")}`} · left the app {a.leaves}×
          </p>
          <p className="mt-1 text-[13px] text-sub">
            MCQ: {a.correct} right, {a.incorrect} wrong · written: {given} / {writtenMax}
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-4">
        {data.questions.map((q, i) => {
          const m = marks[q.questionId]!;
          const set = (patch: Partial<Mark>) => setMarks((p) => ({ ...p, [q.questionId]: { ...m, ...patch } }));
          return (
            <li key={q.questionId} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
              <p className="text-[12px] font-semibold text-sub">Question {i + 1} · {q.maxMarks} marks</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-[14px] font-semibold">{q.text}</p>
              {q.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileHref(q.imageUrl)} alt="Question figure" className="mt-2 max-h-48 max-w-full rounded-[10px] border border-line" />
              )}

              <div className="mt-3 rounded-[10px] bg-bg p-3">
                <p className="text-[11.5px] font-semibold uppercase text-sub">Student’s answer</p>
                {!q.answered && <p className="mt-1 text-[13px] text-sub">Not answered.</p>}
                {q.textAnswer?.trim() && <p className="mt-1 whitespace-pre-wrap break-words text-[13.5px]">{q.textAnswer}</p>}
                {q.images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {q.images.map((src, j) => (
                      <a key={src} href={fileHref(src)} target="_blank" rel="noreferrer" title="Open full size">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fileHref(src)} alt={`Answer photo ${j + 1}`} className="h-40 max-w-full rounded-[10px] border border-line object-cover" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {q.modelAnswer && (
                <p className="mt-2 whitespace-pre-wrap text-[12.5px] text-sub">
                  <b>Model answer:</b> {q.modelAnswer}
                </p>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr]">
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-sub">
                  Marks (0–{q.maxMarks})
                  <input type="number" min={0} max={q.maxMarks} step="0.25" inputMode="decimal" value={m.awarded}
                    placeholder={q.answered ? "" : "0"} onChange={(e) => set({ awarded: e.target.value })} className={inputCls} />
                </label>
                <label className="flex flex-col gap-1 text-[12px] font-semibold text-sub">
                  Feedback for the student (optional)
                  <input value={m.feedback} maxLength={2000} onChange={(e) => set({ feedback: e.target.value })} className={inputCls} />
                </label>
              </div>
            </li>
          );
        })}
      </ol>

      <ErrorNote error={localError ? new Error(localError) : save.error} />
      {saved && <p className="rounded-[10px] bg-success-tint px-3 py-2 text-[13px] text-success">{saved}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button className={btnGhost} disabled={save.isPending} onClick={() => submit(false)}>Save</button>
        <button className={btnPrimary} disabled={save.isPending} onClick={() => submit(true)}>
          {save.isPending ? "Saving…" : a.evaluation === "DONE" ? "Save & update result" : "Save & finish checking"}
        </button>
      </div>
    </>
  );
}
