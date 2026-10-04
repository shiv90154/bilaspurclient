"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, qs, type Batch, type Paginated } from "@/lib/api";
import {
  Badge,
  btnGhost,
  btnPrimary,
  ErrorNote,
  Field,
  inputCls,
  Modal,
  PageHeader,
} from "@/components/ui";

interface FacultyRow {
  id: string;
  qualification: string | null;
  user: { id: string; name: string; phone: string; email: string | null; status: string };
  batches: { batch: { id: string; name: string; course: { name: string } } }[];
}

const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || undefined;

export function FacultyView() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FacultyRow | null>(null);

  const list = useQuery({
    queryKey: ["faculty"],
    queryFn: () => api<Paginated<FacultyRow>>(`/faculty${qs({ limit: 100 })}`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/faculty/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["faculty"] }),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Roles & access"
        subtitle="Faculty accounts and the batches each one can see"
        action={
          <button className={btnPrimary} onClick={() => setAdding(true)}>
            <Plus size={16} /> Add faculty
          </button>
        }
      />
      <ErrorNote error={list.error ?? remove.error} />

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead className="border-b border-line text-[11.5px] uppercase tracking-wide text-sub">
            <tr>
              <th className="px-4 py-3">Faculty</th>
              <th className="px-4 py-3">Batches</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.data?.items.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-3">
                  <div className="font-semibold">{f.user.name}</div>
                  <div className="text-[12px] text-sub">{f.user.phone}{f.qualification ? ` · ${f.qualification}` : ""}</div>
                </td>
                <td className="px-4 py-3 text-sub">{f.batches.map((b) => `${b.batch.course.name} · ${b.batch.name}`).join(", ") || "—"}</td>
                <td className="px-4 py-3"><Badge tone={f.user.status === "ACTIVE" ? "green" : "red"}>{f.user.status}</Badge></td>
                <td className="px-4 py-3 text-right">
                  <button className={btnGhost + " !h-8 !px-3"} onClick={() => setEditing(f)}>Edit</button>{" "}
                  <button
                    className={btnGhost + " !h-8 !px-3 text-danger"}
                    onClick={() => window.confirm(`Delete ${f.user.name}? Their login will be disabled.`) && remove.mutate(f.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {list.data?.items.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sub">No faculty yet.</td></tr>
            )}
            {list.isPending && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sub">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {adding && <FacultyForm onClose={() => setAdding(false)} />}
      {editing && <FacultyForm faculty={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function FacultyForm({ faculty, onClose }: { faculty?: FacultyRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [password, setPassword] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const batches = useQuery({
    queryKey: ["batches", "all"],
    queryFn: () => api<Paginated<Batch>>(`/batches${qs({ limit: 100, active: true })}`),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      faculty
        ? api<{ temporaryPassword?: string }>(`/faculty/${faculty.id}`, { method: "PATCH", body })
        : api<{ temporaryPassword?: string }>("/faculty", { method: "POST", body }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["faculty"] });
      void qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      if (r.temporaryPassword) {
        setPassword(r.temporaryPassword);
        setDone(true);
      } else onClose();
    },
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      name: val(f, "name"),
      phone: val(f, "phone"),
      email: val(f, "email"),
      qualification: val(f, "qualification"),
      batchIds: f.getAll("batchIds").map(String),
    });
  };

  if (done) {
    return (
      <Modal title="Faculty added" onClose={onClose}>
        <p className="text-[13.5px]">They can log in with their phone number.</p>
        {password && (
          <div className="mt-3 rounded-[10px] bg-accent-tint p-3 text-[13px]">
            Temporary password (shown only once): <code className="font-bold">{password}</code>
          </div>
        )}
        <button className={btnPrimary + " mt-5"} onClick={onClose}>Done</button>
      </Modal>
    );
  }

  const mine = new Set(faculty?.batches.map((b) => b.batch.id));
  return (
    <Modal title={faculty ? "Edit faculty" : "Add faculty"} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Full name *">{(i) => <input id={i} name="name" required defaultValue={faculty?.user.name} className={inputCls} />}</Field>
          <Field label="Phone (10 digits) *">
            {(i) => <input id={i} name="phone" required pattern="[6-9][0-9]{9}" defaultValue={faculty?.user.phone} className={inputCls} />}
          </Field>
          <Field label="Email">{(i) => <input id={i} name="email" type="email" defaultValue={faculty?.user.email ?? ""} className={inputCls} />}</Field>
          <Field label="Qualification">{(i) => <input id={i} name="qualification" defaultValue={faculty?.qualification ?? ""} className={inputCls} />}</Field>
        </div>
        <fieldset>
          <legend className="text-[12px] font-semibold text-sub">Batches they can access</legend>
          <div className="mt-2 flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-[10px] border border-line p-3">
            {batches.data?.items.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" name="batchIds" value={b.id} defaultChecked={mine.has(b.id)} />
                {b.course?.name} · {b.name}
              </label>
            ))}
            {batches.data?.items.length === 0 && <span className="text-[13px] text-sub">No active batches yet.</span>}
          </div>
        </fieldset>
        <ErrorNote error={save.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
