"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Download, FileUp } from "lucide-react";
import { useState } from "react";
import { api, type Batch } from "@/lib/api";
import { parseCsv } from "@/lib/question-csv";
import { Badge, btnGhost, btnPrimary, ErrorNote, inputCls, Modal } from "@/components/ui";

const CHUNK = 100;
const MAX_ROWS = 2000;

/** Header spellings people actually use in their sheets → our field. */
const HEADERS: Record<string, keyof Row> = {
  name: "name", "student name": "name", "full name": "name", "student": "name",
  phone: "phone", mobile: "phone", "phone number": "phone", "mobile number": "phone", "mobile no": "phone", contact: "phone", "whatsapp": "phone",
  email: "email", "email id": "email", "e-mail": "email", "mail": "email",
  batch: "batch", "batch name": "batch",
  guardian: "guardianName", "guardian name": "guardianName", "father name": "guardianName", "father's name": "guardianName", "parent name": "guardianName",
  "guardian phone": "guardianPhone", "guardian mobile": "guardianPhone", "parent phone": "guardianPhone", "father phone": "guardianPhone", "parent mobile": "guardianPhone",
  city: "city",
  address: "address",
  "admission no": "admissionNo", "admission number": "admissionNo", "roll no": "admissionNo", "enrollment no": "admissionNo",
  password: "password",
};

interface Row {
  name: string;
  phone: string;
  email: string;
  batch: string;
  guardianName: string;
  guardianPhone: string;
  city: string;
  address: string;
  admissionNo: string;
  password: string;
}
interface Checked {
  line: number;
  row: Row;
  batchId?: string;
  problems: string[];
}
interface ImportResult {
  row: number;
  status: "created" | "skipped" | "error";
  message?: string;
  name?: string;
  phone?: string;
  temporaryPassword?: string;
}

const TEMPLATE = "Name,Phone,Email,Batch,Guardian name,Guardian phone,City\nRavi Kumar,9876543210,ravi@example.com,,Suresh Kumar,9876500000,Bilaspur\n";

/** "+91 98765-43210", "098765 43210", 9876543210 (a number cell) → "9876543210". */
function normalizePhone(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

const cellText = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? "" : String(v)).trim();

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
const csvCell = (v: string | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;

/** Rows of cells → students, checked here so the admin fixes the sheet before anything is saved. */
function check(sheet: string[][], batches: Batch[], defaultBatchId: string): { rows: Checked[]; missing: string[] } {
  const [header = [], ...body] = sheet;
  const fields = header.map((h) => HEADERS[h.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.:*]/g, "")]);
  const missing = (["name", "phone"] as const).filter((f) => !fields.includes(f));
  if (missing.length) return { rows: [], missing };
  const byName = new Map(batches.map((b) => [b.name.trim().toLowerCase(), b.id]));
  const seen = new Set<string>();

  const rows = body.slice(0, MAX_ROWS).map((cells, i) => {
    const row = { name: "", phone: "", email: "", batch: "", guardianName: "", guardianPhone: "", city: "", address: "", admissionNo: "", password: "" } as Row;
    fields.forEach((f, c) => {
      if (f) row[f] = cellText(cells[c]);
    });
    row.phone = normalizePhone(row.phone);
    if (row.guardianPhone) row.guardianPhone = normalizePhone(row.guardianPhone);
    row.email = row.email.toLowerCase();
    const problems: string[] = [];
    if (!row.name) problems.push("name missing");
    if (!/^[6-9]\d{9}$/.test(row.phone)) problems.push("phone must be a 10-digit mobile number");
    else if (seen.has(row.phone)) problems.push("same phone twice in the file");
    seen.add(row.phone);
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) problems.push("email looks wrong");
    if (row.guardianPhone && !/^[6-9]\d{9}$/.test(row.guardianPhone)) problems.push("guardian phone must be 10 digits");
    if (row.password && !/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(row.password)) problems.push("password needs 8+ characters with a letter and a number");
    let batchId: string | undefined = defaultBatchId || undefined;
    if (row.batch) {
      batchId = byName.get(row.batch.toLowerCase());
      if (!batchId) problems.push(`no batch called “${row.batch}”`);
    }
    return { line: i + 2, row, batchId, problems };
  });
  return { rows, missing: [] };
}

