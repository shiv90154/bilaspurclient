"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, qs, type DoubtDetail, type DoubtRow, type DoubtStatus, type FacultyRow, type Paginated } from "@/lib/api";
import { Badge, btnGhost, btnPrimary, ErrorNote, inputCls, PageHeader, Pager } from "@/components/ui";

const TONE: Record<DoubtStatus, "red" | "blue" | "amber" | "green"> = {
  OPEN: "red",
  ASSIGNED: "blue",
  ANSWERED: "amber",
  RESOLVED: "green",
};
const LIMIT = 15;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function DoubtsView({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["doubts", { page, status }],
    queryFn: () => api<Paginated<DoubtRow>>(`/doubts${qs({ page, limit: LIMIT, status })}`),
    refetchInterval: 30_000,
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Doubts"
        subtitle={isAdmin ? "Every student doubt. Assign it to a faculty member or answer it yourself." : "Doubts assigned to you, and new ones from your batches."}
      />
      <select aria-label="Status" className={inputCls + " sm:!w-48"} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
        <option value="">All statuses</option>
        <option value="OPEN">Open (unanswered)</option>
        <option value="ASSIGNED">Assigned</option>
        <option value="ANSWERED">Answered</option>
        <option value="RESOLVED">Resolved</option>
      </select>

      <ErrorNote error={list.error} />
      {list.isPending && <p className="text-[13px] text-sub">Loading…</p>}
      {list.data?.items.length === 0 && <p className="rounded-2xl border border-line bg-surface p-6 text-[13px] text-sub">No doubts here. 🎉</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <ul className="flex flex-col gap-2">
          {list.data?.items.map((d) => (
            <li key={d.id}>
              <button onClick={() => setOpenId(d.id)} aria-current={openId === d.id}
                className={`w-full rounded-2xl border bg-surface p-3.5 text-left hover:border-primary ${openId === d.id ? "border-primary" : "border-line"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13.5px] font-semibold">{d.title}</p>
                  <Badge tone={TONE[d.status]}>{d.status}</Badge>
                </div>
                <p className="mt-1 text-[12px] text-sub">
                  {d.student.user.name} · {[d.subject?.name, d.topic?.name].filter(Boolean).join(" › ") || "General"} · {d._count.messages} msgs
                </p>
                <p className="text-[11.5px] text-sub">
                  {d.assignedTo ? `Assigned to ${d.assignedTo.name} · ` : "Unassigned · "}
                  {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}
                </p>
              </button>
            </li>
          ))}
          {list.data && <Pager page={page} limit={LIMIT} total={list.data.total} onPage={setPage} />}
        </ul>

        <div>
          {openId ? <Thread key={openId} id={openId} isAdmin={isAdmin} /> : (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-[13px] text-sub">Select a doubt to read and reply.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Thread({ id, isAdmin }: { id: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ["doubt", id], queryFn: () => api<DoubtDetail>(`/doubts/${id}`), refetchInterval: 15_000 });
  const faculty = useQuery({
    queryKey: ["faculty"],
    queryFn: () => api<Paginated<FacultyRow>>(`/faculty${qs({ limit: 100 })}`),
    enabled: isAdmin,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["doubt", id] });
    void qc.invalidateQueries({ queryKey: ["doubts"] });
  };
  const reply = useMutation({ mutationFn: (text: string) => api(`/doubts/${id}/messages`, { method: "POST", body: { text } }), onSuccess: refresh });
  const assign = useMutation({ mutationFn: (facultyUserId: string) => api(`/doubts/${id}/assign`, { method: "POST", body: { facultyUserId } }), onSuccess: refresh });
  const resolve = useMutation({ mutationFn: (a: "resolve" | "reopen") => api(`/doubts/${id}/${a}`, { method: "POST" }), onSuccess: refresh });

  const d = detail.data;
  if (detail.isPending) return <p className="text-[13px] text-sub">Loading…</p>;
  if (!d) return <ErrorNote error={detail.error} />;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const text = String(new FormData(form).get("text") ?? "").trim();
    if (text) reply.mutate(text, { onSuccess: () => form.reset() });
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-bold">{d.title}</h2>
          <p className="text-[12.5px] text-sub">
            {d.student.user.name} · {d.student.user.phone}
            {d.classTimestamp !== null && ` · at ${mmss(d.classTimestamp)} in class`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={TONE[d.status]}>{d.status}</Badge>
          {d.status === "RESOLVED" ? (
            <button className={btnGhost + " !h-8 !px-3"} disabled={resolve.isPending} onClick={() => resolve.mutate("reopen")}><RotateCcw size={14} /> Reopen</button>
          ) : (
            <button className={btnGhost + " !h-8 !px-3"} disabled={resolve.isPending} onClick={() => resolve.mutate("resolve")}><CheckCircle2 size={14} /> Resolve</button>
          )}
        </div>
      </div>

      {isAdmin && (
        <label className="flex items-center gap-2 text-[12.5px] text-sub">
          Assign to
          <select aria-label="Assign to faculty" className={inputCls + " !h-8 max-w-56"} value={d.assignedTo?.id ?? ""}
            disabled={assign.isPending} onChange={(e) => e.target.value && assign.mutate(e.target.value)}>
            <option value="" disabled>Choose faculty</option>
            {faculty.data?.items.map((f) => <option key={f.userId} value={f.userId}>{f.user.name}</option>)}
          </select>
        </label>
      )}
      <ErrorNote error={reply.error ?? assign.error ?? resolve.error}/>

      <ol className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto">
        {d.messages.map((m) => {
          const staff = m.sender.role !== "STUDENT";
          return (
            <li key={m.id} className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] ${staff ? "self-end bg-primary-tint" : "self-start bg-bg"}`}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              <p className="mt-1 text-[11px] text-sub">{m.sender.name} · {format(new Date(m.createdAt), "d MMM, h:mm a")}</p>
            </li>
          );
        })}
      </ol>

      {d.status === "RESOLVED" ? (
        <p className="text-[12.5px] text-sub">Resolved. Reopen to reply.</p>
      ) : (
        <form onSubmit={onSubmit} className="flex gap-2">
          <textarea name="text" required rows={2} maxLength={4000} aria-label="Your answer" placeholder="Write your answer…" className={inputCls + " h-auto py-2"} />
          <button className={btnPrimary + " self-end"} disabled={reply.isPending}>{reply.isPending ? "…" : "Send"}</button>
        </form>
      )}
    </section>
  );
}
