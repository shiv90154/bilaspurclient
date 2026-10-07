"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { api, type DashboardSummary } from "@/lib/api";
import { ErrorNote } from "@/components/ui";
import { describeActivity } from "@/lib/format";

const LABELS: Record<string, [string, string]> = {
  students: ["Total students", "All registered students"],
  activeStudents: ["Active students", "Currently enrolled"],
  faculty: ["Faculty", "Teaching staff"],
  activeBatches: ["Active batches", "Running right now"],
  openEnquiries: ["Open enquiries", "Not yet converted or lost"],
  followUpsDue: ["Follow-ups due", "Due today or overdue"],
  openDoubts: ["Open doubts", "Waiting for an answer"],
  upcomingClasses: ["Upcoming classes", "Scheduled ahead"],
  liveNow: ["Live now", "Classes running right now"],
  materials: ["Study material", "Published notes"],
  questions: ["Question bank", "Active questions"],
  activeToday: ["Active today", "Used the app or panel"],
  activeWeek: ["Active this week", "Last 7 days"],
  pendingRegistrations: ["New registrations", "Waiting for your approval"],
};

export function DashboardStats() {
  const { data, isPending, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => api<DashboardSummary>("/dashboard/summary"),
    refetchInterval: 60_000,
  });

  if (error) return <ErrorNote error={error} />;

  const entries = Object.keys(LABELS).filter((k) => !data || k in data.counts);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {entries.map((key) => (
          <div key={key} className="rounded-[14px] border border-line bg-surface p-3.5 sm:p-[18px]">
            <div className="text-[12px] font-semibold text-sub">{LABELS[key][0]}</div>
            <div className="mt-2 font-display text-[22px] font-extrabold sm:mt-2.5 sm:text-[26px]">
              {isPending ? <span className="text-sub/50">—</span> : data.counts[key]}
            </div>
            <div className="mt-1.5 text-[11.5px] text-sub">{LABELS[key][1]}</div>
          </div>
        ))}
      </div>

      {data?.recentActivity && (
        <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="text-[15px] font-bold">Recent activity</h2>
          {data.recentActivity.length === 0 ? (
            <p className="mt-2 text-[13px] text-sub">Nothing yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-[13px]">
                  <span className="min-w-0">
                    <span className="font-semibold">{a.actor?.name ?? "System"}</span>{" "}
                    <span className="text-sub">· {describeActivity(a.action)}</span>
                  </span>
                  <span className="shrink-0 text-[12px] text-sub">
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
