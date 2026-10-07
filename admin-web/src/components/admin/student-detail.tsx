"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Camera, Download, ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  api,
  apiForm,
  fileHref,
  qs,
  type Batch,
  type DocumentType,
  type Paginated,
  type StudentDocument,
  type StudentRecords,
  type StudentStatus,
} from "@/lib/api";
import { Badge, btnGhost, btnPrimary, ErrorNote, Field, inputCls } from "@/components/ui";
import { ResetPasswordButton } from "@/components/password";

interface StudentDetailData {
  id: string;
  admissionNo: string | null;
  dob: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  address: string | null;
  city: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  notes: string | null;
  status: StudentStatus;
  photoUrl: string | null;
  createdAt: string;
  user: { id: string; name: string; phone: string; email: string | null; lastLoginAt: string | null };
  academic: { prevSchool: string | null; prevClass: string | null; prevMarks: string | null; targetExam: string | null } | null;
  batches: { status: string; joinedAt: string; batch: { id: string; name: string; course: { name: string } } }[];
}

interface DeviceRow {
  id: string;
  name: string | null;
  platform: string;
  status: string;
  lastSeenAt: string;
}

const STATUSES: StudentStatus[] = ["PENDING", "ACTIVE", "INACTIVE", "COMPLETED", "DROPPED"];
const STATUS_TONE: Record<StudentStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  ACTIVE: "green",
  PENDING: "amber",
  INACTIVE: "gray",
  COMPLETED: "blue",
  DROPPED: "red",
};
const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: "ID_PROOF", label: "ID proof (Aadhaar etc.)" },
  { value: "MARKSHEET", label: "Marksheet" },
  { value: "PHOTO", label: "Photo" },
  { value: "OTHER", label: "Other" },
];
const DOC_LABEL: Record<string, string> = Object.fromEntries(DOC_TYPES.map((d) => [d.value, d.label.replace(/ \(.*/, "")]));

const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || undefined;
const day = (d: string | null) => (d ? format(new Date(d), "d MMM yyyy") : "—");
const size = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

type Tab = "profile" | "records" | "documents" | "batches";

export function StudentDetail({ id, isAdmin }: { id: string; isAdmin: boolean }) {
  const key = ["student", id];
  const [tab, setTab] = useState<Tab>("profile");
  const { data: s, error, isPending } = useQuery({
    queryKey: key,
    queryFn: () => api<StudentDetailData>(`/students/${id}`),
  });

  if (error) return <ErrorNote error={error} />;
  if (isPending) return <p className="text-[13px] text-sub">Loading…</p>;

  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "records", label: "Tests & attendance" },
    ...(isAdmin ? [{ id: "documents" as const, label: "Documents" }] : []),
    { id: "batches", label: isAdmin ? "Batches & devices" : "Batches" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">
        <ArrowLeft size={15} /> All students
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar s={s} isAdmin={isAdmin} queryKey={key} />
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-2 break-words text-[20px] font-bold sm:text-[23px]">
              {s.user.name} <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
            </h1>
            <p className="mt-1 break-words text-[13px] text-sub">
              {s.admissionNo ? `Adm. ${s.admissionNo} · ` : ""}
              {s.user.phone}
              {s.user.email ? ` · ${s.user.email}` : ""}
            </p>
            <p className="mt-0.5 text-[12px] text-sub">
              Registered {day(s.createdAt)} ·{" "}
              {s.user.lastLoginAt ? `last login ${format(new Date(s.user.lastLoginAt), "d MMM, h:mm a")}` : "never logged in"}
            </p>
          </div>
        </div>
        {isAdmin && <ResetPasswordButton userId={s.user.id} name={s.user.name} />}
      </header>

      <div role="tablist" aria-label="Student sections" className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-semibold sm:px-4 ${
              tab === t.id ? "border-primary text-primary-dark" : "border-transparent text-sub hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "profile" && (isAdmin ? <ProfileForm s={s} queryKey={key} /> : <ProfileReadOnly s={s} />)}
        {tab === "records" && <RecordsPanel studentId={s.id} />}
        {tab === "documents" && isAdmin && <DocumentsPanel studentId={s.id} />}
        {tab === "batches" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <BatchesCard s={s} isAdmin={isAdmin} queryKey={key} />
            {isAdmin && <DevicesCard userId={s.user.id} />}
          </div>
        )}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function Avatar({ s, isAdmin, queryKey }: { s: StudentDetailData; isAdmin: boolean; queryKey: unknown[] }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const done = () => void qc.invalidateQueries({ queryKey });
  const upload = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiForm(`/students/${s.id}/photo`, fd);
    },
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: () => api(`/students/${s.id}/photo`, { method: "DELETE" }),
    onSuccess: done,
  });
  const err = upload.error ?? remove.error;

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div className="relative">
        {s.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed link, not a static asset
          <img src={fileHref(s.photoUrl)} alt={`Photo of ${s.user.name}`} className="size-[72px] rounded-full border border-line object-cover" />
        ) : (
          <span className="flex size-[72px] items-center justify-center rounded-full bg-primary-tint font-display text-[22px] font-bold text-primary">
            {initials(s.user.name)}
          </span>
        )}
        {isAdmin && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={upload.isPending}
            aria-label={s.photoUrl ? "Change photo" : "Add photo"}
            className="absolute -bottom-1 -right-1 rounded-full border border-line bg-surface p-1.5 text-sub shadow-sm hover:text-primary"
          >
            <Camera size={14} />
          </button>
        )}
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
      {isAdmin && s.photoUrl && (
        <button type="button" className="text-[11px] font-semibold text-danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
          Remove
        </button>
      )}
      {err && (
        <p role="alert" className="max-w-[140px] text-center text-[11px] text-danger">
          {err.message}
        </p>
      )}
    </div>
  );
}

