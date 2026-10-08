import type { Metadata } from "next";
import { Bell, Laptop, Smartphone } from "lucide-react";
import { CtaBand, FeatureGrid, PageHero, Section, SectionTitle } from "@/components/site/site-ui";

export const metadata: Metadata = {
  title: "What you get",
  description: "Live classes, study notes, test series, doubt solving and video lessons in the DHĪ app.",
  alternates: { canonical: "/features" },
};

const PLATFORMS = [
  {
    icon: Smartphone,
    title: "Android app",
    points: ["Live classes, notes, tests, videos and doubts", "Content is protected: no screenshots or recording", "Works on one phone at a time"],
  },
  {
    icon: Laptop,
    title: "Website (iPhone and computer)",
    points: ["Join live classes and ask doubts", "Pay fees and download receipts", "See your profile and progress"],
  },
  {
    icon: Bell,
    title: "Notifications",
    points: ["Class reminders before every live class", "Alert when a teacher answers your doubt", "Updates when a class is changed or cancelled"],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="What you get"
        title="Everything you need to prepare, in one app"
        text="One place for classes, notes, tests and doubts, made for the way Ayurveda students actually study."
      />

      <Section className="py-16 lg:py-20">
        <FeatureGrid />
      </Section>

      <Section className="bg-primary-tint/40 py-16 lg:py-20">
        <SectionTitle eyebrow="Where you can use it" title="App, website and notifications" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PLATFORMS.map(({ icon: Icon, title, points }) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-tint text-accent-ink">
                <Icon size={21} />
              </span>
              <h3 className="mt-4 text-[17px] font-semibold">{title}</h3>
              <ul className="mt-3 flex flex-col gap-2 text-[14px] text-sub">
                {points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
