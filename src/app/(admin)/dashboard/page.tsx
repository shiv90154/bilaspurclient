import type { Metadata } from "next";
import { format } from "date-fns";
import { SystemStatus } from "@/components/admin/system-status";

export const metadata: Metadata = { title: "Dashboard" };

// Numbers come from the dashboard API (docs/07-admin-dashboard.md) once Phase 1 is built.
const STATS = [
  { label: "Total students", hint: "All registered students" },
  { label: "Active students", hint: "Currently enrolled" },
  { label: "New enquiries", hint: "Pending follow-ups shown here" },
  { label: "Live classes today", hint: "Scheduled for today" },
  { label: "Question bank", hint: "Questions across subjects" },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[23px] font-bold">Dashboard</h1>
        <p className="mt-1 text-[13px] text-sub">
          {format(new Date(), "EEEE, d MMMM")} · overview across all batches
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {STATS.map((stat) => (
          <div key={stat.label} className="rounded-[14px] border border-line bg-surface p-[18px]">
            <div className="text-[12px] font-semibold text-sub">{stat.label}</div>
            <div className="mt-2.5 font-display text-[26px] font-extrabold text-sub/50" aria-label="No data yet">
              —
            </div>
            <div className="mt-1.5 text-[11.5px] text-sub">{stat.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-[15px] font-bold">Pending follow-ups & recent activity</h2>
          <p className="mt-2 text-[13px] text-sub">
            Appears here after the students, enquiries and activity-log modules are built (Phase 1).
          </p>
        </section>
        <SystemStatus />
      </div>
    </div>
  );
}
