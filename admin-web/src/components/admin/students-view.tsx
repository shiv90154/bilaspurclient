"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState, type FormEvent } from "react";
import {
  api,
  qs,
  type Batch,
  type Paginated,
  type StudentRow,
  type StudentStatus,
} from "@/lib/api";
import {
  Badge,
  btnGhost,
  btnPrimary,
  ErrorNote,
  Field,
  inputCls,
  Modal,
  PageHeader,
  Pager,
} from "@/components/ui";

const STATUSES: StudentStatus[] = ["PENDING", "ACTIVE", "INACTIVE", "COMPLETED", "DROPPED"];
const TONE: Record<StudentStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  ACTIVE: "green",
  PENDING: "amber",
  INACTIVE: "gray",
  COMPLETED: "blue",
  DROPPED: "red",
};

export function StudentsView({ canEdit }: { canEdit: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [batchId, setBatchId] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const deferredSearch = useDeferredValue(search);

  const batches = useQuery({
    queryKey: ["batches", "all"],
    queryFn: () => api<Paginated<Batch>>(`/batches${qs({ limit: 100, active: true })}`),
  });
  const students = useQuery({
    queryKey: ["students", { deferredSearch, status, batchId, page }],
    queryFn: () =>
      api<Paginated<StudentRow>>(
        `/students${qs({ search: deferredSearch, status, batchId, page, limit: 20 })}`,
      ),
    placeholderData: (prev) => prev,
  });

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Students"
        subtitle="Search, filter and manage every student"
        action={
          canEdit && (
            <button className={btnPrimary} onClick={() => setAdding(true)}>
              <Plus size={16} /> Add student
            </button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <input
          className={inputCls}
          placeholder="Search name, phone or admission no"
          aria-label="Search students"
          value={search}
          onChange={(e) => reset(() => setSearch(e.target.value))}
        />
        <select className={inputCls} aria-label="Filter by status" value={status} onChange={(e) => reset(() => setStatus(e.target.value))}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className={inputCls} aria-label="Filter by batch" value={batchId} onChange={(e) => reset(() => setBatchId(e.target.value))}>
          <option value="">All batches</option>
          {batches.data?.items.map((b) => (
            <option key={b.id} value={b.id}>{b.course?.name} · {b.name}</option>
          ))}
        </select>
      </div>

      <ErrorNote error={students.error} />

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="border-b border-line text-[11.5px] uppercase tracking-wide text-sub">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Batches</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {students.data?.items.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3">
                  <Link href={`/students/${s.id}`} className="font-semibold text-primary hover:underline">
                    {s.user.name}
                  </Link>
                  <div className="text-[12px] text-sub">{s.admissionNo ?? "No admission no"}</div>
                </td>
                <td className="px-4 py-3">{s.user.phone}</td>
                <td className="px-4 py-3 text-sub">
                  {s.batches.map((b) => b.batch.name).join(", ") || "—"}
                </td>
                <td className="px-4 py-3"><Badge tone={TONE[s.status]}>{s.status}</Badge></td>
              </tr>
            ))}
            {students.data?.items.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sub">No students found.</td></tr>
            )}
            {students.isPending && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sub">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {students.data && (
        <Pager page={students.data.page} limit={students.data.limit} total={students.data.total} onPage={setPage} />
      )}

      {adding && <AddStudent batches={batches.data?.items ?? []} onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddStudent({ batches, onClose }: { batches: Batch[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [created, setCreated] = useState<{ name: string; phone: string; password?: string } | null>(null);

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<StudentRow & { temporaryPassword?: string }>("/students", { method: "POST", body }),
    onSuccess: (s) => {
      void qc.invalidateQueries({ queryKey: ["students"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      setCreated({ name: s.user.name, phone: s.user.phone, password: s.temporaryPassword });
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim() || undefined;
    const batchId = text("batchId");
    create.mutate({
      name: text("name"),
      phone: text("phone"),
      email: text("email"),
      guardianName: text("guardianName"),
      guardianPhone: text("guardianPhone"),
      admissionNo: text("admissionNo"),
      batchIds: batchId ? [batchId] : undefined,
    });
  }

  if (created) {
    return (
      <Modal title="Student added" onClose={onClose}>
        <p className="text-[13.5px]">
          <b>{created.name}</b> can now log in with phone <b>{created.phone}</b>.
        </p>
        {created.password && (
          <div className="mt-3 rounded-[10px] bg-accent-tint p-3 text-[13px]">
            Temporary password (shown only once):{" "}
            <code className="font-bold">{created.password}</code>
          </div>
        )}
        <button className={btnPrimary + " mt-5"} onClick={onClose}>Done</button>
      </Modal>
    );
  }

  return (
    <Modal title="Add student" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="Full name *">{(id) => <input id={id} name="name" required maxLength={100} className={inputCls} />}</Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Phone (10 digits) *">
            {(id) => <input id={id} name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" className={inputCls} />}
          </Field>
          <Field label="Email">{(id) => <input id={id} name="email" type="email" className={inputCls} />}</Field>
          <Field label="Guardian name">{(id) => <input id={id} name="guardianName" className={inputCls} />}</Field>
          <Field label="Guardian phone">
            {(id) => <input id={id} name="guardianPhone" inputMode="numeric" pattern="[6-9][0-9]{9}" className={inputCls} />}
          </Field>
          <Field label="Admission no">{(id) => <input id={id} name="admissionNo" className={inputCls} />}</Field>
          <Field label="Batch">
            {(id) => (
              <select id={id} name="batchId" className={inputCls}>
                <option value="">No batch yet</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.course?.name} · {b.name}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <ErrorNote error={create.error} />
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Add student"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
