"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { IndianRupee, Plus, Receipt, Tag } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  api,
  inr,
  offerRunning,
  PAYMENT_MODE_LABEL,
  qs,
  type Batch,
  type FeePlan,
  type Paginated,
  type Payment,
  type PaymentMode,
  type PaymentStatus,
} from "@/lib/api";
import {
  Badge,
  btnGhost,
  btnPrimary,
  EmptyState,
  ErrorNote,
  Field,
  inputCls,
  ListSkeleton,
  Modal,
  PageHeader,
  Pager,
} from "@/components/ui";

const STATUS_TONE: Record<PaymentStatus, "green" | "amber" | "red" | "gray"> = {
  PAID: "green",
  PENDING: "amber",
  FAILED: "red",
  REJECTED: "red",
  REFUNDED: "gray",
};

export function FeesView() {
  const [tab, setTab] = useState<"payments" | "plans">("payments");
  const [dialog, setDialog] = useState<"plan" | "offline" | null>(null);
  const [editing, setEditing] = useState<FeePlan | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Fees & payments"
        subtitle="Course fees shown on the website, online payments and cash/UPI entries"
        action={
          <div className="flex gap-2">
            <button className={btnGhost} onClick={() => setDialog("plan")}>
              <Plus size={16} /> Course fee
            </button>
            <button className={btnPrimary} onClick={() => setDialog("offline")}>
              <Plus size={16} /> Record payment
            </button>
          </div>
        }
      />

      <div role="tablist" className="flex gap-1 rounded-[12px] border border-line bg-surface p-1 text-[13px] font-semibold sm:w-fit">
        {(["payments", "plans"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-[9px] px-4 py-2 sm:flex-none ${tab === t ? "bg-primary text-white" : "text-sub hover:bg-bg"}`}
          >
            {t === "payments" ? "Payments" : "Course fees"}
          </button>
        ))}
      </div>

      {tab === "payments" ? <PaymentsList /> : <PlansList onAdd={() => setDialog("plan")} onEdit={setEditing} />}

      {dialog === "plan" && <PlanDialog onClose={() => setDialog(null)} />}
      {editing && <PlanDialog plan={editing} onClose={() => setEditing(null)} />}
      {dialog === "offline" && <OfflineDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

function PaymentsList() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PaymentStatus | "">("PAID");
  const [search, setSearch] = useState("");

  const payments = useQuery({
    queryKey: ["payments", page, status, search],
    queryFn: () =>
      api<Paginated<Payment> & { paidTotal: string }>(`/payments${qs({ page, limit: 20, status, search: search.trim() })}`),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <input
          className={inputCls + " sm:max-w-xs"}
          placeholder="Name, phone or receipt no."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={inputCls + " sm:max-w-[180px]"}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PaymentStatus | "");
            setPage(1);
          }}
          aria-label="Status"
        >
          <option value="PAID">Paid</option>
          <option value="PENDING">Started, not paid</option>
          <option value="">All</option>
        </select>
      </div>

      <ErrorNote error={payments.error} />
      {payments.isPending && <ListSkeleton />}
      {payments.data && status === "PAID" && (
        <p className="text-[13px] text-sub">
          Collected{search ? " (matching)" : ""}: <span className="font-bold text-ink">{inr(payments.data.paidTotal)}</span>
        </p>
      )}
      {payments.data?.items.length === 0 && (
        <EmptyState
          icon={IndianRupee}
          title="No payments here"
          text="Online payments from the website appear here by themselves. Use Record payment for cash, UPI or cheque."
        />
      )}

      <ul className="flex flex-col gap-2.5">
        {payments.data?.items.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{p.studentFee.student.user.name}</span>
                <span className="text-[12.5px] text-sub">{p.studentFee.student.user.phone}</span>
                <Badge tone={STATUS_TONE[p.status]}>{p.status === "PENDING" ? "Not paid" : p.status.toLowerCase()}</Badge>
              </div>
              <p className="mt-1 text-[12.5px] text-sub">
                {p.studentFee.plan.name} · {PAYMENT_MODE_LABEL[p.mode]} · {format(new Date(p.approvedAt ?? p.createdAt), "d MMM yyyy, h:mm a")}
                {p.approvedBy ? ` · by ${p.approvedBy.name}` : ""}
              </p>
              {p.notes && <p className="mt-0.5 text-[12px] text-sub">{p.notes}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[15px] font-bold">{inr(p.amount)}</span>
              {p.status === "PAID" && (
                <Link href={`/receipt/${p.id}`} target="_blank" className={btnGhost + " !h-8 !px-3"}>
                  <Receipt size={14} /> Receipt
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
      {payments.data && payments.data.total > 20 && (
        <Pager page={page} limit={20} total={payments.data.total} onPage={setPage} />
      )}
    </div>
  );
}

function PlansList({ onAdd, onEdit }: { onAdd: () => void; onEdit: (p: FeePlan) => void }) {
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ["fee-plans"], queryFn: () => api<FeePlan[]>("/fee-plans") });
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; active?: boolean; total?: number }) =>
      api(`/fee-plans/${id}`, { method: "PATCH", body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["fee-plans"] }),
  });

  return (
    <div className="flex flex-col gap-4">
      <ErrorNote error={plans.error ?? update.error} />
      {plans.isPending && <ListSkeleton />}
      {plans.data?.length === 0 && (
        <EmptyState
          icon={Tag}
          title="No course fees yet"
          text="Add a fee for a batch. It shows on the website, and a student who pays it joins that batch automatically."
          action={<button className={btnPrimary} onClick={onAdd}><Plus size={16} /> Add course fee</button>}
        />
      )}
      <ul className="flex flex-col gap-2.5">
        {plans.data?.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{p.name}</span>
                <Badge tone={p.active ? "green" : "gray"}>{p.active ? "On website" : "Hidden"}</Badge>
                {p.offerPrice && Number(p.offerPrice) > 0 && (
                  offerRunning(p) ? (
                    <Badge tone="amber">
                      {p.offerLabel || "Offer"}: {inr(p.offerPrice)}
                      {p.offerEndsAt ? ` till ${format(new Date(p.offerEndsAt), "d MMM, h:mm a")}` : ""}
                    </Badge>
                  ) : (
                    <Badge tone="gray">Offer ended</Badge>
                  )
                )}
              </div>
              <p className="mt-1 text-[12.5px] text-sub">
                {p.course.name} → batch {p.batch?.name ?? "—"} · {p._count?.fees ?? 0} students billed
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="mr-1 text-right">
                <span className="block text-[15px] font-bold">{inr(p.total)}</span>
                {p.mrp && Number(p.mrp) > Number(p.total) && <span className="block text-[12px] text-sub line-through">{inr(p.mrp)}</span>}
              </span>
              <button className={btnGhost + " !h-8 !px-3"} onClick={() => onEdit(p)}>
                Edit
              </button>
              <button
                className={btnGhost + " !h-8 !px-3"}
                onClick={() => update.mutate({ id: p.id, active: !p.active })}
                disabled={update.isPending}
              >
                {p.active ? "Hide" : "Show"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Add a course fee, or edit the name and prices of one (`plan`). */
function PlanDialog({ plan, onClose }: { plan?: FeePlan; onClose: () => void }) {
  const qc = useQueryClient();
  const batches = useQuery({
    queryKey: ["batches", "active"],
    queryFn: () => api<Paginated<Batch>>(`/batches${qs({ limit: 100, active: true })}`),
    enabled: !plan,
  });
  const [name, setName] = useState(plan?.name ?? "");
  const [batchId, setBatchId] = useState("");
  const [total, setTotal] = useState(plan ? String(Number(plan.total)) : "");
  const [mrp, setMrp] = useState(plan?.mrp ? String(Number(plan.mrp)) : "");
  const [offerPrice, setOfferPrice] = useState(plan?.offerPrice ? String(Number(plan.offerPrice)) : "");
  const [offerLabel, setOfferLabel] = useState(plan?.offerLabel ?? "");
  // The offer ends at the end of the chosen day (India time).
  const [offerEnd, setOfferEnd] = useState(plan?.offerEndsAt ? istDate(plan.offerEndsAt) : "");

  const hasOffer = Number(offerPrice) > 0;
  const offerBody = {
    offerPrice: hasOffer ? Number(offerPrice) : 0,
    offerLabel: hasOffer ? offerLabel.trim() : "",
    offerEndsAt: hasOffer && offerEnd ? `${offerEnd}T23:59:59+05:30` : "",
  };
  const create = useMutation({
    mutationFn: () =>
      plan
        ? api(`/fee-plans/${plan.id}`, { method: "PATCH", body: { name, total: Number(total), mrp: Number(mrp) || 0, ...offerBody } })
        : api("/fee-plans", { method: "POST", body: { name, batchId, total: Number(total), mrp: Number(mrp) || 0, ...offerBody } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fee-plans"] });
      onClose();
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  const active = batches.data?.items.filter((b) => b.active) ?? [];
  return (
    <Modal title={plan ? "Edit course fee" : "Add course fee"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {!plan && (
        <Field label="Batch the student joins after paying">
          {(id) => (
            <select id={id} className={inputCls} required value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">Choose a batch</option>
              {active.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.course?.name ? `${b.course.name} → ` : ""}{b.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        )}
        <Field label="Name shown to students">
          {(id) => (
            <input id={id} className={inputCls} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. BAMS 1st Prof: full course" />
          )}
        </Field>
        <Field label="Price in rupees (GST included)">
          {(id) => (
            <input id={id} className={inputCls} required inputMode="decimal" type="number" min={1} step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="4999" />
          )}
        </Field>
        <Field label="Original price, shown struck through (optional)">
          {(id) => (
            <input id={id} className={inputCls} inputMode="decimal" type="number" min={0} step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} placeholder="7999" />
          )}
        </Field>
        <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-3.5">
          <legend className="px-1 text-[13px] font-bold">Offer (optional)</legend>
          <p className="-mt-1 text-[12px] text-sub">
            While the offer runs, students pay the offer price and the website shows the badge and a countdown. After the end
            date the normal price comes back by itself. Leave the offer price empty to remove the offer.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Offer price (₹)">
              {(id) => (
                <input
                  id={id}
                  className={inputCls}
                  inputMode="decimal"
                  type="number"
                  min={0}
                  max={total ? Math.max(0, Number(total) - 0.01) : undefined}
                  step="0.01"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder="3999"
                />
              )}
            </Field>
            <Field label="Offer ends on (last day)">
              {(id) => (
                <input id={id} className={inputCls} type="date" value={offerEnd} disabled={!hasOffer} onChange={(e) => setOfferEnd(e.target.value)} />
              )}
            </Field>
          </div>
          <Field label="Offer name (badge)">
            {(id) => (
              <input id={id} className={inputCls} maxLength={60} value={offerLabel} disabled={!hasOffer} onChange={(e) => setOfferLabel(e.target.value)} placeholder="e.g. Diwali offer" />
            )}
          </Field>
          {hasOffer && !offerEnd && <p className="text-[12px] text-sub">No end date: the offer runs until you remove it.</p>}
        </fieldset>
        <ErrorNote error={create.error ?? batches.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={create.isPending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

interface StudentHit {
  id: string;
  user: { name: string; phone: string };
}

function OfflineDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [student, setStudent] = useState<StudentHit | null>(null);
  const [planId, setPlanId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<Exclude<PaymentMode, "RAZORPAY">>("CASH");
  const [notes, setNotes] = useState("");
  const [grantAccess, setGrantAccess] = useState(true);

  const plans = useQuery({ queryKey: ["fee-plans"], queryFn: () => api<FeePlan[]>("/fee-plans") });
  const hits = useQuery({
    queryKey: ["students", "pick", search],
    queryFn: () => api<Paginated<StudentHit>>(`/students${qs({ search: search.trim(), limit: 8 })}`),
    enabled: !student && search.trim().length >= 2,
  });

  const save = useMutation({
    mutationFn: () =>
      api<Payment>("/payments/offline", {
        method: "POST",
        body: { studentId: student!.id, planId, amount: Number(amount), mode, notes: notes || undefined, grantAccess },
      }),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ["payments"] });
      void qc.invalidateQueries({ queryKey: ["fee-plans"] });
      window.open(`/receipt/${p.id}`, "_blank");
      onClose();
    },
  });

  const plan = plans.data?.find((p) => p.id === planId);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (student) save.mutate();
  };

  return (
    <Modal title="Record a payment" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Student">
          {(id) =>
            student ? (
              <div className="flex items-center justify-between rounded-[10px] border border-line px-3 py-2 text-[13.5px]">
                <span>
                  <span className="font-semibold">{student.user.name}</span> <span className="text-sub">{student.user.phone}</span>
                </span>
                <button type="button" className="text-[12px] font-semibold text-primary" onClick={() => setStudent(null)}>
                  Change
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <input id={id} className={inputCls} placeholder="Type name or phone" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
                {hits.data?.items.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setStudent(s)}
                    className="rounded-[10px] border border-line px-3 py-2 text-left text-[13px] hover:border-primary"
                  >
                    <span className="font-semibold">{s.user.name}</span> <span className="text-sub">{s.user.phone}</span>
                  </button>
                ))}
                {hits.data?.items.length === 0 && <p className="text-[12px] text-sub">No student found. Add the student first.</p>}
              </div>
            )
          }
        </Field>
        <Field label="Course fee">
          {(id) => (
            <select
              id={id}
              className={inputCls}
              required
              value={planId}
              onChange={(e) => {
                setPlanId(e.target.value);
                const p = plans.data?.find((x) => x.id === e.target.value);
                if (p && !amount) setAmount(String(Number(p.total)));
              }}
            >
              <option value="">Choose</option>
              {plans.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({inr(p.total)})
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount received (₹)">
            {(id) => (
              <input id={id} className={inputCls} required type="number" min={1} step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            )}
          </Field>
          <Field label="Paid by">
            {(id) => (
              <select id={id} className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
                {(["CASH", "UPI", "CHEQUE", "BANK_TRANSFER"] as const).map((m) => (
                  <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field label="Reference / note (UPI ref, cheque no.)">
          {(id) => <input id={id} className={inputCls} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        {plan && amount && Number(amount) < Number(plan.total) && (
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" className="mt-0.5" checked={grantAccess} onChange={(e) => setGrantAccess(e.target.checked)} />
            <span>Open the batch now, even though this is only part of the fee</span>
          </label>
        )}
        <ErrorNote error={save.error ?? plans.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={!student || save.isPending}>Save and open receipt</button>
        </div>
      </form>
    </Modal>
  );
}

/** "2026-11-01" for an ISO time, as the date in India (for a date input). */
function istDate(iso: string) {
  return new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
