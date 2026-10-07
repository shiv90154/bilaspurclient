"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ExternalLink, Plus, Trash2, Video } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, qs, type Batch, type Paginated } from "@/lib/api";
import { Badge, btnGhost, btnPrimary, EmptyState, ErrorNote, Field, inputCls, ListSkeleton, Modal, PageHeader } from "@/components/ui";

interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  externalUrl: string | null;
  isDemo: boolean;
  createdAt: string;
  batches: { batch: { id: string; name: string } }[];
}

export function VideosView() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
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
        subtitle="Add a lecture by its link (YouTube unlisted, Google Drive …). Free demo videos are open to students waiting for approval too."
        action={<button className={btnPrimary} onClick={() => setAdding(true)}><Plus size={16} /> Add video</button>}
      />
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
                <p className="mt-0.5 text-[12px] text-sub">Added {format(new Date(v.createdAt), "d MMM yyyy")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
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
                {v.externalUrl && (
                  <a className={btnGhost + " !h-8 !px-3"} href={v.externalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open</a>
                )}
                <button aria-label={`Delete ${v.title}`} className="rounded-lg p-1.5 text-danger hover:bg-bg" onClick={() => window.confirm(`Delete "${v.title}"?`) && remove.mutate(v.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {adding && <AddVideo onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddVideo({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const batches = useQuery({ queryKey: ["batches", "all"], queryFn: () => api<Paginated<Batch>>(`/batches${qs({ limit: 100, active: true })}`) });
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
        <fieldset>
          <legend className="text-[12px] font-semibold text-sub">Batches that can watch it</legend>
          <div className="mt-2 flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-[10px] border border-line p-3">
            {batches.data?.items.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" name="batchIds" value={b.id} /> {b.course?.name} · {b.name}
              </label>
            ))}
          </div>
        </fieldset>
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
