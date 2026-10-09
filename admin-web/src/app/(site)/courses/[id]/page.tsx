/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock,
  FileText,
  Languages,
  MessageCircle,
  MonitorSmartphone,
  PlayCircle,
  Receipt,
  UserRound,
  Video,
} from "lucide-react";
import { btnSolid, CtaBand, PriceTag, Section, type PublicPlan } from "@/components/site/site-ui";
import { plural } from "@/lib/format";
import { backendRequest } from "@/lib/server/session";
import { FOUNDER, SITE } from "@/lib/site";

interface CoursePage extends Omit<PublicPlan, "course" | "batch"> {
  batch: { id: string; name: string; startDate: string | null; endDate: string | null };
  course: {
    id: string;
    name: string;
    description: string | null;
    tagline: string | null;
    language: string | null;
    duration: string | null;
    highlights: string[];
    includes: string[];
    audience: string[];
    faqs: { q: string; a: string }[] | null;
    subjects: { name: string; topics: { name: string }[] }[];
  };
  counts: { tests: number; notes: number; videos: number; classes: number };
  onlinePayments: boolean;
}

async function load(id: string): Promise<CoursePage | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const res = await backendRequest(`/fee-plans/public/${id}`);
    return res.ok ? ((await res.json()) as CoursePage) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const c = await load((await params).id);
  if (!c) return { title: "Course not found" };
  return {
    title: `${c.name} · ${c.course.name}`,
    description: c.course.tagline ?? c.course.description ?? `Join ${c.course.name} with ${SITE.founder}.`,
    alternates: { canonical: `/courses/${c.id}` },
  };
}

const date = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const PAYMENT_FAQ = [
  { q: "How do I pay?", a: "Register, log in on this website and press Join now. Pay with UPI, card or net banking through Razorpay, or pay at the institute." },
  { q: "When does the course open?", a: "As soon as the payment goes through. Sign in to the DHĪ app again and your classes, notes and tests are there." },
  { q: "Do I get a receipt?", a: "Yes. Every payment has a receipt under Fees, which you can print or save as PDF." },
];

