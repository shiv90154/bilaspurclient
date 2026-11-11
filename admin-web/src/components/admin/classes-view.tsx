"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, CalendarPlus, CloudDownload, ExternalLink, Pencil, PlayCircle, Users, XCircle } from "lucide-react";
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

/** A video that can premiere: our own uploaded mp4 (links cannot be kept in sync). */
interface PremiereVideo {
  id: string;
  title: string;
  status: string;
  source: "file" | "link";
  durationSec: number | null;
}
const hm = (sec: number) => {
  const m = Math.ceil(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

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

  // Zoom normally sends the recording by itself; this asks Zoom right now.
  const [fetchNote, setFetchNote] = useState<string | null>(null);
  const fetchRecording = useMutation({
    mutationFn: (id: string) => api<{ found: number }>(`/classes/${id}/fetch-recording`, { method: "POST" }),
    onSuccess: (r) => {
      setFetchNote(
        r.found
          ? "Zoom recording found. It is being copied and will appear under Recorded videos in a few minutes."
          : "Zoom has no cloud recording for this class yet. Recording must be “In the cloud”; Zoom needs some time after the class ends.",
      );
      void qc.invalidateQueries({ queryKey: ["classes"] });
    },
  });

  const switchTab = (t: "upcoming" | "past") => {
    setTab(t);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Online classes"
        subtitle="Schedule Zoom / Meet classes, or a Premiere (a recorded video that plays like a live class). Students get a reminder 10 minutes before and an alert if it moves or is cancelled."
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

      <ErrorNote error={list.error ?? cancel.error ?? fetchRecording.error} />
      {fetchNote && <p role="status" className="rounded-xl bg-info-tint px-3.5 py-2.5 text-[13px] text-info">{fetchNote}</p>}
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
                  <p className="break-words text-[14.5px] font-bold">{c.title}</p>
                  <Badge tone={TONE[c.status]}>{c.status === "LIVE" ? "Live now" : c.status.charAt(0) + c.status.slice(1).toLowerCase()}</Badge>
                  {c.type === "PREMIERE" && <Badge tone="blue">Premiere</Badge>}
                  {c.seriesId && <Badge tone="gray">Weekly</Badge>}
                  {!!c.recordings?.length && <Badge tone="green">Recording saved{c.recordings.length > 1 ? ` (${c.recordings.length} parts)` : ""}</Badge>}
                </div>
                <p className="mt-1 text-[12.5px] text-sub">
                  {format(new Date(c.startAt), "EEE d MMM, h:mm a")} – {format(new Date(c.endAt), "h:mm a")} · {c.batch.name}
                  {c.faculty && ` · ${c.faculty.user.name}`}
                </p>
                {c.type === "PREMIERE" && c.video && (
                  <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-sub">
                    <PlayCircle size={13} /> {c.video.title}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {c.joinUrl && c.status !== "CANCELLED" && (
                  <a href={c.joinUrl} target="_blank" rel="noopener noreferrer" className={btnGhost + " !h-8 !px-3"}>
                    <ExternalLink size={14} /> Open link
                  </a>
                )}
                {c.type === "ZOOM" && c.status === "ENDED" && !c.recordings?.length && (
                  <button className={btnGhost + " !h-8 !px-3"} disabled={fetchRecording.isPending}
                    onClick={() => { setFetchNote(null); fetchRecording.mutate(c.id); }}>
                    <CloudDownload size={14} /> {fetchRecording.isPending && fetchRecording.variables === c.id ? "Asking Zoom…" : "Fetch recording"}
                  </button>
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
  const [type, setType] = useState<"ZOOM" | "PREMIERE">(row?.type === "PREMIERE" ? "PREMIERE" : "ZOOM");
  const [videoId, setVideoId] = useState(row?.videoId ?? "");
  const [startAt, setStartAt] = useState(row ? toLocalInput(row.startAt) : "");
  const premiere = type === "PREMIERE";
  const videos = useQuery({
    queryKey: ["videos", "premiere"],
    queryFn: () => api<Paginated<PremiereVideo>>(`/videos${qs({ limit: 100 })}`),
    enabled: premiere && !row,
    select: (p) => p.items.filter((v) => v.source === "file" && v.status === "READY"),
  });
  const pickedSec = videos.data?.find((v) => v.id === videoId)?.durationSec ?? row?.video?.durationSec ?? null;
  // A premiere ends when its video ends; the server works it out the same way.
  const premiereEndLabel =
    premiere && startAt && pickedSec
      ? format(new Date(new Date(startAt).getTime() + Math.ceil(pickedSec / 60) * 60_000), "h:mm a")
      : null;

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
    // A premiere's end comes from its video's length (the server sets it); this is only a placeholder.
    const endAt = premiere ? new Date(new Date(String(f.get("startAt"))).getTime() + 60_000).toISOString() : iso("endAt");
    if (row) {
      save.mutate({
        title: String(f.get("title")).trim(),
        startAt: iso("startAt"),
        ...(!premiere && { endAt, joinUrl: String(f.get("joinUrl")).trim() }),
        ...(isAdmin && facultyId && { facultyId }),
      });
    } else {
      const until = String(f.get("repeatUntil") ?? "");
      save.mutate({
        batchId: String(f.get("batchId")),
        title: String(f.get("title")).trim(),
        type,
        startAt: iso("startAt"),
        endAt,
        ...(premiere ? { videoId } : { joinUrl: String(f.get("joinUrl")).trim() }),
        ...(isAdmin && facultyId && { facultyId }),
        ...(repeat && until && { repeatWeeklyUntil: new Date(`${until}T23:59:59`).toISOString() }),
      });
    }
  };

  return (
    <Modal title={row ? (premiere ? "Edit premiere" : "Edit class") : "Schedule a class"} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        {!row && (
          <div role="radiogroup" aria-label="Class type" className="grid grid-cols-2 gap-2">
            {([
              ["ZOOM", "Zoom / Meet", "A live class on a meeting link"],
              ["PREMIERE", "Premiere", "A recorded video, played like a live class"],
            ] as const).map(([t, label, hint]) => (
              <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)}
                className={`rounded-[10px] border p-3 text-left ${type === t ? "border-primary bg-primary-tint" : "border-line"}`}>
                <span className="block text-[13px] font-bold">{label}</span>
                <span className="block text-[11.5px] text-sub">{hint}</span>
              </button>
            ))}
          </div>
        )}
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
            {(id) => <input id={id} name="startAt" type="datetime-local" required value={startAt} onChange={(e) => setStartAt(e.target.value)} className={inputCls} />}
          </Field>
          {premiere ? (
            <Field label="Ends">
              {(id) => (
                <p id={id} className={inputCls + " flex items-center text-sub"}>
                  {premiereEndLabel ? `${premiereEndLabel} (when the video ends)` : "When the video ends"}
                </p>
              )}
            </Field>
          ) : (
            <Field label="Ends *">
              {(id) => <input id={id} name="endAt" type="datetime-local" required defaultValue={row ? toLocalInput(row.endAt) : ""} className={inputCls} />}
            </Field>
          )}
        </div>
        {premiere ? (
          row ? (
            <p className="rounded-[10px] bg-bg px-3 py-2 text-[12.5px] text-sub">Video: {row.video?.title ?? "-"}</p>
          ) : (
            <Field label="Video *">
              {(id) => (
                <div>
                  <select id={id} required value={videoId} onChange={(e) => setVideoId(e.target.value)} className={inputCls}>
                    <option value="" disabled>{videos.isPending ? "Loading videos…" : "Select an uploaded video"}</option>
                    {videos.data?.map((v) => (
                      <option key={v.id} value={v.id}>{v.title}{v.durationSec ? ` · ${hm(v.durationSec)}` : ""}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-[11.5px] text-sub">
                    Only mp4 videos uploaded under Recorded Videos can premiere. Everyone watches the same moment; late joiners start mid-way and cannot skip ahead.
                    To keep it new, add the video to the batch only after the premiere.
                  </p>
                  {videos.data?.length === 0 && <p className="mt-1.5 text-[12px] text-danger">No uploaded video yet. Upload an mp4 under Recorded Videos first.</p>}
                </div>
              )}
            </Field>
          )
        ) : (
          <Field label="Zoom / Google Meet link *">
            {(id) => <input id={id} name="joinUrl" type="url" required maxLength={500} defaultValue={row?.joinUrl ?? ""} placeholder="https://zoom.us/j/…" pattern="https://.*" title="The link must start with https://" className={inputCls} />}
          </Field>
        )}
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
