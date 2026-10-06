"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { format, isToday, isTomorrow } from "date-fns";
import { Video } from "lucide-react";
import { api, type ClassRow } from "@/lib/api";
import { Badge, btnPrimary, ErrorNote } from "@/components/ui";

const dayLabel = (d: Date) => (isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEE d MMM"));

export function StudentClasses() {
  const list = useQuery({
    queryKey: ["classes", "mine"],
    queryFn: () => api<ClassRow[]>("/classes/upcoming"),
    refetchInterval: 30_000,
  });

  // The link is only handed out by the server inside the join window, so it is requested on click.
  const join = useMutation({
    mutationFn: (id: string) => api<{ joinUrl: string | null }>(`/classes/${id}/join`, { method: "POST" }),
    onSuccess: ({ joinUrl }) => joinUrl && window.open(joinUrl, "_blank", "noopener,noreferrer"),
  });

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-[18px] font-bold">Live classes</h1>
      <ErrorNote error={list.error ?? join.error} />
      {list.isPending && <p className="text-[13px] text-sub">Loading…</p>}
      {list.data?.length === 0 && (
        <p className="rounded-2xl border border-line bg-surface p-5 text-[13px] text-sub">
          No classes are scheduled for your batch right now. New classes appear here as soon as your teacher adds them.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {list.data?.map((c) => {
          const start = new Date(c.startAt);
          const live = c.status === "LIVE";
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-primary-tint p-2.5 text-primary"><Video size={20} /></span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-[14.5px] font-bold">{c.title}</p>
                    {live && <Badge tone="green">Live now</Badge>}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-sub">
                    {dayLabel(start)}, {format(start, "h:mm a")} – {format(new Date(c.endAt), "h:mm a")}
                    {c.faculty && ` · ${c.faculty.user.name}`}
                  </p>
                </div>
              </div>
              <button className={btnPrimary} disabled={join.isPending} onClick={() => join.mutate(c.id)}>
                {live ? "Join now" : "Join"}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] text-sub">You can join from 15 minutes before the class starts.</p>
    </section>
  );
}
