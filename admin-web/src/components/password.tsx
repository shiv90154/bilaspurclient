"use client";

import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { btnGhost, btnPrimary, ErrorNote, Field, inputCls, Modal } from "@/components/ui";

/** Same rule as the backend: 8+ characters with a letter and a number. */
const RULE = "(?=.*[A-Za-z])(?=.*\\d).{8,128}";
const RULE_HINT = "At least 8 characters, with a letter and a number.";

/** The signed-in user changes their own password. Other devices are logged out. */
export function ChangePasswordForm() {
  const [done, setDone] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const change = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api("/auth/change-password", { method: "POST", body }),
    onSuccess: () => setDone(true),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDone(false);
    const form = e.currentTarget;
    const f = new FormData(form);
    const next = String(f.get("newPassword") ?? "");
    if (next !== String(f.get("confirm") ?? "")) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    change.mutate(
      { currentPassword: String(f.get("currentPassword") ?? ""), newPassword: next },
      { onSuccess: () => form.reset() },
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
      <Field label="Current password">
        {(i) => <input id={i} name="currentPassword" type="password" required autoComplete="current-password" className={inputCls} />}
      </Field>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="New password">
          {(i) => (
            <input id={i} name="newPassword" type="password" required pattern={RULE} title={RULE_HINT} autoComplete="new-password" className={inputCls} />
          )}
        </Field>
        <Field label="Repeat new password" error={mismatch ? "The two passwords are different" : undefined}>
          {(i) => <input id={i} name="confirm" type="password" required autoComplete="new-password" className={inputCls} />}
        </Field>
      </div>
      <p className="text-[12px] text-sub">{RULE_HINT} Your other devices will be logged out.</p>
      <ErrorNote error={change.error} />
      {done && <p className="text-[12.5px] font-semibold text-success">Password changed.</p>}
      <div>
        <button className={btnPrimary} disabled={change.isPending}>
          {change.isPending ? "Saving…" : "Change password"}
        </button>
      </div>
    </form>
  );
}

/** Admin action for a student or teacher who forgot their password. */
export function ResetPasswordButton({ userId, name, className }: { userId: string; name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className ?? btnGhost} onClick={() => setOpen(true)}>
        <KeyRound size={15} aria-hidden="true" /> Reset password
      </button>
      {open && <ResetPasswordModal userId={userId} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

function ResetPasswordModal({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const [mode, setMode] = useState<"generate" | "choose">("generate");
  const reset = useMutation({
    mutationFn: (password?: string) =>
      api<{ temporaryPassword?: string; sessionsRevoked: number }>(`/users/${userId}/reset-password`, {
        method: "POST",
        body: password ? { password } : {},
      }),
  });

  if (reset.isSuccess) {
    return (
      <Modal title="Password reset" onClose={onClose}>
        <p className="text-[13.5px]">
          <b>{name}</b> has been logged out everywhere.
        </p>
        {reset.data.temporaryPassword ? (
          <div className="mt-3 rounded-[10px] bg-accent-tint p-3 text-[13px]">
            New password (shown only once): <code className="font-bold">{reset.data.temporaryPassword}</code>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-sub">They can log in with the password you chose.</p>
        )}
        <button className={btnPrimary + " mt-5"} onClick={onClose}>Done</button>
      </Modal>
    );
  }

  return (
    <Modal title={`Reset password · ${name}`} onClose={onClose}>
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          const chosen = String(new FormData(e.currentTarget).get("password") ?? "");
          reset.mutate(mode === "choose" ? chosen : undefined);
        }}
      >
        <fieldset className="flex flex-col gap-2 text-[13px]">
          <legend className="sr-only">How to set the new password</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" checked={mode === "generate"} onChange={() => setMode("generate")} />
            Make a random password and show it to me
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" checked={mode === "choose"} onChange={() => setMode("choose")} />
            I will type the new password
          </label>
        </fieldset>
        {mode === "choose" && (
          <Field label="New password">
            {(i) => <input id={i} name="password" type="text" required pattern={RULE} title={RULE_HINT} autoComplete="off" className={inputCls} />}
          </Field>
        )}
        <p className="text-[12px] text-sub">They will be logged out of every device and need the new password to sign in.</p>
        <ErrorNote error={reset.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={reset.isPending}>{reset.isPending ? "Resetting…" : "Reset password"}</button>
        </div>
      </form>
    </Modal>
  );
}
