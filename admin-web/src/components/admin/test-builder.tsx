"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  api,
  qs,
  type Batch,
  type Paginated,
  type Question,
  type TestDetail,
  type TestSeries,
  type TestResults,
} from "@/lib/api";
import { Badge, btnGhost, btnPrimary, ErrorNote, inputCls, Modal } from "@/components/ui";
import { useSubjects } from "./question-bank-view";
import { STATUS_TONE } from "./tests-view";

interface Picked {
  questionId: string;
  text: string;
  marks: number;
}

export function TestBuilder({ id }: { id: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const test = useQuery({ queryKey: ["test", id], queryFn: () => api<TestDetail>(`/tests/${id}`) });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["test", id] });
    void qc.invalidateQueries({ queryKey: ["tests"] });
  };
  const act = useMutation({
    mutationFn: (a: "publish" | "close") => api(`/tests/${id}/${a}`, { method: "POST" }),
    onSuccess: refresh,
  });
  const series = useQuery({ queryKey: ["test-series"], queryFn: () => api<TestSeries[]>("/test-series") });
  const moveSeries = useMutation({
    mutationFn: (seriesId: string | null) => api(`/tests/${id}`, { method: "PATCH", body: { seriesId } }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => api(`/tests/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tests"] });
      router.push("/tests");
    },
  });

  const t = test.data;
  if (test.isPending) return <p className="text-[13px] text-sub">Loading…</p>;
  if (!t) return <ErrorNote error={test.error} />;

  const locked = t.status === "CLOSED" || t._count.attempts > 0;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/tests" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-sub hover:text-ink">
        <ArrowLeft size={15} /> Tests
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[23px] font-bold">{t.title}</h1>
            <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
          </div>
          <p className="mt-1 text-[13px] text-sub">
            {t.durationMin} min · {Number(t.totalMarks)} marks · negative {Number(t.negativeMark)}
            {t.startAt && ` · opens ${format(new Date(t.startAt), "d MMM yyyy, h:mm a")}`}
            {t.endAt && ` · closes ${format(new Date(t.endAt), "d MMM yyyy, h:mm a")}`}
          </p>
          <label className="mt-2 flex items-center gap-2 text-[12.5px] text-sub">
            Series
            <select aria-label="Test series" className={inputCls + " !h-8 max-w-64"} value={t.series?.id ?? ""}
              disabled={moveSeries.isPending} onChange={(e) => moveSeries.mutate(e.target.value || null)}>
              <option value="">None (stand-alone)</option>
              {series.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          {t.status === "DRAFT" && (
            <button className={btnPrimary} disabled={act.isPending} onClick={() => window.confirm("Publish? Students of the assigned batches will see it.") && act.mutate("publish")}>
              Publish
            </button>
          )}
          {t.status === "PUBLISHED" && (
            <button className={btnGhost} disabled={act.isPending} onClick={() => window.confirm("Close this test? No new attempts; results become reviewable.") && act.mutate("close")}>
              Close test
            </button>
          )}
          {t._count.attempts === 0 && (
            <button className={btnGhost + " text-danger"} disabled={remove.isPending} onClick={() => window.confirm("Delete this test?") && remove.mutate()}>
              Delete
            </button>
          )}
        </div>
      </div>
      <ErrorNote error={act.error ?? remove.error ?? moveSeries.error} />
      {locked && t.status !== "CLOSED" && (
        <p className="rounded-[10px] bg-accent-tint px-3 py-2 text-[12.5px] text-accent-ink">
          Students have started this test, so questions can no longer change.
        </p>
      )}

      <QuestionsSection test={t} locked={locked} onSaved={refresh} />
      <BatchesSection test={t} locked={t.status === "CLOSED"} onSaved={refresh} />
      {t._count.attempts > 0 && <ResultsSection id={id} />}
    </div>
  );
}

function QuestionsSection({ test, locked, onSaved }: { test: TestDetail; locked: boolean; onSaved: () => void }) {
  const initial: Picked[] = test.questions.map((q) => ({ questionId: q.questionId, text: q.question.text, marks: Number(q.marks) }));
  const [picked, setPicked] = useState(initial);
  const [adding, setAdding] = useState(false);
  const dirty = JSON.stringify(picked) !== JSON.stringify(initial);

  const save = useMutation({
    mutationFn: () => api(`/tests/${test.id}/questions`, { method: "PUT", body: { questions: picked.map(({ questionId, marks }) => ({ questionId, marks })) } }),
    onSuccess: onSaved,
  });

  const move = (i: number, d: -1 | 1) =>
    setPicked((p) => {
      const j = i + d;
      if (j < 0 || j >= p.length) return p;
      const n = [...p];
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });

  const total = picked.reduce((s, q) => s + q.marks, 0);

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">Questions <span className="font-normal text-sub">· {picked.length} · {total} marks</span></h2>
        {!locked && (
          <div className="flex gap-2">
            <button className={btnGhost + " !h-9"} onClick={() => setAdding(true)}><Plus size={15} /> From bank</button>
            <button className={btnPrimary + " !h-9"} disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save questions"}
            </button>
          </div>
        )}
      </div>
      <ErrorNote error={save.error} />
      {picked.length === 0 && <p className="mt-3 text-[13px] text-sub">No questions yet.</p>}
      <ol className="mt-3 flex flex-col gap-2">
        {picked.map((q, i) => (
          <li key={q.questionId} className="flex items-center gap-2 rounded-[10px] border border-line px-3 py-2 text-[13px]">
            <span className="w-6 shrink-0 text-sub">{i + 1}.</span>
            <span className="min-w-0 flex-1 truncate" title={q.text}>{q.text}</span>
            {!locked ? (
              <>
                <input aria-label={`Marks for question ${i + 1}`} type="number" min={0.25} max={100} step="0.25" value={q.marks}
                  onChange={(e) => setPicked((p) => p.map((x, j) => j === i ? { ...x, marks: Number(e.target.value) || 1 } : x))}
                  className="h-8 w-16 rounded-lg border border-line px-2 text-[13px]" />
                <button aria-label="Move up" className="px-1 text-sub hover:text-ink" onClick={() => move(i, -1)}>↑</button>
                <button aria-label="Move down" className="px-1 text-sub hover:text-ink" onClick={() => move(i, 1)}>↓</button>
                <button aria-label="Remove question" className="p-1 text-danger" onClick={() => setPicked((p) => p.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
              </>
            ) : (
              <span className="text-sub">{q.marks} marks</span>
            )}
          </li>
        ))}
      </ol>
      {adding && (
        <BankPicker
          already={new Set(picked.map((p) => p.questionId))}
          onAdd={(qs_) => { setPicked((p) => [...p, ...qs_.map((q) => ({ questionId: q.id, text: q.text, marks: 1 }))]); setAdding(false); }}
          onClose={() => setAdding(false)}
        />
      )}
    </section>
  );
}

function BankPicker({ already, onAdd, onClose }: { already: Set<string>; onAdd: (q: Question[]) => void; onClose: () => void }) {
  const [subjectId, setSubjectId] = useState("");
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<Map<string, Question>>(new Map());
  const subjects = useSubjects();
  const list = useQuery({
    queryKey: ["questions", "picker", subjectId, search],
    queryFn: () => api<Paginated<Question>>(`/questions${qs({ limit: 50, subjectId, search, active: true })}`),
  });
  const rows = list.data?.items.filter((q) => !already.has(q.id)) ?? [];

  return (
    <Modal title="Add from question bank" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <select aria-label="Subject" className={inputCls} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input aria-label="Search" placeholder="Search" className={inputCls} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <ErrorNote error={list.error} />
        <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
          {rows.length === 0 && !list.isPending && <li className="text-[13px] text-sub">No more questions match.</li>}
          {rows.map((q) => (
            <li key={q.id}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-line px-3 py-2 text-[13px] hover:bg-bg">
                <input type="checkbox" className="mt-0.5" checked={sel.has(q.id)}
                  onChange={(e) => setSel((m) => { const n = new Map(m); if (e.target.checked) n.set(q.id, q); else n.delete(q.id); return n; })} />
                <span>
                  {q.text}
                  <span className="block text-[11.5px] text-sub">{q.topic.subject.name} › {q.topic.name} · {q.difficulty}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={sel.size === 0} onClick={() => onAdd([...sel.values()])}>Add {sel.size || ""} selected</button>
        </div>
      </div>
    </Modal>
  );
}

function BatchesSection({ test, locked, onSaved }: { test: TestDetail; locked: boolean; onSaved: () => void }) {
  const batches = useQuery({ queryKey: ["batches", "active"], queryFn: () => api<Paginated<Batch>>(`/batches${qs({ limit: 100, active: true })}`) });
  const initial = test.batches.map((b) => b.batch.id);
  const [sel, setSel] = useState(new Set(initial));
  const dirty = sel.size !== initial.length || initial.some((i) => !sel.has(i));

  const save = useMutation({
    mutationFn: () => api(`/tests/${test.id}/batches`, { method: "PUT", body: { batchIds: [...sel] } }),
    onSuccess: onSaved,
  });

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">Who can take it <span className="font-normal text-sub">· {sel.size} batches</span></h2>
        {!locked && <button className={btnPrimary + " !h-9"} disabled={!dirty || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save batches"}</button>}
      </div>
      <ErrorNote error={save.error ?? batches.error} />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {batches.data?.items.map((b) => (
          <label key={b.id} className="flex items-center gap-2.5 rounded-[10px] border border-line px-3 py-2 text-[13px]">
            <input type="checkbox" disabled={locked} checked={sel.has(b.id)}
              onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(b.id); else n.delete(b.id); return n; })} />
            <span>{b.name} <span className="text-sub">· {b.course?.name}</span></span>
          </label>
        ))}
      </div>
    </section>
  );
}

function ResultsSection({ id }: { id: string }) {
  const res = useQuery({ queryKey: ["test-results", id], queryFn: () => api<TestResults>(`/tests/${id}/results`), refetchInterval: 30_000 });
  const r = res.data;
  const mmss = (s: number | null) => (s === null ? "-" : `${Math.floor(s / 60)}m ${s % 60}s`);

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-[15px] font-bold">Results</h2>
      <ErrorNote error={res.error} />
      {r && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Submitted", r.summary.attempts], ["Average", r.summary.average], ["Highest", r.summary.highest], ["Lowest", r.summary.lowest]].map(([k, v]) => (
              <div key={String(k)} className="rounded-[10px] bg-bg p-3">
                <p className="text-[11.5px] text-sub">{k}</p>
                <p className="text-[18px] font-bold">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="text-[11.5px] uppercase text-sub">
                <tr><th className="py-2">#</th><th>Student</th><th>Score</th><th>%</th><th>✓ / ✗ / –</th><th>Time</th><th>Left app</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {r.rows.map((x) => (
                  <tr key={x.attemptId}>
                    <td className="py-2">{x.rank}</td>
                    <td>{x.name}<span className="block text-[11.5px] text-sub">{x.phone}</span></td>
                    <td className="font-semibold">{x.score} / {r.test.totalMarks}</td>
                    <td>{x.percentage}%</td>
                    <td>{x.correct} / {x.incorrect} / {x.unanswered}</td>
                    <td>{mmss(x.timeTakenSec)}{x.status === "AUTO_SUBMITTED" && <span className="ml-1 text-[11px] text-accent-ink">auto</span>}</td>
                    <td className={x.backgroundHits > 2 ? "font-semibold text-danger" : ""}>{x.backgroundHits}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {r.rows.length === 0 && <p className="py-3 text-[13px] text-sub">Nobody has submitted yet.</p>}
          </div>
        </>
      )}
    </section>
  );
}
