/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  CirclePlay,
  Download,
  FileText,
  LogIn,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Smartphone,
  UserPlus,
  BadgeCheck,
  Video,
} from "lucide-react";
import { BrandMark } from "@/components/brand";
import { SITE } from "@/lib/site";

// lucide-react 1.x dropped brand icons, so the three social marks are drawn here.
function YoutubeIcon({ size = 20 }: { size?: number }) {
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

const SOCIALS = [
  { href: SITE.youtube, label: "YouTube", icon: YoutubeIcon },
  { href: SITE.instagram, label: "Instagram", icon: InstagramIcon },
  { href: SITE.facebook, label: "Facebook", icon: FacebookIcon },
];

const FEATURES = [
  { icon: Video, title: "Live classes", text: "Join scheduled live sessions from the app. Your attendance is marked automatically." },
  { icon: FileText, title: "Study notes", text: "Clear PDF notes, sorted by subject and topic, for your batch. Read them right inside the app." },
  { icon: ClipboardCheck, title: "Tests and test series", text: "Timed exam-style tests with instant results, negative marking, ranks and answer review." },
  { icon: MessageCircle, title: "Doubt solving", text: "Ask a doubt any time. Faculty reply in the app and you are notified as soon as they do." },
  { icon: CirclePlay, title: "Video lessons", text: "Recorded lessons to revise a topic again, at your own pace." },
  { icon: ShieldCheck, title: "Safe and private", text: "Protected content, one device per student and no ads. Your data is never sold." },
];

const STEPS = [
  { icon: Download, title: "Download the app", text: "Get the DHĪ Android app from this website." },
  { icon: UserPlus, title: "Register", text: "Sign up with your name, phone and email. Verify with a one-time code." },
  { icon: BadgeCheck, title: "Start learning", text: "Once the institute approves you, your batch’s classes, notes and tests open up." },
];

function Section({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-20 px-4 sm:px-6 ${className}`}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
      <span className="h-px w-6 bg-accent" aria-hidden="true" />
      {children}
    </p>
  );
}

const btn = "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold transition";
const btnPrimary = `${btn} bg-primary text-white shadow-sm hover:bg-primary-dark`;
const btnOutline = `${btn} border border-primary/25 bg-surface text-primary hover:border-primary hover:bg-primary-tint`;

export function Landing({ appSoon = false }: { appSoon?: boolean }) {
  const year = new Date().getFullYear();
  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="DHĪ home">
            <BrandMark size={38} />
            <span className="leading-tight">
              <span className="block text-[18px] font-bold text-primary">DHĪ</span>
              <span className="hidden text-[10px] uppercase tracking-[0.16em] text-sub sm:block">Ayurveda Classroom</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-[14px] font-medium text-sub md:flex" aria-label="Main">
            <a href="#about" className="hover:text-primary">About</a>
            <a href="#features" className="hover:text-primary">What you get</a>
            <a href="#app" className="hover:text-primary">App</a>
            <a href="#contact" className="hover:text-primary">Contact</a>
          </nav>
          <Link href="/login" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-semibold text-white hover:bg-primary-dark">
            <LogIn size={16} /> Log in
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <Section className="relative pb-16 pt-10 sm:pt-16 lg:pb-24">
          <div
            className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-primary-tint/60 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <Eyebrow>Ayurveda Classroom</Eyebrow>
              <h1 className="mt-5 text-[38px] font-bold leading-[1.1] text-primary-dark sm:text-[52px]">
                Understand Ayurveda.
                <span className="block text-accent">Don’t just memorise it.</span>
              </h1>
              <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-sub sm:text-[17px]">
                Learn with {SITE.founder}: live classes, clear notes, exam-style test series and quick doubt solving,
                all in one app.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="/download" className={btnPrimary}>
                  <Download size={18} /> Download the app
                </a>
                <a href={SITE.youtube} target="_blank" rel="noopener noreferrer" className={btnOutline}>
                  <YoutubeIcon size={18} /> Watch free lessons
                </a>
              </div>
              <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-medium text-sub">
                {["Live classes", "PDF notes", "Test series", "Doubt solving"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-[400px]">
              <div className="absolute -inset-3 rounded-[2.2rem] border border-accent/40" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-[2rem] bg-surface shadow-xl shadow-primary/10">
                <img
                  src="/founder-portrait.jpg"
                  alt={`${SITE.founder}, founder of DHĪ`}
                  width={900}
                  height={1200}
                  className="aspect-[4/5] w-full object-cover object-top"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary-dark/90 via-primary-dark/50 to-transparent px-5 pb-5 pt-16 text-white">
                  <p className="text-[18px] font-semibold">{SITE.founder}</p>
                  <p className="text-[13px] text-white/80">Founder &amp; Faculty</p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Meaning of the name */}
        <section className="border-y border-line bg-surface px-4 py-10 sm:px-6">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center">
            <p className="text-[40px] font-bold leading-none text-accent" lang="sa">धी</p>
            <p className="max-w-2xl text-[16px] leading-relaxed text-ink sm:text-[18px]">
              <b className="text-primary">Dhī</b> is the Sanskrit word for intellect: the power to truly understand.
              That is how we teach. Concepts first, so they stay with you.
            </p>
          </div>
        </section>

        {/* About */}
        <Section id="about" className="py-16 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="relative mx-auto w-full max-w-[380px] lg:order-none">
              <img
                src="/founder-seated.jpg"
                alt={`${SITE.founder} seated in a white coat`}
                width={900}
                height={1200}
                loading="lazy"
                className="aspect-[4/5] w-full rounded-[2rem] object-cover shadow-lg shadow-primary/10"
              />
              <div className="absolute -bottom-5 -right-3 rounded-2xl bg-accent px-5 py-3 text-white shadow-lg sm:-right-6">
                <p className="text-[12px] uppercase tracking-wider text-white/85">Teaching on</p>
                <p className="text-[15px] font-semibold">YouTube · App · Live</p>
              </div>
            </div>
            <div>
              <Eyebrow>Meet your teacher</Eyebrow>
              <h2 className="mt-4 text-[30px] font-bold leading-tight text-primary-dark sm:text-[38px]">{SITE.founder}</h2>
              <div className="mt-5 flex flex-col gap-4 text-[16px] leading-relaxed text-sub">
                <p>
                  {SITE.founder} runs <b className="text-ink">Ayurveda Classroom</b>, where students learn Ayurveda in
                  simple language with a focus on the concepts behind every topic.
                </p>
                <p>
                  DHĪ brings that teaching into one place: live classes, notes, tests and doubt solving, so students can
                  study in a structured way and track their own progress.
                </p>
              </div>
              <div className="mt-7 flex flex-wrap gap-3">
                {SOCIALS.map(({ href, label, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[14px] font-semibold text-ink hover:border-primary hover:text-primary"
                  >
                    <Icon size={18} /> {label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Features */}
        <Section id="features" className="bg-primary-tint/40 py-16 lg:py-24">
          <div className="max-w-2xl">
            <Eyebrow>What you get</Eyebrow>
            <h2 className="mt-4 text-[30px] font-bold leading-tight text-primary-dark sm:text-[38px]">
              Everything you need to prepare, in one app
            </h2>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:shadow-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
                  <Icon size={21} />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-sub">{text}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* How to join */}
        <Section className="py-16 lg:py-24">
          <div className="text-center">
            <div className="flex justify-center">
              <Eyebrow>How to join</Eyebrow>
            </div>
            <h2 className="mt-4 text-[30px] font-bold text-primary-dark sm:text-[38px]">Start in three steps</h2>
          </div>
          <ol className="mt-12 grid gap-8 md:grid-cols-3">
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
        </Section>

        {/* App */}
        <Section id="app" className="pb-16 lg:pb-24">
          <div className="relative overflow-hidden rounded-[2rem] bg-primary-dark px-6 py-12 text-white sm:px-12 lg:py-16">
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full border-[40px] border-accent/15" aria-hidden="true" />
            <div className="relative grid items-center gap-10 lg:grid-cols-[1.3fr_0.7fr]">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent-tint">DHĪ for Android</p>
                <h2 className="mt-3 text-[28px] font-bold leading-tight sm:text-[36px]">Your classroom, in your pocket</h2>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/80">
                  Download the app, register and start learning once you are approved. On an iPhone or a computer, log in on
                  this website for classes, doubts and your profile.
                </p>
                {appSoon && (
                  <p role="status" className="mt-5 inline-block rounded-lg bg-accent px-4 py-2 text-[14px] font-semibold text-white">
                    The app download will be available here soon. Please contact us meanwhile.
                  </p>
                )}
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <a href="/download" className={`${btn} bg-accent text-white hover:brightness-110`}>
                    <Download size={18} /> Download APK
                  </a>
                  <Link href="/login" className={`${btn} border border-white/30 text-white hover:bg-white/10`}>
                    Log in on the web <ArrowRight size={18} />
                  </Link>
                </div>
                <p className="mt-4 text-[12px] text-white/60">
                  If Android asks, allow &quot;Install unknown apps&quot; for your browser, then tap Install.
                </p>
              </div>
              <div className="hidden justify-center lg:flex">
                <div className="flex h-56 w-56 items-center justify-center rounded-[2.5rem] bg-white/5 ring-1 ring-white/15">
                  <Smartphone size={110} strokeWidth={1.2} className="text-accent-tint" />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Contact */}
        <Section id="contact" className="pb-20">
          <div className="max-w-2xl">
            <Eyebrow>Contact</Eyebrow>
            <h2 className="mt-4 text-[30px] font-bold text-primary-dark sm:text-[38px]">Talk to us about admission</h2>
            <p className="mt-3 text-[16px] text-sub">Call or message for batches, fees and timings.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ContactCard icon={<Phone size={20} />} label="Call" value={SITE.phone} href={SITE.phoneHref} />
            <ContactCard icon={<MessageCircle size={20} />} label="WhatsApp" value={SITE.phone} href={SITE.whatsappHref} external />
            <ContactCard icon={<Mail size={20} />} label="Email" value={SITE.email} href={`mailto:${SITE.email}`} />
            <ContactCard icon={<MapPin size={20} />} label="Location" value={SITE.location} />
          </div>
        </Section>
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-surface px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <BrandMark size={40} />
              <span className="text-[18px] font-bold text-primary">DHĪ</span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-sub">
              Ayurveda Classroom by {SITE.founder}. {SITE.tagline}.
            </p>
            <div className="mt-4 flex gap-2">
              {SOCIALS.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-sub hover:border-primary hover:text-primary"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>
          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-[14px] text-sub" aria-label="Footer">
            <a href="#about" className="hover:text-primary">About</a>
            <Link href="/privacy" className="hover:text-primary">Privacy policy</Link>
            <a href="#features" className="hover:text-primary">What you get</a>
            <Link href="/terms" className="hover:text-primary">Terms of use</Link>
            <a href="/download" className="hover:text-primary">Download app</a>
            <Link href="/delete-account" className="hover:text-primary">Delete my account</Link>
            <Link href="/login" className="hover:text-primary">Log in</Link>
            <Link href="/register" className="hover:text-primary">Register</Link>
          </nav>
        </div>
        <p className="mx-auto mt-8 max-w-6xl border-t border-line pt-6 text-[12px] text-sub">
          © {year} DHĪ. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

function ContactCard({ icon, label, value, href, external }: { icon: ReactNode; label: string; value: string; href?: string; external?: boolean }) {
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
