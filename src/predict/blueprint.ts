// The blueprint: what the past exams of a course look like (topics, how often and where they appear, question
// types, points, difficulty). It is computed once by scripts/build-blueprint.ts and stored in data/blueprints/,
// so the app never recomputes it; blueprint.test.ts fails when the stored file is out of date.
import type { Exam, Question } from '../types';
import { GEN_TYPES, SECTIONS, sectionOf, type Difficulty, type GenType, type Section } from './types';

export const BLUEPRINT_VERSION = 1;

/** Weight of an exam = RECENCY_DECAY ^ (number of newer exams): the newest exam counts 1, the one before 0.5, ... */
export const RECENCY_DECAY = 0.5;

export interface BlueprintQuestion {
  exam: string;
  number: number;
  section: Section;
  topic: string;
  type: Question['type'];
  points: number;
  /** 1-based position within its section. */
  position: number;
  /** Position within the section scaled to 0 (first) … 1 (last). */
  relPosition: number;
  difficulty: Difficulty;
  /** Number of answer options (single-choice / multi-select), else 0. */
  options: number;
}

export interface BlueprintExam {
  id: string;
  academicYear: string;
  /** Year used to order the exams (first year of the academic year). */
  year: number;
  weight: number;
  questions: number;
  points: number;
  durationMinutes: number;
  bySection: Record<Section, number>;
}

export interface BlueprintTopic {
  topic: string;
  section: Section;
  /** Number of past exams containing the topic. */
  exams: number;
  /** In every past exam: always included in a predicted exam. */
  inEveryExam: boolean;
  /** Total number of past questions on the topic. */
  count: number;
  /** Mean share of its section's questions (unweighted). */
  frequency: number;
  /** Recency-weighted share of its section's questions: the weight used for the prediction. */
  weight: number;
  /** Recency-weighted mean relative position within the section (0 = first, 1 = last). */
  meanPosition: number;
  /** Recency-weighted share of each question type for this topic. */
  typeMix: Partial<Record<GenType, number>>;
  /** Mean estimated difficulty (1–3). */
  meanDifficulty: number;
}

export interface BlueprintSection {
  /** Recency-weighted share of the exam's questions. */
  share: number;
  /** Recency-weighted share of each question type in this section. */
  typeMix: Partial<Record<GenType, number>>;
  /** Most common number of options (recency-weighted) for single-choice questions. */
  optionCount: number;
  /** Points per question (all past questions are worth the same). */
  pointsPerQuestion: number;
}

export interface Blueprint {
  version: number;
  course: { code: string; name: string };
  recencyDecay: number;
  exams: BlueprintExam[];
  sectionOrder: Section[];
  sections: Record<Section, BlueprintSection>;
  topics: BlueprintTopic[];
  questions: BlueprintQuestion[];
}

const yearOf = (academicYear: string) => Number(academicYear.match(/\d{4}/)?.[0] ?? 0);

/**
 * Rough difficulty estimate from what a question demands: reading (stem length), the answer format (numeric,
 * multi-select and matching leave no option to eliminate), a figure or table to interpret, several answer boxes.
 */
export function estimateDifficulty(q: Question): Difficulty {
  let score = 0;
  const len = q.stem.length;
  if (len > 180) score += 1;
  if (len > 420) score += 1;
  if (q.type === 'numeric' || q.type === 'multi-select' || q.type === 'matching') score += 1;
  if (q.images?.length || q.table) score += 0.5;
  if ((q.fields?.length ?? 0) > 1) score += 0.5;
  return score < 1 ? 1 : score < 2 ? 2 : 3;
}

const normalise = <K extends string>(m: Partial<Record<K, number>>): Partial<Record<K, number>> => {
  const total = Object.values<number>(m as Record<K, number>).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries<number>(m as Record<K, number>).map(([k, v]) => [k, Math.round((v / total) * 1e4) / 1e4])) as Partial<
    Record<K, number>
  >;
};
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