function ProfileReadOnly({ s }: { s: StudentDetailData }) {
  const rows: [string, string | null][] = [
    ["Admission no", s.admissionNo],
    ["Date of birth", s.dob ? day(s.dob) : null],
    ["Gender", s.gender ? s.gender.charAt(0) + s.gender.slice(1).toLowerCase() : null],
    ["City", s.city],
    ["Guardian", s.guardianName],
    ["Guardian phone", s.guardianPhone],
    ["Previous school", s.academic?.prevSchool ?? null],
    ["Previous class", s.academic?.prevClass ?? null],
    ["Target exam", s.academic?.targetExam ?? null],
  ];
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <dl className="grid grid-cols-1 gap-4 text-[13px] min-[400px]:grid-cols-2 sm:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[12px] text-sub">{k}</dt>
            <dd className="break-words font-semibold">{v ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ProfileForm({ s, queryKey }: { s: StudentDetailData; queryKey: unknown[] }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/students/${s.id}`, { method: "PATCH", body }),
    onSuccess: () => {
      setSaved(true);
      void qc.invalidateQueries({ queryKey });
      void qc.invalidateQueries({ queryKey: ["students"] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/students/${s.id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["students"] });
      router.push("/students");
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaved(false);
    const f = new FormData(e.currentTarget);
    const marks = val(f, "prevMarks");
    save.mutate({
      name: val(f, "name"),
      phone: val(f, "phone"),
      email: val(f, "email"),
      status: val(f, "status"),
      admissionNo: val(f, "admissionNo"),
      dob: val(f, "dob"),
      gender: val(f, "gender"),
      city: val(f, "city"),
      address: val(f, "address"),
      guardianName: val(f, "guardianName"),
      guardianPhone: val(f, "guardianPhone"),
      notes: val(f, "notes"),
      academic: {
        prevSchool: val(f, "prevSchool"),
        prevClass: val(f, "prevClass"),
        prevMarks: marks ? Number(marks) : undefined,
        targetExam: val(f, "targetExam"),
      },
    });
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      {/* key remounts the form with fresh defaults after a save refetch */}
      <form key={JSON.stringify(s)} onSubmit={onSubmit} className="flex flex-col gap-5">
        <fieldset className="flex min-w-0 flex-col gap-3.5">
          <legend className="mb-3 text-[14px] font-bold">Personal</legend>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Full name">{(i) => <input id={i} name="name" required defaultValue={s.user.name} className={inputCls} />}</Field>
            <Field label="Status">
              {(i) => (
                <select id={i} name="status" defaultValue={s.status} className={inputCls}>
                  {STATUSES.map((x) => <option key={x}>{x}</option>)}
                </select>
              )}
            </Field>
            <Field label="Admission no">{(i) => <input id={i} name="admissionNo" defaultValue={s.admissionNo ?? ""} className={inputCls} />}</Field>
            <Field label="Date of birth">{(i) => <input id={i} name="dob" type="date" defaultValue={s.dob?.slice(0, 10) ?? ""} className={inputCls} />}</Field>
            <Field label="Gender">
              {(i) => (
                <select id={i} name="gender" defaultValue={s.gender ?? ""} className={inputCls}>
                  <option value="">Not given</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              )}
            </Field>
          </div>
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-3.5">
          <legend className="mb-3 text-[14px] font-bold">Contact</legend>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Phone (login)">{(i) => <input id={i} name="phone" required pattern="[6-9][0-9]{9}" defaultValue={s.user.phone} className={inputCls} />}</Field>
            <Field label="Email">{(i) => <input id={i} name="email" type="email" defaultValue={s.user.email ?? ""} className={inputCls} />}</Field>
            <Field label="City">{(i) => <input id={i} name="city" defaultValue={s.city ?? ""} className={inputCls} />}</Field>
            <Field label="Guardian name">{(i) => <input id={i} name="guardianName" defaultValue={s.guardianName ?? ""} className={inputCls} />}</Field>
            <Field label="Guardian phone">{(i) => <input id={i} name="guardianPhone" pattern="[6-9][0-9]{9}" defaultValue={s.guardianPhone ?? ""} className={inputCls} />}</Field>
          </div>
          <Field label="Address">{(i) => <input id={i} name="address" defaultValue={s.address ?? ""} className={inputCls} />}</Field>
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-3.5">
          <legend className="mb-3 text-[14px] font-bold">Academic</legend>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Previous school">{(i) => <input id={i} name="prevSchool" defaultValue={s.academic?.prevSchool ?? ""} className={inputCls} />}</Field>
            <Field label="Previous class">{(i) => <input id={i} name="prevClass" defaultValue={s.academic?.prevClass ?? ""} className={inputCls} />}</Field>
            <Field label="Previous marks (%)">{(i) => <input id={i} name="prevMarks" type="number" step="0.01" min="0" max="100" defaultValue={s.academic?.prevMarks ?? ""} className={inputCls} />}</Field>
            <Field label="Target exam">{(i) => <input id={i} name="targetExam" defaultValue={s.academic?.targetExam ?? ""} className={inputCls} />}</Field>
          </div>
        </fieldset>

        <Field label="Internal notes (staff only)">{(i) => <textarea id={i} name="notes" rows={2} defaultValue={s.notes ?? ""} className={inputCls + " h-auto py-2"} />}</Field>
        <ErrorNote error={save.error ?? remove.error} />
        {saved && <p className="text-[12.5px] font-semibold text-success">Saved.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className={btnGhost + " text-danger"}
            disabled={remove.isPending}
            onClick={() => window.confirm(`Delete ${s.user.name}? Their login will be disabled.`) && remove.mutate()}
          >
            Delete student
          </button>
          <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-surface p-3.5 sm:p-4">
      <div className="text-[12px] font-semibold text-sub">{label}</div>
      <div className="mt-1.5 font-display text-[20px] font-extrabold sm:text-[22px]">{value}</div>
      {hint && <div className="mt-0.5 text-[11.5px] text-sub">{hint}</div>}
    </div>
  );
}

function RecordsPanel({ studentId }: { studentId: string }) {
  const { data: r, error, isPending } = useQuery({
    queryKey: ["student-records", studentId],
    queryFn: () => api<StudentRecords>(`/students/${studentId}/records`),
  });
  if (error) return <ErrorNote error={error} />;
  if (isPending) return <p className="text-[13px] text-sub">Loading…</p>;
  const m = r.summary;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Tests taken" value={m.testsTaken} hint={m.averagePercentage != null ? `Average ${m.averagePercentage}%` : "No results yet"} />
        <Stat
          label="Attendance"
          value={m.attendancePercentage != null ? `${m.attendancePercentage}%` : "—"}
          hint={`${m.classesAttended} of ${m.classesHeld} classes`}
        />
        <Stat label="Doubts asked" value={m.doubtsAsked} hint={`${m.doubtsOpen} still open`} />
        <Stat label="Notes opened" value={m.materialsOpened} hint={`${m.materialViews} opens in all`} />
      </div>

      <section className="rounded-2xl border border-line bg-surface">
        <h2 className="px-4 pt-4 text-[15px] font-bold sm:px-5 sm:pt-5">Test results</h2>
        <div className="overflow-x-auto">
          <table className="rtable mt-3 w-full min-w-[560px] text-left text-[13px]">
            <thead className="border-y border-line text-[11.5px] uppercase tracking-wide text-sub">
              <tr>
                <th className="px-5 py-2.5">Test</th>
                <th className="px-5 py-2.5">Date</th>
                <th className="px-5 py-2.5">Score</th>
                <th className="px-5 py-2.5">%</th>
                <th className="px-5 py-2.5">Right / wrong / skipped</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.tests.map((t) => (
                <tr key={t.attemptId}>
                  <td className="px-5 py-2.5 font-semibold">
                    <Link href={`/tests/${t.testId}`} className="hover:text-primary hover:underline">{t.title}</Link>
                  </td>
                  <td data-label="Date" className="px-5 py-2.5 text-sub">{day(t.submittedAt ?? t.startedAt)}</td>
                  <td data-label="Score" className="px-5 py-2.5">
                    {t.status === "IN_PROGRESS" ? <Badge tone="amber">In progress</Badge> : `${t.score ?? 0} / ${t.totalMarks}`}
                  </td>
                  <td data-label="%" className="px-5 py-2.5 font-semibold">{t.percentage != null ? `${t.percentage}%` : "—"}</td>
                  <td data-label="Right / wrong / skipped" className="px-5 py-2.5 text-sub">{t.correct} / {t.incorrect} / {t.unanswered}</td>
                </tr>
              ))}
              {r.tests.length === 0 && <tr><td colSpan={5} className="px-5 py-6 text-center text-sub">No tests taken yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="text-[15px] font-bold">Class attendance</h2>
          <ul className="mt-3 max-h-[360px] divide-y divide-line overflow-y-auto text-[13px]">
            {r.attendance.map((a) => (
              <li key={a.classId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  <span className="font-semibold">{a.title}</span>
                  <span className="block text-[12px] text-sub">{format(new Date(a.startAt), "d MMM, h:mm a")} · {a.batch}</span>
                </span>
                <Badge tone={a.present ? "green" : "red"}>{a.present ? "Present" : "Absent"}</Badge>
              </li>
            ))}
            {r.attendance.length === 0 && <li className="py-2.5 text-sub">No classes held since they joined.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="text-[15px] font-bold">Doubts</h2>
          <ul className="mt-3 max-h-[360px] divide-y divide-line overflow-y-auto text-[13px]">
            {r.doubts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="min-w-0">
                  <span className="block break-words font-semibold">{d.title}</span>
                  <span className="block text-[12px] text-sub">
                    {day(d.createdAt)}{d.subject ? ` · ${d.subject}` : ""} · {d.messages} messages
                  </span>
                </span>
                <Badge tone={d.status === "RESOLVED" ? "green" : d.status === "ANSWERED" ? "blue" : "amber"}>{d.status}</Badge>
              </li>
            ))}
            {r.doubts.length === 0 && <li className="py-2.5 text-sub">No doubts asked.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function DocumentsPanel({ studentId }: { studentId: string }) {
  const qc = useQueryClient();
  const key = ["student-documents", studentId];
  const [formKey, setFormKey] = useState(0);
  const docs = useQuery({ queryKey: key, queryFn: () => api<StudentDocument[]>(`/students/${studentId}/documents`) });
  const upload = useMutation({
    mutationFn: (fd: FormData) => apiForm<StudentDocument>(`/students/${studentId}/documents`, fd),
    onSuccess: () => {
      setFormKey((k) => k + 1);
      void qc.invalidateQueries({ queryKey: key });
    },
  });
  const open = useMutation({
    mutationFn: ({ docId, download }: { docId: string; download: boolean }) =>
      api<{ url: string }>(`/students/${studentId}/documents/${docId}/url${qs({ download: download ? 1 : undefined })}`),
    onSuccess: ({ url }) => window.open(fileHref(url), "_blank", "noopener"),
  });
  const remove = useMutation({
    mutationFn: (docId: string) => api(`/students/${studentId}/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section className="min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-[15px] font-bold">Documents</h2>
        <p className="mt-1 text-[12px] text-sub">Private: only admins can open these, and every open is logged.</p>
        <ul className="mt-3 divide-y divide-line text-[13px]">
          {docs.data?.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 rounded-xl bg-primary-tint p-2 text-primary"><FileText size={16} aria-hidden="true" /></span>
                <span className="min-w-0">
                  <span className="block break-all font-semibold">{d.fileName}</span>
                  <span className="block text-[12px] text-sub">{DOC_LABEL[d.type]} · {size(d.size)} · {day(d.createdAt)}</span>
                </span>
              </span>
              <span className="flex gap-1.5">
                <button className={btnGhost + " !h-8 !px-3"} disabled={open.isPending} onClick={() => open.mutate({ docId: d.id, download: false })}>
                  <ExternalLink size={14} /> Open
                </button>
                <button
                  className={btnGhost + " !h-8 !px-3"}
                  disabled={open.isPending}
                  onClick={() => open.mutate({ docId: d.id, download: true })}
                  aria-label={`Download ${d.fileName}`}
                >
                  <Download size={14} />
                </button>
                <button
                  className={btnGhost + " !h-8 !px-3 text-danger"}
                  disabled={remove.isPending}
                  aria-label={`Delete ${d.fileName}`}
                  onClick={() => window.confirm(`Delete ${d.fileName}?`) && remove.mutate(d.id)}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </li>
          ))}
          {docs.data?.length === 0 && <li className="py-3 text-sub">No documents uploaded yet.</li>}
          {docs.isPending && <li className="py-3 text-sub">Loading…</li>}
        </ul>
        <div className="mt-3"><ErrorNote error={docs.error ?? open.error ?? remove.error} /></div>
      </section>

      <section className="h-fit rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="text-[15px] font-bold">Upload a document</h2>
        <form
          key={formKey}
          className="mt-4 flex flex-col gap-3.5"
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
      </section>
    </div>
  );
}

