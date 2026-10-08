"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Printer } from "lucide-react";
import { api, inr, PAYMENT_MODE_LABEL, type Payment } from "@/lib/api";
import { btnPrimary, ErrorNote, ListSkeleton } from "@/components/ui";

export function ReceiptView({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["payment", id], queryFn: () => api<Payment>(`/payments/${id}`) });
  const p = q.data;

  return (
    <div className="mx-auto max-w-xl px-4 py-8 print:p-0">
      <ErrorNote error={q.error} />
      {q.isPending && <ListSkeleton rows={1} />}
      {p && (
        <>
          <article className="rounded-2xl border border-line bg-surface p-6 print:border-0">
            <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
              <div>
                <h1 className="text-[18px] font-bold">{p.institute?.instituteName ?? "DHĪ"}</h1>
                {p.institute?.address && <p className="mt-0.5 text-[12px] text-sub">{p.institute.address}</p>}
                <p className="text-[12px] text-sub">
                  {[p.institute?.contactPhone, p.institute?.contactEmail].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] font-bold uppercase tracking-wide text-sub">Fee receipt</p>
                <p className="mt-0.5 font-mono text-[13px] font-bold">{p.receiptNo ?? "—"}</p>
              </div>
            </header>

            {p.status !== "PAID" && (
              <p className="mt-4 rounded-[10px] bg-danger-tint px-3 py-2 text-[12.5px] font-semibold text-danger">
                This payment is {p.status === "PENDING" ? "not completed" : p.status.toLowerCase()}. It is not a valid receipt.
              </p>
            )}

            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[13.5px]">
              <dt className="text-sub">Received from</dt>
              <dd className="font-semibold">{p.studentFee.student.user.name}</dd>
              <dt className="text-sub">Phone</dt>
              <dd>{p.studentFee.student.user.phone}</dd>
              {p.studentFee.student.admissionNo && (
                <>
                  <dt className="text-sub">Admission no.</dt>
                  <dd>{p.studentFee.student.admissionNo}</dd>
                </>
              )}
              <dt className="text-sub">For</dt>
              <dd>
                {p.studentFee.plan.name}
                <span className="text-sub"> ({p.studentFee.plan.course.name}{p.studentFee.plan.batch ? `, ${p.studentFee.plan.batch.name}` : ""})</span>
              </dd>
              <dt className="text-sub">Date</dt>
              <dd>{format(new Date(p.approvedAt ?? p.createdAt), "d MMM yyyy, h:mm a")}</dd>
              <dt className="text-sub">Paid by</dt>
              <dd>{PAYMENT_MODE_LABEL[p.mode]}</dd>
              {p.razorpayPaymentId && (
                <>
                  <dt className="text-sub">Payment ID</dt>
                  <dd className="font-mono text-[12.5px]">{p.razorpayPaymentId}</dd>
                </>
              )}
              {p.notes && (
                <>
                  <dt className="text-sub">Reference</dt>
                  <dd>{p.notes}</dd>
                </>
              )}
            </dl>

            <div className="mt-5 flex items-center justify-between rounded-xl bg-bg px-4 py-3">
              <span className="text-[13px] font-semibold">Amount received</span>
              <span className="text-[20px] font-bold">{inr(p.amount)}</span>
            </div>
            <p className="mt-2 text-[12px] text-sub">
              Course fee {inr(p.studentFee.total)}
              {Number(p.studentFee.discount) > 0 ? `, discount ${inr(p.studentFee.discount)}` : ""} · fee status: {p.studentFee.status.toLowerCase()}
            </p>
            <p className="mt-6 text-[11.5px] text-sub">This is a computer-generated receipt and needs no signature.</p>
          </article>
          <div className="mt-4 flex justify-center print:hidden">
            <button className={btnPrimary} onClick={() => window.print()}>
              <Printer size={16} /> Print / save as PDF
            </button>
          </div>
        </>
      )}
    </div>
  );
}
