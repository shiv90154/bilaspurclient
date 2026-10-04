import type { Metadata } from "next";
import { format } from "date-fns";
import { DashboardStats } from "@/components/admin/dashboard-stats";
import { SystemStatus } from "@/components/admin/system-status";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[23px] font-bold">Dashboard</h1>
        <p className="mt-1 text-[13px] text-sub">
          {format(new Date(), "EEEE, d MMMM")} · overview across all batches
        </p>
      </div>

      <DashboardStats />
      <div className="max-w-md">
        <SystemStatus />
      </div>
    </div>
  );
}