function BatchesCard({ s, isAdmin, queryKey }: { s: StudentDetailData; isAdmin: boolean; queryKey: unknown[] }) {
  const qc = useQueryClient();
  const all = useQuery({
    queryKey: ["batches", "all"],
    queryFn: () => api<Paginated<Batch>>(`/batches${qs({ limit: 100, active: true })}`),
    enabled: isAdmin,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey });
    void qc.invalidateQueries({ queryKey: ["students"] });
  };
  const add = useMutation({
    mutationFn: (batchId: string) => api(`/students/${s.id}/batches`, { method: "POST", body: { batchId } }),
    onSuccess: refresh,
  });
  const drop = useMutation({
    mutationFn: (batchId: string) => api(`/students/${s.id}/batches/${batchId}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const enrolled = new Set(s.batches.map((b) => b.batch.id));
  const options = all.data?.items.filter((b) => !enrolled.has(b.id)) ?? [];

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-[15px] font-bold">Batches</h2>
      <ul className="mt-3 divide-y divide-line text-[13px]">
        {s.batches.map((b) => (
          <li key={b.batch.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span>
              <span className="font-semibold">{b.batch.course.name} · {b.batch.name}</span>
              <span className="ml-2 text-sub">joined {format(new Date(b.joinedAt), "d MMM yyyy")}</span>
            </span>
            {isAdmin && (
              <button className="text-[12px] font-semibold text-danger" disabled={drop.isPending} onClick={() => drop.mutate(b.batch.id)}>
                Remove
              </button>
            )}
          </li>
        ))}
        {s.batches.length === 0 && <li className="py-2.5 text-sub">Not enrolled in any batch.</li>}
      </ul>
      {isAdmin && options.length > 0 && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const batchId = val(new FormData(e.currentTarget), "batchId");
            if (batchId) add.mutate(batchId);
          }}
        >
          <select name="batchId" aria-label="Batch to add" className={inputCls} defaultValue="">
            <option value="" disabled>Add to a batch…</option>
            {options.map((b) => <option key={b.id} value={b.id}>{b.course?.name} · {b.name}</option>)}
          </select>
          <button className={btnGhost} disabled={add.isPending}>Add</button>
        </form>
      )}
      <div className="mt-3"><ErrorNote error={add.error ?? drop.error} /></div>
    </section>
  );
}

function DevicesCard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const devices = useQuery({
    queryKey: ["devices", userId],
    queryFn: () => api<DeviceRow[]>(`/users/${userId}/devices`),
  });
  const reset = useMutation({
    mutationFn: () => api(`/users/${userId}/reset-device`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["devices", userId] }),
  });

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">Devices</h2>
        <button
          className={btnGhost + " !h-8 !px-3"}
          disabled={reset.isPending || !devices.data?.length}
          onClick={() =>
            window.confirm("Log this student out everywhere and forget all their devices?") && reset.mutate()
          }
        >
          Reset devices
        </button>
      </div>
      <p className="mt-1 text-[12px] text-sub">One student, one active device. Reset lets them log in on a new phone.</p>
      <ul className="mt-3 divide-y divide-line text-[13px]">
        {devices.data?.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span>
              <span className="font-semibold">{d.name ?? "Unknown device"}</span>
              <span className="ml-2 text-sub">{d.platform}</span>
            </span>
            <span className="flex items-center gap-2 text-[12px] text-sub">
              {format(new Date(d.lastSeenAt), "d MMM, h:mm a")}
              <Badge tone={d.status === "ACTIVE" ? "green" : "red"}>{d.status}</Badge>
            </span>
          </li>
        ))}
        {devices.data?.length === 0 && <li className="py-2.5 text-sub">No devices registered.</li>}
      </ul>
      <div className="mt-3"><ErrorNote error={devices.error ?? reset.error} /></div>
    </section>
  );
}
