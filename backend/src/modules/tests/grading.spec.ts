import { describe, expect, it } from 'vitest';
import { QuestionType } from '../../generated/prisma/enums.js';
import { grade, hasWrittenAnswer, verdict, type GradeAnswer, type GradeRow } from './grading.js';

const mcq = (id: string, marks = 4): GradeRow => ({
  questionId: id,
  marks,
  question: {
    type: QuestionType.SINGLE,
    options: [
      { id: `${id}-a`, isCorrect: true },
      { id: `${id}-b`, isCorrect: false },
    ],
  },
});
const written = (id: string, marks = 10): GradeRow => ({
  questionId: id,
  marks,
  question: { type: QuestionType.SUBJECTIVE, options: [] },
});
const ans = (questionId: string, a: Partial<GradeAnswer>): GradeAnswer => ({
  questionId,
  selectedOptionIds: [],
  textAnswer: null,
  imageKeys: [],
  awardedMarks: null,
  ...a,
});

describe('grading', () => {
  it('a written answer counts as answered with text or with a photo, not with blank text', () => {
    expect(hasWrittenAnswer(ans('w', { textAnswer: '   ' }))).toBe(false);
    expect(hasWrittenAnswer(ans('w', { textAnswer: 'x' }))).toBe(true);
    expect(hasWrittenAnswer(ans('w', { imageKeys: ['k'] }))).toBe(true);
    expect(verdict(written('w'), undefined)).toBe('skipped');
  });

  it('scores MCQ with negative marking and leaves unchecked written answers at 0', () => {
    const rows = [mcq('q1'), mcq('q2'), mcq('q3'), written('w1'), written('w2')];
    const answers = [
      ans('q1', { selectedOptionIds: ['q1-a'] }),
      ans('q2', { selectedOptionIds: ['q2-b'] }),
      ans('w1', { textAnswer: 'my answer' }),
    ];
    expect(grade(rows, answers, 1)).toEqual({ score: 3, correct: 1, incorrect: 1, unanswered: 2, written: 1 });
  });

  it('adds the marks a teacher gave', () => {
    const rows = [mcq('q1'), written('w1')];
    const answers = [ans('q1', { selectedOptionIds: ['q1-a'] }), ans('w1', { imageKeys: ['k'], awardedMarks: 7.5 })];
    expect(grade(rows, answers, 1).score).toBe(11.5);
  });
});
