"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, CalendarPlus, ExternalLink, Pencil, Users, XCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  api,
  qs,
  type Batch,
  type ClassAttendance,
  type ClassRow,
  type ClassStatus,
  type FacultyRow,
  type Paginated,
} from "@/lib/api";
import { Badge, btnGhost, btnPrimary, EmptyState, ErrorNote, Field, inputCls, ListSkeleton, Modal, PageHeader, Pager } from "@/components/ui";

const TONE: Record<ClassStatus, "blue" | "green" | "gray" | "red"> = {
  SCHEDULED: "blue",
  LIVE: "green",
  ENDED: "gray",
  CANCELLED: "red",
};
const LIMIT = 20;

/** <input type="datetime-local"> wants local time without a zone. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

type Dialog = { kind: "create" } | { kind: "edit"; row: ClassRow } | { kind: "attendance"; row: ClassRow } | null;

export function ClassesView({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [page, setPage] = useState(1);
  const [batchId, setBatchId] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);

  const batches = useQuery({
    queryKey: ["batches", "active"],
    queryFn: () => api<Paginated<Batch>>(`/batches${qs({ limit: 100, active: true })}`),
  });

  const list = useQuery({
    queryKey: ["classes", { tab, page, batchId }],
    queryFn: () =>
      tab === "upcoming"
        ? // Live now and everything still ahead (the same set the dashboard counts), soonest first.
          api<Paginated<ClassRow>>(`/classes${qs({ page, limit: LIMIT, batchId, upcoming: true })}`)
        : api<Paginated<ClassRow>>(`/classes${qs({ page, limit: LIMIT, batchId, to: new Date().toISOString(), order: "desc" })}`),
    refetchInterval: 60_000,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api(`/classes/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["classes"] }),
  });

  const switchTab = (t: "upcoming" | "past") => {
    setTab(t);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Online classes"
        subtitle="Schedule Zoom / Meet classes for a batch. Students get a reminder 10 minutes before and an alert if it moves or is cancelled."
        action={
          <button className={btnPrimary} onClick={() => setDialog({ kind: "create" })}>
            <CalendarPlus size={16} /> Schedule class
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="inline-flex rounded-[10px] border border-line bg-surface p-1">
          {(["upcoming", "past"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => switchTab(t)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold ${tab === t ? "bg-primary text-white" : "text-sub"}`}>
              {t === "upcoming" ? "Live & upcoming" : "Past classes"}
            </button>
          ))}
        </div>
        <select aria-label="Batch" className={inputCls + " sm:!w-56"} value={batchId}
          onChange={(e) => { setBatchId(e.target.value); setPage(1); }}>
          <option value="">All batches</option>
          {batches.data?.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <ErrorNote error={list.error ?? cancel.error} />
      {list.isPending && <ListSkeleton />}
      {list.data?.items.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title={tab === "upcoming" ? "No class is scheduled" : "No past classes yet"}
          text={tab === "upcoming" ? "Schedule a Zoom or Google Meet class for a batch. Students are reminded 10 minutes before it starts." : "Classes that have finished or were cancelled show up here."}
          action={tab === "upcoming" ? <button className={btnPrimary} onClick={() => setDialog({ kind: "create" })}><CalendarPlus size={16} /> Schedule class</button> : undefined}
        />
      )}

      <ul className="flex flex-col gap-3">
        {list.data?.items.map((c) => (
          <li key={c.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14.5px] font-bold">{c.title}</p>
                  <Badge tone={TONE[c.status]}>{c.status === "LIVE" ? "Live now" : c.status.charAt(0) + c.status.slice(1).toLowerCase()}</Badge>
                  {c.seriesId && <Badge tone="gray">Weekly</Badge>}
                </div>
                <p className="mt-1 text-[12.5px] text-sub">
                  {format(new Date(c.startAt), "EEE d MMM, h:mm a")} – {format(new Date(c.endAt), "h:mm a")} · {c.batch.name}
                  {c.faculty && ` · ${c.faculty.user.name}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {c.joinUrl && c.status !== "CANCELLED" && (
                  <a href={c.joinUrl} target="_blank" rel="noopener noreferrer" className={btnGhost + " !h-8 !px-3"}>
                    <ExternalLink size={14} /> Open link
                  </a>
                )}
                <button className={btnGhost + " !h-8 !px-3"} onClick={() => setDialog({ kind: "attendance", row: c })}>
                  <Users size={14} /> Attendance
                </button>
                {(c.status === "SCHEDULED" || c.status === "LIVE") && (
                  <>
                    <button className={btnGhost + " !h-8 !px-3"} onClick={() => setDialog({ kind: "edit", row: c })}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button className={btnGhost + " !h-8 !px-3 text-danger"} disabled={cancel.isPending}
                      onClick={() => window.confirm(`Cancel "${c.title}"? Students will be notified.`) && cancel.mutate(c.id)}>
                      <XCircle size={14} /> Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {list.data && list.data.total > LIMIT && <Pager page={page} limit={LIMIT} total={list.data.total} onPage={setPage} />}

      {dialog?.kind === "create" && (
        <ClassForm batches={batches.data?.items ?? []} isAdmin={isAdmin} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "edit" && (
        <ClassForm row={dialog.row} batches={batches.data?.items ?? []} isAdmin={isAdmin} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "attendance" && <AttendanceDialog row={dialog.row} onClose={() => setDialog(null)} />}
    </div>
  );
}

function ClassForm({ row, batches, isAdmin, onClose }: { row?: ClassRow; batches: Batch[]; isAdmin: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const faculty = useQuery({
    queryKey: ["faculty"],
    queryFn: () => api<Paginated<FacultyRow>>(`/faculty${qs({ limit: 100 })}`),
    enabled: isAdmin,
  });
  const [repeat, setRepeat] = useState(false);

  const save = useMutation({
    mutationFn: (body: unknown) =>
      row ? api(`/classes/${row.id}`, { method: "PATCH", body }) : api("/classes", { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["classes"] });
      onClose();
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const iso = (k: string) => new Date(String(f.get(k))).toISOString();
    const facultyId = String(f.get("facultyId") ?? "") || undefined;
    if (row) {
      save.mutate({
        title: String(f.get("title")).trim(),
        startAt: iso("startAt"),
        endAt: iso("endAt"),
        joinUrl: String(f.get("joinUrl")).trim(),
        ...(isAdmin && facultyId && { facultyId }),
      });
    } else {
      const until = String(f.get("repeatUntil") ?? "");
      save.mutate({
        batchId: String(f.get("batchId")),
        title: String(f.get("title")).trim(),
        type: "ZOOM",
        startAt: iso("startAt"),
        endAt: iso("endAt"),
        joinUrl: String(f.get("joinUrl")).trim(),
        ...(isAdmin && facultyId && { facultyId }),
        ...(repeat && until && { repeatWeeklyUntil: new Date(`${until}T23:59:59`).toISOString() }),
      });
    }
  };

  return (
    <Modal title={row ? "Edit class" : "Schedule a class"} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        {!row && (
          <Field label="Batch *">
            {(id) => (
              <select id={id} name="batchId" required defaultValue="" className={inputCls}>
                <option value="" disabled>Select a batch</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}{b.course ? ` · ${b.course.name}` : ""}</option>)}
              </select>
            )}
          </Field>
        )}
        <Field label="Title *">
          {(id) => <input id={id} name="title" required maxLength={150} defaultValue={row?.title} placeholder="Physics: Kinematics" className={inputCls} />}
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Starts *">
            {(id) => <input id={id} name="startAt" type="datetime-local" required defaultValue={row ? toLocalInput(row.startAt) : ""} className={inputCls} />}
          </Field>
          <Field label="Ends *">
            {(id) => <input id={id} name="endAt" type="datetime-local" required defaultValue={row ? toLocalInput(row.endAt) : ""} className={inputCls} />}
          </Field>
        </div>
        <Field label="Zoom / Google Meet link *">
          {(id) => <input id={id} name="joinUrl" type="url" required maxLength={500} defaultValue={row?.joinUrl ?? ""} placeholder="https://zoom.us/j/…" pattern="https://.*" title="The link must start with https://" className={inputCls} />}
        </Field>
        {isAdmin && (
          <Field label="Teacher">
            {(id) => (
              <select id={id} name="facultyId" defaultValue={row?.faculty?.id ?? ""} className={inputCls}>
                <option value="">Not assigned</option>
                {faculty.data?.items.map((f) => <option key={f.id} value={f.id}>{f.user.name}</option>)}
              </select>
            )}
          </Field>
        )}
        {!row && (
          <div className="rounded-[10px] border border-line p-3">
            <label className="flex items-center gap-2 text-[13px] font-semibold">
              <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
              Repeat every week
            </label>
            {repeat && (
              <div className="mt-3">
                <Field label="Repeat until *">
                  {(id) => <input id={id} name="repeatUntil" type="date" required className={inputCls} />}
                </Field>
                <p className="mt-1.5 text-[11.5px] text-sub">Same weekday and time each week, up to 60 classes.</p>
              </div>
            )}
          </div>
        )}
        <ErrorNote error={save.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Close</button>
          <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Saving…" : row ? "Save changes" : "Schedule"}</button>
        </div>
      </form>
    </Modal>
  );
}

const mins = (s: number) => (s < 60 ? "<1 min" : `${Math.round(s / 60)} min`);

function AttendanceDialog({ row, onClose }: { row: ClassRow; onClose: () => void }) {
  const att = useQuery({ queryKey: ["class-attendance", row.id], queryFn: () => api<ClassAttendance>(`/classes/${row.id}/attendance`) });
  const a = att.data;
  return (
    <Modal title={`Attendance · ${row.title}`} onClose={onClose}>
      <ErrorNote error={att.error} />
      {att.isPending && <p className="text-[13px] text-sub">Loading…</p>}
      {a && (
        <div className="flex flex-col gap-4">
          <p className="text-[13px]">
            <span className="font-bold">{a.attended}</span> of {a.expected} students joined.
          </p>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11.5px] uppercase text-sub">
                <tr><th className="py-1.5">Student</th><th>Status</th><th>Joined</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {a.present.map((p) => (
                  <tr key={p.studentId}>
                    <td className="py-2">{p.name}<span className="block text-[11.5px] text-sub">{p.phone}</span></td>
                    <td><Badge tone="green">Present</Badge></td>
                    <td className="text-sub">{format(new Date(p.joinedAt), "h:mm a")} · {mins(p.durationSec)}</td>
                  </tr>
                ))}
                {a.absent.map((p) => (
                  <tr key={p.studentId}>
                    <td className="py-2">{p.name}<span className="block text-[11.5px] text-sub">{p.phone}</span></td>
                    <td><Badge tone="gray">Absent</Badge></td>
                    <td className="text-sub">-</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {a.expected === 0 && <p className="py-3 text-[13px] text-sub">No active students in this batch.</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}
