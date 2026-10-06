import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { CalendarPlus, ClipboardCheck, FileText, MessageCircleQuestion, UserPlus } from "lucide-react";
import { DashboardStats } from "@/components/admin/dashboard-stats";
import { SystemStatus } from "@/components/admin/system-status";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Dashboard" };

const ACTIONS = [
  { href: "/students", label: "Add a student", hint: "Register and put in a batch", icon: UserPlus, adminOnly: true },
  { href: "/tests", label: "Create a test", hint: "From the question bank", icon: ClipboardCheck },
  { href: "/classes", label: "Schedule a class", hint: "Zoom or Meet, with reminders", icon: CalendarPlus },
  { href: "/materials", label: "Upload notes", hint: "PDF for selected batches", icon: FileText },
  { href: "/doubts", label: "Answer doubts", hint: "Reply to students", icon: MessageCircleQuestion },
];

export default async function DashboardPage() {
  const user = await requireUser(["ADMIN", "FACULTY"]);
  const actions = ACTIONS.filter((a) => !a.adminOnly || user.role === "ADMIN");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[23px] font-bold">Hello, {user.name.split(" ")[0]}</h1>
        <p className="mt-1 text-[13px] text-sub">
          {format(new Date(), "EEEE, d MMMM")} · overview across all batches
        </p>
      </div>

      <section aria-label="Quick actions" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {actions.map(({ href, label, hint, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-3 rounded-[14px] border border-line bg-surface p-4 transition-colors hover:border-primary"
          >
            <span className="rounded-xl bg-primary-tint p-2.5 text-primary">
              <Icon size={18} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-[13.5px] font-bold">{label}</span>
              <span className="mt-0.5 block text-[11.5px] text-sub">{hint}</span>
            </span>
          </Link>
        ))}
      </section>

      <DashboardStats />
      <div className="max-w-md">
        <SystemStatus />
      </div>
    </div>
  );
}
