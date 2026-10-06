"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { format, isToday, isTomorrow } from "date-fns";
import { Video } from "lucide-react";
import Link from "next/link";
import { api, type ClassRow } from "@/lib/api";
import { Badge, btnPrimary, EmptyState, ErrorNote, ListSkeleton } from "@/components/ui";

const dayLabel = (d: Date) => (isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEE d MMM"));

function useUpcomingClasses() {
  return useQuery({
    queryKey: ["classes", "mine"],
    queryFn: () => api<ClassRow[]>("/classes/upcoming"),
    refetchInterval: 30_000,
  });
}

/** The link is only handed out by the server inside the join window, so it is requested on click. */
function useJoin() {
  return useMutation({
    mutationFn: (id: string) => api<{ joinUrl: string | null }>(`/classes/${id}/join`, { method: "POST" }),
    onSuccess: ({ joinUrl }) => joinUrl && window.open(joinUrl, "_blank", "noopener,noreferrer"),
  });
}

function ClassCard({ c, onJoin, busy }: { c: ClassRow; onJoin: (id: string) => void; busy: boolean }) {
  const start = new Date(c.startAt);
  const live = c.status === "LIVE";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
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
      <button className={btnPrimary} disabled={busy} onClick={() => onJoin(c.id)}>
        {live ? "Join now" : "Join"}
      </button>
    </li>
  );
}

export function StudentClasses() {
  const list = useUpcomingClasses();
  const join = useJoin();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-[18px] font-bold">Live classes</h1>
      <ErrorNote error={list.error ?? join.error} />
      {list.isPending && <ListSkeleton rows={2} />}
      {list.data?.length === 0 && (
        <EmptyState icon={Video} title="No classes scheduled" text="New classes appear here as soon as your teacher adds them, and you get a reminder before each one." />
      )}
      <ul className="flex flex-col gap-3">
        {list.data?.map((c) => <ClassCard key={c.id} c={c} onJoin={join.mutate} busy={join.isPending} />)}
      </ul>
      <p className="text-[12px] text-sub">You can join from 15 minutes before the class starts.</p>
    </section>
  );
}

/** Home screen: what is on next, with a one-tap Join. Shows nothing at all when there is no class. */
export function NextClasses() {
  const list = useUpcomingClasses();
  const join = useJoin();
  const next = list.data?.slice(0, 2) ?? [];

  if (list.isPending) return <ListSkeleton rows={1} />;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Coming up</h2>
        <Link href="/learn/classes" className="text-[12.5px] font-semibold text-primary">See all</Link>
      </div>
      <ErrorNote error={join.error} />
      {next.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-4 text-[13px] text-sub">
          No class is scheduled right now. You will get a notification when your teacher adds one.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {next.map((c) => <ClassCard key={c.id} c={c} onJoin={join.mutate} busy={join.isPending} />)}
        </ul>
      )}
    </section>
  );
}
