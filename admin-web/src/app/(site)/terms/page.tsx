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
          <li>Students may register in the app or on this website; full access opens when the institute approves the admission or the fee is paid. Staff accounts are given by the institute.</li>
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

      <Section title="Fees, payments and refunds">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            To buy a course, message the institute on WhatsApp from the course page on this website. We share the payment
            details (UPI or bank transfer) in the chat; you can also pay at the institute. The app itself does not sell
            anything. Prices are in Indian rupees and include taxes.
          </li>
          <li>Pay only to the UPI ID or bank account the institute shares from its official number. We never ask for your UPI PIN or OTP.</li>
          <li>Once the institute confirms the payment, the course opens in the app and a receipt is available on the website.</li>
          <li>
            If you paid but the course does not open, message us with the payment screenshot or transaction ID; it is
            settled within 2 working days, or refunded.
          </li>
          <li>
            Fees are not refundable once the course has started or study content has been opened, except when the
            institute cancels the course. Approved refunds go back to the original payment method within 7 working days.
          </li>
          <li>The institute may pause access (for example when a student is inactive or fees are pending) as per the admission terms.</li>
        </ul>
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
