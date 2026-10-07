"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, ExternalLink, FileText, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import {
  api,
  apiForm,
  fileHref,
  qs,
  type Batch,
  type Material,
  type Paginated,
} from "@/lib/api";
import { Badge, btnGhost, btnPrimary, EmptyState, ErrorNote, Field, inputCls, ListSkeleton, Modal, PageHeader, Pager } from "@/components/ui";
import { useSubjects } from "./question-bank-view";

const LIMIT = 15;
const MAX_MB = 25;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

export function MaterialsView() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [subjectId, setSubjectId] = useState("");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const subjects = useSubjects();
  const list = useQuery({
    queryKey: ["materials", { page, subjectId, search }],
    queryFn: () => api<Paginated<Material>>(`/materials${qs({ page, limit: LIMIT, subjectId, search })}`),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["materials"] });

  const open = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: "view" | "download" }) =>
      api<{ url: string }>(`/materials/${id}/${kind}-url`),
    // Open synchronously-ish: popup blockers allow window.open only right after the click chain.
    onSuccess: ({ url }) => window.open(fileHref(url), "_blank", "noopener"),
  });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) => api(`/materials/${id}`, { method: "PATCH", body }),
    onSuccess: refresh,
  });
  const archive = useMutation({
    mutationFn: (id: string) => api(`/materials/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const replace = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiForm(`/materials/${id}/replace`, fd);
    },
    onSuccess: refresh,
  });

  const onReplacePicked = (file: File | undefined) => {
    const id = replaceId;
    setReplaceId(null);
    if (replaceInput.current) replaceInput.current.value = "";
    if (!file || !id) return;
    if (file.size > MAX_MB * 1024 * 1024) return window.alert(`File is larger than ${MAX_MB} MB`);
    replace.mutate({ id, file });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Study material"
        subtitle="PDF notes shared with selected batches. Students read them in the app; downloads are off unless you allow them."
        action={<button className={btnPrimary} onClick={() => setUploading(true)}><Plus size={16} /> Upload</button>}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <select aria-label="Subject" className={inputCls} value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setPage(1); }}>
          <option value="">All subjects</option>
          {subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input aria-label="Search" placeholder="Search title" className={inputCls} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <input ref={replaceInput} type="file" accept="application/pdf" hidden onChange={(e) => onReplacePicked(e.target.files?.[0])} />
      <ErrorNote error={list.error ?? open.error ?? patch.error ?? archive.error ?? replace.error} />
      {replace.isPending && <p className="text-[13px] text-sub">Uploading new version…</p>}
      {list.isPending && <ListSkeleton />}
      {list.data?.items.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No study material yet"
          text="Upload PDF notes and choose which batches can read them. Students read them inside the app; downloads stay off unless you allow them."
          action={<button className={btnPrimary} onClick={() => setUploading(true)}><Plus size={16} /> Upload notes</button>}
        />
      )}

      <ul className="flex flex-col gap-3">
        {list.data?.items.map((m) => (
          <li key={m.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words text-[14.5px] font-bold">{m.title}</p>
                <p className="mt-0.5 text-[12.5px] text-sub">
                  {[m.subject?.name, m.topic?.name].filter(Boolean).join(" › ") || "No subject"} · v{m.version} · {mb(m.size)} · {format(new Date(m.updatedAt), "d MMM yyyy")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.isDemo && <Badge tone="green">Free demo: every student</Badge>}
                  {m.batches.length === 0 && !m.isDemo && <Badge tone="red">No batch: nobody can see it</Badge>}
                  {m.batches.map((b) => <Badge key={b.batch.id} tone="blue">{b.batch.name}</Badge>)}
                  {m.status !== "PUBLISHED" && <Badge tone="gray">{m.status}</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-[12.5px]">
                  <input type="checkbox" checked={m.allowDownload} disabled={patch.isPending}
                    onChange={(e) => patch.mutate({ id: m.id, body: { allowDownload: e.target.checked } })} />
                  Allow download
                </label>
                <label className="flex items-center gap-1.5 text-[12.5px]" title="Free demo: students who registered but are not approved yet can open it too">
                  <input type="checkbox" checked={m.isDemo} disabled={patch.isPending}
                    onChange={(e) => patch.mutate({ id: m.id, body: { isDemo: e.target.checked } })} />
                  Free demo
                </label>
                <button className={btnGhost + " !h-8 !px-3"} onClick={() => open.mutate({ id: m.id, kind: "view" })}><ExternalLink size={14} /> View</button>
                <button className={btnGhost + " !h-8 !px-3"} onClick={() => open.mutate({ id: m.id, kind: "download" })}><Download size={14} /></button>
                <button className={btnGhost + " !h-8 !px-3"} onClick={() => { setReplaceId(m.id); replaceInput.current?.click(); }}><RefreshCw size={14} /> New version</button>
                <button aria-label="Archive" className="rounded-lg p-1.5 text-danger hover:bg-bg"
                  onClick={() => window.confirm(`Archive "${m.title}"? Students will no longer see it.`) && archive.mutate(m.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {list.data && <Pager page={page} limit={LIMIT} total={list.data.total} onPage={setPage} />}
      {uploading && <UploadForm onClose={() => setUploading(false)} onDone={refresh} />}
    </div>
  );
}

function UploadForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const subjects = useSubjects();
  const batches = useQuery({ queryKey: ["batches", "active"], queryFn: () => api<Paginated<Batch>>(`/batches${qs({ limit: 100, active: true })}`) });
  const [subjectId, setSubjectId] = useState("");
  const [batchIds, setBatchIds] = useState<Set<string>>(new Set());
  const [localError, setLocalError] = useState("");

  const save = useMutation({
    mutationFn: (fd: FormData) => apiForm("/materials", fd),
    onSuccess: () => { onDone(); onClose(); },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const file = f.get("file");
    if (!(file instanceof File) || file.size === 0) return setLocalError("Choose a PDF");
    if (file.size > MAX_MB * 1024 * 1024) return setLocalError(`File is larger than ${MAX_MB} MB`);
    if (batchIds.size === 0 && !window.confirm("No batch selected: no student will see this yet. Upload anyway?")) return;
    setLocalError("");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("title", String(f.get("title")).trim());
    const description = String(f.get("description") ?? "").trim();
    if (description) fd.append("description", description);
    if (subjectId) fd.append("subjectId", subjectId);
    const topicId = String(f.get("topicId") ?? "");
    if (topicId) fd.append("topicId", topicId);
    fd.append("allowDownload", f.get("allowDownload") === "on" ? "true" : "false");
    fd.append("isDemo", f.get("isDemo") === "on" ? "true" : "false");
    fd.append("batchIds", JSON.stringify([...batchIds]));
    save.mutate(fd);
  };

  const topics = subjects.data?.find((s) => s.id === subjectId)?.topics ?? [];

  return (
    <Modal title="Upload study material" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="PDF file *">{(id) => <input id={id} name="file" type="file" accept="application/pdf" required className={inputCls + " pt-2"} />}</Field>
        <Field label="Title *">{(id) => <input id={id} name="title" required maxLength={200} className={inputCls} />}</Field>
        <Field label="Description">{(id) => <textarea id={id} name="description" rows={2} maxLength={2000} className={inputCls + " h-auto py-2"} />}</Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Subject">
            {(id) => (
              <select id={id} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputCls}>
                <option value="">None</option>
                {subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Topic">
            {(id) => (
              <select id={id} name="topicId" key={subjectId} defaultValue="" disabled={!subjectId} className={inputCls}>
                <option value="">None</option>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-[12px] font-semibold text-sub">Visible to batches</legend>
          <div className="grid max-h-36 gap-1.5 overflow-y-auto sm:grid-cols-2">
            {batches.data?.items.map((b) => (
              <label key={b.id} className="flex items-center gap-2 rounded-[10px] border border-line px-3 py-1.5 text-[13px]">
                <input type="checkbox" checked={batchIds.has(b.id)}
                  onChange={(e) => setBatchIds((s) => { const n = new Set(s); if (e.target.checked) n.add(b.id); else n.delete(b.id); return n; })} />
                {b.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="allowDownload" /> Students may download</label>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="isDemo" /> Free demo (also for students waiting for approval)</label>
        <ErrorNote error={localError ? new Error(localError) : save.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Uploading…" : "Upload"}</button>
        </div>
      </form>
    </Modal>
  );
}
