import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, MessageCircle } from "lucide-react";
import { btnOutline, CourseCard, CtaBand, PageHero, Section, SectionTitle, Steps } from "@/components/site/site-ui";
import { getOpenPlans } from "@/lib/server/public-plans";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Courses",
  description: "Ayurveda courses with live classes, notes and test series. See fees and buy on WhatsApp.",
  alternates: { canonical: "/courses" },
};

const FAQ = [
  {
    q: "How do I buy a course?",
    a: "Press Buy now on the course. WhatsApp opens with the course name already typed; send it and we reply with the payment details (UPI or bank transfer). You can also pay at the institute.",
  },
  {
    q: "When does my course open?",
    a: "As soon as we confirm your payment. Open the DHĪ app and sign in again to see your classes, notes and tests.",
  },
  {
    q: "Do I get a receipt?",
    a: "Yes. Every payment has a receipt under Fees, which you can print or save as PDF.",
  },
  {
    q: "Can I get a refund?",
    a: "See the refund rules in our terms. If you paid but the course did not open, message us on WhatsApp with the payment screenshot.",
  },
];

export default async function CoursesPage() {
  const plans = await getOpenPlans();
  return (
    <>
      <PageHero
        eyebrow="Courses"
        title="Choose your course"
        text="Live classes, PDF notes, test series and doubt solving in every course. Message us on WhatsApp to buy and start the same day."
      />

      <Section className="py-16 lg:py-20">
        {plans.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <CourseCard key={p.id} plan={p} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
            <span className="rounded-2xl bg-primary-tint p-3.5 text-primary"><GraduationCap size={26} /></span>
            <div>
              <p className="text-[17px] font-bold">New batches are being planned</p>
              <p className="mx-auto mt-1 max-w-md text-[14px] text-sub">Message us for the next batch, its timings and fees.</p>
            </div>
            <a href={SITE.whatsappHref} target="_blank" rel="noopener noreferrer" className={btnOutline}>
              <MessageCircle size={18} /> Ask on WhatsApp
            </a>
          </div>
        )}
        <p className="mt-6 text-[14px] text-sub">
          New here? Press Buy now and send us the message, then <Link href="/register" className="font-semibold text-primary">register</Link> in the app or on this website with the same phone number.
        </p>
      </Section>

      <Section className="bg-primary-tint/40 py-16 lg:py-20">
        <SectionTitle eyebrow="How to join" title="Start in three steps" center />
        <div className="mt-12">
          <Steps />
        </div>
      </Section>

      <Section className="py-16 lg:py-20">
        <SectionTitle eyebrow="Questions" title="Fees and payment" />
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group rounded-2xl border border-line bg-surface p-5 open:shadow-sm">
              <summary className="cursor-pointer list-none text-[15px] font-semibold marker:hidden">
                <span className="flex items-center justify-between gap-3">
                  {q}
                  <span className="text-[20px] leading-none text-primary transition group-open:rotate-45" aria-hidden="true">+</span>
                </span>
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-sub">
                {a}
                {q.startsWith("Can I") && (
                  <>
                    {" "}<Link href="/terms" className="font-semibold text-primary">Read the terms</Link>.
                  </>
                )}
              </p>
            </details>
          ))}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
