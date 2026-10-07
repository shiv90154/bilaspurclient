import type { Metadata } from "next";
import { Contact, LegalPage, Section } from "@/components/legal";
import { getPublicInfo } from "@/lib/server/public-info";
import { DeletionForm } from "./deletion-form";

export const metadata: Metadata = { title: "Delete my account" };

export default async function DeleteAccountPage() {
  const info = await getPublicInfo();
  return (
    <LegalPage title="Delete my account" info={info}>
      <p>
        Students of {info.instituteName} can ask for their DHĪ account and personal data to be deleted. You can also do
        this inside the app: <b>Profile → Delete my account</b>.
      </p>

      <Section title="What gets deleted">
        <ul className="list-disc space-y-1 pl-5">
          <li>Your name, mobile number, email, address, date of birth and guardian details</li>
          <li>Your photo and uploaded documents (ID proof, marksheets)</li>
          <li>Your devices, logins and notification settings</li>
        </ul>
        <p>
          Test scores and class attendance are kept only as anonymous numbers for batch statistics. Records the
          institute must keep by law (for example fee receipts) are kept for the required period. Deletion is done
          within 30 days, and backup copies disappear 14 days after that.
        </p>
      </Section>

      <Section title="Request deletion">
        <p className="text-sub">
          The institute checks that the request really comes from you (it may call the number) before deleting anything.
        </p>
        <DeletionForm />
      </Section>

      <Section title="Questions">
        <Contact info={info} />
      </Section>
    </LegalPage>
  );
}
