"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { btnGhost, btnPrimary, ErrorNote, Field, inputCls } from "@/components/ui";
import { PASSWORD_HINT, PASSWORD_PATTERN, publicApi } from "@/lib/public-api";

export function ForgotForm() {
  const [step, setStep] = useState<"ask" | "reset" | "done">("ask");
  const [identifier, setIdentifier] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Something went wrong"));
    } finally {
      setBusy(false);
    }
  }

  const ask = (e?: FormEvent) => {
    e?.preventDefault();
    void run(async () => {
      const r = await publicApi<{ message: string }>("password/forgot", { identifier: identifier.trim() });
      setNotice(r.message);
      setStep("reset");
    });
  };

  function reset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newPassword = String(f.get("newPassword") ?? "");
    if (newPassword !== String(f.get("confirm") ?? "")) {
      setError(new Error("The two passwords are different"));
      return;
    }
    void run(async () => {
      await publicApi("password/reset", { identifier: identifier.trim(), code: String(f.get("code") ?? "").trim(), newPassword });
      setStep("done");
    });
  }

  if (step === "done") {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-xl bg-success-tint p-3.5 text-[13.5px] font-semibold text-success">
          Password changed. Every device was logged out; log in with the new password.
        </p>
        <Link href="/login" className={btnPrimary}>Log in</Link>
      </div>
    );
  }

  if (step === "ask") {
    return (
      <form onSubmit={ask} className="flex flex-col gap-3.5">
        <Field label="Phone number or email">
          {(i) => <input id={i} required value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" className={inputCls} />}
        </Field>
        <ErrorNote error={error} />
        <button className={btnPrimary} disabled={busy}>{busy ? "Sending…" : "Send code"}</button>
      </form>
    );
  }

  return (
    <form onSubmit={reset} className="flex flex-col gap-3.5">
      <p role="status" className="rounded-lg bg-accent-tint px-3.5 py-2.5 text-[13px] text-accent-ink">{notice}</p>
      <Field label="6 digit code from the email">
        {(i) => <input id={i} name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" className={inputCls} />}
      </Field>
      <Field label="New password">
        {(i) => <input id={i} name="newPassword" type="password" required pattern={PASSWORD_PATTERN} title={PASSWORD_HINT} autoComplete="new-password" className={inputCls} />}
      </Field>
      <Field label="Repeat new password">
        {(i) => <input id={i} name="confirm" type="password" required autoComplete="new-password" className={inputCls} />}
      </Field>
      <p className="text-[12px] text-sub">{PASSWORD_HINT}</p>
      <ErrorNote error={error} />
      <button className={btnPrimary} disabled={busy}>{busy ? "Saving…" : "Set new password"}</button>
      <button type="button" className={btnGhost} disabled={busy} onClick={() => ask()}>Send the code again</button>
    </form>
  );
}
