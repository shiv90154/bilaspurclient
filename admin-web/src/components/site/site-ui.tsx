/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BadgeCheck, CirclePlay, ClipboardCheck, Download, FileText, MessageCircle, ShieldCheck, UserPlus, Video } from "lucide-react";
import { inr } from "@/lib/api";
import { SITE } from "@/lib/site";

/** An open course fee from GET /fee-plans/public. */
export interface PublicPlan {
  id: string;
  name: string;
  total: string;
  course: { id: string; name: string; description: string | null };
  batch: { id: string; name: string; startDate: string | null } | null;
}

// lucide-react 1.x dropped brand icons, so the social marks are drawn here.
export function YoutubeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
    </svg>
  );
}
function FacebookIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12Z" />
    </svg>
  );
}
function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.3" />
      <circle cx="17.6" cy="6.4" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function GooglePlayIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path fill="#34A853" d="M3.6 1.8 13.8 12 3.6 22.2c-.4-.2-.6-.7-.6-1.2V3c0-.5.2-1 .6-1.2Z" />
      <path fill="#FBBC04" d="m17.2 15.4-3.4-3.4 3.4-3.4 3.9 2.2c1.1.6 1.1 1.8 0 2.4l-3.9 2.2Z" />
      <path fill="#EA4335" d="M17.2 15.4 13.8 12 3.6 22.2c.4.2.9.2 1.4-.1l12.2-6.7Z" />
      <path fill="#4285F4" d="M17.2 8.6 5 1.9c-.5-.3-1-.3-1.4-.1L13.8 12l3.4-3.4Z" />
    </svg>
  );
}

export const SOCIALS = [
  { href: SITE.youtube, label: "YouTube", icon: YoutubeIcon },
  { href: SITE.instagram, label: "Instagram", icon: InstagramIcon },
  { href: SITE.facebook, label: "Facebook", icon: FacebookIcon },
];

export const FEATURES = [
  { icon: Video, title: "Live classes", text: "Join scheduled live sessions from the app. Your attendance is marked automatically." },
  { icon: FileText, title: "Study notes", text: "Clear PDF notes, sorted by subject and topic, for your batch. Read them right inside the app." },
  { icon: ClipboardCheck, title: "Tests and test series", text: "Timed exam-style tests with instant results, negative marking, ranks and answer review." },
  { icon: MessageCircle, title: "Doubt solving", text: "Ask a doubt any time. Faculty reply in the app and you are notified as soon as they do." },
  { icon: CirclePlay, title: "Video lessons", text: "Recorded lessons to revise a topic again, at your own pace." },
  { icon: ShieldCheck, title: "Safe and private", text: "Protected content, one device per student and no ads. Your data is never sold." },
];

export const STEPS = [
  { icon: Download, title: "Download the app", text: "Get the DHĪ app from the Google Play Store." },
  { icon: UserPlus, title: "Register", text: "Sign up with your name, phone and email. Verify with a one-time code." },
  { icon: BadgeCheck, title: "Start learning", text: "Pay the course fee on this website (or at the institute) and your batch’s classes, notes and tests open up." },
];

export const btn = "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold transition";
export const btnSolid = `${btn} bg-primary text-white hover:bg-primary-dark`;
export const btnOutline = `${btn} border border-primary/25 bg-surface text-primary hover:border-primary hover:bg-primary-tint`;

export function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-24 px-4 sm:px-6 ${className}`}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
      <span className="h-px w-6 bg-accent" aria-hidden="true" />
      {children}
    </p>
  );
}

export function SectionTitle({ eyebrow, title, text, center }: { eyebrow: string; title: string; text?: string; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <div className={center ? "flex justify-center" : undefined}>
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>
      <h2 className="mt-4 text-[28px] font-bold leading-tight text-primary-dark sm:text-[36px]">{title}</h2>
      {text && <p className="mt-3 text-[16px] leading-relaxed text-sub">{text}</p>}
    </div>
  );
}

/** Title band at the top of every inner page, with a breadcrumb back to home. */
export function PageHero({ eyebrow, title, text, children }: { eyebrow: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-primary-tint/40 px-4 py-14 sm:px-6 lg:py-20">
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary-tint blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl">
        <nav aria-label="Breadcrumb" className="text-[13px] text-sub">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span className="text-ink">{eyebrow}</span>
        </nav>
        <h1 className="mt-4 max-w-3xl text-[34px] font-bold leading-[1.15] text-primary-dark sm:text-[46px]">{title}</h1>
        {text && <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-sub sm:text-[17px]">{text}</p>}
        {children && <div className="mt-7">{children}</div>}
      </div>
    </section>
  );
}

/** "Get it on Google Play" button, styled like the official badge. */
export function PlayStoreButton({ light = false }: { light?: boolean }) {
  return (
    <a
      href={SITE.playStore}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex h-14 items-center justify-center gap-3 rounded-xl px-5 transition ${
        light ? "bg-white text-ink hover:bg-white/90" : "bg-ink text-white hover:bg-black"
      }`}
    >
      <GooglePlayIcon size={26} />
      <span className="flex flex-col text-left leading-none">
        <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">Get it on</span>
        <span className="mt-1 text-[18px] font-semibold">Google Play</span>
      </span>
    </a>
  );
}