export function StudentImport({ batches, onClose }: { batches: Batch[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [sheet, setSheet] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState("");
  const [defaultBatchId, setDefaultBatchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  const checked = sheet ? check(sheet, batches, defaultBatchId) : null;
  const good = checked?.rows.filter((r) => r.problems.length === 0) ?? [];
  const bad = checked?.rows.filter((r) => r.problems.length > 0) ?? [];

  async function onFile(file: File | undefined) {
    setSheet(null);
    setResults(null);
    setError(null);
    if (!file) return;
    setFileName(file.name);
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        const data = await readSheet(file);
        setSheet(data.map((r) => r.map(cellText)));
      } else if (/\.csv$/i.test(file.name)) {
        setSheet(parseCsv(await file.text()));
      } else {
        setError(new Error("Choose an Excel (.xlsx) or CSV file. Old .xls files: open in Excel and “Save as” .xlsx."));
      }
    } catch {
      setError(new Error("Could not read this file. Save it again as .xlsx or .csv and retry."));
    }
  }

  async function run() {
    setBusy(true);
    setError(null);
    const all: ImportResult[] = [];
    try {
      for (let i = 0; i < good.length; i += CHUNK) {
        setProgress(`Saving ${Math.min(i + CHUNK, good.length)} of ${good.length}…`);
        const chunk = good.slice(i, i + CHUNK);
        const res = await api<{ results: ImportResult[] }>("/students/import", {
          method: "POST",
          body: {
            rows: chunk.map(({ row, batchId }) => ({
              name: row.name,
              phone: row.phone,
              ...(row.email && { email: row.email }),
              ...(row.password && { password: row.password }),
              ...(row.guardianName && { guardianName: row.guardianName }),
              ...(row.guardianPhone && { guardianPhone: row.guardianPhone }),
              ...(row.city && { city: row.city }),
              ...(row.address && { address: row.address }),
              ...(row.admissionNo && { admissionNo: row.admissionNo }),
              ...(batchId && { batchIds: [batchId] }),
            })),
          },
        });
        all.push(...res.results.map((r) => ({ ...r, row: r.row + i })));
      }
    } catch (err) {
      setError(err);
    }
    setResults(all);
    setBusy(false);
    setProgress("");
    void qc.invalidateQueries({ queryKey: ["students"] });
  }

  const created = results?.filter((r) => r.status === "created") ?? [];
  const skipped = results?.filter((r) => r.status === "skipped") ?? [];
  const failed = results?.filter((r) => r.status === "error") ?? [];

  function downloadLogins() {
    const lines = [
      "Name,Phone,Temporary password,Result",
      ...(results ?? []).map((r) =>
        [csvCell(r.name), csvCell(r.phone), csvCell(r.temporaryPassword), csvCell(r.status === "created" ? "Added" : r.message)].join(","),
      ),
    ];
    download("student-logins.csv", lines.join("\n") + "\n");
  }

  return (
    <Modal title="Import students from Excel" onClose={busy ? () => undefined : onClose}>
      <div className="flex flex-col gap-3.5">
        {!results && (
          <>
            <p className="text-[12.5px] text-sub">
              First row = column names. Needed: <b>Name</b> and <b>Phone</b>. Optional: Email, Batch (exact batch name), Guardian name, Guardian phone, City, Address, Admission no, Password.
              Without a password, each student gets a temporary one that you download at the end.
            </p>
            <button type="button" className={btnGhost + " self-start"} onClick={() => download("students-template.csv", TEMPLATE)}>
              <Download size={15} /> Template
            </button>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line p-5 text-center hover:border-primary">
              <FileUp size={22} className="text-primary" aria-hidden="true" />
              <span className="text-[13px] font-semibold">{fileName || "Choose .xlsx or .csv file"}</span>
              <input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-sub">
              Batch for rows without a Batch column/value
              <select className={inputCls} value={defaultBatchId} onChange={(e) => setDefaultBatchId(e.target.value)}>
                <option value="">No batch (assign later)</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.course?.name ? `${b.course.name} · ` : ""}{b.name}</option>)}
              </select>
            </label>
          </>
        )}

        <ErrorNote error={error} />

        {checked && checked.missing.length > 0 && (
          <p role="alert" className="rounded-lg bg-danger-tint px-3 py-2 text-[12.5px] font-semibold text-danger">
            The first row needs a {checked.missing.join(" and ")} column. Use the template if unsure.
          </p>
        )}

        {checked && checked.missing.length === 0 && !results && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="green">{good.length} ready</Badge>
              {bad.length > 0 && <Badge tone="red">{bad.length} with problems (skipped)</Badge>}
              {sheet && sheet.length - 1 > MAX_ROWS && <Badge tone="amber">Only the first {MAX_ROWS} rows</Badge>}
            </div>
            {bad.length > 0 && (
              <ul className="max-h-40 overflow-y-auto rounded-lg border border-line p-2.5 text-[12px]">
                {bad.slice(0, 100).map((r) => (
                  <li key={r.line} className="py-0.5"><b>Row {r.line}</b> {r.row.name && `(${r.row.name})`}: {r.problems.join(", ")}</li>
                ))}
              </ul>
            )}
            {good.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-lg border border-line">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-bg text-sub"><tr><th className="px-2 py-1.5">Name</th><th className="px-2 py-1.5">Phone</th><th className="px-2 py-1.5">Batch</th></tr></thead>
                  <tbody>
                    {good.slice(0, 50).map((r) => (
                      <tr key={r.line} className="border-t border-line">
                        <td className="px-2 py-1.5">{r.row.name}</td>
                        <td className="px-2 py-1.5">{r.row.phone}</td>
                        <td className="px-2 py-1.5">{batches.find((b) => b.id === r.batchId)?.name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {results && (
          <div className="flex flex-col gap-2" role="status">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="green">{created.length} added</Badge>
              {skipped.length > 0 && <Badge tone="amber">{skipped.length} already registered</Badge>}
              {failed.length > 0 && <Badge tone="red">{failed.length} not saved</Badge>}
            </div>
            {created.some((r) => r.temporaryPassword) && (
              <p className="text-[12.5px] font-semibold text-danger">
                Download the login sheet now: temporary passwords are shown only once. Students can change them after logging in.
              </p>
            )}
            {failed.length + skipped.length > 0 && (
              <ul className="max-h-40 overflow-y-auto rounded-lg border border-line p-2.5 text-[12px]">
                {[...skipped, ...failed].map((r) => (
                  <li key={r.row} className="py-0.5"><b>{r.name ?? `Row ${r.row + 2}`}</b> {r.phone}: {r.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {results ? (
            <>
              <button type="button" className={btnGhost} onClick={downloadLogins}><Download size={15} /> Login sheet</button>
              <button type="button" className={btnPrimary} onClick={onClose}>Done</button>
            </>
          ) : (
            <>
              <button type="button" className={btnGhost} onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className={btnPrimary} disabled={busy || good.length === 0} onClick={() => void run()}>
                {busy ? progress || "Saving…" : `Import ${good.length} student${good.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
