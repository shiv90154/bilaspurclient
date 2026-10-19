"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CloudDownload, ExternalLink, Play, Plus, RotateCw, Trash2, Upload, Users, Video } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, ApiError, fileHref, qs, type Batch, type Paginated } from "@/lib/api";
import { Badge, btnGhost, btnPrimary, EmptyState, ErrorNote, Field, inputCls, ListSkeleton, Modal, PageHeader } from "@/components/ui";

interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  externalUrl: string | null;
  /** file = our own mp4 (an imported Zoom recording), played through /videos/:id/play. */
  source: "file" | "link";
  durationSec: number | null;
  status: "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
  isDemo: boolean;
  createdAt: string;
  batches: { batch: { id: string; name: string } }[];
}

const duration = (sec: number) =>
  sec >= 3600 ? `${Math.floor(sec / 3600)} h ${Math.round((sec % 3600) / 60)} min` : `${Math.max(1, Math.round(sec / 60))} min`;

export function VideosView({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState<VideoRow | null>(null);
  const [editing, setEditing] = useState<VideoRow | null>(null);
  const list = useQuery({ queryKey: ["videos"], queryFn: () => api<Paginated<VideoRow>>(`/videos${qs({ limit: 100 })}`) });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api(`/videos/${id}`, { method: "PATCH", body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["videos"] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/videos/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["videos"] }),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Recorded videos"
        subtitle="Zoom cloud recordings of your classes arrive here by themselves, for the class's batch. You can also upload an mp4 from this computer, or add a lecture by its link (YouTube unlisted, Google Drive …)."
        action={
          <div className="flex flex-wrap gap-2">
            <button className={btnPrimary} onClick={() => setUploading(true)}><Upload size={16} /> Upload file</button>
            <button className={btnGhost} onClick={() => setAdding(true)}><Plus size={16} /> Add a link</button>
          </div>
        }
      />
      {isAdmin && <ZoomPanel />}
      <ErrorNote error={list.error ?? patch.error ?? remove.error} />
      {list.isPending && <ListSkeleton />}
      {list.data?.items.length === 0 && (
        <EmptyState icon={Video} title="No videos yet" text="Add a demo lecture so new students can see how you teach." />
      )}
      <ul className="flex flex-col gap-3">
        {list.data?.items.map((v) => (
          <li key={v.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words text-[14.5px] font-bold">{v.title}</p>
                {v.description && <p className="mt-0.5 text-[12.5px] text-sub">{v.description}</p>}
                <p className="mt-0.5 text-[12px] text-sub">
                  Added {format(new Date(v.createdAt), "d MMM yyyy")}
                  {v.durationSec ? ` · ${duration(v.durationSec)}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {v.status === "UPLOADING" && <Badge tone="red">Upload not finished: delete it and upload again</Badge>}
                  {v.source === "file" && <Badge tone="amber">Plays inside the app</Badge>}
                  {v.isDemo && <Badge tone="green">Free demo: every student</Badge>}
                  {v.batches.map((b) => <Badge key={b.batch.id} tone="blue">{b.batch.name}</Badge>)}
                  {!v.isDemo && v.batches.length === 0 && <Badge tone="red">No batch: nobody can see it</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-[12.5px]">
                  <input type="checkbox" checked={v.isDemo} disabled={patch.isPending} onChange={(e) => patch.mutate({ id: v.id, body: { isDemo: e.target.checked } })} />
                  Free demo
                </label>
                {v.source === "file" ? (
                  <button className={btnGhost + " !h-8 !px-3"} onClick={() => setPlaying(v)}><Play size={14} /> Play</button>
                ) : (
                  v.externalUrl && (
                    <a className={btnGhost + " !h-8 !px-3"} href={v.externalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open</a>
                  )
                )}
                <button className={btnGhost + " !h-8 !px-3"} onClick={() => setEditing(v)}><Users size={14} /> Batches</button>
                <button aria-label={`Delete ${v.title}`} className="rounded-lg p-1.5 text-danger hover:bg-bg" onClick={() => window.confirm(`Delete "${v.title}"?`) && remove.mutate(v.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {adding && <AddVideo onClose={() => setAdding(false)} />}
      {uploading && <UploadVideo onClose={() => setUploading(false)} />}
      {playing && <PlayVideo video={playing} onClose={() => setPlaying(null)} />}
      {editing && <EditBatches video={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BatchChecklist({ selected }: { selected?: string[] }) {
  const batches = useQuery({ queryKey: ["batches", "all"], queryFn: () => api<Paginated<Batch>>(`/batches${qs({ limit: 100, active: true })}`) });
  return (
    <fieldset>
      <legend className="text-[12px] font-semibold text-sub">Batches that can watch it</legend>
      <div className="mt-2 flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-[10px] border border-line p-3">
        {batches.data?.items.map((b) => (
          <label key={b.id} className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" name="batchIds" value={b.id} defaultChecked={selected?.includes(b.id)} /> {b.course?.name} · {b.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function AddVideo({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api("/videos", { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["videos"] });
      onClose();
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    create.mutate({
      title: text("title"),
      description: text("description") || undefined,
      url: text("url"),
      isDemo: f.get("isDemo") === "on",
      batchIds: f.getAll("batchIds").map(String),
    });
  }

  return (
    <Modal title="Add video" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="Title">{(i) => <input id={i} name="title" required maxLength={200} className={inputCls} />}</Field>
        <Field label="Video link (https)">{(i) => <input id={i} name="url" type="url" required placeholder="https://youtu.be/…" className={inputCls} />}</Field>
        <Field label="Description (optional)">{(i) => <textarea id={i} name="description" rows={2} maxLength={2000} className={inputCls + " h-auto py-2"} />}</Field>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="isDemo" /> Free demo (also for students waiting for approval)</label>
        <BatchChecklist />
        <p className="text-[12px] text-sub">Tip: on YouTube choose “Unlisted” so only people with the link can find it.</p>
        <ErrorNote error={create.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={create.isPending}>{create.isPending ? "Saving…" : "Add video"}</button>
        </div>
      </form>
    </Modal>
  );
}

/** Sends one chunk; a 409 answer says how many bytes the server already has (resume from there). */
async function putChunk(id: string, offset: number, chunk: Blob): Promise<number> {
  const res = await fetch(`/api/backend/videos/uploads/${id}${qs({ offset })}`, {
    method: "PUT",
    headers: { "content-type": "application/octet-stream" },
    body: chunk,
  });
  const body = (await res.json().catch(() => ({}))) as { received?: number; message?: string };
  if (res.ok || (res.status === 409 && typeof body.received === "number")) return body.received!;
  throw new ApiError(res.status, undefined, body.message ?? `Upload failed (${res.status})`);
}

/**
 * Uploads an mp4 from this computer to our server in chunks (one request is capped at 160 MB),
 * retrying a failed chunk a few times. The video stays hidden from students until it is complete.
 */
function UploadVideo({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    const f = new FormData(e.currentTarget);
    setError(null);
    setProgress(0);
    try {
      const start = await api<{ id: string; chunkBytes: number }>("/videos/uploads", {
        method: "POST",
        body: {
          title: String(f.get("title") ?? "").trim(),
          size: file.size,
          isDemo: f.get("isDemo") === "on",
          batchIds: f.getAll("batchIds").map(String),
        },
      });
      let sent = 0;
      let failures = 0;
      while (sent < file.size) {
        try {
          sent = await putChunk(start.id, sent, file.slice(sent, sent + start.chunkBytes));
          failures = 0;
          setProgress(sent / file.size);
        } catch (err) {
          if (++failures > 4) throw err;
          await new Promise((r) => setTimeout(r, 3000 * failures));
        }
      }
      await api(`/videos/uploads/${start.id}/complete`, { method: "POST" });
      void qc.invalidateQueries({ queryKey: ["videos"] });
      onClose();
    } catch (err) {
      setError(err);
      setProgress(null);
      void qc.invalidateQueries({ queryKey: ["videos"] });
    }
  }

  const busy = progress !== null;
  return (
    <Modal title="Upload a video file" onClose={busy ? () => undefined : onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="Title">{(i) => <input id={i} name="title" required maxLength={200} className={inputCls} disabled={busy} />}</Field>
        <Field label="Video file (mp4)">
          {(i) => (
            <input id={i} type="file" accept="video/mp4" required disabled={busy} className="text-[13px]"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          )}
        </Field>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="isDemo" disabled={busy} /> Free demo (also for students waiting for approval)</label>
        <BatchChecklist />
        <p className="text-[12px] text-sub">The video is kept on our server and plays only inside the app. Keep this page open until the upload finishes.</p>
        {busy && (
          <div role="status" className="flex flex-col gap-1">
            <div className="h-2 overflow-hidden rounded-full bg-bg"><div className="h-full bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <p className="text-[12px] text-sub">Uploading… {Math.round(progress * 100)}% of {(file!.size / 1e6).toFixed(0)} MB</p>
          </div>
        )}
        <ErrorNote error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose} disabled={busy}>Cancel</button>
          <button className={btnPrimary} disabled={busy || !file}>{busy ? "Uploading…" : "Upload"}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditBatches({ video, onClose }: { video: VideoRow; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (batchIds: string[]) => api(`/videos/${video.id}`, { method: "PATCH", body: { batchIds } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["videos"] });
      onClose();
    },
  });
  return (
    <Modal title="Who can watch it" onClose={onClose}>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(new FormData(e.currentTarget).getAll("batchIds").map(String));
        }}
      >
        <p className="break-words text-[13px] font-semibold">{video.title}</p>
        <BatchChecklist selected={video.batches.map((b) => b.batch.id)} />
        <ErrorNote error={save.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}

function PlayVideo({ video, onClose }: { video: VideoRow; onClose: () => void }) {
  const link = useQuery({
    queryKey: ["video-play", video.id],
    queryFn: () => api<{ url: string }>(`/videos/${video.id}/play`),
    staleTime: 3600_000,
  });
  // Our own files come back as /api/files/... (through the proxy); R2 links are absolute.
  const src = link.data && (link.data.url.startsWith("/") ? fileHref(link.data.url) : link.data.url);
  return (
    <Modal title={video.title} onClose={onClose}>
      <ErrorNote error={link.error} />
      {src ? (
        <video src={src} controls autoPlay controlsList="nodownload" className="aspect-video w-full rounded-xl bg-black" />
      ) : (
        !link.error && <div className="aspect-video w-full animate-pulse rounded-xl bg-bg" />
      )}
    </Modal>
  );
}

// ───────────── Zoom recordings (admin) ─────────────

type ImportStatus = "PENDING" | "DOWNLOADING" | "DONE" | "FAILED" | "SKIPPED";
interface ZoomStatus {
  apiConnected: boolean;
  webhookConnected: boolean;
  trashAfterImport: boolean;
  videoStore: "local" | "r2";
  r2Configured: boolean;
  counts: Partial<Record<ImportStatus, number>>;
}
interface ImportRow {
  id: string;
  meetingId: string;
  topic: string | null;
  startedAt: string | null;
  status: ImportStatus;
  attempts: number;
  error: string | null;
  createdAt: string;
  class: { id: string; title: string; batch: { id: string; name: string } } | null;
  video: { id: string; title: string } | null;
}
const IMPORT_TONE: Record<ImportStatus, "blue" | "green" | "gray" | "red" | "amber"> = {
  PENDING: "blue",
  DOWNLOADING: "amber",
  DONE: "green",
  FAILED: "red",
  SKIPPED: "gray",
};
const IMPORT_LABEL: Record<ImportStatus, string> = {
  PENDING: "Waiting",
  DOWNLOADING: "Copying…",
  DONE: "Saved",
  FAILED: "Failed",
  SKIPPED: "No video",
};

function ZoomPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const status = useQuery({ queryKey: ["zoom-status"], queryFn: () => api<ZoomStatus>("/integrations/zoom/status"), refetchInterval: 30_000 });
  const imports = useQuery({
    queryKey: ["zoom-imports"],
    queryFn: () => api<Paginated<ImportRow>>(`/integrations/zoom/imports${qs({ limit: 20 })}`),
    enabled: open,
    refetchInterval: open ? 10_000 : false,
  });
  const retry = useMutation({
    mutationFn: (id: string) => api(`/integrations/zoom/imports/${id}/retry`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["zoom-imports"] });
      void qc.invalidateQueries({ queryKey: ["zoom-status"] });
    },
  });
  const s = status.data;
  if (!s) return null;
  const connected = s.apiConnected || s.webhookConnected;
  const busy = (s.counts.PENDING ?? 0) + (s.counts.DOWNLOADING ?? 0);

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="rounded-xl bg-primary-tint p-2 text-primary"><CloudDownload size={18} /></span>
          <div className="min-w-0">
            <p className="text-[14px] font-bold">Zoom recordings</p>
            <p className="text-[12px] text-sub">
              {connected
                ? `Connected · saved on ${s.videoStore === "r2" ? "Cloudflare R2" : "this server"}${s.trashAfterImport ? " · removed from Zoom after copying" : ""}`
                : "Not connected yet. The Zoom keys go in the server settings (docs/14-zoom-recordings.md)."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={s.webhookConnected ? "green" : "gray"}>Auto {s.webhookConnected ? "on" : "off"}</Badge>
          <Badge tone={s.apiConnected ? "green" : "gray"}>Zoom API {s.apiConnected ? "on" : "off"}</Badge>
          {busy > 0 && <Badge tone="amber">{busy} copying</Badge>}
          {(s.counts.FAILED ?? 0) > 0 && <Badge tone="red">{s.counts.FAILED} failed</Badge>}
          <button className={btnGhost + " !h-8 !px-3"} onClick={() => setOpen(!open)}>{open ? "Hide" : "Recent imports"}</button>
        </div>
      </div>
      {open && (
        <div className="mt-3 border-t border-line pt-3">
          <ErrorNote error={imports.error ?? retry.error} />
          {imports.data?.items.length === 0 && <p className="text-[13px] text-sub">No Zoom recording has come in yet.</p>}
          <ul className="flex flex-col">
            {imports.data?.items.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-line py-2.5 last:border-b-0">
                <div className="min-w-0">
                  <p className="break-words text-[13px] font-semibold">{r.video?.title ?? r.class?.title ?? r.topic ?? `Meeting ${r.meetingId}`}</p>
                  <p className="text-[12px] text-sub">
                    {format(new Date(r.startedAt ?? r.createdAt), "d MMM yyyy, h:mm a")}
                    {r.class ? ` · ${r.class.batch.name}` : " · no matching class: choose its batches below"}
                  </p>
                  {r.error && r.status !== "DONE" && <p className="mt-0.5 break-words text-[12px] text-danger">{r.error}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={IMPORT_TONE[r.status]}>{IMPORT_LABEL[r.status]}</Badge>
                  {(r.status === "FAILED" || r.status === "SKIPPED") && (
                    <button className={btnGhost + " !h-8 !px-3"} disabled={retry.isPending} onClick={() => retry.mutate(r.id)}>
                      <RotateCw size={14} /> Retry
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
