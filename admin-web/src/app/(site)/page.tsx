import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  btnOutline,
  btnSolid,
  CourseCard,
  CtaBand,
  Eyebrow,
  FeatureGrid,
  FEATURES,
  FounderPhoto,
  FounderStats,
  PlayStoreButton,
  Section,
  SectionTitle,
  Steps,
  YoutubeIcon,
} from "@/components/site/site-ui";
import { ROLE_HOME } from "@/lib/constants";
import { getOpenPlans } from "@/lib/server/public-plans";
import { getSessionUser } from "@/lib/server/session";
import { FOUNDER, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "DHĪ · Ayurveda Classroom by Dr. Pardeuman Singh" },
  alternates: { canonical: "/" },
};

/** Home page; signed-in users go straight to their own home. */
export default async function HomePage() {
  const state = await getSessionUser();
  if (state.status === "ok") redirect(ROLE_HOME[state.user.role]);
  if (state.status === "needs-refresh") redirect("/api/session/refresh?next=/");
  const plans = await getOpenPlans();

  return (
    <>
      {/* Hero */}
      <Section className="relative pb-16 pt-10 sm:pt-16 lg:pb-24">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-primary-tint/60 blur-3xl" aria-hidden="true" />
        <div className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Eyebrow>Ayurveda Classroom</Eyebrow>
            <h1 className="mt-5 text-[38px] font-bold leading-[1.1] text-primary-dark sm:text-[52px]">
              Understand Ayurveda.
              <span className="block text-accent">Don’t just memorise it.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-sub sm:text-[17px]">
              Prepare for AIAPGET and AMO with {SITE.founder} ({FOUNDER.degrees}): live classes, clear notes, exam-style test
              series and quick doubt solving, all in one app.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/courses" className={`${btnSolid} sm:h-14`}>
                Explore courses <ArrowRight size={18} />
              </Link>
              <a href={SITE.youtube} target="_blank" rel="noopener noreferrer" className={`${btnOutline} sm:h-14`}>
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
          <FounderPhoto
            src="/founder-portrait.jpg"
            alt={`${SITE.founder}, founder of DHĪ`}
            caption={
              <>
                <p className="text-[18px] font-semibold">{SITE.founder}</p>
                <p className="text-[13px] text-white/80">{FOUNDER.degrees} · {FOUNDER.role}</p>
              </>
            }
          />
        </div>
      </Section>

      {/* The founder in numbers */}
      <Section className="pb-14">
        <FounderStats />
      </Section>

      {/* Meaning of the name */}
      <section className="border-y border-line bg-surface px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 text-center">
          <p className="text-[40px] font-bold leading-none text-accent" lang="sa">धी</p>
          <p className="max-w-2xl text-[16px] leading-relaxed text-ink sm:text-[18px]">
            <b className="text-primary">Dhī</b> is the Sanskrit word for intellect: the power to truly understand. That is how we
            teach. Concepts first, so they stay with you.
          </p>
          <Link href="/about" className="mt-1 inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline">
            About {SITE.founder} <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Courses */}
      {plans.length > 0 && (
        <Section className="py-16 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle eyebrow="Courses" title="Join a course" text="Press Buy now to message us on WhatsApp. Your course opens in the app as soon as the fee is paid." />
            <Link href="/courses" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline">
              All courses <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.slice(0, 3).map((p) => (
              <CourseCard key={p.id} plan={p} />
            ))}
          </div>
        </Section>
      )}

      {/* Features */}
      <Section className="bg-primary-tint/40 py-16 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle eyebrow="What you get" title="Everything you need to prepare, in one app" />
          <Link href="/features" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline">
            See all features <ArrowRight size={16} />
          </Link>
        </div>
        <div className="mt-10">
          <FeatureGrid items={FEATURES.slice(0, 3)} />
        </div>
      </Section>

      {/* How to join */}
      <Section className="py-16 lg:py-24">
        <SectionTitle eyebrow="How to join" title="Start in three steps" center />
        <div className="mt-12">
          <Steps />
        </div>
        <div className="mt-10 flex justify-center">
          <PlayStoreButton />
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
