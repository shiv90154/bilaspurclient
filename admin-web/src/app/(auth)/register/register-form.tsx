"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { btnGhost, btnPrimary, ErrorNote, Field, inputCls } from "@/components/ui";
import { PASSWORD_HINT, PASSWORD_PATTERN, publicApi } from "@/lib/public-api";

interface Course {
  id: string;
  name: string;
  description: string | null;
}

export function RegisterForm() {
  const courses = useQuery({ queryKey: ["public-courses"], queryFn: () => publicApi<Course[]>("courses") });
  const [step, setStep] = useState<"form" | "code" | "done">("form");
  const [email, setEmail] = useState("");
  const [masked, setMasked] = useState("");
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

  function start(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    if (text("password") !== text("confirm")) {
      setError(new Error("The two passwords are different"));
      return;
    }
    if (f.get("agree") !== "on") {
      setError(new Error("Please accept the privacy policy and terms"));
      return;
    }
    void run(async () => {
      const r = await publicApi<{ email: string }>("register/start", {
        name: text("name"),
        phone: text("phone"),
        email: text("email"),
        password: text("password"),
        courseId: text("courseId"),
        via: "WEB",
      });
      setEmail(text("email"));
      setMasked(r.email);
      setStep("code");
    });
  }

  function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    void run(async () => {
      await publicApi("register/verify", { email, code });
      setStep("done");
    });
  }

  if (step === "done") {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-xl bg-success-tint p-3.5 text-[13.5px] font-semibold text-success">
          Account created. Log in with your mobile number and password. You can use the free demo now; the rest opens
          when the institute approves your admission.
        </p>
        <Link href="/login" className={btnPrimary}>Log in</Link>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={verify} className="flex flex-col gap-3.5">
        <p role="status" className="rounded-lg bg-accent-tint px-3.5 py-2.5 text-[13px] text-accent-ink">
          We sent a 6 digit code to {masked}. Check spam too. It works for 10 minutes.
        </p>
        <Field label="Code">
          {(i) => <input id={i} name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" className={inputCls} />}
        </Field>
        <ErrorNote error={error} />
        <button className={btnPrimary} disabled={busy}>{busy ? "Checking…" : "Confirm email"}</button>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnGhost} disabled={busy} onClick={() => void run(async () => { await publicApi("register/resend", { email }); })}>
            Send again
          </button>
          <button type="button" className={btnGhost} disabled={busy} onClick={() => setStep("form")}>Change details</button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={start} className="flex flex-col gap-3.5">
      <Field label="Full name">{(i) => <input id={i} name="name" required maxLength={100} autoComplete="name" className={inputCls} />}</Field>
      <Field label="Mobile number (you log in with this)">
        {(i) => <input id={i} name="phone" required inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} autoComplete="tel-national" className={inputCls} />}
      </Field>
      <Field label="Email (we send a code to confirm it)">
        {(i) => <input id={i} name="email" type="email" required maxLength={150} autoComplete="email" className={inputCls} />}
      </Field>
      <Field label="Course you want to join">
        {(i) => (
          <select id={i} name="courseId" required defaultValue="" className={inputCls}>
            <option value="" disabled>{courses.isPending ? "Loading…" : "Choose a course"}</option>
            {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </Field>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Password">
          {(i) => <input id={i} name="password" type="password" required pattern={PASSWORD_PATTERN} title={PASSWORD_HINT} autoComplete="new-password" className={inputCls} />}
        </Field>
        <Field label="Repeat password">
          {(i) => <input id={i} name="confirm" type="password" required autoComplete="new-password" className={inputCls} />}
        </Field>
      </div>
      <p className="text-[12px] text-sub">{PASSWORD_HINT}</p>
      <label className="flex items-start gap-2.5 text-[13px]">
        <input type="checkbox" name="agree" required className="mt-1" />
        <span>
          I agree to the <Link href="/privacy" target="_blank" className="font-semibold text-primary">privacy policy</Link> and{" "}
          <Link href="/terms" target="_blank" className="font-semibold text-primary">terms</Link>. If I am under 18, my parent/guardian agrees too.
        </span>
      </label>
      <ErrorNote error={error ?? courses.error} />
      <button className={btnPrimary} disabled={busy}>{busy ? "Sending code…" : "Continue"}</button>
    </form>
  );
}
