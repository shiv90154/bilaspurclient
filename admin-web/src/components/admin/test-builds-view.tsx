"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Copy, Download, FlaskConical, Trash2, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, apiForm, fileHref } from "@/lib/api";
import { Badge, btnGhost, btnPrimary, EmptyState, ErrorNote, Field, inputCls, ListSkeleton, PageHeader } from "@/components/ui";

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
/** Same rule as the server: a suffix ("1.7.0-test") marks a test build. */
const isTest = (v: string) => /[-+]/.test(v);

/**
 * APKs for the client to try a new version before it goes to Google Play. Only shared through the
 * /download/test link; students on the Play Store app are never prompted to install these.
 */
export function TestBuildsView() {
  const qc = useQueryClient();
  const [localError, setLocalError] = useState("");
  const [copied, setCopied] = useState(false);

  const list = useQuery({
    queryKey: ["app-releases"],
    queryFn: () => api<AppRelease[]>("/app-releases"),
    select: (rows) => rows.filter((r) => isTest(r.version)),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["app-releases"] });

  const download = useMutation({
    mutationFn: (id: string) => api<{ url: string }>(`/app-releases/${id}/download-url`),
    onSuccess: ({ url }) => window.location.assign(fileHref(url)),
  });
  const upload = useMutation({ mutationFn: (fd: FormData) => apiForm("/app-releases", fd), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => api(`/app-releases/${id}`, { method: "DELETE" }), onSuccess: refresh });

  const link = typeof window === "undefined" ? "/download/test" : `${window.location.origin}/download/test`;

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
      <PageHeader
        title="App test builds"
        subtitle="Upload an APK for the client to check before it goes to Google Play. Students never see these."
      />
      <ErrorNote error={list.error ?? download.error ?? remove.error} />
      {list.isPending && <ListSkeleton rows={1} />}

      {latest ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-bold">v{latest.version}</h2>
            <Badge tone="green">Served at /download/test</Badge>
          </div>
          <p className="text-[13px] text-sub">
            {mb(latest.size)} · uploaded {format(new Date(latest.createdAt), "d MMM yyyy, h:mm a")}
          </p>
          {latest.notes && <p className="whitespace-pre-wrap text-[13px]">{latest.notes}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-bg px-3 py-2 text-[13px]">{link}</code>
            <button className={btnGhost + " !h-9 !px-3"} onClick={() => void navigator.clipboard.writeText(link).then(() => setCopied(true))}>
              <Copy size={14} /> {copied ? "Copied" : "Copy link"}
            </button>
            <button className={btnGhost + " !h-9 !px-3"} disabled={download.isPending} onClick={() => download.mutate(latest.id)}>
              <Download size={14} /> Download
            </button>
          </div>
          <p className="rounded-[10px] bg-accent-tint px-3 py-2 text-[12.5px] text-accent-ink">
            If DHĪ from the Play Store is on the phone, uninstall it first: Android will not install a test APK over the Play Store app.
            Afterwards, reinstall from the Play Store.
          </p>
        </section>
      ) : (
        !list.isPending && <EmptyState icon={FlaskConical} title="No test build yet" text="Upload an APK below and share the /download/test link with the client." />
      )}

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-[15px] font-bold">Upload a test build</h2>
        <form onSubmit={onSubmit} className="mt-3 grid gap-3.5 sm:grid-cols-2">
          <Field label="APK file *">
            {(id) => <input id={id} name="file" type="file" accept=".apk,application/vnd.android.package-archive" required className={inputCls + " pt-2"} />}
          </Field>
          <Field label="Version *">
            {(id) => (
              <input id={id} name="version" required pattern="\d+\.\d+\.\d+-[\w.]+" title="Add a suffix, for example 1.7.0-test"
                placeholder="1.7.0-test" className={inputCls} />
            )}
          </Field>
          <div className="sm:col-span-2">
            <Field label="What to check (optional)">
              {(id) => <textarea id={id} name="notes" rows={2} maxLength={2000} className={inputCls + " h-auto py-2"} />}
            </Field>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <ErrorNote error={localError ? new Error(localError) : upload.error} />
            <div className="flex flex-wrap items-center justify-end gap-3">
              {upload.isPending && <span className="text-[12.5px] text-sub">Uploading, please wait…</span>}
              <button className={btnPrimary} disabled={upload.isPending}><Upload size={16} /> Upload</button>
            </div>
          </div>
        </form>
      </section>

      {older.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-[15px] font-bold">Older test builds</h2>
          <ul className="mt-2 divide-y divide-line text-[13px]">
            {older.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <span className="font-semibold">v{r.version}</span>
                  <span className="ml-2 text-sub">{mb(r.size)} · {format(new Date(r.createdAt), "d MMM yyyy")}</span>
                </span>
                <button aria-label={`Delete v${r.version}`} className="rounded-lg p-1.5 text-danger hover:bg-bg"
                  onClick={() => window.confirm(`Delete test build v${r.version}?`) && remove.mutate(r.id)}>
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
