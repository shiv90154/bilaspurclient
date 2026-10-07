import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import type { PublicInfo } from "@/lib/server/public-info";

/** Public page frame for the privacy policy, terms and account deletion pages. */
export function LegalPage({ title, info, children }: { title: string; info: PublicInfo; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/" aria-label="Home">
        <Brand />
      </Link>
      <h1 className="mt-8 break-words text-[24px] font-bold sm:text-[28px]">{title}</h1>
      <p className="mt-1 text-[13px] text-sub">
        {info.instituteName}
        {info.termsVersion ? ` · Version ${info.termsVersion}` : ""}
      </p>
      <article className="legal mt-6 flex flex-col gap-5 text-[14px] leading-relaxed">{children}</article>
      <footer className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5 text-[13px] text-sub">
        <Link href="/privacy" className="hover:text-primary">Privacy policy</Link>
        <Link href="/terms" className="hover:text-primary">Terms of use</Link>
        <Link href="/delete-account" className="hover:text-primary">Delete my account</Link>
        <Link href="/login" className="hover:text-primary">Log in</Link>
      </footer>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[16px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function Contact({ info }: { info: PublicInfo }) {
  const lines = [
    info.instituteName,
    info.address,
    info.contactEmail && `Email: ${info.contactEmail}`,
    info.contactPhone && `Phone: ${info.contactPhone}`,
  ].filter(Boolean);
  return (
    <address className="rounded-xl border border-line bg-surface p-4 not-italic">
      {lines.map((l) => (
        <div key={l as string}>{l}</div>
      ))}
      {!info.contactEmail && !info.contactPhone && <div className="text-sub">Contact the institute office.</div>}
    </address>
  );
}
