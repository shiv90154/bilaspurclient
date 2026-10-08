import type { Metadata } from "next";
import { Award, BookOpenCheck, Brain, GraduationCap, HeartHandshake, Stethoscope } from "lucide-react";
import { CtaBand, FounderPhoto, FounderStats, PageHero, Section, SectionTitle, SOCIALS } from "@/components/site/site-ui";
import { FOUNDER, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE.founder}, ${FOUNDER.degrees}, ${FOUNDER.role}: 15+ years of teaching, about 400 students selected in AIAPGET and AMO exams.`,
  alternates: { canonical: "/about" },
};

const VALUES = [
  { icon: Brain, title: "Concepts first", text: "Every topic starts with the idea behind it, so you can explain it in your own words, not just repeat it." },
  { icon: BookOpenCheck, title: "Exam ready", text: "Notes and test series follow the AIAPGET and AMO pattern, with answer review after every test." },
  { icon: HeartHandshake, title: "Always reachable", text: "Ask doubts in the app any time. Your teacher replies there, and you get a notification." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Learn from a teacher who has cleared the exams himself"
        text={`${SITE.founder} (${FOUNDER.degrees}) has taught AIAPGET and AMO aspirants for over 15 years, and about 400 of his students have been selected.`}
      />

      <Section className="py-16 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="relative">
            <FounderPhoto src="/founder-seated.jpg" alt={`${SITE.founder} seated in a white coat`} />
            <div className="absolute -bottom-5 right-3 rounded-2xl bg-accent px-5 py-3 text-white shadow-lg sm:right-0">
              <p className="text-[12px] uppercase tracking-wider text-white/85">{FOUNDER.degrees}</p>
              <p className="text-[15px] font-semibold">{FOUNDER.role}</p>
            </div>
          </div>
          <div>
            <SectionTitle eyebrow="Meet your teacher" title={SITE.founder} />
            <div className="mt-5 flex flex-col gap-4 text-[16px] leading-relaxed text-sub">
              <p>
                {SITE.founder} is an <b className="text-ink">{FOUNDER.role}</b> with an MS in Shalya Tantra from Paprola. For more
                than 15 years he has prepared students for <b className="text-ink">AIAPGET</b> and <b className="text-ink">AMO</b>{" "}
                exams; about 400 of them have been selected.
              </p>
              <p>
                He has cleared the State AMO exam all five times he sat it, and a central-level AMO exam as well, so he teaches
                from inside the exam, not from the outside.
              </p>
              <p>
                DHĪ brings his <b className="text-ink">Ayurveda Classroom</b> into one place: live classes, notes, tests and doubt
                solving, so students can study in a structured way and track their own progress.
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

      <Section className="pb-16 lg:pb-24">
        <FounderStats />
      </Section>

      <Section className="bg-primary-tint/40 py-16 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-line bg-surface p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white"><GraduationCap size={21} /></span>
            <h2 className="mt-4 text-[18px] font-semibold">Education</h2>
            <ol className="mt-4 flex flex-col gap-4 border-l-2 border-accent/40 pl-4">
              {FOUNDER.education.map((e) => (
                <li key={e.degree}>
                  <p className="text-[15px] font-semibold text-ink">
                    {e.degree}
                    {"year" in e && <span className="ml-2 text-[13px] font-medium text-accent-ink">{e.year}</span>}
                  </p>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-sub">{e.place}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white"><Award size={21} /></span>
            <h2 className="mt-4 text-[18px] font-semibold">Achievements</h2>
            <ul className="mt-4 flex flex-col gap-3 text-[14px] leading-relaxed text-sub">
              {FOUNDER.achievements.map((a) => (
                <li key={a} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white"><Stethoscope size={21} /></span>
            <h2 className="mt-4 text-[18px] font-semibold">Clinical work</h2>
            <p className="mt-4 text-[14px] leading-relaxed text-sub">{FOUNDER.clinical}</p>
          </div>
        </div>
      </Section>

      <section className="border-b border-line bg-surface px-4 py-14 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center">
          <p className="text-[48px] font-bold leading-none text-accent" lang="sa">धी</p>
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-sub">{SITE.tagline}</p>
          <p className="max-w-2xl text-[16px] leading-relaxed text-ink sm:text-[18px]">
            <b className="text-primary">Dhī</b> is the Sanskrit word for intellect: the power to truly understand. The name is our
            promise. Concepts first, so they stay with you.
          </p>
        </div>
      </section>

      <Section className="py-16 lg:py-24">
        <SectionTitle eyebrow="How we teach" title="Three things we never compromise on" center />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {VALUES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-tint text-accent-ink">
                <Icon size={21} />
              </span>
              <h3 className="mt-4 text-[17px] font-semibold">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-sub">{text}</p>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand title="Start learning with DHĪ" />
    </>
  );
}
