"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { btnPrimary, ErrorNote, Field, inputCls } from "@/components/ui";

interface Info {
  instituteName: string;
  termsVersion: string;
}

/** Shown in place of the student area until the current terms + privacy policy are accepted. */
export function ConsentForm() {
  const router = useRouter();
  const [minor, setMinor] = useState(false);
  const info = useQuery({ queryKey: ["privacy-info"], queryFn: () => api<Info>("/privacy/info") });
  const accept = useMutation({
    mutationFn: (body: Record<string, unknown>) => api("/privacy/consent", { method: "POST", body }),
    onSuccess: () => router.refresh(),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    accept.mutate({
      version: info.data?.termsVersion,
      accepted: f.get("accepted") === "on",
      guardianAgree: minor ? f.get("guardianAgree") === "on" : undefined,
      guardianName: minor ? String(f.get("guardianName") ?? "").trim() || undefined : undefined,
    });
  }

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <h1 className="text-[18px] font-bold">Before you start</h1>
      <p className="mt-2 text-[13.5px] text-sub">
        Please read how {info.data?.instituteName ?? "the institute"} uses your data and the rules for using the app.
      </p>
      <p className="mt-3 flex flex-wrap gap-x-4 text-[13.5px] font-semibold">
        <Link href="/privacy" target="_blank" className="text-primary hover:underline">Privacy policy</Link>
        <Link href="/terms" target="_blank" className="text-primary hover:underline">Terms of use</Link>
      </p>
      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3.5 text-[13.5px]">
        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="accepted" required className="mt-1" />
          <span>I have read and agree to the privacy policy and terms of use.</span>
        </label>
        <label className="flex items-start gap-2.5">
          <input type="checkbox" checked={minor} onChange={(e) => setMinor(e.target.checked)} className="mt-1" />
          <span>I am under 18 years old.</span>
        </label>
        {minor && (
          <div className="flex flex-col gap-3.5 rounded-xl bg-bg p-3.5">
            <Field label="Parent / guardian name">
              {(i) => <input id={i} name="guardianName" required maxLength={100} className={inputCls} />}
            </Field>
            <label className="flex items-start gap-2.5">
              <input type="checkbox" name="guardianAgree" required className="mt-1" />
              <span>I am the parent/guardian and I agree to the privacy policy and terms for this student.</span>
            </label>
          </div>
        )}
        <ErrorNote error={accept.error ?? info.error} />
        <div>
          <button className={btnPrimary} disabled={accept.isPending || !info.data}>
            {accept.isPending ? "Saving…" : "Agree and continue"}
          </button>
        </div>
      </form>
    </section>
  );
}
