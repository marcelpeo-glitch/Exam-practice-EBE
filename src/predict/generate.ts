// Assemble a predicted exam: plan from the stored blueprint, one generated question per slot, every key computed in
// code by its template, nothing copied from the past exams.
import type { Exam, Question } from '../types';
import type { Blueprint } from './blueprint';
import { PREDICTED_FORMAT } from './courses';
import { planExam, type Slot } from './plan';
import { makeRng, subSeed } from './rng';
import { COPY_THRESHOLD, maxOverlap, overlap } from './similarity';
import type { GenType, Generated, Template } from './types';

const templateModules = import.meta.glob(['./templates/*.ts', '!./templates/*.test.ts', '!./templates/_*.ts'], { eager: true }) as Record<
  string,
  { TEMPLATES?: Template[] }
>;
export const ALL_TEMPLATES: Template[] = Object.values(templateModules).flatMap((m) => m.TEMPLATES ?? []);

export const supports = (templates: Template[]) => (topic: string, type: GenType) => templates.some((t) => t.topic === topic && t.types.includes(type));

/** Basic sanity checks on a generated question (the template tests check much more). */
export function checkGenerated(g: Generated, type: GenType, optionCount: number): string | null {
  if (g.type !== type) return `type ${g.type} instead of ${type}`;
  if (!g.stem?.trim() || !g.explanation?.trim()) return 'empty stem or solution';
  if (type === 'single-choice' || type === 'multi-select') {
    const opts = g.options ?? [];
    if (opts.length !== optionCount) return `${opts.length} options instead of ${optionCount}`;
    if (new Set(opts.map((o) => (o.text ?? '').replace(/\s+/g, ''))).size !== opts.length) return 'duplicate options';
    const ids = opts.map((o) => o.id);
    if (type === 'single-choice' && !ids.includes(g.correctAnswer as string)) return 'key is not an option';
    if (type === 'multi-select') {
      const key = g.correctAnswer as string[];
      if (!Array.isArray(key) || !key.length || key.length >= opts.length || key.some((k) => !ids.includes(k))) return 'bad multi-select key';
    }
  }
  if (type === 'numeric') {
    const ok = g.fields?.length ? g.fields.every((f) => Number.isFinite(f.answer)) : Number.isFinite(g.correctAnswer as number);
    if (!ok) return 'non-numeric key';
  }
  if (type === 'matching') {
    const key = (g.correctAnswer ?? {}) as Record<string, string>;
    const ids = (g.choices ?? []).map((c) => c.id);
    if (!g.prompts?.length || g.prompts.some((p) => !ids.includes(key[p.id]))) return 'bad matching key';
  }
  return null;
}

export interface GenerateOptions {
  blueprint: Blueprint;
  seed: number;
  /** Stems of the past exams: a generated stem may not copy one of them. */
  pastStems: string[];
  /** Formula sheets and tables to offer (those of the newest past exam). */
  resources?: Exam['resources'];
  templates?: Template[];
  generatedAt?: string;
}

/** Generate one question for a slot, trying other draws and other templates until one passes every check. */
function generateSlot(slot: Slot, index: number, o: Required<Pick<GenerateOptions, 'seed' | 'pastStems'>>, templates: Template[], optionCount: number, used: Map<string, number>, stems: string[]) {
  const pickOrder = (type: GenType) => {
    const rng = makeRng(subSeed(o.seed, `pick-${index}-${type}`));
    return templates
      .filter((t) => t.topic === slot.topic && t.types.includes(type))
      .map((t) => {
        // Prefer the planned difficulty, and templates not used yet in this exam.
        const fit = t.difficulty === slot.difficulty ? 3 : Math.abs(t.difficulty - slot.difficulty) === 1 ? 1.5 : 0.7;
        const fresh = used.has(t.id) ? 0.15 / (used.get(t.id)! + 1) : 1;
        return { t, key: -Math.log(1 - rng.next()) / (fit * fresh) }; // weighted random order
      })
      .sort((a, b) => a.key - b.key)
      .map((x) => x.t);
  };
  const types: GenType[] = slot.type === 'single-choice' ? ['single-choice'] : [slot.type, 'single-choice'];
  for (const type of types) {
    for (const t of pickOrder(type)) {
      for (let attempt = 0; attempt < 6; attempt++) {
        let g: Generated;
        try {
          g = t.generate({ rng: makeRng(subSeed(o.seed, `${index}-${t.id}-${attempt}`)), type, optionCount });
        } catch {
          continue;
        }
        if (checkGenerated(g, type, optionCount)) continue;
        if (maxOverlap(g.stem, o.pastStems) >= COPY_THRESHOLD) continue;
        if (stems.some((s) => overlap(g.stem, s) > 0.8)) continue; // two near-identical questions in one exam
        used.set(t.id, (used.get(t.id) ?? 0) + 1);
        return { g, t };
      }
    }
  }
  throw new Error(`No template could generate a question for "${slot.topic}" (${slot.type})`);
}

export function generatePredictedExam(o: GenerateOptions): Exam {
  const bp = o.blueprint;
  const templates = o.templates ?? ALL_TEMPLATES;
  const rng = makeRng(o.seed);
  const plan = planExam(bp, PREDICTED_FORMAT.questions, rng, supports(templates));
  const used = new Map<string, number>();
  const stems: string[] = [];
  const questions: Question[] = plan.slots.map((slot, i) => {
    const { g, t } = generateSlot(slot, i, { seed: o.seed, pastStems: o.pastStems }, templates, bp.sections[slot.section].optionCount, used, stems);
    stems.push(g.stem);
    return {
      ...g,
      id: `p${i + 1}`,
      number: i + 1,
      section: slot.section,
      topic: slot.topic,
      points: bp.sections[slot.section].pointsPerQuestion,
      answerSource: 'generated',
      explanationSource: 'generated',
      templateId: t.id,
    };
  });
  const split = Object.fromEntries(bp.sectionOrder.map((s) => [s, questions.filter((q) => q.section === s).length]));
  return {
    schemaVersion: 1,
    id: `predicted-${o.seed.toString(36)}`,
    courseCode: bp.course.code,
    courseName: bp.course.name,
    academicYear: 'Prediction',
    examType: 'regular',
    title: 'Predicted exam',
    date: o.generatedAt,
    durationMinutes: PREDICTED_FORMAT.durationMinutes,
    durationSource: 'stated',
    grading: { method: 'linear', passGrade: 5.5, multiSelectScoring: 'partial', guessingCorrection: false },
    resources: o.resources,
    questions,
    prediction: {
      seed: o.seed,
      generatedAt: o.generatedAt ?? new Date().toISOString(),
      basedOn: bp.exams.map((e) => e.id),
      basedOnYears: bp.exams.map((e) => e.academicYear),
      split,
      ratio: plan.ratio,
      topics: plan.topics.filter((a) => a.count > 0 || a.mandatory).map((a) => ({ ...a, expected: Math.round(a.expected * 100) / 100 })),
    },
  };
}
