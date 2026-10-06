/** Pure CSV -> questions logic for the bulk importer (no React, so it is unit-testable). */
import type { Subject } from "./api";

export const TEMPLATE = [
  "subject,topic,question,option_a,option_b,option_c,option_d,correct,difficulty,explanation",
  'Physics,Kinematics,"A car goes from rest to 20 m/s in 5 s. Its acceleration is?",2 m/s²,4 m/s²,5 m/s²,10 m/s²,B,easy,a = Δv / t = 20 / 5',
  'Chemistry,Atomic Structure,Which of these are noble gases?,Helium,Oxygen,Neon,Nitrogen,"A,C",medium,Helium and neon are in group 18',
].join("\n");

const LETTERS = "abcdefgh";
export const MAX_ROWS = 2000;

/** Minimal CSV reader (RFC 4180): quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export interface ParsedQuestion {
  line: number;
  subject: string;
  topic: string;
  text: string;
  options: { text: string; isCorrect: boolean }[];
  type: "SINGLE" | "MULTIPLE";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  explanation?: string;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: { line: number; message: string }[];
}

/** Turns CSV rows into questions, checking each one so the teacher fixes the sheet once, not after a failed import. */
export function parseQuestions(rows: string[][], subjects: Subject[]): ParseResult {
  const result: ParseResult = { questions: [], errors: [] };
  if (rows.length === 0) return { ...result, errors: [{ line: 1, message: "The file is empty." }] };

  const header = rows[0]!.map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  const col = (name: string) => header.indexOf(name);
  const need = ["subject", "topic", "question", "correct"];
  const missing = need.filter((n) => col(n) < 0);
  const optionCols = LETTERS.split("").map((l) => col(`option_${l}`)).filter((i) => i >= 0);
  if (missing.length || optionCols.length < 2) {
    return {
      ...result,
      errors: [{ line: 1, message: `The first row must have the columns: subject, topic, question, option_a, option_b, … , correct. Missing: ${[...missing, ...(optionCols.length < 2 ? ["option_a, option_b"] : [])].join(", ")}.` }],
    };
  }
  if (rows.length - 1 > MAX_ROWS) {
    return { ...result, errors: [{ line: 1, message: `Too many questions in one file (${rows.length - 1}). Split it into files of up to ${MAX_ROWS}.` }] };
  }

  const subjectByName = new Map(subjects.map((s) => [s.name.trim().toLowerCase(), s]));
  const get = (r: string[], name: string) => (r[col(name)] ?? "").trim();

  rows.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const fail = (message: string) => result.errors.push({ line, message });
    const subjectName = get(r, "subject");
    const topic = get(r, "topic");
    const text = get(r, "question");
    if (!subjectName || !topic || !text) return fail("subject, topic and question are all required.");
    if (!subjectByName.has(subjectName.toLowerCase())) {
      return fail(`Subject “${subjectName}” does not exist. Add it under Subjects & topics first.`);
    }

    // Keep the letter of every option so "correct = C" still points at the right one when a middle option is blank.
    const options = optionCols
      .map((c, i) => ({ letter: LETTERS[i]!, text: (r[c] ?? "").trim() }))
      .filter((o) => o.text !== "");
    if (options.length < 2) return fail("A question needs at least two options.");

    const letters = get(r, "correct").toLowerCase().split(/[\s,;/&]+/).filter(Boolean);
    if (letters.length === 0) return fail("The correct column is empty (use A, B, C … or A,C for several).");
    const known = new Set(options.map((o) => o.letter));
    const unknown = letters.filter((l) => !known.has(l));
    if (unknown.length) return fail(`Correct answer “${unknown.join(",").toUpperCase()}” does not match any filled option.`);
    const right = new Set(letters);

    const diff = get(r, "difficulty").toUpperCase();
    if (diff && !["EASY", "MEDIUM", "HARD"].includes(diff)) return fail(`Difficulty “${get(r, "difficulty")}” must be easy, medium or hard (or blank).`);

    result.questions.push({
      line,
      subject: subjectByName.get(subjectName.toLowerCase())!.name,
      topic,
      text,
      options: options.map((o) => ({ text: o.text, isCorrect: right.has(o.letter) })),
      type: right.size > 1 ? "MULTIPLE" : "SINGLE",
      difficulty: (diff || "MEDIUM") as ParsedQuestion["difficulty"],
      explanation: get(r, "explanation") || undefined,
    });
  });
  return result;
}

