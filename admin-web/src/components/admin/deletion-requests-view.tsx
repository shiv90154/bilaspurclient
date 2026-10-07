"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { UserX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api, qs, type DeletionRequestRow, type DeletionRequestStatus, type Paginated } from "@/lib/api";
import { Badge, btnGhost, EmptyState, ErrorNote, inputCls, PageHeader, Pager } from "@/components/ui";

const TONE: Record<DeletionRequestStatus, "amber" | "green" | "gray"> = { PENDING: "amber", COMPLETED: "green", REJECTED: "gray" };

export function DeletionRequestsView() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<DeletionRequestStatus | "">("PENDING");
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ["deletion-requests", status, page],
    queryFn: () => api<Paginated<DeletionRequestRow>>(`/privacy/deletion-requests${qs({ status, page, limit: 20 })}`),
  });
  const done = () => void qc.invalidateQueries({ queryKey: ["deletion-requests"] });
  const complete = useMutation({
    mutationFn: (id: string) => api(`/privacy/deletion-requests/${id}/complete`, { method: "POST", body: {} }),
    onSuccess: done,
  });
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api(`/privacy/deletion-requests/${id}/reject`, { method: "POST", body: { note } }),
    onSuccess: done,
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Account deletion requests"
        subtitle="From the app (Profile → Delete my account) and the public /delete-account page. Play Store expects them handled within 30 days."
      />
      <div className="max-w-xs">
        <select
          aria-label="Filter by status"
          className={inputCls}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as DeletionRequestStatus | "");
            setPage(1);
          }}
        >
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All</option>
        </select>
      </div>
      <ErrorNote error={list.error ?? complete.error ?? reject.error} />

      {list.data?.items.length === 0 ? (
        <EmptyState icon={UserX} title="No requests" text="Nobody has asked to delete their account." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="rtable w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-line text-[11.5px] uppercase tracking-wide text-sub">
              <tr>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.data?.items.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-[12px] text-sub">{r.phone}</div>
                    {r.reason && <div className="mt-1 text-[12px] text-sub">“{r.reason}”</div>}
                  </td>
                  <td data-label="Account" className="px-4 py-3">
                    {r.user?.student ? (
                      <Link href={`/students/${r.user.student.id}`} className="font-semibold text-primary hover:underline">
                        Student{r.user.student.admissionNo ? ` · ${r.user.student.admissionNo}` : ""}
                      </Link>
                    ) : r.user ? (
                      <span className="capitalize">{r.user.role.toLowerCase()}</span>
                    ) : (
                      <span className="text-danger">No account with this phone</span>
                    )}
                  </td>
                  <td data-label="From" className="px-4 py-3 text-sub">
                    {r.source === "APP" ? "App" : "Website"} · {format(new Date(r.createdAt), "d MMM yyyy")}
                  </td>
                  <td data-label="Status" className="px-4 py-3">
                    <Badge tone={TONE[r.status]}>{r.status}</Badge>
                    {r.note && <div className="mt-1 text-[12px] text-sub">{r.note}</div>}
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-4 py-3 text-right">
                    {r.status === "PENDING" && (
                      <>
                        {r.user && (
                          <button
                            className={btnGhost + " !h-8 !px-3 text-danger"}
                            disabled={complete.isPending}
                            onClick={() =>
                              window.confirm(
                                `Permanently delete the personal data of ${r.name} (${r.phone})?\n\nName, phone, email, address, guardian details, photo, documents and devices are removed and they can no longer log in. This cannot be undone.`,
                              ) && complete.mutate(r.id)
                            }
                          >
                            Delete data
                          </button>
                        )}
                        <button
                          className={btnGhost + " !h-8 !px-3"}
                          disabled={reject.isPending}
                          onClick={() => {
                            const note = window.prompt("Why is this request rejected? (saved with the request)");
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
              {list.isPending && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sub">Loading…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {list.data && list.data.total > list.data.limit && (
        <Pager page={list.data.page} limit={list.data.limit} total={list.data.total} onPage={setPage} />
      )}
    </div>
  );
}
