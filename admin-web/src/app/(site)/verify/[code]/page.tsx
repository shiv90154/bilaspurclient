import type { Metadata } from "next";
import { BadgeCheck, CircleX } from "lucide-react";
import { backendRequest } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "Student ID check",
  robots: { index: false, follow: false },
};

interface CardCheck {
  instituteName: string;
  name: string;
  admissionNo: string | null;
  active: boolean;
  expired: boolean;
  valid: boolean;
  courses: string[];
  validTill: string | null;
  checkedAt: string;
}

const day = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Where the QR on a student's ID card leads: says whether the card belongs to a current student. */
export default async function VerifyCardPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let card: CardCheck | null = null;
  if (/^[0-9a-f]{32}\.[0-9a-f]{16}$/i.test(code)) {
    const res = await backendRequest(`/students/id-card/${encodeURIComponent(code)}`).catch(() => null);
    if (res?.ok) card = (await res.json()) as CardCheck;
  }
  const valid = card?.valid === true;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
        {valid ? (
          <BadgeCheck size={48} className="mx-auto text-primary" aria-hidden="true" />
        ) : (
          <CircleX size={48} className="mx-auto text-danger" aria-hidden="true" />
        )}
        <h1 className="mt-3 font-display text-[22px] font-bold">
          {valid ? "Valid student ID" : card ? "This ID is no longer valid" : "ID card not found"}
        </h1>
        {card ? (
          <dl className="mt-5 flex flex-col divide-y divide-line text-left text-[14px]">
            <Row label="Name" value={card.name} />
            {card.admissionNo && <Row label="Admission no" value={card.admissionNo} />}
            <Row label="Institute" value={card.instituteName} />
            {card.courses.length > 0 && <Row label="Course" value={card.courses.join(", ")} />}
            {card.validTill && <Row label="Valid till" value={day(card.validTill)} />}
            <Row label="Status" value={valid ? "Current student" : card.active && card.expired ? "Course ended" : "Not a current student"} />
          </dl>
        ) : (
          <p className="mt-3 text-[14px] text-sub">
            The code in this link does not match any student. Ask the student to open the ID card in the DHĪ app again.
          </p>
        )}
        {card && <p className="mt-5 text-[12px] text-sub">Checked live on {day(card.checkedAt)}.</p>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-sub">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
