import { describe, expect, it } from 'vitest';
import type { Exam, Question } from '../types';
import { gradeFromPoints, isAnswered, parseNumber, scoreExam, scoreQuestion } from './scoring';

const base = { topic: 'T', points: 1, stem: 's', explanation: 'e', answerSource: 'official' as const };
const single: Question = { ...base, id: 's', number: 1, type: 'single-choice', options: [{ id: 'A' }, { id: 'B' }, { id: 'C' }], correctAnswer: 'B', alsoAccepted: ['C'] };
const multi: Question = { ...base, id: 'm', number: 2, type: 'multi-select', options: [{ id: 'A' }, { id: 'B' }, { id: 'C' }], correctAnswer: ['A', 'C'] };
const num: Question = { ...base, id: 'n', number: 3, type: 'numeric', correctAnswer: 0.2643, tolerance: 0.0035 };
const numRange: Question = { ...base, id: 'r', number: 4, type: 'numeric', correctAnswer: 623, tolerance: 0, acceptRange: [622, 623] };
const fields: Question = {
  ...base, id: 'f', number: 5, type: 'numeric', points: 3,
  fields: [{ id: 'a', answer: 1.973, tolerance: 0.006 }, { id: 'b', answer: 3.24, tolerance: 0.006 }, { id: 'c', answer: 3.56, tolerance: 0.006 }],
};
const match: Question = {
  ...base, id: 'x', number: 6, type: 'matching', prompts: [{ id: 'p1', text: '1' }, { id: 'p2', text: '2' }],
  choices: [{ id: 'c1', text: 'one' }, { id: 'c2', text: 'two' }], correctAnswer: { p1: 'c1', p2: 'c2' },
};
const open: Question = { ...base, id: 'o', number: 7, type: 'open', points: 2, correctAnswer: null, modelAnswer: 'm' };
const exam: Exam = {
  schemaVersion: 1, id: 'e', courseCode: 'C', courseName: 'C', academicYear: 'y', examType: 'regular', title: 't', durationMinutes: 10,
  questions: [single, multi, num, numRange, fields, match, open],
};

describe('scoreQuestion', () => {
  it('single choice incl. alsoAccepted', () => {
    expect(scoreQuestion(exam, single, 'B').status).toBe('correct');
    expect(scoreQuestion(exam, single, 'C').earned).toBe(1);
    expect(scoreQuestion(exam, single, 'A')).toMatchObject({ earned: 0, status: 'wrong' });
    expect(scoreQuestion(exam, single, undefined)).toMatchObject({ earned: 0, status: 'blank' });
  });
  it('guessing correction deducts 1/(k-1)', () => {
    const g = { ...exam, grading: { guessingCorrection: true } };
    expect(scoreQuestion(g, single, 'A').earned).toBeCloseTo(-0.5);
  });
  it('multi select partial credit', () => {
    expect(scoreQuestion(exam, multi, ['A', 'C'])).toMatchObject({ earned: 1, status: 'correct' });
    expect(scoreQuestion(exam, multi, ['A'])).toMatchObject({ earned: 0.5, status: 'partial' });
    expect(scoreQuestion(exam, multi, ['A', 'B'])).toMatchObject({ earned: 0, status: 'wrong' });
    expect(scoreQuestion({ ...exam, grading: { multiSelectScoring: 'all-or-nothing' } }, multi, ['A']).earned).toBe(0);
  });
  it('numeric tolerance, comma decimal and accept range', () => {
    expect(scoreQuestion(exam, num, { value: '0.266' }).status).toBe('correct');
    expect(scoreQuestion(exam, num, { value: '0,264' }).status).toBe('correct');
    expect(scoreQuestion(exam, num, { value: '0.27' }).status).toBe('wrong');
    expect(scoreQuestion(exam, num, { value: 'abc' }).status).toBe('wrong');
    expect(scoreQuestion(exam, numRange, { value: '622' }).status).toBe('correct');
    expect(scoreQuestion(exam, numRange, { value: '624' }).status).toBe('wrong');
  });
  it('multi-field numeric gives partial credit per field', () => {
    expect(scoreQuestion(exam, fields, { a: '1.973', b: '1.23', c: '5.57' })).toMatchObject({ earned: 1, status: 'partial' });
    expect(scoreQuestion(exam, fields, { a: '1.973', b: '3.24', c: '3.56' })).toMatchObject({ earned: 3, status: 'correct' });
  });
  it('matching partial credit', () => {
    expect(scoreQuestion(exam, match, { p1: 'c1', p2: 'c1' })).toMatchObject({ earned: 0.5, status: 'partial' });
  });
  it('open questions use the self-awarded score', () => {
    expect(scoreQuestion(exam, open, 'my text')).toMatchObject({ earned: 0, status: 'ungraded' });
    expect(scoreQuestion(exam, open, 'my text', 1.5)).toMatchObject({ earned: 1.5, status: 'partial' });
    expect(scoreQuestion(exam, open, 'my text', 5)).toMatchObject({ earned: 2, status: 'correct' });
  });
});

