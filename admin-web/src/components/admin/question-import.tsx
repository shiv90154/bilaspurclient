"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Download, FileUp } from "lucide-react";
import { useState } from "react";
import { api, type Subject } from "@/lib/api";
import { parseCsv, parseQuestions, TEMPLATE, type ParseResult } from "@/lib/question-csv";
import { Badge, btnGhost, btnPrimary, ErrorNote, Modal } from "@/components/ui";

const CHUNK = 100;

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "questions-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function QuestionImport({ subjects, onClose }: { subjects: Subject[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<number | null>(null);

  const onFile = async (file: File | undefined) => {
    setParsed(null);
    setDone(null);
    setError(null);
    if (!file) return;
    setFileName(file.name);
    setParsed(parseQuestions(parseCsv(await file.text()), subjects));
  };

  const run = async () => {
    if (!parsed || parsed.questions.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      // 1. Topics that do not exist yet are created under their subject.
      const topicId = new Map<string, string>();
      const known = new Map<string, string>();
      for (const s of subjects) for (const t of s.topics) known.set(`${s.name.toLowerCase()}|${t.name.trim().toLowerCase()}`, t.id);
      for (const q of parsed.questions) {
        const key = `${q.subject.toLowerCase()}|${q.topic.toLowerCase()}`;
        if (topicId.has(key)) continue;
        const existing = known.get(key);
        if (existing) { topicId.set(key, existing); continue; }
        setProgress(`Creating topic “${q.topic}”…`);
        const subject = subjects.find((s) => s.name === q.subject)!;
        const t = await api<{ id: string }>("/topics", { method: "POST", body: { subjectId: subject.id, name: q.topic } });
        topicId.set(key, t.id);
      }
      // 2. Questions go in batches; each batch is all-or-nothing on the server.
      let created = 0;
      for (let i = 0; i < parsed.questions.length; i += CHUNK) {
        setProgress(`Importing ${Math.min(i + CHUNK, parsed.questions.length)} of ${parsed.questions.length}…`);
        const chunk = parsed.questions.slice(i, i + CHUNK).map((q) => ({
          topicId: topicId.get(`${q.subject.toLowerCase()}|${q.topic.toLowerCase()}`)!,
          text: q.text,
          type: q.type,
          difficulty: q.difficulty,
          explanation: q.explanation,
          options: q.options,
        }));
        await api("/questions/bulk", { method: "POST", body: { questions: chunk } });
        created += chunk.length;
      }
      setDone(created);
      void qc.invalidateQueries({ queryKey: ["questions"] });
      void qc.invalidateQueries({ queryKey: ["subjects"] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const ok = parsed?.questions.length ?? 0;
  const bad = parsed?.errors.length ?? 0;

  return (
    <Modal title="Import questions from a spreadsheet" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-sub">
          Fill the template in Excel or Google Sheets, save it as <b>CSV</b>, and upload it here. One row per question; the
          <b> correct</b> column holds the letter (B) or letters (A,C) of the right option(s).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnGhost} onClick={downloadTemplate}><Download size={15} /> Download template</button>
          <label className={btnGhost + " cursor-pointer"}>
            <FileUp size={15} /> {fileName || "Choose CSV file"}
            <input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
        </div>

        {parsed && (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <Badge tone="green">{ok} ready to import</Badge>
              {bad > 0 && <Badge tone="red">{bad} need fixing</Badge>}
            </div>
            {bad > 0 && (
              <ul className="max-h-40 overflow-y-auto rounded-[10px] bg-danger-tint p-3 text-[12.5px] text-danger">
                {parsed.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>Row {e.line}: {e.message}</li>
                ))}
                {bad > 50 && <li>…and {bad - 50} more.</li>}
              </ul>
            )}
            {ok > 0 && (
              <ul className="max-h-36 overflow-y-auto rounded-[10px] border border-line p-3 text-[12.5px]">
                {parsed.questions.slice(0, 5).map((q) => (
                  <li key={q.line} className="truncate">
                    <span className="text-sub">{q.subject} › {q.topic}:</span> {q.text}
                  </li>
                ))}
                {ok > 5 && <li className="text-sub">…and {ok - 5} more.</li>}
              </ul>
            )}
            {ok > 0 && bad > 0 && <p className="text-[12px] text-sub">Rows with problems are skipped. You can fix them in the file and import again.</p>}
          </div>
        )}

        <ErrorNote error={error} />
        {done !== null && (
          <p role="status" className="rounded-[10px] bg-success-tint px-3 py-2 text-[13px] font-semibold text-success">
            Imported {done} questions.
          </p>
        )}
        {progress && <p className="text-[12.5px] text-sub">{progress}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>{done !== null ? "Close" : "Cancel"}</button>
          {done === null && (
            <button className={btnPrimary} disabled={busy || ok === 0} onClick={() => void run()}>
              {busy ? "Importing…" : `Import ${ok || ""} questions`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
