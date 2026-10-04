"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, qs, type Batch, type Paginated, type StudentStatus } from "@/lib/api";
import {
  Badge,
  btnGhost,
  btnPrimary,
  ErrorNote,
  Field,
  inputCls,
  PageHeader,
} from "@/components/ui";

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
const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || undefined;

export function StudentDetail({ id, isAdmin }: { id: string; isAdmin: boolean }) {
  const key = ["student", id];
  const { data: s, error, isPending } = useQuery({
    queryKey: key,
    queryFn: () => api<StudentDetailData>(`/students/${id}`),
  });

  if (error) return <ErrorNote error={error} />;
  if (isPending) return <p className="text-[13px] text-sub">Loading…</p>;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">
        <ArrowLeft size={15} /> All students
      </Link>
      <PageHeader
        title={s.user.name}
        subtitle={`${s.user.phone}${s.user.email ? ` · ${s.user.email}` : ""}${
          s.user.lastLoginAt ? ` · last login ${format(new Date(s.user.lastLoginAt), "d MMM, h:mm a")}` : " · never logged in"
        }`}
        action={<Badge tone={s.status === "ACTIVE" ? "green" : "gray"}>{s.status}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {isAdmin ? <ProfileForm s={s} queryKey={key} /> : <ProfileReadOnly s={s} />}
        <div className="flex flex-col gap-4">
          <BatchesCard s={s} isAdmin={isAdmin} queryKey={key} />
          {isAdmin && <DevicesCard userId={s.user.id} />}
        </div>
      </div>
    </div>
  );
}

function ProfileReadOnly({ s }: { s: StudentDetailData }) {
  const rows: [string, string | null][] = [
    ["Admission no", s.admissionNo],
    ["City", s.city],
    ["Guardian", s.guardianName],
    ["Guardian phone", s.guardianPhone],
    ["Target exam", s.academic?.targetExam ?? null],
  ];
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-[15px] font-bold">Profile</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[12px] text-sub">{k}</dt>
            <dd className="font-semibold">{v ?? "—"}</dd>
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
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-[15px] font-bold">Profile</h2>
      {/* key remounts the form with fresh defaults after a save refetch */}
      <form key={JSON.stringify(s)} onSubmit={onSubmit} className="mt-4 flex flex-col gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Full name">{(i) => <input id={i} name="name" required defaultValue={s.user.name} className={inputCls} />}</Field>
          <Field label="Status">
            {(i) => (
              <select id={i} name="status" defaultValue={s.status} className={inputCls}>
                {STATUSES.map((x) => <option key={x}>{x}</option>)}
              </select>
            )}
          </Field>
          <Field label="Phone">{(i) => <input id={i} name="phone" required pattern="[6-9][0-9]{9}" defaultValue={s.user.phone} className={inputCls} />}</Field>
          <Field label="Email">{(i) => <input id={i} name="email" type="email" defaultValue={s.user.email ?? ""} className={inputCls} />}</Field>
          <Field label="Admission no">{(i) => <input id={i} name="admissionNo" defaultValue={s.admissionNo ?? ""} className={inputCls} />}</Field>
          <Field label="City">{(i) => <input id={i} name="city" defaultValue={s.city ?? ""} className={inputCls} />}</Field>
          <Field label="Guardian name">{(i) => <input id={i} name="guardianName" defaultValue={s.guardianName ?? ""} className={inputCls} />}</Field>
          <Field label="Guardian phone">{(i) => <input id={i} name="guardianPhone" pattern="[6-9][0-9]{9}" defaultValue={s.guardianPhone ?? ""} className={inputCls} />}</Field>
          <Field label="Previous school">{(i) => <input id={i} name="prevSchool" defaultValue={s.academic?.prevSchool ?? ""} className={inputCls} />}</Field>
          <Field label="Previous class">{(i) => <input id={i} name="prevClass" defaultValue={s.academic?.prevClass ?? ""} className={inputCls} />}</Field>
          <Field label="Previous marks (%)">{(i) => <input id={i} name="prevMarks" type="number" step="0.01" min="0" max="100" defaultValue={s.academic?.prevMarks ?? ""} className={inputCls} />}</Field>
          <Field label="Target exam">{(i) => <input id={i} name="targetExam" defaultValue={s.academic?.targetExam ?? ""} className={inputCls} />}</Field>
        </div>
        <Field label="Address">{(i) => <input id={i} name="address" defaultValue={s.address ?? ""} className={inputCls} />}</Field>
        <Field label="Internal notes">{(i) => <textarea id={i} name="notes" rows={2} defaultValue={s.notes ?? ""} className={inputCls + " h-auto py-2"} />}</Field>
        <ErrorNote error={save.error ?? remove.error} />
        {saved && <p className="text-[12.5px] font-semibold text-success">Saved.</p>}
        <div className="flex items-center justify-between gap-2">
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
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-[15px] font-bold">Batches</h2>
      <ul className="mt-3 divide-y divide-line text-[13px]">
        {s.batches.map((b) => (
          <li key={b.batch.id} className="flex items-center justify-between gap-2 py-2.5">
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
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
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
          <li key={d.id} className="flex items-center justify-between gap-2 py-2.5">
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