describe('scoreExam', () => {
  it('totals, grade and topics', () => {
    const r = scoreExam(exam, exam.questions.map((q) => q.id), { s: 'B', m: ['A'], n: { value: '0.2643' }, f: { a: '1.973' }, o: 'x' }, { o: 2 });
    // 1 + 0.5 + 1 + 0 + 1 + 0 + 2 = 5.5 of 10
    expect(r.points).toBe(5.5);
    expect(r.maxPoints).toBe(10);
    expect(r.percentage).toBe(55);
    expect(r.grade).toBe(5.5);
    expect(r.passed).toBe(true);
    expect(r.byTopic[0]).toMatchObject({ topic: 'T', earned: 5.5, max: 10 });
  });
  it('applies an exam pass rule with section minimums', () => {
    const qs: Question[] = Array.from({ length: 4 }, (_, i) => ({ ...single, id: `q${i}`, number: i + 1, section: i < 2 ? 'Math' : 'Stats' }));
    const e: Exam = { ...exam, questions: qs, grading: { passRule: { minPoints: 3, minSectionPoints: { Math: 1, Stats: 2 } } } };
    const ids = qs.map((q) => q.id);
    expect(scoreExam(e, ids, { q0: 'B', q1: 'B', q2: 'B', q3: 'A' }).passed).toBe(false); // 3 points but Stats 1
    expect(scoreExam(e, ids, { q0: 'B', q1: 'A', q2: 'B', q3: 'B' }).passed).toBe(true);
  });
  it('a retry that contains every question does not use the exam pass rule', () => {
    const qs: Question[] = Array.from({ length: 4 }, (_, i) => ({ ...single, id: `q${i}`, number: i + 1, section: i < 2 ? 'Math' : 'Stats' }));
    const e: Exam = { ...exam, questions: qs, grading: { passRule: { minSectionPoints: { Math: 2 } } } };
    const ids = qs.map((q) => q.id);
    const ans = { q0: 'B', q2: 'B', q3: 'B' }; // 3/4 = 7.5 but only 1 point in Math
    expect(scoreExam(e, ids, ans, {}, 'full').passed).toBe(false);
    const retry = scoreExam(e, ids, ans, {}, 'retry');
    expect(retry.passed).toBe(true);
    expect(retry.passCheck).toEqual({ kind: 'grade', passGrade: 5.5 });
  });
  it('section minimums compare the rounded section score (thirds add up)', () => {
    const qs: Question[] = [0, 1, 2].map((i) => ({ ...fields, id: `f${i}`, number: i + 1, points: 1, section: 'A' }));
    const e: Exam = { ...exam, questions: qs, grading: { passRule: { minSectionPoints: { A: 1 } } } };
    const r = scoreExam(e, qs.map((q) => q.id), { f0: { a: '1.973' }, f1: { a: '1.973' }, f2: { a: '1.973' } }, {}, 'full');
    expect(r.points).toBe(1);
    expect(r.passed).toBe(true);
  });
  it('grade = 10 × points / max, one decimal', () => {
    expect(gradeFromPoints(27, 40)).toBe(6.8);
    expect(gradeFromPoints(0, 40)).toBe(0);
    expect(gradeFromPoints(17, 28)).toBe(6.1);
  });
});

describe('helpers', () => {
  it('parseNumber', () => {
    expect(parseNumber(' 3.5 ')).toBe(3.5);
    expect(parseNumber('3,5')).toBe(3.5);
    expect(parseNumber('-.5')).toBe(-0.5);
    expect(parseNumber('1e3')).toBe(1000);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('3.5.1')).toBeNull();
  });
  it('isAnswered', () => {
    expect(isAnswered(fields, { a: '', b: ' ' })).toBe(false);
    expect(isAnswered(fields, { a: '1' })).toBe(true);
    expect(isAnswered(open, '   ')).toBe(false);
  });
});
