import type { ReactNode } from "react";
import type { PublicInfo } from "@/lib/server/public-info";

/** Public page frame for the privacy policy, terms and account deletion pages. */
export function LegalPage({ title, info, children }: { title: string; info: PublicInfo; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="break-words text-[26px] font-bold text-primary-dark sm:text-[32px]">{title}</h1>
      <p className="mt-1 text-[13px] text-sub">
        {info.instituteName}
        {info.termsVersion ? ` · Version ${info.termsVersion}` : ""}
      </p>
      <article className="legal mt-6 flex flex-col gap-5 text-[14px] leading-relaxed">{children}</article>
    </div>
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
