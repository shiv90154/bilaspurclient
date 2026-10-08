import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Apple, ShieldCheck, Smartphone } from "lucide-react";
import { btnOutline, PageHero, PlayStoreButton, Section, SectionTitle, Steps } from "@/components/site/site-ui";

export const metadata: Metadata = {
  title: "Get the app",
  description: "Download the DHĪ app from Google Play. iPhone users can log in on the website.",
  alternates: { canonical: "/app" },
};

const NOTES = [
  { icon: Smartphone, title: "Any recent Android phone", text: "Install free from Google Play. Updates arrive automatically." },
  { icon: ShieldCheck, title: "One phone per student", text: "Logging in on a new phone logs out the old one. Rooted phones and emulators are not supported." },
  { icon: Apple, title: "On an iPhone?", text: "Log in on this website for live classes, doubts, fees and your profile." },
];

export default function AppPage() {
  return (
    <>
      <PageHero
        eyebrow="App"
        title="Your classroom, in your pocket"
        text="Live classes, notes, tests and doubts in one app. Download it free from Google Play."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <PlayStoreButton />
          <Link href="/login" className={`${btnOutline} h-14`}>
            Log in on the web <ArrowRight size={18} />
          </Link>
        </div>
      </PageHero>

      <Section className="py-16 lg:py-20">
        <SectionTitle eyebrow="Getting started" title="Start in three steps" center />
        <div className="mt-12">
          <Steps />
        </div>
      </Section>

      <Section className="bg-primary-tint/40 py-16 lg:py-20">
        <SectionTitle eyebrow="Good to know" title="Before you install" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {NOTES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
                <Icon size={21} />
              </span>
              <h3 className="mt-4 text-[17px] font-semibold">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-sub">{text}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
