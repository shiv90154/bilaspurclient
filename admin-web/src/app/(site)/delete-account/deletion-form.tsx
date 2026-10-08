"use client";

import { useState, type FormEvent } from "react";
import { btnPrimary, ErrorNote, Field, inputCls } from "@/components/ui";

export function DeletionForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<Error | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/public/deletion-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(f.get("name") ?? "").trim(),
          phone: String(f.get("phone") ?? "").trim(),
          reason: String(f.get("reason") ?? "").trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(body.message) ? body.message.join(", ") : body.message;
        throw new Error(res.status === 429 ? "Too many requests. Please wait a minute and try again." : (msg ?? "Could not send the request."));
      }
      setState("sent");
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Could not send the request."));
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <p role="status" className="rounded-xl bg-success-tint p-4 text-[14px] font-semibold text-success">
        Request received. The institute will check it and delete the account within 30 days.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3.5 rounded-xl border border-line bg-surface p-4">
      <Field label="Student name">{(i) => <input id={i} name="name" required maxLength={100} className={inputCls} />}</Field>
      <Field label="Mobile number you log in with">
        {(i) => <input id={i} name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} className={inputCls} />}
      </Field>
      <Field label="Reason (optional)">
        {(i) => <textarea id={i} name="reason" rows={3} maxLength={500} className={inputCls + " h-auto py-2"} />}
      </Field>
      <ErrorNote error={error} />
      <button className={btnPrimary} disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Request account deletion"}
      </button>
    </form>
  );
}
