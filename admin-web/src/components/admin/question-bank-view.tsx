"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Check, FileUp, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { QuestionImport } from "./question-import";
import {
  api,
  apiForm,
  fileHref,
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
  EmptyState,
  ErrorNote,
  Field,
  inputCls,
  ListSkeleton,
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
  const [dialog, setDialog] = useState<"question" | "curriculum" | "import" | null>(null);
  const [editing, setEditing] = useState<Question | null>(null);
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

  const filtered = !!(search || subjectId || topicId || difficulty);

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
          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={() => setDialog("curriculum")}>Subjects &amp; topics</button>
            <button className={btnGhost} onClick={() => setDialog("import")}><FileUp size={15} /> Import CSV</button>
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
      {list.isPending && <ListSkeleton rows={4} />}
      {list.data?.items.length === 0 && (
        <EmptyState
          icon={BookOpenCheck}
          title={filtered ? "No question matches" : "No questions yet"}
          text={
            filtered
              ? "Try a different filter or search word."
              : subjects.data?.length === 0
                ? "Create a subject and topic first (Subjects & topics), then add questions one by one or import many from a spreadsheet."
                : "Add questions one by one, or import many at once from a CSV spreadsheet. Tests are built from this bank."
          }
          action={
            filtered ? undefined : (
              <div className="flex flex-wrap justify-center gap-2">
                <button className={btnPrimary} onClick={() => setDialog(subjects.data?.length ? "question" : "curriculum")}>
                  <Plus size={16} /> {subjects.data?.length ? "Add a question" : "Add subjects & topics"}
                </button>
                {!!subjects.data?.length && (
                  <button className={btnGhost} onClick={() => setDialog("import")}><FileUp size={15} /> Import CSV</button>
                )}
              </div>
            )
          }
        />
      )}

      <ul className="flex flex-col gap-3">
        {list.data?.items.map((q) => (
          <li key={q.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 break-words text-[14px] font-semibold">{q.text}</p>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={TONE[q.difficulty]}>{q.difficulty}</Badge>
                {q.type === "MULTIPLE" && <Badge tone="blue">Multi</Badge>}
                <button aria-label="Edit question" className="rounded-lg p-1.5 text-sub hover:bg-bg" onClick={() => setEditing(q)}>
                  <Pencil size={15} />
                </button>
                <button aria-label="Archive question" className="rounded-lg p-1.5 text-danger hover:bg-bg"
                  onClick={() => window.confirm("Archive this question? Existing tests keep it.") && archive.mutate(q.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <p className="mt-0.5 text-[12px] text-sub">{q.topic.subject.name} › {q.topic.name}</p>
            {q.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileHref(q.imageUrl)} alt="Question figure" className="mt-2.5 max-h-48 max-w-full rounded-[10px] border border-line" />
            )}
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
      {editing && <QuestionForm subjects={subjects.data ?? []} question={editing} onClose={() => setEditing(null)} />}
      {dialog === "import" && <QuestionImport subjects={subjects.data ?? []} onClose={() => setDialog(null)} />}
      {dialog === "curriculum" && <CurriculumDialog isAdmin={isAdmin} onClose={() => setDialog(null)} />}
    </div>
  );
}

const MAX_IMAGE_MB = 3;

/** Add a question, or edit an existing one (pass `question`). */
function QuestionForm({ subjects, question, onClose }: { subjects: Subject[]; question?: Question; onClose: () => void }) {
  const qc = useQueryClient();
  const editing = !!question;
  const [subjectId, setSubjectId] = useState(question?.topic.subject.id ?? "");
  const [type, setType] = useState<QuestionType>(question?.type ?? "SINGLE");
  const [options, setOptions] = useState(
    question
      ? question.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))
      : [
          { text: "", isCorrect: true },
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
        ],
  );
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [localError, setLocalError] = useState("");
  // One blob URL per chosen file, released when it changes or the dialog closes.
  const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const save = useMutation({
    mutationFn: async (body: unknown) => {
      const saved = question
        ? await api<Question>(`/questions/${question.id}`, { method: "PATCH", body })
        : await api<Question>("/questions", { method: "POST", body });
      // The picture is a separate upload: a failed picture must not lose the typed question.
      if (image) {
        const fd = new FormData();
        fd.append("file", image);
        await apiForm(`/questions/${saved.id}/image`, fd);
      } else if (removeImage && question?.imageUrl) {
        await api(`/questions/${saved.id}/image`, { method: "DELETE" });
      }
      return saved;
    },
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

  const onPickImage = (file: File | undefined) => {
    setLocalError("");
    if (!file) return setImage(null);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setLocalError("Use a PNG, JPG or WebP picture.");
      return setImage(null);
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setLocalError(`The picture is larger than ${MAX_IMAGE_MB} MB.`);
      return setImage(null);
    }
    setImage(file);
    setRemoveImage(false);
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
  const shownImage = previewUrl ?? (!removeImage && question?.imageUrl ? fileHref(question.imageUrl) : null);

  return (
    <Modal title={editing ? "Edit question" : "Add question"} onClose={onClose}>
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
              <select id={id} name="topicId" required defaultValue={question?.topic.id ?? ""} key={subjectId} className={inputCls}>
                <option value="" disabled>Select</option>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </Field>
        </div>
        <Field label="Question *">
          {(id) => <textarea id={id} name="text" required rows={3} maxLength={4000} defaultValue={question?.text} className={inputCls + " h-auto py-2"} />}
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-sub">Picture / diagram (optional)</span>
          {shownImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownImage} alt="Question figure" className="max-h-44 self-start rounded-[10px] border border-line" />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className={btnGhost + " cursor-pointer !h-9"}>
              <ImagePlus size={15} /> {shownImage ? "Replace picture" : "Add a picture"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onPickImage(e.target.files?.[0])} />
            </label>
            {shownImage && (
              <button type="button" className={btnGhost + " !h-9 text-danger"} onClick={() => { setImage(null); setRemoveImage(true); }}>
                Remove
              </button>
            )}
            <span className="text-[11.5px] text-sub">PNG, JPG or WebP, up to {MAX_IMAGE_MB} MB</span>
          </div>
        </div>

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
              <select id={id} name="difficulty" defaultValue={question?.difficulty ?? "MEDIUM"} className={inputCls}>
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
        {editing && (
          <p className="text-[11.5px] text-sub">
            If students have already answered this question you can fix the wording, but not which option is correct.
          </p>
        )}

        <Field label="Explanation (shown after the test)">
          {(id) => <textarea id={id} name="explanation" rows={2} maxLength={4000} defaultValue={question?.explanation ?? ""} className={inputCls + " h-auto py-2"} />}
        </Field>
        <ErrorNote error={localError ? new Error(localError) : save.error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={save.isPending}>
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Add question"}
          </button>
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
            <div className="flex flex-col gap-2 sm:flex-row">
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
