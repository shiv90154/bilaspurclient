import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { btn, ContactCard, PageHero, Section, SectionTitle, SOCIALS } from "@/components/site/site-ui";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Call or WhatsApp DHĪ Ayurveda Classroom for admission, batches, fees and timings.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to us about admission"
        text="Call or message for batches, fees and timings."
      >
        <a href={SITE.whatsappHref} target="_blank" rel="noopener noreferrer" className={`${btn} h-14 bg-[#1f8f4e] text-white hover:bg-[#187540]`}>
          <MessageCircle size={20} /> Chat on WhatsApp
        </a>
      </PageHero>

      <Section className="py-16 lg:py-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ContactCard icon={<Phone size={20} />} label="Call" value={SITE.phone} href={SITE.phoneHref} />
          <ContactCard icon={<MessageCircle size={20} />} label="WhatsApp" value={SITE.phone} href={SITE.whatsappHref} external />
          <ContactCard icon={<Mail size={20} />} label="Email" value={SITE.email} href={`mailto:${SITE.email}`} />
          <ContactCard icon={<MapPin size={20} />} label="Location" value={SITE.location} />
        </div>
      </Section>

      <Section className="pb-20">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-tint text-accent-ink"><Clock size={21} /></span>
            <h2 className="mt-4 text-[17px] font-semibold">Already a student?</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-sub">
              Ask study doubts inside the app, where your teacher can see your batch and reply with notes. For login, device or fee
              problems, message us on WhatsApp with your registered phone number.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-6">
            <SectionTitle eyebrow="Follow" title="Free lessons and updates" />
            <div className="mt-5 flex flex-wrap gap-3">
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
    </>
  );
}
