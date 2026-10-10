import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage, Section } from "@/components/legal";
import { getPublicInfo } from "@/lib/server/public-info";

export const metadata: Metadata = { title: "Privacy policy" };

export default async function PrivacyPage() {
  const info = await getPublicInfo();
  const name = info.instituteName;

  return (
    <LegalPage title="Privacy policy" info={info}>
      <p>
        This policy explains what personal data {name} (&quot;we&quot;) collects through the DHĪ Android app and this
        website, why, and what you can do about it. It applies to students, parents/guardians, teachers and staff.
      </p>

      <Section title="Who can use the app">
        <p>
          Students can create an account themselves in the app or on this website (confirmed with a code sent to their
          email); the institute approves their admission. Teacher and staff accounts are created by the institute.
          If a student is under 18, a parent or guardian must agree to this policy and the terms before the app is used.
        </p>
      </Section>

      <Section title="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Account:</b> name, mobile number, email, password (stored only as a one-way hash).</li>
          <li><b>Profile, entered by the institute:</b> date of birth, gender, address, city, guardian name and phone, previous school, class and marks, target exam, photo, and documents such as ID proof or marksheets.</li>
          <li><b>Learning records:</b> batches and courses, test answers and scores, class attendance (when you join a live class), doubts you ask and the replies, and which study notes you open.</li>
          <li><b>Device and security:</b> a device identifier and model (one account works on one phone at a time), a notification token, IP address and login times.</li>
        </ul>
        <p>We do not collect location, contacts, call logs or your files. The app does not show ads and does not use advertising or analytics trackers.</p>
      </Section>

      <Section title="Why we use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>To run your classes, tests, study material and doubt solving, and to show your progress to you and your teachers.</li>
          <li>To send reminders about classes and replies to your doubts.</li>
          <li>To keep accounts secure: one device per student, blocking screenshots and screen recording of protected content, and (when the institute turns it on) a faint watermark with your name and phone on the screen so leaked photos can be traced.</li>
          <li>To keep institute records such as admission documents and attendance.</li>
        </ul>
      </Section>

      <Section title="Who we share it with">
        <p>We never sell your data. It is shared only with the services needed to run the app:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>our server hosting provider, where the data is stored;</li>
          <li>Google Firebase Cloud Messaging, to deliver notifications (it receives the notification token and the message);</li>
          <li>Zoom or Google Meet, only when you open a live class link (their own privacy policies apply there).</li>
          <li>WhatsApp, only when you choose to message us there, for example to buy a course (WhatsApp&apos;s own privacy policy applies).</li>
        </ul>
        <p>Teachers see data only for the batches they teach. We disclose data to authorities only when the law requires it.</p>
      </Section>

      <Section title="How we protect it">
        <p>
          All traffic is encrypted (HTTPS). Passwords are hashed. Documents and notes are kept in private storage and
          opened only through links that expire within minutes. Opening personal documents is logged. Backups are kept for
          up to 14 days.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          We keep your data while you are enrolled. When you ask us to delete your account, we remove your personal data
          within 30 days: name, phone, email, address, guardian details, photo, documents and devices. Test scores and
          attendance stay only as anonymous numbers for batch statistics. Copies in backups disappear within 14 days after
          that. Records we must keep by law (for example fee receipts) are kept for the required period.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You (or your parent/guardian) can ask to see your data, correct it, or delete your account. To delete it, use
          <b> Profile → Delete my account</b> in the app or the <Link href="/delete-account" className="font-semibold text-primary">account deletion page</Link>.
          You can also withdraw consent at any time; the app cannot be used without it.
        </p>
      </Section>

      <Section title="Contact and grievances">
        <p>Questions, corrections or complaints about your data:</p>
        <Contact info={info} />
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes in a way that matters, the app will ask you to read and accept it again. The version
          date is shown at the top of this page.
        </p>
      </Section>
    </LegalPage>
  );
}
