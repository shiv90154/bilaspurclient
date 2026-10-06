"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  api,
  qs,
  type Course,
  type Difficulty,
  type Paginated,
  type Question,
  type QuestionType,
  type Subject,
} from "@/lib/api";
import {
  Badge,
  btnGhost,
  btnPrimary,
  ErrorNote,
  Field,
  inputCls,
  Modal,
  PageHeader,
  Pager,
} from "@/components/ui";

const TONE = { EASY: "green", MEDIUM: "amber", HARD: "red" } as const;
const LIMIT = 15;

export function useSubjects() {
  return useQuery({ queryKey: ["subjects"], queryFn: () => api<Subject[]>("/subjects") });
}

export function QuestionBankView({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<"question" | "curriculum" | null>(null);
  const qc = useQueryClient();

  const subjects = useSubjects();
  const topics = subjects.data?.find((s) => s.id === subjectId)?.topics ?? [];

  const list = useQuery({
    queryKey: ["questions", { page, subjectId, topicId, difficulty, search }],
    queryFn: () =>
      api<Paginated<Question>>(
        `/questions${qs({ page, limit: LIMIT, subjectId, topicId, difficulty, search, active: true })}`,
      ),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api(`/questions/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["questions"] }),
  });

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Question bank"
        subtitle="Reusable questions, organised by subject and topic. Tests are built from here."
        action={
          <div className="flex gap-2">
            <button className={btnGhost} onClick={() => setDialog("curriculum")}>Subjects &amp; topics</button>
            <button className={btnPrimary} onClick={() => setDialog("question")}>
              <Plus size={16} /> Question
            </button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select aria-label="Subject" className={inputCls} value={subjectId}
          onChange={(e) => { reset(setSubjectId)(e.target.value); setTopicId(""); }}>
          <option value="">All subjects</option>
          {subjects.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select aria-label="Topic" className={inputCls} value={topicId} disabled={!subjectId}
          onChange={(e) => reset(setTopicId)(e.target.value)}>
          <option value="">All topics</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select aria-label="Difficulty" className={inputCls} value={difficulty}
          onChange={(e) => reset(setDifficulty)(e.target.value)}>
          <option value="">Any difficulty</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
        <input aria-label="Search questions" className={inputCls} placeholder="Search question text" value={search}
          onChange={(e) => reset(setSearch)(e.target.value)} />
      </div>

      <ErrorNote error={list.error ?? archive.error} />
      {list.isPending && <p className="text-[13px] text-sub">Loading…</p>}
      {list.data?.items.length === 0 && (
        <p className="rounded-2xl border border-line bg-surface p-6 text-[13px] text-sub">
          No questions found. {subjects.data?.length === 0
            ? "Create a subject and topic first, then add questions."
            : "Add your first question."}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {list.data?.items.map((q) => (
          <li key={q.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-[14px] font-semibold">{q.text}</p>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={TONE[q.difficulty]}>{q.difficulty}</Badge>
                {q.type === "MULTIPLE" && <Badge tone="blue">Multi</Badge>}
                <button aria-label="Archive question" className="rounded-lg p-1.5 text-danger hover:bg-bg"
                  onClick={() => window.confirm("Archive this question? Existing tests keep it.") && archive.mutate(q.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <p className="mt-0.5 text-[12px] text-sub">{q.topic.subject.name} › {q.topic.name}</p>
            <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
              {q.options.map((o) => (
                <li key={o.id} className={`flex items-start gap-2 rounded-[10px] border px-3 py-2 text-[13px] ${
                  o.isCorrect ? "border-success bg-success-tint" : "border-line"}`}>
                  {o.isCorrect && <Check size={14} className="mt-0.5 shrink-0 text-success" />}
                  <span>{o.text}</span>
                </li>
              ))}
            </ul>
            {q.explanation && <p className="mt-2 text-[12.5px] text-sub">Explanation: {q.explanation}</p>}
          </li>
        ))}
      </ul>

      {list.data && <Pager page={page} limit={LIMIT} total={list.data.total} onPage={setPage} />}

      {dialog === "question" && <QuestionForm subjects={subjects.data ?? []} onClose={() => setDialog(null)} />}
      {dialog === "curriculum" && <CurriculumDialog isAdmin={isAdmin} onClose={() => setDialog(null)} />}
    </div>
  );
}

function QuestionForm({ subjects, onClose }: { subjects: Subject[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [subjectId, setSubjectId] = useState("");
  const [type, setType] = useState<QuestionType>("SINGLE");
  const [options, setOptions] = useState([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);
  const [localError, setLocalError] = useState("");

  const save = useMutation({
    mutationFn: (body: unknown) => api("/questions", { method: "POST", body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["questions"] });
      onClose();
    },
  });

  const setCorrect = (i: number, checked: boolean) =>
    setOptions((prev) =>
      prev.map((o, j) =>
        type === "SINGLE" ? { ...o, isCorrect: j === i } : j === i ? { ...o, isCorrect: checked } : o,
      ),
    );

  const changeType = (t: QuestionType) => {
    setType(t);
    if (t === "SINGLE") {
      // keep only the first correct option so the form never holds an invalid state
      const first = options.findIndex((o) => o.isCorrect);
      setOptions((prev) => prev.map((o, j) => ({ ...o, isCorrect: j === Math.max(first, 0) })));
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const filled = options.filter((o) => o.text.trim());
    if (filled.length < 2) return setLocalError("Add at least two options");
    if (!filled.some((o) => o.isCorrect)) return setLocalError("Mark the correct option");
    setLocalError("");
    save.mutate({
      topicId: String(f.get("topicId")),
      text: String(f.get("text")).trim(),
      type,
      difficulty: String(f.get("difficulty")) as Difficulty,
      explanation: String(f.get("explanation") ?? "").trim() || undefined,
      options: filled.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
    });
  };

  const topics = subjects.find((s) => s.id === subjectId)?.topics ?? [];

  return (
    <Modal title="Add question" onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Subject *">
            {(id) => (
              <select id={id} required value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputCls}>
                <option value="" disabled>Select</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Topic *">
            {(id) => (
              <select id={id} name="topicId" required defaultValue="" key={subjectId} className={inputCls}>
                <option value="" disabled>Select</option>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </Field>
        </div>
        <Field label="Question *">
          {(id) => <textarea id={id} name="text" required rows={3} maxLength={4000} className={inputCls + " h-auto py-2"} />}
        </Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Type">
            {(id) => (
              <select id={id} value={type} onChange={(e) => changeType(e.target.value as QuestionType)} className={inputCls}>
                <option value="SINGLE">Single correct</option>
                <option value="MULTIPLE">Multiple correct</option>
              </select>
            )}
          </Field>
          <Field label="Difficulty">
            {(id) => (
              <select id={id} name="difficulty" defaultValue="MEDIUM" className={inputCls}>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            )}
          </Field>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[12px] font-semibold text-sub">
            Options — tick the correct {type === "SINGLE" ? "one" : "ones"}
          </legend>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={type === "SINGLE" ? "radio" : "checkbox"}
                name="correct"
                aria-label={`Option ${i + 1} is correct`}
                checked={o.isCorrect}
                onChange={(e) => setCorrect(i, e.target.checked)}
                className="size-4 accent-[var(--color-primary,#1F4D2C)]"
              />
              <input
                aria-label={`Option ${i + 1}`}
                value={o.text}
                maxLength={1000}
                placeholder={`Option ${i + 1}`}
                onChange={(e) => setOptions((p) => p.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                className={inputCls}
              />
            </div>
          ))}
        </fieldset>

        <Field label="Explanation (shown after the test)">
          {(id) => <textarea id={id} name="explanation" rows={2} maxLength={4000} className={inputCls + " h-auto py-2"} />}
        </Field>
        <ErrorNote error={localError ? new Error(localError) : save.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={save.isPending}>{save.isPending ? "Saving…" : "Add question"}</button>
        </div>
      </form>
    </Modal>
  );
}

function CurriculumDialog({ isAdmin, onClose }: { isAdmin: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const subjects = useSubjects();
  const courses = useQuery({ queryKey: ["courses"], queryFn: () => api<Paginated<Course>>(`/courses${qs({ limit: 100 })}`) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["subjects"] });

  const add = useMutation({
    mutationFn: ({ path, body }: { path: string; body: unknown }) => api(path, { method: "POST", body }),
    onSuccess: refresh,
  });

  const submit = (path: string, body: Record<string, unknown>) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (name) add.mutate({ path, body: { ...body, name } }, { onSuccess: () => form.reset() });
  };

  return (
    <Modal title="Subjects & topics" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <ErrorNote error={add.error ?? subjects.error} />
        <ul className="flex max-h-72 flex-col gap-3 overflow-y-auto">
          {subjects.data?.length === 0 && <li className="text-[13px] text-sub">No subjects yet.</li>}
          {subjects.data?.map((s) => (
            <li key={s.id} className="rounded-[10px] border border-line p-3">
              <p className="text-[13.5px] font-bold">
                {s.name} <span className="font-normal text-sub">· {s.course?.name}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {s.topics.map((t) => <Badge key={t.id} tone="gray">{t.name}</Badge>)}
              </div>
              <form onSubmit={submit("/topics", { subjectId: s.id })} className="mt-2 flex gap-2">
                <input name="name" aria-label={`New topic in ${s.name}`} placeholder="New topic" maxLength={150} className={inputCls + " !h-8"} />
                <button className={btnGhost + " !h-8 !px-3"} disabled={add.isPending}>Add</button>
              </form>
            </li>
          ))}
        </ul>

        {isAdmin ? (
          <form onSubmit={(e) => {
            const courseId = String(new FormData(e.currentTarget).get("courseId") ?? "");
            submit("/subjects", { courseId })(e);
          }} className="flex flex-col gap-2 border-t border-line pt-3">
            <p className="text-[12px] font-semibold text-sub">New subject</p>
            <div className="flex gap-2">
              <select name="courseId" required aria-label="Course" defaultValue="" className={inputCls}>
                <option value="" disabled>Course</option>
                {courses.data?.items.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input name="name" required aria-label="Subject name" placeholder="Physics" maxLength={100} className={inputCls} />
              <button className={btnPrimary} disabled={add.isPending}>Add</button>
            </div>
          </form>
        ) : (
          <p className="border-t border-line pt-3 text-[12.5px] text-sub">Only an admin can add subjects. You can add topics.</p>
        )}
      </div>
    </Modal>
  );
}
