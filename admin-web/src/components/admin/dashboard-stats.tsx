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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {entries.map((key) => (
          <div key={key} className="rounded-[14px] border border-line bg-surface p-[18px]">
            <div className="text-[12px] font-semibold text-sub">{LABELS[key][0]}</div>
            <div className="mt-2.5 font-display text-[26px] font-extrabold">
              {isPending ? <span className="text-sub/50">—</span> : data.counts[key]}
            </div>
            <div className="mt-1.5 text-[11.5px] text-sub">{LABELS[key][1]}</div>
          </div>
        ))}
      </div>

      {data?.recentActivity && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-[15px] font-bold">Recent activity</h2>
          {data.recentActivity.length === 0 ? (
            <p className="mt-2 text-[13px] text-sub">Nothing yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span>
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
