import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage, Section } from "@/components/legal";
import { getPublicInfo } from "@/lib/server/public-info";

export const metadata: Metadata = { title: "Terms of use" };

export default async function TermsPage() {
  const info = await getPublicInfo();
  const name = info.instituteName;

  return (
    <LegalPage title="Terms of use" info={info}>
      <p>
        These terms apply to the DHĪ app and website run by {name}. By using them you (and, for a student under 18,
        your parent or guardian) agree to these terms and to the <Link href="/privacy" className="font-semibold text-primary">privacy policy</Link>.
      </p>

      <Section title="Your account">
        <ul className="list-disc space-y-1 pl-5">
          <li>Accounts are given by the institute to enrolled students and staff only.</li>
          <li>Keep your password secret. Do not share your account; it works on one phone at a time and logging in elsewhere logs out the other phone.</li>
          <li>Tell the institute if you think someone else used your account.</li>
        </ul>
      </Section>

      <Section title="Study content">
        <ul className="list-disc space-y-1 pl-5">
          <li>Notes, tests, questions and class recordings belong to {name} or its teachers and are for your personal study only.</li>
          <li>Do not copy, photograph, record, share, sell or upload them anywhere. Screenshots are blocked and content may carry a watermark with your name and phone.</li>
          <li>Sharing content can lead to your account being suspended, without a refund of fees, and to legal action under copyright law.</li>
        </ul>
      </Section>

      <Section title="Behaviour">
        <p>
          Be respectful in doubts and live classes. Do not post anything abusive, unlawful or unrelated to studies.
          Do not try to break, overload or get around the security of the app (for example rooted phones or modified apps).
        </p>
      </Section>

      <Section title="Fees and access">
        <p>
          Fees are paid to the institute outside the app. The app does not sell anything. The institute may pause access
          (for example when a student is inactive or fees are pending) as per the admission terms.
        </p>
      </Section>

      <Section title="Availability">
        <p>
          We try to keep the app running at all times, but it may be unavailable during maintenance or problems with
          internet, Zoom/Meet or other services. Test timings follow the server&apos;s clock.
        </p>
      </Section>

      <Section title="Ending your account">
        <p>
          You can ask to delete your account at any time (<Link href="/delete-account" className="font-semibold text-primary">account deletion</Link>).
          The institute closes accounts when a student leaves.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>When these terms change in a way that matters, the app asks you to accept them again.</p>
        <Contact info={info} />
      </Section>
    </LegalPage>
  );
}
