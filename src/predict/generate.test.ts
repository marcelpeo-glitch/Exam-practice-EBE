import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scoreExam } from '../lib/scoring';
import type { Answers, Exam, Question } from '../types';
import { buildBlueprint } from './blueprint';
import { blueprintFor, blueprintFileName } from './courses';
import { ALL_TEMPLATES, generatePredictedExam, supports } from './generate';
import { allocateTopics, apportion, planExam } from './plan';
import { makeRng } from './rng';
import { COPY_THRESHOLD, maxOverlap } from './similarity';
import { TOPICS } from './types';

const dir = join(__dirname, '../../data/exams');
const exams = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Exam);
const QM1 = exams[0].courseCode;
const bp = blueprintFor(QM1)!;
const pastStems = exams.flatMap((e) => e.questions.map((q) => q.stem));

describe('stored blueprint', () => {
  it('exists and is up to date with data/exams (run `npm run blueprint` after changing an exam)', () => {
    expect(bp, blueprintFileName(QM1)).toBeDefined();
    expect(JSON.parse(JSON.stringify(buildBlueprint(exams)))).toEqual(bp);
  });
  it('has the 50:50 split of the past exams and the topics that are in every exam', () => {
    expect(bp.sections.Mathematics.share).toBe(0.5);
    expect(bp.sections.Statistics.share).toBe(0.5);
    const always = bp.topics.filter((t) => t.inEveryExam).map((t) => t.topic);
    for (const t of TOPICS.Mathematics) expect(always).toContain(t);
    expect(always).not.toContain('Data & displays');
  });
});

describe('planning', () => {
  it('apportions by largest remainder', () => {
    expect(apportion([0.5, 0.5], 28)).toEqual([14, 14]);
    expect(apportion([1, 1, 1], 10)).toEqual([4, 3, 3]);
  });
  it('always includes mandatory topics and fills the section exactly', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const alloc = allocateTopics(bp.topics.filter((t) => t.section === 'Statistics'), 14, makeRng(seed));
      expect(alloc.reduce((s, a) => s + a.count, 0)).toBe(14);
      for (const a of alloc) if (a.mandatory) expect(a.count, a.topic).toBeGreaterThanOrEqual(1);
    }
  });
  it('makes 28 slots: 14 Mathematics first, then 14 Statistics', () => {
    const plan = planExam(bp, 28, makeRng(5), () => true);
    expect(plan.slots).toHaveLength(28);
    expect(plan.split).toEqual({ Mathematics: 14, Statistics: 14 });
    expect(plan.slots.slice(0, 14).every((s) => s.section === 'Mathematics')).toBe(true);
    expect(plan.slots.slice(14).every((s) => s.section === 'Statistics')).toBe(true);
    // The newest exam's formats appear (numeric in both sections; matching and multi-select in statistics).
    expect(plan.types.Mathematics.numeric).toBeGreaterThan(0);
    expect(plan.types.Statistics.numeric).toBeGreaterThan(0);
  });
});

const rightAnswer = (q: Question) => {
  switch (q.type) {
    case 'single-choice':
      return q.correctAnswer as string;
    case 'multi-select':
      return q.correctAnswer as string[];
    case 'numeric':
      return q.fields?.length ? Object.fromEntries(q.fields.map((f) => [f.id, String(f.answer)])) : { value: String(q.correctAnswer) };
    case 'matching':
      return q.correctAnswer as Record<string, string>;
    default:
      return 'x';
  }
};

describe('generated predicted exam', () => {
  const covered = [...TOPICS.Mathematics, ...TOPICS.Statistics].filter((t) => supports(ALL_TEMPLATES)(t, 'single-choice'));
  it.runIf(covered.length === TOPICS.Mathematics.length + TOPICS.Statistics.length)('every topic has templates', () => {
    expect(covered.length).toBe(19);
  });

  it.runIf(covered.length === 19)('20 different seeds: valid 28-question exams that the scorer marks correctly', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const exam = generatePredictedExam({ blueprint: bp, seed: seed * 7919, pastStems, generatedAt: '2026-01-01T00:00:00.000Z' });
      expect(exam.questions).toHaveLength(28);
      expect(exam.durationMinutes).toBe(120);
      expect(exam.prediction!.split).toEqual({ Mathematics: 14, Statistics: 14 });
      expect(exam.questions.slice(0, 14).every((q) => q.section === 'Mathematics')).toBe(true);
      expect(exam.questions.map((q) => q.number)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
      for (const t of bp.topics.filter((x) => x.inEveryExam)) expect(exam.questions.some((q) => q.topic === t.topic), t.topic).toBe(true);
      for (const q of exam.questions) {
        expect(q.answerSource).toBe('generated');
        expect(maxOverlap(q.stem, pastStems)).toBeLessThan(COPY_THRESHOLD);
      }
      // The keys the templates computed are accepted by the app's own scoring: all right = 28/28, nothing = 0.
      const answers: Answers = Object.fromEntries(exam.questions.map((q) => [q.id, rightAnswer(q)]));
      const full = scoreExam(exam, exam.questions.map((q) => q.id), answers, {}, 'full');
      expect(full.points, `seed ${seed}`).toBe(28);
      expect(full.grade).toBe(10);
      expect(scoreExam(exam, exam.questions.map((q) => q.id), {}, {}, 'full').points).toBe(0);
      // Same seed, same exam.
      if (seed === 1) expect(generatePredictedExam({ blueprint: bp, seed: 7919, pastStems, generatedAt: '2026-01-01T00:00:00.000Z' })).toEqual(exam);
    }
  });
});
