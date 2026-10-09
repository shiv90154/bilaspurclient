/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Mail, MessageCircle, Phone, Wrench } from "lucide-react";
import { SITE } from "@/lib/site";

/** Shown instead of the website and student panel while the admin has maintenance mode on. */
export function MaintenanceScreen({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-16">
      <div className="w-full max-w-lg rounded-3xl border border-line bg-surface p-8 text-center shadow-sm sm:p-10">
        <img src="/logo.png" alt={SITE.name} className="mx-auto h-16 w-16 rounded-2xl" />
        <span className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-tint text-accent-ink">
          <Wrench size={26} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-[26px] font-bold leading-tight text-ink">We&apos;ll be back soon</h1>
        <p className="mt-3 text-[16px] leading-relaxed text-sub">
          {message || "We are doing some maintenance on the website and the app. Please check back in a little while."}
        </p>
        <div className="mt-7 flex flex-col gap-2 text-[14px] text-sub">
          <a href={SITE.phoneHref} className="inline-flex items-center justify-center gap-2 font-semibold text-primary hover:underline">
            <Phone size={16} aria-hidden="true" /> {SITE.phone}
          </a>
          <a href={SITE.whatsappHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 hover:text-primary">
            <MessageCircle size={16} aria-hidden="true" /> WhatsApp us
          </a>
          <a href={`mailto:${SITE.email}`} className="inline-flex items-center justify-center gap-2 hover:text-primary">
            <Mail size={16} aria-hidden="true" /> {SITE.email}
          </a>
        </div>
      </div>
      <Link href="/login" className="mt-6 text-[13px] text-sub hover:text-primary hover:underline">
        Staff login
      </Link>
    </main>
  );
}
