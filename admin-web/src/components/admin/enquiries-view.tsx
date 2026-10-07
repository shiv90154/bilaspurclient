"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useDeferredValue, useState, type FormEvent } from "react";
import {
  api,
  qs,
  type Batch,
  type Course,
  type Enquiry,
  type EnquiryStatus,
  type Paginated,
  type StudentRow,
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

const STATUSES: EnquiryStatus[] = ["NEW", "CONTACTED", "FOLLOW_UP", "CONVERTED", "LOST"];
const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || undefined;

export function EnquiriesView({ canConvert }: { canConvert: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [converting, setConverting] = useState<Enquiry | null>(null);
  const deferredSearch = useDeferredValue(search);

  const list = useQuery({
    queryKey: ["enquiries", { deferredSearch, status, page }],
    queryFn: () =>
      api<Paginated<Enquiry>>(`/enquiries${qs({ search: deferredSearch, status, page, limit: 20 })}`),
    placeholderData: (prev) => prev,
  });

  const setEnquiryStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EnquiryStatus }) =>
      api(`/enquiries/${id}`, { method: "PATCH", body: { status } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["enquiries"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Enquiries"
        subtitle="Track leads, follow up and convert them into students"
        action={
          <button className={btnPrimary} onClick={() => setAdding(true)}>
            <Plus size={16} /> Add enquiry
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className={inputCls}
          placeholder="Search name or phone"
          aria-label="Search enquiries"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className={inputCls} aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
      </div>

      <ErrorNote error={list.error ?? setEnquiryStatus.error} />

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="rtable w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-b border-line text-[11.5px] uppercase tracking-wide text-sub">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Interested in</th>
              <th className="px-4 py-3">Follow-up</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.data?.items.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3">
                  <div className="font-semibold">{e.name}</div>
                  <div className="text-[12px] text-sub">{e.phone}{e.source ? ` · ${e.source}` : ""}</div>
                </td>
                <td data-label="Interested in" className="px-4 py-3 text-sub">{e.courseInterest?.name ?? "—"}</td>
                <td data-label="Follow-up" className="px-4 py-3 text-sub">
                  {e.followUpDate ? format(new Date(e.followUpDate), "d MMM yyyy") : "—"}
                </td>
                <td data-label="Status" className="px-4 py-3">
                  {e.status === "CONVERTED" ? (
                    <Badge tone="green">CONVERTED</Badge>
                  ) : (
                    <select
                      aria-label={`Status of ${e.name}`}
                      className="h-8 rounded-lg border border-line bg-surface px-2 text-[12px]"
                      value={e.status}
                      onChange={(ev) => setEnquiryStatus.mutate({ id: e.id, status: ev.target.value as EnquiryStatus })}
                    >
                      {STATUSES.filter((s) => s !== "CONVERTED").map((s) => (
                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {canConvert && e.status !== "CONVERTED" && e.status !== "LOST" && (
                    <button className={btnGhost + " !h-8 !px-3"} onClick={() => setConverting(e)}>
                      Convert
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {list.data?.items.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sub">No enquiries found.</td></tr>
            )}
            {list.isPending && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sub">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {list.data && <Pager page={list.data.page} limit={list.data.limit} total={list.data.total} onPage={setPage} />}

      {adding && <AddEnquiry onClose={() => setAdding(false)} />}
      {converting && <ConvertDialog enquiry={converting} onClose={() => setConverting(null)} />}
    </div>
  );
}

function AddEnquiry({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: () => api<Paginated<Course>>(`/courses${qs({ limit: 100 })}`),
  });
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api("/enquiries", { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["enquiries"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      onClose();
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      name: val(f, "name"),
      phone: val(f, "phone"),
      email: val(f, "email"),
      courseInterestId: val(f, "courseInterestId"),
      source: val(f, "source"),
      followUpDate: val(f, "followUpDate"),
      notes: val(f, "notes"),
    });
  };

  return (
    <Modal title="Add enquiry" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Name *">{(id) => <input id={id} name="name" required maxLength={100} className={inputCls} />}</Field>
          <Field label="Phone (10 digits) *">
            {(id) => <input id={id} name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" className={inputCls} />}
          </Field>
          <Field label="Email">{(id) => <input id={id} name="email" type="email" className={inputCls} />}</Field>
          <Field label="Source">{(id) => <input id={id} name="source" placeholder="Walk-in, Instagram…" className={inputCls} />}</Field>
          <Field label="Interested course">
            {(id) => (
              <select id={id} name="courseInterestId" className={inputCls}>
                <option value="">Not decided</option>
                {courses.data?.items.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Follow-up date">{(id) => <input id={id} name="followUpDate" type="date" className={inputCls} />}</Field>
        </div>
        <Field label="Notes">{(id) => <textarea id={id} name="notes" rows={2} maxLength={1000} className={inputCls + " h-auto py-2"} />}</Field>
        <ErrorNote error={save.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Saving…" : "Add enquiry"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ConvertDialog({ enquiry, onClose }: { enquiry: Enquiry; onClose: () => void }) {
  const qc = useQueryClient();
  const [result, setResult] = useState<(StudentRow & { temporaryPassword?: string }) | null>(null);
  const batches = useQuery({
    queryKey: ["batches", "all"],
    queryFn: () => api<Paginated<Batch>>(`/batches${qs({ limit: 100, active: true })}`),
  });
  const convert = useMutation({
    mutationFn: (batchId?: string) =>
      api<StudentRow & { temporaryPassword?: string }>(`/enquiries/${enquiry.id}/convert`, {
        method: "POST",
        body: { batchId },
      }),
    onSuccess: (s) => {
      for (const key of ["enquiries", "students", "dashboard-summary"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      setResult(s);
    },
  });

  if (result) {
    return (
      <Modal title="Converted to student" onClose={onClose}>
        <p className="text-[13.5px]">
          <b>{result.user.name}</b> can log in with phone <b>{result.user.phone}</b>.
        </p>
        {result.temporaryPassword && (
          <div className="mt-3 rounded-[10px] bg-accent-tint p-3 text-[13px]">
            Temporary password (shown only once): <code className="font-bold">{result.temporaryPassword}</code>
          </div>
        )}
        <button className={btnPrimary + " mt-5"} onClick={onClose}>Done</button>
      </Modal>
    );
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    convert.mutate(val(new FormData(e.currentTarget), "batchId"));
  };

  return (
    <Modal title={`Convert ${enquiry.name}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <p className="text-[13px] text-sub">
          This creates a student account for {enquiry.phone} and marks the enquiry as converted.
        </p>
        <Field label="Enrol in batch">
          {(id) => (
            <select id={id} name="batchId" className={inputCls}>
              <option value="">No batch yet</option>
              {batches.data?.items.map((b) => <option key={b.id} value={b.id}>{b.course?.name} · {b.name}</option>)}
            </select>
          )}
        </Field>
        <ErrorNote error={convert.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={convert.isPending}>{convert.isPending ? "Converting…" : "Convert"}</button>
        </div>
      </form>
    </Modal>
  );
}
