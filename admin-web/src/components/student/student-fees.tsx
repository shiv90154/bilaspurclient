"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, GraduationCap, MessageCircle, Receipt } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api, inr, PAYMENT_MODE_LABEL, type MyFeePlan, type Payment } from "@/lib/api";
import { OfferCountdown } from "@/components/site/offer-countdown";
import { whatsappBuyHref } from "@/lib/site";
import { Badge, btnGhost, btnPrimary, EmptyState, ErrorNote, ListSkeleton } from "@/components/ui";

interface OrderResponse {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  prefill: { name: string; email?: string; contact: string };
}

interface CheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

type RazorpayCtor = new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: string, cb: (r: { error?: { description?: string } }) => void) => void;
};

/** Loads Razorpay's checkout script once, on the first click (not on every page view). */
function loadCheckout(): Promise<RazorpayCtor> {
  const w = window as unknown as { Razorpay?: RazorpayCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Payment window did not load")));
    s.onerror = () => reject(new Error("Could not load the payment window. Check your internet and try again."));
    document.body.appendChild(s);
  });
}

export function StudentFees({ highlight }: { highlight?: string }) {
  const qc = useQueryClient();
  const [paidPlan, setPaidPlan] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const plans = useQuery({
    queryKey: ["fee-plans", "mine"],
    queryFn: () => api<{ onlinePayments: boolean; plans: MyFeePlan[] }>("/fee-plans/mine"),
  });
  const payments = useQuery({ queryKey: ["payments", "mine"], queryFn: () => api<Payment[]>("/payments/mine") });

  const pay = useMutation({
    mutationFn: async (plan: MyFeePlan) => {
      setPayError(null);
      const [Razorpay, order] = await Promise.all([
        loadCheckout(),
        api<OrderResponse>("/payments/razorpay/order", { method: "POST", body: { planId: plan.id } }),
      ]);
      await new Promise<void>((resolve, reject) => {
        const rzp = new Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: "DHĪ Ayurveda Classroom",
          description: order.description,
          prefill: order.prefill,
          theme: { color: "#1f4d2c" },
          handler: (resp: CheckoutSuccess) => {
            api("/payments/razorpay/verify", { method: "POST", body: resp })
              .then(() => {
                setPaidPlan(plan.id);
                resolve();
              })
              .catch(reject);
          },
          modal: { ondismiss: () => resolve() },
        });
        rzp.on("payment.failed", (r) => setPayError(r.error?.description ?? "Payment failed. No money was taken; try again."));
        rzp.open();
      });
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["fee-plans", "mine"] });
      void qc.invalidateQueries({ queryKey: ["payments", "mine"] });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[20px] font-bold">Fees</h1>
        <p className="mt-1 text-[13px] text-sub">
          {plans.data && !plans.data.onlinePayments
            ? "Press Buy on WhatsApp to get the payment details. The course opens in the app once the institute confirms your payment."
            : "Pay for a course here. It opens in the app as soon as the payment goes through."}
        </p>
      </div>

      {paidPlan && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-success-tint p-4 text-success">
          <CheckCircle2 size={22} className="shrink-0" aria-hidden="true" />
          <div className="text-[13.5px]">
            <p className="font-bold">Payment received. Your course is open.</p>
            <p className="mt-0.5">Open the DHĪ app and sign in again to see your classes, notes and tests. Your receipt is below.</p>
          </div>
        </div>
      )}
      {payError && <p role="alert" className="rounded-[10px] bg-danger-tint px-3 py-2 text-[12.5px] text-danger">{payError}</p>}
      <ErrorNote error={plans.error ?? pay.error} />

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-bold">Courses</h2>
        {plans.isPending && <ListSkeleton rows={2} />}
        {plans.data?.plans.length === 0 && (
          <EmptyState icon={GraduationCap} title="No courses open right now" text="The institute has not opened any course for online payment yet." />
        )}
        {plans.data?.plans.map((p) => {
          const due = Number(p.due);
          const done = p.enrolled && due <= 0;
          return (
            <article
              key={p.id}
              className={`rounded-2xl border bg-surface p-4 ${highlight === p.id ? "border-primary" : "border-line"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold">{p.name}</h3>
                  <p className="mt-0.5 text-[12.5px] text-sub">
                    {p.course.name}
                    {p.batch?.startDate ? ` · starts ${format(new Date(p.batch.startDate), "d MMM yyyy")}` : ""}
                  </p>
                  {p.course.description && <p className="mt-1.5 text-[12.5px] text-sub">{p.course.description}</p>}
                </div>
                <div className="text-right">
                  {p.offer && !(Number(p.paid) > 0) && (
                    <div className="mb-1">
                      <Badge tone="red">{p.offer.label || "Offer"}</Badge>
                    </div>
                  )}
                  <div className="text-[17px] font-bold">
                    {p.offer && !(Number(p.paid) > 0) ? (
                      <>
                        <span className="mr-1.5 text-[13px] font-medium text-sub line-through">{inr(p.total)}</span>
                        {inr(p.offer.price)}
                      </>
                    ) : (
                      inr(p.total)
                    )}
                  </div>
                  {p.offer?.endsAt && !(Number(p.paid) > 0) && (
                    <div className="text-[12px] font-semibold text-danger">
                      <OfferCountdown endsAt={p.offer.endsAt} />
                    </div>
                  )}
                  {Number(p.paid) > 0 && due > 0 && <div className="text-[12px] text-sub">Paid {inr(p.paid)} · due {inr(due)}</div>}
                </div>
              </div>
              <div className="mt-3">
                {done ? (
                  <Badge tone="green">Joined</Badge>
                ) : !plans.data.onlinePayments ? (
                  <a
                    href={whatsappBuyHref(p, inr(due))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={btnPrimary + " w-full sm:w-auto"}
                  >
                    <MessageCircle size={16} aria-hidden="true" /> Buy on WhatsApp
                  </a>
                ) : (
                  <button
                    className={btnPrimary + " w-full sm:w-auto"}
                    disabled={pay.isPending}
                    onClick={() => pay.mutate(p)}
                  >
                    {pay.isPending && pay.variables?.id === p.id ? "Opening payment…" : `Pay ${inr(due)}`}
                  </button>
                )}
              </div>
            </article>
          );
        })}
        <p className="text-[11.5px] text-sub">
          {plans.data?.onlinePayments
            ? "Payments are handled by Razorpay (UPI, cards, net banking). We never see your card or UPI PIN."
            : "Pay only to the UPI ID or bank account the institute shares from its official number. We never ask for your UPI PIN or OTP."}{" "}
          See the <Link href="/terms" className="underline">terms and refund policy</Link>.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] font-bold">My payments</h2>
        {payments.data?.length === 0 && <p className="text-[13px] text-sub">No payments yet.</p>}
        <ul className="flex flex-col gap-2">
          {payments.data?.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5">
              <div className="min-w-0 text-[13px]">
                <p className="font-semibold">{p.studentFee.plan.name}</p>
                <p className="text-[12px] text-sub">
                  {format(new Date(p.approvedAt ?? p.createdAt), "d MMM yyyy")} · {PAYMENT_MODE_LABEL[p.mode]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{inr(p.amount)}</span>
                <Link href={`/receipt/${p.id}`} target="_blank" className={btnGhost + " !h-8 !px-3"} aria-label="Receipt">
                  <Receipt size={14} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
