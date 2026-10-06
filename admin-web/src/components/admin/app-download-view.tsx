"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Smartphone, Trash2, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, apiForm, fileHref } from "@/lib/api";
import { Badge, btnGhost, btnPrimary, ErrorNote, Field, inputCls, PageHeader } from "@/components/ui";

interface AppRelease {
  id: string;
  version: string;
  fileName: string;
  size: number;
  notes: string | null;
  createdAt: string;
}

const MAX_MB = 150;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

export function AppDownloadView() {
  const qc = useQueryClient();
  const [localError, setLocalError] = useState("");

  const list = useQuery({ queryKey: ["app-releases"], queryFn: () => api<AppRelease[]>("/app-releases") });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["app-releases"] });

  const download = useMutation({
    mutationFn: (id: string) => api<{ url: string }>(`/app-releases/${id}/download-url`),
    // The link is signed and short-lived, so it is fetched fresh on every click.
    onSuccess: ({ url }) => window.location.assign(fileHref(url)),
  });
  const upload = useMutation({ mutationFn: (fd: FormData) => apiForm("/app-releases", fd), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/app-releases/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const file = f.get("file");
    if (!(file instanceof File) || file.size === 0) return setLocalError("Choose the .apk file");
    if (file.size > MAX_MB * 1024 * 1024) return setLocalError(`APK is larger than ${MAX_MB} MB`);
    setLocalError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("version", String(f.get("version")).trim());
    const notes = String(f.get("notes") ?? "").trim();
    if (notes) fd.append("notes", notes);
    upload.mutate(fd, { onSuccess: () => form.reset() });
  };

  const [latest, ...older] = list.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Mobile app" subtitle="Download the latest Android app (APK), or upload a new build." />
      <ErrorNote error={list.error ?? download.error ?? remove.error} />

      {list.isPending && <p className="text-[13px] text-sub">Loading…</p>}

      {latest ? (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-start gap-3.5">
            <span className="rounded-2xl bg-primary-tint p-3 text-primary"><Smartphone size={26} /></span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-bold">DHĪ for Android</h2>
                <Badge tone="green">Latest</Badge>
              </div>
              <p className="mt-0.5 text-[13px] text-sub">
                Version {latest.version} · {mb(latest.size)} · uploaded {format(new Date(latest.createdAt), "d MMM yyyy, h:mm a")}
              </p>
              {latest.notes && <p className="mt-2 whitespace-pre-wrap text-[13px]">{latest.notes}</p>}
            </div>
          </div>
          <button className={btnPrimary + " !h-11 !px-6"} disabled={download.isPending} onClick={() => download.mutate(latest.id)}>
            <Download size={17} /> {download.isPending ? "Preparing…" : "Download APK"}
          </button>
        </section>
      ) : (
        !list.isPending && (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-[13px] text-sub">
            No app build uploaded yet. Upload the APK below once it is built.
          </p>
        )
      )}

      {latest && (
        <p className="rounded-[10px] bg-accent-tint px-3 py-2 text-[12.5px] text-accent-ink">
          To install: open the downloaded file on the phone and allow &quot;Install unknown apps&quot; for your browser if Android asks.
        </p>
      )}

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-[15px] font-bold">Upload a new build</h2>
        <form onSubmit={onSubmit} className="mt-3 grid gap-3.5 sm:grid-cols-2">
          <Field label="APK file *">
            {(id) => <input id={id} name="file" type="file" accept=".apk,application/vnd.android.package-archive" required className={inputCls + " pt-2"} />}
          </Field>
          <Field label="Version *">
            {(id) => <input id={id} name="version" required pattern="\d+\.\d+\.\d+([\-+][\w.]+)?" placeholder="1.0.0" className={inputCls} />}
          </Field>
          <div className="sm:col-span-2">
            <Field label="What changed (optional)">
              {(id) => <textarea id={id} name="notes" rows={2} maxLength={2000} className={inputCls + " h-auto py-2"} />}
            </Field>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <ErrorNote error={localError ? new Error(localError) : upload.error} />
            <div className="flex items-center justify-end gap-3">
              {upload.isPending && <span className="text-[12.5px] text-sub">Uploading, please wait…</span>}
              <button className={btnPrimary} disabled={upload.isPending}><Upload size={16} /> Upload</button>
            </div>
          </div>
        </form>
      </section>

      {older.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-[15px] font-bold">Older builds</h2>
          <ul className="mt-2 divide-y divide-line text-[13px]">
            {older.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <span className="font-semibold">v{r.version}</span>
                  <span className="ml-2 text-sub">{mb(r.size)} · {format(new Date(r.createdAt), "d MMM yyyy")}</span>
                </span>
                <span className="flex items-center gap-2">
                  <button className={btnGhost + " !h-8 !px-3"} onClick={() => download.mutate(r.id)}><Download size={14} /> Download</button>
                  <button aria-label={`Delete v${r.version}`} className="rounded-lg p-1.5 text-danger hover:bg-bg"
                    onClick={() => window.confirm(`Delete build v${r.version}? This cannot be undone.`) && remove.mutate(r.id)}>
                    <Trash2 size={15} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
