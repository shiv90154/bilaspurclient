"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { UserCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api, qs, type Batch, type Paginated } from "@/lib/api";
import { Badge, btnGhost, btnPrimary, EmptyState, ErrorNote, Field, Modal, PageHeader, Pager } from "@/components/ui";

interface Registration {
  id: string;
  status: "PENDING" | "ACTIVE" | "DROPPED";
  registeredVia: "APP" | "WEB";
  reviewNote: string | null;
  createdAt: string;
  user: { id: string; name: string; phone: string; email: string | null; emailVerifiedAt: string | null; lastLoginAt: string | null };
  requestedCourse: { id: string; name: string } | null;
  batches: { batch: { id: string; name: string } }[];
}

type Status = Registration["status"];

export function RegistrationsView() {
  const [status, setStatus] = useState<Status>("PENDING");
  const [page, setPage] = useState(1);
  const [approving, setApproving] = useState<Registration | null>(null);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["registrations", status, page],
    queryFn: () => api<Paginated<Registration>>(`/students/registrations${qs({ status, page, limit: 20 })}`),
  });
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => api(`/students/${id}/reject`, { method: "POST", body: { note } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["registrations"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Registrations"
        subtitle="Students who signed up in the app. Until you approve them they only see free demo notes and tests."
      />
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Status">
        {(["PENDING", "ACTIVE", "DROPPED"] as Status[]).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${status === s ? "bg-primary-tint text-primary-dark" : "text-sub hover:bg-bg"}`}
          >
            {s === "PENDING" ? "Waiting" : s === "ACTIVE" ? "Approved" : "Rejected"}
          </button>
        ))}
      </div>
      <ErrorNote error={list.error ?? reject.error} />

      {list.data?.items.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title={status === "PENDING" ? "No one is waiting" : "Nothing here yet"}
          text="New sign-ups from the app appear here. Mark some notes or tests as “Free demo” so they have something to try."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="rtable w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-line text-[11.5px] uppercase tracking-wide text-sub">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Course asked for</th>
                <th className="px-4 py-3">Signed up</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.data?.items.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <Link href={`/students/${r.id}`} className="font-semibold text-primary hover:underline">{r.user.name}</Link>
                    <div className="text-[12px] text-sub">{r.user.phone}</div>
                  </td>
                  <td data-label="Course asked for" className="px-4 py-3">
                    {r.requestedCourse?.name ?? "—"}
                    {r.batches.length > 0 && <div className="text-[12px] text-sub">In: {r.batches.map((b) => b.batch.name).join(", ")}</div>}
                    {r.reviewNote && <div className="text-[12px] text-sub">Note: {r.reviewNote}</div>}
                  </td>
                  <td data-label="Signed up" className="px-4 py-3 text-sub">
                    {format(new Date(r.createdAt), "d MMM yyyy")} · {r.registeredVia === "APP" ? "app" : "website"}
                    <div className="text-[12px]">
                      {r.user.lastLoginAt ? `active ${formatDistanceToNow(new Date(r.user.lastLoginAt), { addSuffix: true })}` : "not logged in yet"}
                    </div>
                  </td>
                  <td data-label="Email" className="px-4 py-3">
                    <span className="break-all">{r.user.email}</span>{" "}
                    {r.user.emailVerifiedAt && <Badge tone="green">verified</Badge>}
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-4 py-3 text-right">
                    {r.status === "PENDING" && (
                      <>
                        <button className={btnPrimary + " !h-8 !px-3"} onClick={() => setApproving(r)}>Approve</button>
                        <button
                          className={btnGhost + " !h-8 !px-3 text-danger"}
                          disabled={reject.isPending}
                          onClick={() => {
                            const note = window.prompt(`Reject ${r.user.name}? They will be told by email. Reason (optional):`);
                            if (note !== null) reject.mutate({ id: r.id, note });
                          }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {list.isPending && <tr><td colSpan={5} className="px-4 py-8 text-center text-sub">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {list.data && list.data.total > list.data.limit && (
        <Pager page={list.data.page} limit={list.data.limit} total={list.data.total} onPage={setPage} />
      )}
      {approving && <ApproveModal reg={approving} onClose={() => setApproving(null)} />}
    </div>
  );
}

function ApproveModal({ reg, onClose }: { reg: Registration; onClose: () => void }) {
  const qc = useQueryClient();
  const batches = useQuery({
    queryKey: ["batches", "all"],
    queryFn: () => api<Paginated<Batch>>(`/batches${qs({ limit: 100, active: true })}`),
  });
  const approve = useMutation({
    mutationFn: (batchIds: string[]) => api(`/students/${reg.id}/approve`, { method: "POST", body: { batchIds } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["registrations"] });
      void qc.invalidateQueries({ queryKey: ["students"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      onClose();
    },
  });
  // Batches of the course they asked for come first.
  const all = batches.data?.items ?? [];
  const sorted = [...all].sort((a, b) => Number(b.courseId === reg.requestedCourse?.id) - Number(a.courseId === reg.requestedCourse?.id));

  return (
    <Modal title={`Approve ${reg.user.name}`} onClose={onClose}>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          approve.mutate(new FormData(e.currentTarget).getAll("batchIds").map(String));
        }}
      >
        <p className="text-[13px] text-sub">
          Asked for <b className="text-ink">{reg.requestedCourse?.name ?? "no course"}</b>. Choose the batch(es) they join. They get
          full access straight away and an email (if email is set up).
        </p>
        <Field label="Batches">
          {() => (
            <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-[10px] border border-line p-3">
              {sorted.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" name="batchIds" value={b.id} defaultChecked={sorted.length === 1} />
                  {b.course?.name} · {b.name}
                  {b.courseId === reg.requestedCourse?.id && <Badge tone="blue">asked for</Badge>}
                </label>
              ))}
              {batches.data && sorted.length === 0 && <span className="text-[13px] text-sub">No active batches. Create one under Courses &amp; Batches.</span>}
            </div>
          )}
        </Field>
        <ErrorNote error={approve.error ?? batches.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={approve.isPending}>{approve.isPending ? "Approving…" : "Approve"}</button>
        </div>
      </form>
    </Modal>
  );
}
