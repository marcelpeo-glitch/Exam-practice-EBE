import type { AnswerValue, Answers, Exam, NumericField, Question, ScoreSnapshot } from '../types';

export type Status = 'correct' | 'partial' | 'wrong' | 'blank' | 'ungraded';

export interface QuestionScore {
  questionId: string;
  earned: number;
  max: number;
  status: Status;
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

/** Numeric fields of a numeric question (single-field questions are normalised to one field with id "value"). */
export function numericFields(q: Question): NumericField[] {
  if (q.fields?.length) return q.fields;
  return [
    {
      id: 'value',
      answer: Number(q.correctAnswer),
      tolerance: q.tolerance,
      acceptRange: q.acceptRange,
      prefix: q.prefix,
      suffix: q.suffix,
    },
  ];
}

/** Parse a typed number. Accepts a comma as decimal separator too (TestVision asks for a dot). */
export function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const s = raw.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function defaultTolerance(answer: number): number {
  return Math.abs(answer) * 0.005 || 1e-9;
}

export function numericFieldCorrect(f: NumericField, raw: string | undefined): boolean {
  const x = parseNumber(raw);
  if (x === null) return false;
  const tol = f.tolerance ?? defaultTolerance(f.answer);
  if (Math.abs(x - f.answer) <= tol + 1e-12) return true;
  if (f.acceptRange && x >= f.acceptRange[0] - 1e-12 && x <= f.acceptRange[1] + 1e-12) return true;
  return false;
}

export function isAnswered(q: Question, a: AnswerValue | undefined): boolean {
  if (a === undefined || a === null) return false;
  switch (q.type) {
    case 'single-choice':
      return typeof a === 'string' && a !== '';
    case 'open':
      return typeof a === 'string' && a.trim() !== '';
    case 'multi-select':
      return Array.isArray(a) && a.length > 0;
    case 'numeric':
    case 'matching':
      return typeof a === 'object' && !Array.isArray(a) && Object.values(a).some((v) => v !== undefined && String(v).trim() !== '');
  }
}

/** Score one question. Open questions use the self-awarded score (undefined = not yet marked). */
export function scoreQuestion(exam: Exam, q: Question, a: AnswerValue | undefined, selfScore?: number): QuestionScore {
  const max = q.points;
  const res = (earned: number, status: Status): QuestionScore => ({ questionId: q.id, earned: round(earned, 4), max, status });
  const answered = isAnswered(q, a);

  if (q.type === 'open') {
    if (selfScore !== undefined) {
      const s = Math.max(0, Math.min(max, selfScore));
      return res(s, s >= max ? 'correct' : s > 0 ? 'partial' : answered ? 'wrong' : 'blank');
    }
    return res(0, answered ? 'ungraded' : 'blank');
  }
  if (!answered) return res(0, 'blank');

  switch (q.type) {
    case 'single-choice': {
      const ok = a === q.correctAnswer || (q.alsoAccepted ?? []).includes(a as string);
      if (ok) return res(max, 'correct');
      if (exam.grading?.guessingCorrection && q.options && q.options.length > 1) return res(-max / (q.options.length - 1), 'wrong');
      return res(0, 'wrong');
    }
    case 'multi-select': {
      const correct = new Set((q.correctAnswer as string[]) ?? []);
      const chosen = new Set(a as string[]);
      const hits = [...chosen].filter((c) => correct.has(c)).length;
      const misses = chosen.size - hits;
      const exact = hits === correct.size && misses === 0;
      if (exact) return res(max, 'correct');
      if (exam.grading?.multiSelectScoring === 'all-or-nothing') return res(0, 'wrong');
      const frac = Math.max(0, (hits - misses) / Math.max(1, correct.size));
      return res(max * frac, frac > 0 ? 'partial' : 'wrong');
    }
    case 'numeric': {
      const fields = numericFields(q);
      const vals = a as Record<string, string>;
      const ok = fields.filter((f) => numericFieldCorrect(f, vals[f.id])).length;
      if (ok === fields.length) return res(max, 'correct');
      return res((max * ok) / fields.length, ok > 0 ? 'partial' : 'wrong');
    }
    case 'matching': {
      const key = (q.correctAnswer as Record<string, string>) ?? {};
      const vals = a as Record<string, string>;
      const prompts = q.prompts ?? [];
      const ok = prompts.filter((p) => vals[p.id] !== undefined && vals[p.id] === key[p.id]).length;
      if (ok === prompts.length) return res(max, 'correct');
      return res((max * ok) / Math.max(1, prompts.length), ok > 0 ? 'partial' : 'wrong');
    }
  }
  return res(0, 'wrong');
}

export interface ExamResult {
  perQuestion: QuestionScore[];
  points: number;
  maxPoints: number;
  percentage: number;
  grade: number;
  passed: boolean;
  passReason: string;
  ungradedOpen: number;
  bySection: { section: string; earned: number; max: number }[];
  byTopic: { topic: string; earned: number; max: number; count: number }[];
}

export function questionsById(exam: Exam): Map<string, Question> {
  return new Map(exam.questions.map((q) => [q.id, q]));
}

export function gradeFromPoints(points: number, maxPoints: number): number {
  if (maxPoints <= 0) return 0;
  return Math.round((10 * points) / maxPoints * 10) / 10;
}

export function scoreExam(exam: Exam, questionIds: string[], answers: Answers, selfScores: Record<string, number> = {}): ExamResult {
  const byId = questionsById(exam);
  const qs = questionIds.map((id) => byId.get(id)).filter((q): q is Question => !!q);
  const perQuestion = qs.map((q) => scoreQuestion(exam, q, answers[q.id], selfScores[q.id]));
  const maxPoints = round(qs.reduce((s, q) => s + q.points, 0), 4);
  const points = round(Math.max(0, perQuestion.reduce((s, r) => s + r.earned, 0)), 2);
  const percentage = maxPoints > 0 ? round((100 * points) / maxPoints, 1) : 0;
  const grade = gradeFromPoints(points, maxPoints);

  const sectionMap = new Map<string, { earned: number; max: number }>();
  const topicMap = new Map<string, { earned: number; max: number; count: number }>();
  qs.forEach((q, i) => {
    const r = perQuestion[i];
    const sec = q.section ?? 'Questions';
    const s = sectionMap.get(sec) ?? { earned: 0, max: 0 };
    s.earned += r.earned;
    s.max += r.max;
    sectionMap.set(sec, s);
    const t = topicMap.get(q.topic) ?? { earned: 0, max: 0, count: 0 };
    t.earned += r.earned;
    t.max += r.max;
    t.count += 1;
    topicMap.set(q.topic, t);
  });
  const bySection = [...sectionMap].map(([section, v]) => ({ section, earned: round(v.earned), max: round(v.max) }));
  const byTopic = [...topicMap].map(([topic, v]) => ({ topic, earned: round(v.earned), max: round(v.max), count: v.count }));

  const g = exam.grading ?? {};
  const passGrade = g.passGrade ?? 5.5;
  let passed: boolean;
  let passReason: string;
  const isFull = questionIds.length === exam.questions.length;
  if (g.passRule && isFull) {
    const rule = g.passRule;
    const fails: string[] = [];
    if (rule.minPoints !== undefined && points < rule.minPoints) fails.push(`fewer than ${rule.minPoints} points`);
    if (rule.minPercentage !== undefined && percentage < rule.minPercentage) fails.push(`below ${rule.minPercentage}%`);
    for (const [sec, min] of Object.entries(rule.minSectionPoints ?? {})) {
      const s = sectionMap.get(sec);
      if (!s || s.earned < min) fails.push(`fewer than ${min} points in ${sec}`);
    }
    passed = fails.length === 0;
    passReason = passed ? 'Meets the exam’s own pass rule.' : `Fails the exam’s own pass rule: ${fails.join('; ')}.`;
  } else {
    passed = grade >= passGrade;
    passReason = `Pass if grade ≥ ${passGrade}.`;
  }
  const ungradedOpen = perQuestion.filter((r) => r.status === 'ungraded').length;
  return { perQuestion, points, maxPoints, percentage, grade, passed, passReason, ungradedOpen, bySection, byTopic };
}

export function snapshot(r: ExamResult): ScoreSnapshot {
  return { points: r.points, maxPoints: r.maxPoints, percentage: r.percentage, grade: r.grade, passed: r.passed, ungradedOpen: r.ungradedOpen };
}

/** Human-readable version of a given answer (for the review screen). */
export function describeAnswer(q: Question, a: AnswerValue | undefined): string {
  if (!isAnswered(q, a)) return '';
  switch (q.type) {
    case 'single-choice':
      return a as string;
    case 'multi-select':
      return [...(a as string[])].sort().join(', ');
    case 'open':
      return a as string;
    case 'numeric': {
      const vals = a as Record<string, string>;
      return numericFields(q)
        .map((f) => `${f.label ? f.label + ' ' : ''}${vals[f.id]?.trim() || '—'}${f.suffix ? ' ' + f.suffix : ''}`)
        .join('; ');
    }
    case 'matching': {
      const vals = a as Record<string, string>;
      return (q.prompts ?? []).map((p) => `${p.text} → ${choiceText(q, vals[p.id]) ?? '—'}`).join('\n');
    }
  }
}

export function choiceText(q: Question, id: string | undefined): string | undefined {
  if (!id) return undefined;
  return q.choices?.find((c) => c.id === id)?.text ?? id;
}
