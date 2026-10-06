"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, MessageCircleQuestion, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, qs, type DoubtDetail, type DoubtRow, type DoubtStatus, type Paginated } from "@/lib/api";
import { Badge, btnGhost, btnPrimary, EmptyState, ErrorNote, Field, inputCls, ListSkeleton, Modal } from "@/components/ui";

const LABEL: Record<DoubtStatus, { text: string; tone: "red" | "blue" | "amber" | "green" }> = {
  OPEN: { text: "Waiting for a teacher", tone: "red" },
  ASSIGNED: { text: "With a teacher", tone: "blue" },
  ANSWERED: { text: "Answered", tone: "amber" },
  RESOLVED: { text: "Resolved", tone: "green" },
};

export function StudentDoubts() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const list = useQuery({
    queryKey: ["doubts", "mine"],
    queryFn: () => api<Paginated<DoubtRow>>(`/doubts${qs({ limit: 50 })}`),
    refetchInterval: 30_000,
  });

  if (openId) return <Thread id={openId} onBack={() => setOpenId(null)} />;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[18px] font-bold">My doubts</h1>
        <button className={btnPrimary} onClick={() => setAsking(true)}><Plus size={16} /> Ask a doubt</button>
      </div>
      <ErrorNote error={list.error} />
      {list.isPending && <ListSkeleton rows={2} />}
      {list.data?.items.length === 0 && (
        <EmptyState
          icon={MessageCircleQuestion}
          title="No doubts yet"
          text="Stuck on something? Ask your teachers and follow the answer here."
          action={<button className={btnPrimary} onClick={() => setAsking(true)}><Plus size={16} /> Ask a doubt</button>}
        />
      )}
      <ul className="flex flex-col gap-2.5">
        {list.data?.items.map((d) => (
          <li key={d.id}>
            <button onClick={() => setOpenId(d.id)} className="w-full rounded-2xl border border-line bg-surface p-4 text-left hover:border-primary">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14px] font-semibold">{d.title}</p>
                <Badge tone={LABEL[d.status].tone}>{LABEL[d.status].text}</Badge>
              </div>
              <p className="mt-1 text-[12px] text-sub">
                {d.subject?.name ?? "General"} · updated {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}
              </p>
            </button>
          </li>
        ))}
      </ul>
      {asking && <Ask onClose={() => setAsking(false)} />}
    </section>
  );
}

function Ask({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (body: unknown) => api("/doubts", { method: "POST", body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["doubts"] }); onClose(); },
  });
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({ title: String(f.get("title")).trim(), text: String(f.get("text")).trim() });
  };
  return (
    <Modal title="Ask a doubt" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="Short title *">{(id) => <input id={id} name="title" required maxLength={200} className={inputCls} />}</Field>
        <Field label="Describe your doubt *">{(id) => <textarea id={id} name="text" required rows={5} maxLength={4000} className={inputCls + " h-auto py-2"} />}</Field>
        <ErrorNote error={save.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Sending…" : "Send"}</button>
        </div>
      </form>
    </Modal>
  );
}

function Thread({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ["doubt", id], queryFn: () => api<DoubtDetail>(`/doubts/${id}`), refetchInterval: 15_000 });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["doubt", id] });
    void qc.invalidateQueries({ queryKey: ["doubts"] });
  };
  const reply = useMutation({ mutationFn: (text: string) => api(`/doubts/${id}/messages`, { method: "POST", body: { text } }), onSuccess: refresh });
  const act = useMutation({ mutationFn: (a: "resolve" | "reopen") => api(`/doubts/${id}/${a}`, { method: "POST" }), onSuccess: refresh });

  const d = detail.data;
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const text = String(new FormData(form).get("text") ?? "").trim();
    if (text) reply.mutate(text, { onSuccess: () => form.reset() });
  };

  return (
    <section className="flex flex-col gap-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-sub hover:text-ink">
        <ArrowLeft size={15} /> My doubts
      </button>
      {detail.isPending && <p className="text-[13px] text-sub">Loading…</p>}
      <ErrorNote error={detail.error ?? reply.error ?? act.error} />
      {d && (
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-[16px] font-bold">{d.title}</h2>
              {d.assignedTo && <p className="text-[12.5px] text-sub">Teacher: {d.assignedTo.name}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={LABEL[d.status].tone}>{LABEL[d.status].text}</Badge>
              {d.status === "RESOLVED" ? (
                <button className={btnGhost + " !h-8 !px-3"} disabled={act.isPending} onClick={() => act.mutate("reopen")}>Reopen</button>
              ) : (
                <button className={btnGhost + " !h-8 !px-3"} disabled={act.isPending} onClick={() => act.mutate("resolve")}>Mark resolved</button>
              )}
            </div>
          </div>
          <ol className="flex flex-col gap-2.5">
            {d.messages.map((m) => {
              const mine = m.sender.role === "STUDENT";
              return (
                <li key={m.id} className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13.5px] ${mine ? "self-end bg-primary-tint" : "self-start bg-bg"}`}>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <p className="mt-1 text-[11px] text-sub">{mine ? "You" : m.sender.name} · {format(new Date(m.createdAt), "d MMM, h:mm a")}</p>
                </li>
              );
            })}
          </ol>
          {d.status !== "RESOLVED" && (
            <form onSubmit={onSubmit} className="flex gap-2">
              <textarea name="text" required rows={2} maxLength={4000} aria-label="Your message" placeholder="Add a follow-up…" className={inputCls + " h-auto py-2"} />
              <button className={btnPrimary + " self-end"} disabled={reply.isPending}>{reply.isPending ? "…" : "Send"}</button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
