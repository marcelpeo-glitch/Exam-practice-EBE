import { describe, expect, it } from 'vitest';
import type { Exam, Question } from '../types';
import { validateExam } from './validate';

const match: Question = {
  id: 'x', number: 1, type: 'matching', topic: 'T', points: 1, stem: 's', explanation: 'e', answerSource: 'official', section: 'Math',
  prompts: [{ id: 'p1', text: 'one', choiceIds: ['a', 'b'] }],
  choices: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }],
  correctAnswer: { p1: 'a' },
};
const exam: Exam = {
  schemaVersion: 1, id: 'e', courseCode: 'C', courseName: 'C', academicYear: 'y', examType: 'regular', title: 't', durationMinutes: 10, questions: [match],
};

describe('validateExam', () => {
  it('accepts a consistent exam', () => {
    expect(validateExam(exam)).toEqual([]);
  });
  it('flags a matching answer that its own drop-down does not offer', () => {
    const bad = { ...exam, questions: [{ ...match, correctAnswer: { p1: 'c' } }] };
    expect(validateExam(bad).join(' ')).toContain('not in its choiceIds');
  });
  it('flags pass-rule sections that no question has', () => {
    const bad: Exam = { ...exam, grading: { passRule: { minSectionPoints: { Mathematics: 1 } } } };
    expect(validateExam(bad).join(' ')).toContain('no question has section "Mathematics"');
  });
});