export default async function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const c = await load((await params).id);
  if (!c) notFound();
  const { course, counts } = c;
  const topics = course.subjects.reduce((n, s) => n + s.topics.length, 0);
  const joinHref = `/learn/fees?plan=${c.id}`;

  const includes = [
    counts.classes > 0 && { icon: Video, text: `${plural(counts.classes, "live class", "live classes")} scheduled` },
    counts.notes > 0 && { icon: FileText, text: plural(counts.notes, "PDF note") },
    counts.tests > 0 && { icon: ClipboardCheck, text: `${plural(counts.tests, "test")} with instant results` },
    counts.videos > 0 && { icon: PlayCircle, text: plural(counts.videos, "recorded video lesson") },
    ...course.includes.map((text) => ({ icon: Check, text })),
    { icon: MessageCircle, text: "Doubt solving in the app" },
    { icon: MonitorSmartphone, text: "Android app and website access" },
    { icon: Receipt, text: "Payment receipt on the website" },
  ].filter(Boolean) as { icon: typeof Check; text: string }[];

  const faqs = [...(course.faqs ?? []), ...PAYMENT_FAQ];

  const priceCard = (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-xl shadow-primary/10">
      <PriceTag total={c.total} mrp={c.mrp} offer={c.offer} big />
      <p className="mt-2 text-[12.5px] text-sub">One-time fee, taxes included</p>
      <Link href={joinHref} className={`${btnSolid} mt-5 w-full`}>
        Join now <ArrowRight size={18} />
      </Link>
      <p className="mt-3 text-center text-[12px] text-sub">
        {c.onlinePayments ? "Pay securely with UPI, card or net banking" : "Online payment opens soon. You can pay at the institute."}
      </p>
      <ul className="mt-5 flex flex-col gap-2.5 border-t border-line pt-5 text-[13.5px]">
        {c.batch.startDate && (
          <li className="flex items-center gap-2.5"><CalendarDays size={16} className="text-primary" /> Starts {date(c.batch.startDate)}</li>
        )}
        {course.duration && <li className="flex items-center gap-2.5"><Clock size={16} className="text-primary" /> {course.duration}</li>}
        {course.language && <li className="flex items-center gap-2.5"><Languages size={16} className="text-primary" /> {course.language}</li>}
        <li className="flex items-center gap-2.5"><UserRound size={16} className="text-primary" /> Batch: {c.batch.name}</li>
      </ul>
      <a
        href={SITE.whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex items-center justify-center gap-2 text-[13px] font-semibold text-primary hover:underline"
      >
        <MessageCircle size={15} /> Questions? Ask on WhatsApp
      </a>
    </div>
  );

  return (
    <>
      {/* Title band */}
      <section className="bg-primary-dark px-4 py-12 text-white sm:px-6 lg:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_360px]">
          <div>
            <nav aria-label="Breadcrumb" className="text-[13px] text-white/70">
              <Link href="/" className="hover:text-white">Home</Link>
              <span className="mx-2" aria-hidden="true">/</span>
              <Link href="/courses" className="hover:text-white">Courses</Link>
              <span className="mx-2" aria-hidden="true">/</span>
              <span className="text-white">{course.name}</span>
            </nav>
            <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.18em] text-accent-tint">{course.name}</p>
            <h1 className="mt-2 text-[30px] font-bold leading-tight sm:text-[40px]">{c.name}</h1>
            {course.tagline && <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-white/85">{course.tagline}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-white/85">
              <span className="flex items-center gap-2">
                <img src="/founder-portrait.jpg" alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover object-top" />
                By <Link href="/about" className="font-semibold text-white underline-offset-2 hover:underline">{SITE.founder}</Link>
              </span>
              {c.batch.startDate && <span className="flex items-center gap-1.5"><CalendarDays size={15} /> Starts {date(c.batch.startDate)}</span>}
              {course.language && <span className="flex items-center gap-1.5"><Languages size={15} /> {course.language}</span>}
              {course.duration && <span className="flex items-center gap-1.5"><Clock size={15} /> {course.duration}</span>}
            </div>
          </div>
        </div>
      </section>

      <Section className="py-10 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
          {/* Price card: under the title on phones, sticky on the right on large screens */}
          <aside className="lg:order-2">
            <div className="lg:sticky lg:top-24 lg:-mt-56">{priceCard}</div>
          </aside>

          <div className="flex min-w-0 flex-col gap-10 lg:order-1">
            {course.highlights.length > 0 && (
              <section className="rounded-2xl border border-line bg-surface p-6">
                <h2 className="text-[20px] font-bold">What you’ll learn</h2>
                <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {course.highlights.map((h) => (
                    <li key={h} className="flex gap-2.5 text-[14px] leading-relaxed">
                      <Check size={18} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                      {h}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="text-[20px] font-bold">This course includes</h2>
              <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {includes.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-2.5 text-[14px]">
                    <Icon size={18} className="shrink-0 text-primary" aria-hidden="true" />
                    {text}
                  </li>
                ))}
              </ul>
            </section>

            {course.subjects.length > 0 && (
              <section>
                <h2 className="text-[20px] font-bold">Course content</h2>
                <p className="mt-1 text-[13px] text-sub">
                  {plural(course.subjects.length, "subject")} · {plural(topics, "topic")}
                </p>
                <div className="mt-4 overflow-hidden rounded-2xl border border-line">
                  {course.subjects.map((s, i) => (
                    <details key={s.name} className="group border-line bg-surface [&:not(:first-child)]:border-t" open={i === 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-bg px-5 py-4 marker:hidden">
                        <span className="flex items-center gap-3 font-semibold">
                          <span className="text-[18px] leading-none text-primary transition group-open:rotate-90" aria-hidden="true">›</span>
                          {s.name}
                        </span>
                        <span className="shrink-0 text-[12.5px] text-sub">{plural(s.topics.length, "topic")}</span>
                      </summary>
                      {s.topics.length > 0 && (
                        <ul className="flex flex-col gap-2.5 px-5 py-4 pl-12 text-[14px] text-sub">
                          {s.topics.map((t) => (
                            <li key={t.name} className="flex items-center gap-2.5">
                              <FileText size={15} className="shrink-0 text-sub" aria-hidden="true" />
                              {t.name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  ))}
                </div>
              </section>
            )}

            {course.description && (
              <section>
                <h2 className="text-[20px] font-bold">Description</h2>
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-sub">{course.description}</p>
              </section>
            )}

            {course.audience.length > 0 && (
              <section>
                <h2 className="text-[20px] font-bold">Who this course is for</h2>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {course.audience.map((a) => (
                    <li key={a} className="flex gap-2.5 text-[15px] leading-relaxed text-sub">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      {a}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h2 className="text-[20px] font-bold">Your teacher</h2>
              <div className="mt-4 rounded-2xl border border-line bg-surface p-6">
                <div className="flex items-center gap-4">
                  <img src="/founder-portrait.jpg" alt={SITE.founder} width={80} height={80} className="h-20 w-20 rounded-full object-cover object-top" />
                  <div>
                    <Link href="/about" className="text-[18px] font-bold text-primary hover:underline">{SITE.founder}</Link>
                    <p className="text-[13.5px] text-sub">{FOUNDER.degrees}</p>
                    <p className="text-[13.5px] text-sub">{FOUNDER.role}</p>
                  </div>
                </div>
                <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {FOUNDER.stats.map((s) => (
                    <li key={s.label} className="rounded-xl bg-bg p-3 text-center">
                      <span className="block text-[20px] font-bold text-primary">{s.value}</span>
                      <span className="mt-1 block text-[11.5px] leading-snug text-sub">{s.label}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-[14px] leading-relaxed text-sub">
                  He has prepared AIAPGET and AMO aspirants for over 15 years and serves in the Shalya Tantra (surgery) department, so
                  every topic is taught with the exam and the patient in mind.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-[20px] font-bold">Frequently asked questions</h2>
              <div className="mt-4 flex flex-col gap-2.5">
                {faqs.map(({ q, a }) => (
                  <details key={q} className="group rounded-2xl border border-line bg-surface p-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold marker:hidden">
                      {q}
                      <span className="text-[20px] leading-none text-primary transition group-open:rotate-45" aria-hidden="true">+</span>
                    </summary>
                    <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-sub">{a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </div>
      </Section>

      {/* Sticky join bar on phones */}
      <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <PriceTag total={c.total} mrp={c.mrp} offer={c.offer} compact />
        <Link href={joinHref} className={`${btnSolid} !h-11 shrink-0`}>
          Join now
        </Link>
      </div>

      <CtaBand />
    </>
  );
}
