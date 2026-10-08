import type { Metadata } from "next";
import { BookOpenCheck, Brain, HeartHandshake } from "lucide-react";
import { CtaBand, FounderPhoto, PageHero, Section, SectionTitle, SOCIALS } from "@/components/site/site-ui";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `Meet ${SITE.founder}, founder of DHĪ Ayurveda Classroom, and how we teach Ayurveda concept by concept.`,
  alternates: { canonical: "/about" },
};

const VALUES = [
  { icon: Brain, title: "Concepts first", text: "Every topic starts with the idea behind it, so you can explain it in your own words, not just repeat it." },
  { icon: BookOpenCheck, title: "Exam ready", text: "Notes and test series follow the syllabus and exam pattern, with answer review after every test." },
  { icon: HeartHandshake, title: "Always reachable", text: "Ask doubts in the app any time. Your teacher replies there, and you get a notification." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Ayurveda, taught the way it should be understood"
        text={`DHĪ is the online classroom of ${SITE.founder}: live classes, notes, tests and doubt solving for Ayurveda students, in one place.`}
      />

      <Section className="py-16 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="relative">
            <FounderPhoto src="/founder-seated.jpg" alt={`${SITE.founder} seated in a white coat`} />
            <div className="absolute -bottom-5 right-3 rounded-2xl bg-accent px-5 py-3 text-white shadow-lg sm:right-0">
              <p className="text-[12px] uppercase tracking-wider text-white/85">Teaching on</p>
              <p className="text-[15px] font-semibold">YouTube · App · Live</p>
            </div>
          </div>
          <div>
            <SectionTitle eyebrow="Meet your teacher" title={SITE.founder} />
            <div className="mt-5 flex flex-col gap-4 text-[16px] leading-relaxed text-sub">
              <p>
                {SITE.founder} runs <b className="text-ink">Ayurveda Classroom</b>, where students learn Ayurveda in simple language
                with a focus on the concepts behind every topic.
              </p>
              <p>
                DHĪ brings that teaching into one place: live classes, notes, tests and doubt solving, so students can study in a
                structured way and track their own progress.
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

      <section className="border-y border-line bg-surface px-4 py-14 sm:px-6">
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
