"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { GraduationCap, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, qs, type Batch, type Course, type Paginated } from "@/lib/api";
import {
  Badge,
  btnGhost,
  btnPrimary,
  EmptyState,
  ErrorNote,
  Field,
  inputCls,
  ListSkeleton,
  Modal,
  PageHeader,
} from "@/components/ui";
import { plural } from "@/lib/format";

type Dialog = { kind: "course" } | { kind: "batch"; courseId?: string } | null;

export function CoursesView({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<Dialog>(null);

  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: () => api<Paginated<Course>>(`/courses${qs({ limit: 100 })}`),
  });
  const batches = useQuery({
    queryKey: ["batches", "all-incl-inactive"],
    queryFn: () => api<Paginated<Batch>>(`/batches${qs({ limit: 100 })}`),
  });

  const archive = useMutation({
    mutationFn: ({ kind, id }: { kind: "courses" | "batches"; id: string }) =>
      api(`/${kind}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["courses"] });
      void qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });

  const onArchive = (kind: "courses" | "batches", id: string, name: string) => {
    const extra = kind === "courses" ? " All its batches will be archived too." : "";
    if (window.confirm(`Archive "${name}"?${extra}`)) archive.mutate({ kind, id });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Courses & batches"
        subtitle="Every student belongs to a course through one or more batches"
        action={
          canEdit && (
            <div className="flex gap-2">
              <button className={btnGhost} onClick={() => setDialog({ kind: "batch" })}>
                <Plus size={16} /> Batch
              </button>
              <button className={btnPrimary} onClick={() => setDialog({ kind: "course" })}>
                <Plus size={16} /> Course
              </button>
            </div>
          )
        }
      />

      <ErrorNote error={courses.error ?? batches.error ?? archive.error} />
      {courses.isPending && <ListSkeleton />}
      {courses.data?.items.length === 0 && (
        <EmptyState
          icon={GraduationCap}
          title="No courses yet"
          text="Add your first course, then create batches under it. Students, classes and tests are all organised by batch."
          action={canEdit ? <button className={btnPrimary} onClick={() => setDialog({ kind: "course" })}><Plus size={16} /> Add course</button> : undefined}
        />
      )}

      <div className="flex flex-col gap-4">
        {courses.data?.items.map((c) => {
          const own = batches.data?.items.filter((b) => b.courseId === c.id) ?? [];
          return (
            <section key={c.id} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[15px] font-bold">{c.name}</h2>
                  <Badge tone={c.active ? "green" : "gray"}>{c.active ? "Active" : "Archived"}</Badge>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <button className={btnGhost + " !h-8 !px-3"} onClick={() => setDialog({ kind: "batch", courseId: c.id })}>
                      Add batch
                    </button>
                    {c.active && (
                      <button className={btnGhost + " !h-8 !px-3 text-danger"} onClick={() => onArchive("courses", c.id, c.name)}>
                        Archive
                      </button>
                    )}
                  </div>
                )}
              </div>
              {c.description && <p className="mt-1 text-[13px] text-sub">{c.description}</p>}

              <ul className="mt-3 divide-y divide-line text-[13px]">
                {own.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span>
                      <span className="font-semibold">{b.name}</span>
                      <span className="ml-2 text-sub">
                        {b.startDate ? format(new Date(b.startDate), "d MMM yyyy") : "No start date"}
                        {b.endDate ? ` → ${format(new Date(b.endDate), "d MMM yyyy")}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-sub">{plural(b._count?.students ?? 0, "student")}</span>
                      {!b.active && <Badge tone="gray">Archived</Badge>}
                      {canEdit && b.active && (
                        <button className="text-[12px] font-semibold text-danger" onClick={() => onArchive("batches", b.id, b.name)}>
                          Archive
                        </button>
                      )}
                    </span>
                  </li>
                ))}
                {own.length === 0 && <li className="py-2.5 text-sub">No batches yet.</li>}
              </ul>
            </section>
          );
        })}
      </div>

      {dialog?.kind === "course" && <CourseForm onClose={() => setDialog(null)} />}
      {dialog?.kind === "batch" && (
        <BatchForm courses={courses.data?.items.filter((c) => c.active) ?? []} courseId={dialog.courseId} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function useSave<T>(path: string, onClose: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: T) => api(path, { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["courses"] });
      void qc.invalidateQueries({ queryKey: ["batches"] });
      onClose();
    },
  });
}

const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || undefined;

function CourseForm({ onClose }: { onClose: () => void }) {
  const save = useSave<Record<string, unknown>>("/courses", onClose);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({ name: val(f, "name"), description: val(f, "description") });
  };
  return (
    <Modal title="Add course" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="Course name *">{(id) => <input id={id} name="name" required maxLength={100} className={inputCls} />}</Field>
        <Field label="Description">{(id) => <textarea id={id} name="description" rows={3} maxLength={1000} className={inputCls + " h-auto py-2"} />}</Field>
        <ErrorNote error={save.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Saving…" : "Add course"}</button>
        </div>
      </form>
    </Modal>
  );
}

function BatchForm({ courses, courseId, onClose }: { courses: Course[]; courseId?: string; onClose: () => void }) {
  const save = useSave<Record<string, unknown>>("/batches", onClose);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      courseId: val(f, "courseId"),
      name: val(f, "name"),
      startDate: val(f, "startDate"),
      endDate: val(f, "endDate"),
    });
  };
  return (
    <Modal title="Add batch" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <Field label="Course *">
          {(id) => (
            <select id={id} name="courseId" required defaultValue={courseId ?? ""} className={inputCls}>
              <option value="" disabled>Select a course</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Batch name *">{(id) => <input id={id} name="name" required maxLength={100} placeholder="Morning A" className={inputCls} />}</Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Start date">{(id) => <input id={id} name="startDate" type="date" className={inputCls} />}</Field>
          <Field label="End date">{(id) => <input id={id} name="endDate" type="date" className={inputCls} />}</Field>
        </div>
        <ErrorNote error={save.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Saving…" : "Add batch"}</button>
        </div>
      </form>
    </Modal>
  );
}
