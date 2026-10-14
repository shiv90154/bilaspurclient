"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Camera, ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api, apiForm, fileHref, type DocumentStatus, type StudentDocument } from "@/lib/api";
import { Badge, btnGhost, btnPrimary, ErrorNote, Field, inputCls } from "@/components/ui";

/** The student's own photo: click to change, with a remove link. */
export function PhotoPicker({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const done = () => void qc.invalidateQueries({ queryKey: ["my-profile"] });
  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiForm("/students/me/photo", fd);
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => api("/students/me/photo", { method: "DELETE" }), onSuccess: done });
  const err = upload.error ?? remove.error;

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div className="relative">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed link
          <img src={fileHref(photoUrl)} alt="" className="size-16 rounded-full border border-line object-cover" />
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary-tint font-display text-[22px] font-bold text-primary">
            {name.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={upload.isPending}
          aria-label={photoUrl ? "Change photo" : "Add photo"}
          className="absolute -bottom-1 -right-1 rounded-full border border-line bg-surface p-1.5 text-sub shadow-sm hover:text-primary"
        >
          <Camera size={14} />
        </button>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
            e.target.value = "";
          }}
        />
      </div>
      {upload.isPending && <span className="text-[11px] text-sub">Uploading…</span>}
      {photoUrl && !upload.isPending && (
        <button type="button" className="text-[11px] font-semibold text-danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
          Remove
        </button>
      )}
      {err && (
        <p role="alert" className="max-w-[160px] text-center text-[11px] text-danger">
          {err.message}
        </p>
      )}
    </div>
  );
}

export interface EditableDetails {
  address: string | null;
  city: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
}

/** Address, city and guardian; the rest of the profile is kept by the institute office. */
export function DetailsForm({ p, onDone }: { p: EditableDetails; onDone: () => void }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (body: Record<string, string>) => api("/students/me", { method: "PATCH", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-profile"] });
      onDone();
    },
  });

  return (
    <form
      className="mt-4 grid gap-3.5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const v = (k: string) => String(f.get(k) ?? "").trim();
        save.mutate({ address: v("address"), city: v("city"), guardianName: v("guardianName"), guardianPhone: v("guardianPhone") });
      }}
    >
      <div className="sm:col-span-2">
        <Field label="Address">{(i) => <textarea id={i} name="address" rows={2} maxLength={500} defaultValue={p.address ?? ""} className={inputCls + " !h-auto py-2"} />}</Field>
      </div>
      <Field label="City">{(i) => <input id={i} name="city" maxLength={100} defaultValue={p.city ?? ""} className={inputCls} />}</Field>
      <Field label="Guardian name">{(i) => <input id={i} name="guardianName" maxLength={100} defaultValue={p.guardianName ?? ""} className={inputCls} />}</Field>
      <Field label="Guardian phone">
        {(i) => (
          <input id={i} name="guardianPhone" inputMode="numeric" pattern="[6-9][0-9]{9}" title="10 digit mobile number" maxLength={10} defaultValue={p.guardianPhone ?? ""} className={inputCls} />
        )}
      </Field>
      <div className="flex flex-col gap-2 sm:col-span-2">
        <ErrorNote error={save.error} />
        <div className="flex gap-2">
          <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
          <button type="button" className={btnGhost} onClick={onDone}>Cancel</button>
        </div>
      </div>
    </form>
  );
}

/** New email in two steps: a code goes to the new address, the right code switches it. */
export function EmailForm({ current }: { current: string | null }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const start = useMutation({
    mutationFn: () => api<{ email: string }>("/students/me/email/start", { method: "POST", body: { email: email.trim().toLowerCase() } }),
    onSuccess: (r) => setSentTo(r.email),
  });
  const verify = useMutation({
    mutationFn: (code: string) => api("/students/me/email/verify", { method: "POST", body: { email: email.trim().toLowerCase(), code } }),
    onSuccess: () => {
      setDone(true);
      setSentTo(null);
      setEmail("");
      void qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });

  if (!sentTo) {
    return (
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setDone(false);
          start.mutate();
        }}
      >
        {done && <p className="text-[13px] font-semibold text-primary">Email changed.</p>}
        <Field label={current ? `New email (now ${current})` : "Email"}>
          {(i) => <input id={i} type="email" required maxLength={150} value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />}
        </Field>
        <ErrorNote error={start.error} />
        <button className={btnPrimary + " self-start"} disabled={start.isPending}>{start.isPending ? "Sending…" : "Send code"}</button>
      </form>
    );
  }
  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        verify.mutate(String(new FormData(e.currentTarget).get("code") ?? "").trim());
      }}
    >
      <p className="text-[13px] text-sub">We sent a 6-digit code to {sentTo}. It works for 10 minutes.</p>
      <Field label="Code">
        {(i) => <input id={i} name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoFocus autoComplete="one-time-code" className={inputCls} />}
      </Field>
      <ErrorNote error={verify.error} />
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={verify.isPending}>{verify.isPending ? "Checking…" : "Confirm"}</button>
        <button type="button" className={btnGhost} onClick={() => setSentTo(null)}>Use another email</button>
      </div>
    </form>
  );
}