export function FeatureGrid({ items = FEATURES }: { items?: typeof FEATURES }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ icon: Icon, title, text }) => (
        <div key={title} className="rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:shadow-md">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
            <Icon size={21} />
          </span>
          <h3 className="mt-4 text-[17px] font-semibold text-ink">{title}</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-sub">{text}</p>
        </div>
      ))}
    </div>
  );
}

export function Steps() {
  return (
    <ol className="grid gap-8 md:grid-cols-3">
      {STEPS.map(({ icon: Icon, title, text }, i) => (
        <li key={title} className="relative flex flex-col items-center text-center">
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent bg-accent-tint text-accent-ink">
            <Icon size={26} />
            <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-white">
              {i + 1}
            </span>
          </span>
          <h3 className="mt-4 text-[17px] font-semibold">{title}</h3>
          <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-sub">{text}</p>
        </li>
      ))}
    </ol>
  );
}

export function CourseCard({ plan }: { plan: PublicPlan }) {
  return (
    <article className="flex flex-col rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-accent-ink">{plan.course.name}</p>
      <h3 className="mt-2 text-[18px] font-semibold text-ink">{plan.name}</h3>
      {plan.course.description && <p className="mt-2 text-[14px] leading-relaxed text-sub">{plan.course.description}</p>}
      {plan.batch?.startDate && (
        <p className="mt-3 inline-flex w-fit rounded-full bg-primary-tint px-3 py-1 text-[12.5px] font-semibold text-primary">
          Starts {new Date(plan.batch.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      )}
      <div className="mt-auto pt-5">
        <p className="text-[26px] font-bold text-primary-dark">{inr(plan.total)}</p>
        <p className="text-[12px] text-sub">One-time fee, taxes included</p>
        <Link href={`/learn/fees?plan=${plan.id}`} className={`${btnSolid} mt-4 w-full`}>
          Join now <ArrowRight size={18} />
        </Link>
      </div>
    </article>
  );
}

/** Dark call-to-action band used at the bottom of most pages. */
export function CtaBand({ title = "Your classroom, in your pocket", text }: { title?: string; text?: string }) {
  return (
    <Section className="py-16 lg:py-20">
      <div className="relative overflow-hidden rounded-[2rem] bg-primary-dark px-6 py-12 text-white sm:px-12 lg:py-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border-[40px] border-accent/15" aria-hidden="true" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent-tint">DHĪ for Android</p>
            <h2 className="mt-3 text-[26px] font-bold leading-tight sm:text-[34px]">{title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/80">
              {text ?? "Download the app, register and start learning. On an iPhone or a computer, log in on this website."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <PlayStoreButton light />
            <Link href="/login" className={`${btn} h-14 border border-white/30 text-white hover:bg-white/10`}>
              Log in on the web <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}

export function ContactCard({ icon, label, value, href, external }: { icon: ReactNode; label: string; value: string; href?: string; external?: boolean }) {
  const body = (
    <>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-tint text-accent-ink">{icon}</span>
      <span className="mt-4 block text-[12px] font-semibold uppercase tracking-wider text-sub">{label}</span>
      <span className="mt-1 block break-words text-[15px] font-semibold text-ink">{value}</span>
    </>
  );
  const cls = "block rounded-2xl border border-line bg-surface p-5";
  return href ? (
    <a href={href} className={`${cls} transition hover:border-primary hover:shadow-md`} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function FounderPhoto({ src, alt, caption }: { src: string; alt: string; caption?: ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[400px]">
      <div className="absolute -inset-2 rounded-[2.2rem] border border-accent/40 sm:-inset-3" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[2rem] bg-surface shadow-xl shadow-primary/10">
        <img src={src} alt={alt} width={900} height={1200} className="aspect-[4/5] w-full object-cover object-top" />
        {caption && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary-dark/90 via-primary-dark/50 to-transparent px-5 pb-5 pt-16 text-white">
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}
