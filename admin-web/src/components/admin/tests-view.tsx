"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ClipboardCheck, Layers, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, qs, type Paginated, type TestRow, type TestSeries, type TestStatus } from "@/lib/api";
import { Badge, btnGhost, btnPrimary, EmptyState, ErrorNote, Field, inputCls, ListSkeleton, Modal, PageHeader, Pager } from "@/components/ui";
import { plural } from "@/lib/format";

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
  const [managing, setManaging] = useState(false);
  const [seriesId, setSeriesId] = useState("");

  const series = useQuery({ queryKey: ["test-series"], queryFn: () => api<TestSeries[]>("/test-series") });

  const list = useQuery({
    queryKey: ["tests", { page, status, seriesId }],
    queryFn: () => api<Paginated<TestRow>>(`/tests${qs({ page, limit: LIMIT, status, seriesId })}`),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Tests"
        subtitle="Build a test from the question bank, assign batches, publish. Scoring and the timer run on the server."
        action={
          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={() => setManaging(true)}><Layers size={15} /> Test series</button>
            <button className={btnPrimary} onClick={() => setCreating(true)}>
              <Plus size={16} /> New test
            </button>
          </div>
        }
      />
      <div className="flex flex-wrap gap-3">
        <select aria-label="Status" className={inputCls + " sm:!w-48"} value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select aria-label="Series" className={inputCls + " sm:!w-60"} value={seriesId}
          onChange={(e) => { setSeriesId(e.target.value); setPage(1); }}>
          <option value="">All series</option>
          {series.data?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>

      <ErrorNote error={list.error} />
      {list.isPending && <ListSkeleton />}
      {list.data?.items.length === 0 && (
        <EmptyState
          icon={ClipboardCheck}
          title={status || seriesId ? "No test matches" : "No tests yet"}
          text={status || seriesId ? "Try a different filter." : "Build a test from your question bank, choose the batches that can take it and publish. Marking and the timer run on the server."}
          action={status || seriesId ? undefined : <button className={btnPrimary} onClick={() => setCreating(true)}><Plus size={16} /> New test</button>}
        />
      )}

      <ul className="flex flex-col gap-3">
        {list.data?.items.map((t) => (
          <li key={t.id}>
            <Link href={`/tests/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-primary">
              <div>
                <p className="text-[14.5px] font-bold">{t.title}</p>
                {t.series && <p className="mt-0.5 text-[11.5px] font-semibold text-primary">{t.series.name}</p>}
                <p className="mt-0.5 text-[12.5px] text-sub">
                  {t.durationMin} min · {plural(t._count.questions, "question")} · {Number(t.totalMarks)} marks
                  {t.startAt && ` · opens ${format(new Date(t.startAt), "d MMM, h:mm a")}`}
                </p>
              </div>
              <div className="flex items-center gap-3 text-[12.5px] text-sub">
                <span>{plural(t._count.batches, "batch", "batches")}</span>
                <span>{plural(t._count.attempts, "attempt")}</span>
                <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {list.data && <Pager page={page} limit={LIMIT} total={list.data.total} onPage={setPage} />}
      {creating && <CreateTest series={series.data ?? []} onClose={() => setCreating(false)} />}
      {managing && <SeriesManager onClose={() => setManaging(false)} />}
    </div>
  );
}

function CreateTest({ series, onClose }: { series: TestSeries[]; onClose: () => void }) {
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
      seriesId: String(f.get("seriesId") ?? "") || undefined,
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
        <Field label="Test series">
          {(id) => (
            <select id={id} name="seriesId" defaultValue="" className={inputCls}>
              <option value="">None (stand-alone test)</option>
              {series.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          )}
        </Field>
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

/** Create, rename and archive test series. Archiving keeps every test; they just lose the label. */
function SeriesManager({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["test-series"], queryFn: () => api<TestSeries[]>("/test-series") });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["test-series"] });
    void qc.invalidateQueries({ queryKey: ["tests"] });
  };
  const create = useMutation({
    mutationFn: (body: unknown) => api("/test-series", { method: "POST", body }),
    onSuccess: refresh,
  });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => api(`/test-series/${id}`, { method: "PATCH", body }),
    onSuccess: refresh,
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    create.mutate(
      { name: String(f.get("name")).trim(), description: String(f.get("description") ?? "").trim() || undefined },
      { onSuccess: () => form.reset() },
    );
  };

  return (
    <Modal title="Test series" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-sub">
          A series bundles tests under one name, like “NEET Mock Series 2027”. Students see their tests grouped by series.
        </p>
        <ErrorNote error={list.error ?? create.error ?? patch.error} />
        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {list.data?.length === 0 && <li className="text-[13px] text-sub">No series yet. Create the first one below.</li>}
          {list.data?.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-line px-3 py-2 text-[13px]">
              <span>
                <span className="font-semibold">{x.name}</span>
                <span className="ml-2 text-sub">{plural(x._count?.tests ?? 0, "test")}</span>
                {x.description && <span className="block text-[12px] text-sub">{x.description}</span>}
              </span>
              <span className="flex shrink-0 gap-1.5">
                <button className="text-[12px] font-semibold text-primary"
                  onClick={() => {
                    const name = window.prompt("Rename series", x.name)?.trim();
                    if (name && name !== x.name) patch.mutate({ id: x.id, body: { name } });
                  }}>
                  Rename
                </button>
                <button className="text-[12px] font-semibold text-danger"
                  onClick={() => window.confirm(`Archive "${x.name}"? Its tests are kept.`) && patch.mutate({ id: x.id, body: { active: false } })}>
                  Archive
                </button>
              </span>
            </li>
          ))}
        </ul>
        <form onSubmit={onSubmit} className="flex flex-col gap-3 border-t border-line pt-3">
          <p className="text-[12px] font-semibold text-sub">New series</p>
          <input name="name" required maxLength={120} aria-label="Series name" placeholder="NEET Mock Series 2027" className={inputCls} />
          <input name="description" maxLength={1000} aria-label="Description" placeholder="Short description (optional)" className={inputCls} />
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={onClose}>Close</button>
            <button className={btnPrimary} disabled={create.isPending}>{create.isPending ? "Creating…" : "Create series"}</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