const DOC_TYPES = [
  { value: "ID_PROOF", label: "ID proof (Aadhaar etc.)" },
  { value: "MARKSHEET", label: "Marksheet" },
  { value: "OTHER", label: "Other" },
];
const TYPE_LABEL: Record<string, string> = { ID_PROOF: "ID proof", MARKSHEET: "Marksheet", PHOTO: "Photo", OTHER: "Other" };
const STATUS: Record<DocumentStatus, { label: string; tone: "green" | "amber" | "red" }> = {
  APPROVED: { label: "Approved", tone: "green" },
  PENDING: { label: "Waiting for approval", tone: "amber" },
  REJECTED: { label: "Not accepted", tone: "red" },
};

/** The student's documents: upload, open, and delete their own until the institute approves them. */
export function MyDocuments() {
  const qc = useQueryClient();
  const key = ["my-documents"];
  const [formKey, setFormKey] = useState(0);
  const docs = useQuery({ queryKey: key, queryFn: () => api<StudentDocument[]>("/students/me/documents") });
  const upload = useMutation({
    mutationFn: (fd: FormData) => apiForm<StudentDocument>("/students/me/documents", fd),
    onSuccess: () => {
      setFormKey((k) => k + 1);
      void qc.invalidateQueries({ queryKey: key });
    },
  });
  const open = useMutation({
    mutationFn: (docId: string) => api<{ url: string }>(`/students/me/documents/${docId}/url`),
    onSuccess: ({ url }) => window.open(fileHref(url), "_blank", "noopener"),
  });
  const remove = useMutation({
    mutationFn: (docId: string) => api(`/students/me/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  return (
    <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_300px]">
      <ul className="min-w-0 divide-y divide-line text-[13px]">
        {docs.data?.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 rounded-xl bg-primary-tint p-2 text-primary"><FileText size={16} aria-hidden="true" /></span>
              <span className="min-w-0">
                <span className="block break-all font-semibold">{d.fileName}</span>
                <span className="block text-[12px] text-sub">{TYPE_LABEL[d.type] ?? d.type} · {format(new Date(d.createdAt), "d MMM yyyy")}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
                  {d.status === "REJECTED" && d.reviewNote && <span className="text-[12px] text-sub">Reason: {d.reviewNote}</span>}
                </span>
              </span>
            </span>
            <span className="flex gap-1.5">
              <button className={btnGhost + " !h-8 !px-3"} disabled={open.isPending} onClick={() => open.mutate(d.id)}>
                <ExternalLink size={14} /> Open
              </button>
              {d.byStudent && d.status !== "APPROVED" && (
                <button
                  className={btnGhost + " !h-8 !px-3 text-danger"}
                  disabled={remove.isPending}
                  aria-label={`Delete ${d.fileName}`}
                  onClick={() => window.confirm(`Delete ${d.fileName}?`) && remove.mutate(d.id)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </span>
          </li>
        ))}
        {docs.data?.length === 0 && <li className="py-3 text-sub">No documents yet. Upload your ID proof and marksheet.</li>}
        {docs.isPending && <li className="py-3 text-sub">Loading…</li>}
        <li className="pt-3"><ErrorNote error={docs.error ?? open.error ?? remove.error} /></li>
      </ul>

      <form
        key={formKey}
        className="flex h-fit flex-col gap-3.5 rounded-xl border border-line p-4"
        onSubmit={(e) => {
          e.preventDefault();
          upload.mutate(new FormData(e.currentTarget));
        }}
      >
        <Field label="Type">
          {(i) => (
            <select id={i} name="type" required className={inputCls} defaultValue="ID_PROOF">
              {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="Name (optional)">{(i) => <input id={i} name="label" maxLength={100} placeholder="e.g. Aadhaar card" className={inputCls} />}</Field>
        <Field label="File (PDF, JPG, PNG, WebP · up to 10 MB)">
          {(i) => <input id={i} name="file" type="file" required accept="application/pdf,image/png,image/jpeg,image/webp" className="min-w-0 text-[13px]" />}
        </Field>
        <ErrorNote error={upload.error} />
        <button className={btnPrimary} disabled={upload.isPending}>
          <Upload size={15} /> {upload.isPending ? "Uploading…" : "Upload"}
        </button>
      </form>
    </div>
  );
}
