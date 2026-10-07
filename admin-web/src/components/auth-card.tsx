import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";

/** Same centred card as the login page, for register and forgot password. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px] rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
        <Brand />
        <h1 className="mt-6 text-[22px] font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-sub">{subtitle}</p>}
        <div className="mt-5">{children}</div>
        <p className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-sub">
          <Link href="/login" className="hover:text-primary">Back to log in</Link>
          <Link href="/privacy" className="hover:text-primary">Privacy policy</Link>
          <Link href="/terms" className="hover:text-primary">Terms</Link>
        </p>
      </div>
    </main>
  );
}
