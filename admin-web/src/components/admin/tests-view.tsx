"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, qs, type Paginated, type TestRow, type TestStatus } from "@/lib/api";
import { Badge, btnGhost, btnPrimary, ErrorNote, Field, inputCls, Modal, PageHeader, Pager } from "@/components/ui";

export const STATUS_TONE: Record<TestStatus, "gray" | "green" | "amber"> = {
  DRAFT: "gray",
  PUBLISHED: "green",
  CLOSED: "amber",
};
const LIMIT = 15;

export function TestsView() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);

  const list = useQuery({
    queryKey: ["tests", { page, status }],
    queryFn: () => api<Paginated<TestRow>>(`/tests${qs({ page, limit: LIMIT, status })}`),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tests"
        subtitle="Build a test from the question bank, assign batches, publish. Scoring and the timer run on the server."
        action={
          <button className={btnPrimary} onClick={() => setCreating(true)}>
            <Plus size={16} /> New test
          </button>
        }
      />
      <select aria-label="Status" className={inputCls + " sm:!w-48"} value={status}
        onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
        <option value="">All statuses</option>
        <option value="DRAFT">Draft</option>
        <option value="PUBLISHED">Published</option>
        <option value="CLOSED">Closed</option>
      </select>

      <ErrorNote error={list.error} />
      {list.isPending && <p className="text-[13px] text-sub">Loading…</p>}
      {list.data?.items.length === 0 && (
        <p className="rounded-2xl border border-line bg-surface p-6 text-[13px] text-sub">No tests yet.</p>
      )}

      <ul className="flex flex-col gap-3">
        {list.data?.items.map((t) => (
          <li key={t.id}>
            <Link href={`/tests/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-primary">
              <div>
                <p className="text-[14.5px] font-bold">{t.title}</p>
                <p className="mt-0.5 text-[12.5px] text-sub">
                  {t.durationMin} min · {t._count.questions} questions · {Number(t.totalMarks)} marks
                  {t.startAt && ` · opens ${format(new Date(t.startAt), "d MMM, h:mm a")}`}
                </p>
              </div>
              <div className="flex items-center gap-3 text-[12.5px] text-sub">
                <span>{t._count.batches} batches</span>
                <span>{t._count.attempts} attempts</span>
                <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {list.data && <Pager page={page} limit={LIMIT} total={list.data.total} onPage={setPage} />}
      {creating && <CreateTest onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateTest({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (body: unknown) => api<{ id: string }>("/tests", { method: "POST", body }),
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: ["tests"] });
      router.push(`/tests/${t.id}`);
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const when = (k: string) => {
      const v = String(f.get(k) ?? "");
      return v ? new Date(v).toISOString() : undefined;
    };
    save.mutate({
      title: String(f.get("title")).trim(),
      durationMin: Number(f.get("durationMin")),
      negativeMark: Number(f.get("negativeMark") || 0),
      shuffleQuestions: f.get("shuffleQuestions") === "on",
      shuffleOptions: f.get("shuffleOptions") === "on",
      startAt: when("startAt"),
      endAt: when("endAt"),
    });
  };

  return (
    <Modal title="New test" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="Title *">{(id) => <input id={id} name="title" required maxLength={150} className={inputCls} />}</Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Duration (minutes) *">{(id) => <input id={id} name="durationMin" type="number" min={1} max={600} required defaultValue={60} className={inputCls} />}</Field>
          <Field label="Negative marks per wrong answer">{(id) => <input id={id} name="negativeMark" type="number" min={0} max={99} step="0.25" defaultValue={0} className={inputCls} />}</Field>
          <Field label="Opens at">{(id) => <input id={id} name="startAt" type="datetime-local" className={inputCls} />}</Field>
          <Field label="Closes at">{(id) => <input id={id} name="endAt" type="datetime-local" className={inputCls} />}</Field>
        </div>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="shuffleQuestions" /> Shuffle questions</label>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="shuffleOptions" /> Shuffle options</label>
        <ErrorNote error={save.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Creating…" : "Create & add questions"}</button>
        </div>
      </form>
    </Modal>
  );
}
