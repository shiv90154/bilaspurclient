import { QuestionType } from '../../generated/prisma/enums.js';

export interface GradeRow {
  questionId: string;
  marks: unknown; // Prisma Decimal
  question: { type: QuestionType; options: { id: string; isCorrect: boolean }[] };
}

export interface GradeAnswer {
  questionId: string;
  selectedOptionIds: string[];
  textAnswer: string | null;
  imageKeys: string[];
  awardedMarks: unknown; // Prisma Decimal | null
}

export type Verdict = 'correct' | 'incorrect' | 'skipped' | 'written';

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

export const isWritten = (row: GradeRow) => row.question.type === QuestionType.SUBJECTIVE;

export function hasWrittenAnswer(a: GradeAnswer | undefined): boolean {
  return !!a && ((a.textAnswer?.trim().length ?? 0) > 0 || a.imageKeys.length > 0);
}

/**
 * One question, one verdict. Shared by submit, teacher checking and the per-subject breakdown so
 * they can never disagree. A written answer is neither right nor wrong: the teacher gives marks.
 */
export function verdict(row: GradeRow, a: GradeAnswer | undefined): Verdict {
  if (isWritten(row)) return hasWrittenAnswer(a) ? 'written' : 'skipped';
  const picked = a?.selectedOptionIds ?? [];
  if (picked.length === 0) return 'skipped';
  const right = row.question.options.filter((o) => o.isCorrect).map((o) => o.id);
  return sameSet(picked, right) ? 'correct' : 'incorrect';
}

/** Marks one question earns (negative for a wrong MCQ). Written answers count once checked. */
export function marksFor(v: Verdict, row: GradeRow, a: GradeAnswer | undefined, negative: number): number {
  if (v === 'correct') return Number(row.marks);
  if (v === 'incorrect') return -negative;
  if (v === 'written') return Number(a?.awardedMarks ?? 0);
  return 0;
}

export function grade(rows: GradeRow[], answers: GradeAnswer[], negative: number) {
  const byQ = new Map(answers.map((a) => [a.questionId, a]));
  let score = 0;
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  let written = 0;
  for (const r of rows) {
    const a = byQ.get(r.questionId);
    const v = verdict(r, a);
    score += marksFor(v, r, a, negative);
    if (v === 'correct') correct++;
    else if (v === 'incorrect') incorrect++;
    else if (v === 'written') written++;
    else unanswered++;
  }
  return { score, correct, incorrect, unanswered, written };
}
