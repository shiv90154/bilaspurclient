"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { AuthProfile } from "@/lib/types";
import { Badge, btnGhost, btnPrimary, ErrorNote, Field, inputCls } from "@/components/ui";

/**
 * Two-step login for admins and teachers: after the password, a 6-digit code is emailed. Turning
 * it on first proves the email arrives, so nobody locks themselves out with a wrong address.
 */
export function TwoFactorSettings() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<AuthProfile>("/auth/me") });
  const [step, setStep] = useState<"idle" | "password" | "code" | "disable">("idle");
  const [sentTo, setSentTo] = useState("");

  const start = useMutation({
    mutationFn: (password: string) => api<{ email: string }>("/auth/two-factor/start", { method: "POST", body: { password } }),
    onSuccess: (r) => {
      setSentTo(r.email);
      setStep("code");
    },
  });
  const enable = useMutation({
    mutationFn: (code: string) => api("/auth/two-factor/enable", { method: "POST", body: { code } }),
    onSuccess: () => {
      setStep("idle");
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const disable = useMutation({
    mutationFn: (password: string) => api("/auth/two-factor/disable", { method: "POST", body: { password } }),
    onSuccess: () => {
      setStep("idle");
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const on = me.data?.twoFactorEnabled === true;
  const value = (e: FormEvent<HTMLFormElement>, name: string) => {
    e.preventDefault();
    return String(new FormData(e.currentTarget).get(name) ?? "").trim();
  };

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-bold">
          <ShieldCheck size={18} className="text-primary" aria-hidden="true" /> Two-step login
        </h2>
        {me.data && <Badge tone={on ? "green" : "gray"}>{on ? "On" : "Off"}</Badge>}
      </div>
      <p className="mt-1.5 text-[12.5px] text-sub">
        When it is on, logging in also needs a 6-digit code sent to {me.data?.email ?? "your email"}. Someone who learns your password still cannot get in.
      </p>
      <ErrorNote error={me.error ?? start.error ?? enable.error ?? disable.error} />

      {!me.data?.email && me.data && (
        <p className="mt-3 text-[12.5px] font-semibold text-danger">Your account has no email, so two-step login cannot be used.</p>
      )}

      {step === "idle" && me.data?.email && (
        <div className="mt-3">
          {on ? (
            <button className={btnGhost} onClick={() => setStep("disable")}>Turn off</button>
          ) : (
            <button className={btnPrimary} onClick={() => setStep("password")}>Turn on</button>
          )}
        </div>
      )}

      {step === "password" && (
        <form className="mt-3 flex flex-col gap-3" onSubmit={(e) => start.mutate(value(e, "password"))}>
          <Field label="Your password">
            {(i) => <input id={i} name="password" type="password" required autoComplete="current-password" className={inputCls} />}
          </Field>
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={start.isPending}>{start.isPending ? "Sending code…" : "Email me a code"}</button>
            <button type="button" className={btnGhost} onClick={() => setStep("idle")}>Cancel</button>
          </div>
        </form>
      )}

      {step === "code" && (
        <form className="mt-3 flex flex-col gap-3" onSubmit={(e) => enable.mutate(value(e, "code"))}>
          <Field label={`Code sent to ${sentTo}`}>
            {(i) => (
              <input id={i} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus
                className={inputCls + " tracking-[0.3em]"} />
            )}
          </Field>
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={enable.isPending}>{enable.isPending ? "Checking…" : "Turn on"}</button>
            <button type="button" className={btnGhost} onClick={() => setStep("idle")}>Cancel</button>
          </div>
        </form>
      )}

      {step === "disable" && (
        <form className="mt-3 flex flex-col gap-3" onSubmit={(e) => disable.mutate(value(e, "password"))}>
          <Field label="Your password">
            {(i) => <input id={i} name="password" type="password" required autoComplete="current-password" className={inputCls} />}
          </Field>
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={disable.isPending}>{disable.isPending ? "Saving…" : "Turn off two-step login"}</button>
            <button type="button" className={btnGhost} onClick={() => setStep("idle")}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}
