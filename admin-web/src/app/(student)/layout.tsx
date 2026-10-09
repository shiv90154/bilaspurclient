import { StudentShell } from "@/components/student/student-shell";
import { ConsentForm } from "@/components/student/consent-form";
import { MaintenanceScreen } from "@/components/site/maintenance-screen";
import { getPublicInfo } from "@/lib/server/public-info";
import { requireUser } from "@/lib/server/session";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  // Checked before the session: during maintenance the API refuses student requests.
  const info = await getPublicInfo();
  if (info.maintenanceMode) return <MaintenanceScreen message={info.maintenanceMessage} />;
  const user = await requireUser(["STUDENT"]);
  return (
    <StudentShell user={{ name: user.name }}>
      {/* Nothing else opens until the current terms are accepted (DPDP: guardian for minors). */}
      {user.demo && !user.consentRequired && (
        <p role="status" className="mb-4 rounded-xl bg-accent-tint px-4 py-3 text-[13px] text-accent-ink">
          <b>Demo account.</b> You registered for {user.requestedCourse?.name ?? "a course"}. The institute will approve your
          admission soon; until then you can try the free demo notes and tests in the Android app. Classes and doubts open after approval,
          or right away when you pay the fee under <a href="/learn/fees" className="font-bold underline">Fees</a>.
        </p>
      )}
      {user.consentRequired ? <ConsentForm /> : children}
    </StudentShell>
  );
}