export function buildBlueprint(exams: Exam[]): Blueprint {
  if (!exams.length) throw new Error('no exams');
  const sorted = [...exams].sort((a, b) => yearOf(b.academicYear) - yearOf(a.academicYear) || b.id.localeCompare(a.id));
  const weightOf = new Map(sorted.map((e, i) => [e.id, RECENCY_DECAY ** i]));
  const totalWeight = sorted.reduce((s, e) => s + weightOf.get(e.id)!, 0);

  const questions: BlueprintQuestion[] = [];
  for (const e of sorted) {
    for (const sec of SECTIONS) {
      const qs = e.questions.filter((q) => (q.section ?? sectionOf(q.topic)) === sec).sort((a, b) => a.number - b.number);
      qs.forEach((q, i) =>
        questions.push({
          exam: e.id,
          number: q.number,
          section: sec,
          topic: q.topic,
          type: q.type,
          points: q.points,
          position: i + 1,
          relPosition: qs.length > 1 ? r4(i / (qs.length - 1)) : 0,
          difficulty: estimateDifficulty(q),
          options: q.options?.length ?? 0,
        }),
      );
    }
  }

  const bpExams: BlueprintExam[] = sorted.map((e) => ({
    id: e.id,
    academicYear: e.academicYear,
    year: yearOf(e.academicYear),
    weight: r4(weightOf.get(e.id)!),
    questions: e.questions.length,
    points: e.questions.reduce((s, q) => s + q.points, 0),
    durationMinutes: e.durationMinutes,
    bySection: Object.fromEntries(SECTIONS.map((s) => [s, questions.filter((q) => q.exam === e.id && q.section === s).length])) as Record<Section, number>,
  }));

  const sections = {} as Record<Section, BlueprintSection>;
  for (const sec of SECTIONS) {
    let share = 0;
    const typeMix: Partial<Record<GenType, number>> = {};
    const optionVotes = new Map<number, number>();
    for (const e of bpExams) {
      const w = e.weight / totalWeight;
      const n = e.bySection[sec];
      share += (w * n) / e.questions;
      for (const q of questions.filter((x) => x.exam === e.id && x.section === sec)) {
        const ty = (GEN_TYPES as readonly string[]).includes(q.type) ? (q.type as GenType) : 'single-choice';
        typeMix[ty] = (typeMix[ty] ?? 0) + w / n;
        if (q.type === 'single-choice') optionVotes.set(q.options, (optionVotes.get(q.options) ?? 0) + w);
      }
    }
    const optionCount = [...optionVotes].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 5;
    const pts = questions.filter((q) => q.section === sec).map((q) => q.points);
    sections[sec] = { share: r4(share), typeMix: normalise(typeMix), optionCount, pointsPerQuestion: pts.length ? Math.min(...pts) : 1 };
  }

  const topicNames = [...new Set(questions.map((q) => `${q.section}|${q.topic}`))];
  const topics: BlueprintTopic[] = topicNames.map((key) => {
    const [section, topic] = key.split('|') as [Section, string];
    const qs = questions.filter((q) => q.topic === topic && q.section === section);
    const examsWith = new Set(qs.map((q) => q.exam));
    let weight = 0;
    let frequency = 0;
    for (const e of bpExams) {
      const share = qs.filter((q) => q.exam === e.id).length / e.bySection[section];
      weight += (e.weight / totalWeight) * share;
      frequency += share / bpExams.length;
    }
    let posW = 0;
    let posSum = 0;
    let diffSum = 0;
    const typeMix: Partial<Record<GenType, number>> = {};
    for (const q of qs) {
      const w = weightOf.get(q.exam)!;
      posSum += w * q.relPosition;
      posW += w;
      diffSum += q.difficulty;
      const ty = (GEN_TYPES as readonly string[]).includes(q.type) ? (q.type as GenType) : 'single-choice';
      typeMix[ty] = (typeMix[ty] ?? 0) + w;
    }
    return {
      topic,
      section,
      exams: examsWith.size,
      inEveryExam: examsWith.size === bpExams.length,
      count: qs.length,
      frequency: r4(frequency),
      weight: r4(weight),
      meanPosition: r4(posSum / posW),
      typeMix: normalise(typeMix),
      meanDifficulty: r4(diffSum / qs.length),
    };
  });
  topics.sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.meanPosition - b.meanPosition);

  return {
    version: BLUEPRINT_VERSION,
    course: { code: sorted[0].courseCode, name: sorted[0].courseName },
    recencyDecay: RECENCY_DECAY,
    exams: bpExams,
    sectionOrder: [...SECTIONS],
    sections,
    topics,
    questions,
  };
}
