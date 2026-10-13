"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, HardDrive, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { Badge, btnGhost, ErrorNote, inputCls } from "@/components/ui";

interface Health {
  disk: { totalBytes: number; freeBytes: number; usedPct: number; level: "ok" | "warn" | "critical" } | null;
  push: { enabled: boolean; devicesWithPush: number };
  email: { enabled: boolean };
}
interface PushReport {
  user: { id: string; name: string };
  enabled: boolean;
  devices: number;
  sent: number;
  failed: number;
  errors: string[];
}

const gb = (b: number) => `${(b / 1e9).toFixed(1)} GB`;
const BAR: Record<"ok" | "warn" | "critical", string> = { ok: "bg-success", warn: "bg-accent", critical: "bg-danger" };

/** Admin only: disk space (uploads + recordings + database), push and email, with a test push. */
export function ServerHealth() {
  const health = useQuery({ queryKey: ["system-status"], queryFn: () => api<Health>("/system/status"), refetchInterval: 5 * 60_000 });
  const [report, setReport] = useState<PushReport | null>(null);
  const test = useMutation({
    mutationFn: (identifier: string) => api<PushReport>("/system/test-push", { method: "POST", body: { identifier: identifier || undefined } }),
    onSuccess: setReport,
  });
  const h = health.data;
  const d = h?.disk;

  function onTest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setReport(null);
    test.mutate(String(new FormData(e.currentTarget).get("identifier") ?? "").trim());
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-[15px] font-bold">Server health</h2>
      <ErrorNote error={health.error} />

      {d && (
        <div className="mt-3">
          <p className="flex items-center justify-between gap-2 text-[13px] font-semibold">
            <span className="flex items-center gap-2"><HardDrive size={16} aria-hidden="true" /> Disk space</span>
            <span className={d.level === "ok" ? "text-sub" : "text-danger"}>{d.usedPct}% used</span>
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg" role="meter" aria-valuenow={d.usedPct} aria-valuemin={0} aria-valuemax={100} aria-label="Disk used">
            <div className={`h-full ${BAR[d.level]}`} style={{ width: `${Math.min(100, d.usedPct)}%` }} />
          </div>
          <p className="mt-1 text-[12px] text-sub">{gb(d.freeBytes)} free of {gb(d.totalBytes)}</p>
          {d.level !== "ok" && (
            <p role="alert" className="mt-2 rounded-lg bg-danger-tint px-3 py-2 text-[12.5px] font-semibold text-danger">
              {d.level === "critical" ? "The disk is almost full." : "The disk is filling up."} Delete old recorded videos, move recordings to Cloudflare R2, or add disk space. When it is full, uploads and logins stop.
            </p>
          )}
        </div>
      )}

      {h && (
        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
          <p className="flex items-center justify-between gap-2 text-[13px] font-semibold">
            <span className="flex items-center gap-2"><Bell size={16} aria-hidden="true" /> Push notifications</span>
            <Badge tone={h.push.enabled ? "green" : "red"}>{h.push.enabled ? `On · ${h.push.devicesWithPush} phones` : "Off"}</Badge>
          </p>
          <p className="flex items-center justify-between gap-2 text-[13px] font-semibold">
            <span className="flex items-center gap-2"><Mail size={16} aria-hidden="true" /> Email (OTP, alerts)</span>
            <Badge tone={h.email.enabled ? "green" : "red"}>{h.email.enabled ? "On" : "Off"}</Badge>
          </p>
        </div>
      )}

      {h?.push.enabled && (
        <form onSubmit={onTest} className="mt-3 flex flex-col gap-2">
          <label htmlFor="push-test" className="text-[12px] font-semibold text-sub">Send a test notification to a student (phone or email)</label>
          <div className="flex gap-2">
            <input id="push-test" name="identifier" placeholder="Phone or email" className={inputCls} />
            <button className={btnGhost + " shrink-0"} disabled={test.isPending}>{test.isPending ? "Sending…" : "Send"}</button>
          </div>
          <ErrorNote error={test.error} />
          {report && (
            <p role="status" className={`rounded-lg px-3 py-2 text-[12.5px] font-semibold ${report.sent ? "bg-success-tint text-success" : "bg-danger-tint text-danger"}`}>
              {report.devices === 0
                ? `${report.user.name} has no phone signed in to the app with notifications allowed. Ask them to open the app, log in and allow notifications.`
                : report.sent
                  ? `Sent to ${report.sent} of ${report.devices} phone(s) of ${report.user.name}. Ask them if it arrived.`
                  : `Google refused it for all ${report.devices} phone(s): ${report.errors.join(", ")}. The app may be uninstalled; they should log in again.`}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
