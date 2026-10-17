// Building blocks shared by all templates: answer options from modelled student mistakes, numeric answers with
// tolerances, and the instruction lines the past exams use.
import type { MatchingPrompt, NumericField, Option } from '../types';
import type { Rng } from './rng';
import { round } from './stats';

const LETTERS = 'ABCDEFGH';

// ---------- number formatting for stems and options ----------

/** A number with at most dp decimals, trailing zeros removed (1.50 → "1.5"). Uses a dot, like TestVision. */
export function num(x: number, dp = 2): string {
  const r = round(x, dp);
  return String(Object.is(r, -0) ? 0 : r);
}

/** A number with exactly dp decimals (e.g. probabilities "0.2643"). */
export function fixed(x: number, dp: number): string {
  const r = round(x, dp);
  return (Object.is(r, -0) ? 0 : r).toFixed(dp);
}

/** A signed term for building expressions: sgn(3) = "+ 3", sgn(-3) = "- 3". */
export function sgn(x: number, dp = 4): string {
  return x < 0 ? `- ${num(-x, dp)}` : `+ ${num(x, dp)}`;
}

// ---------- instructions (wording as in the 2025 exam) ----------

export const INSTRUCTION = {
  numeric: (dp: number) =>
    dp === 0
      ? 'Instruction: fill in the value as a whole number.'
      : `Instruction: fill in the value. Use a maximum of ${dp} decimal place${dp > 1 ? 's' : ''}, depending on how many you need. To separate decimals, use a dot and not a comma (example: 0.51 instead of 0,51)!`,
  numericFields: (dp: number) =>
    `Instruction: fill in every box (${dp} decimal${dp > 1 ? 's' : ''}). To separate decimals, use a dot and not a comma (example: 0.51 instead of 0,51)!`,
  multi: 'Instruction: choose every correct option from the list below.',
  matching: 'Instruction: in TestVision you drag each term onto the matching box. Here, pick the matching box for each term.',
};

/** Absolute tolerance for an answer given to dp decimals: half a unit in the last place plus a little slack. */
export const tolFor = (dp: number) => (dp === 0 ? 0 : 0.6 * 10 ** -dp);

// ---------- multiple choice ----------

export interface Choice {
  /** Option text (Markdown + KaTeX). */
  text: string;
  /** For numeric options: the value, used to spot duplicates and accidental matches with the correct answer. */
  value?: number;
  /** For distractors: the mistake that produces this option (used in the worked solution). */
  why?: string;
}

export interface McqOptions {
  /** Number of options (4 or 5). */
  count: number;
  /** Generates extra plausible wrong options when the modelled mistakes are not enough (or coincide). */
  fallback?: (attempt: number) => Choice;
  /** 'ascending' sorts numeric options by value (common in the past exams); default: random order. */
  order?: 'shuffle' | 'ascending' | 'keep';
  /**
   * Two numeric values closer than this (relative) count as the same option (default 0.005, i.e. 0.5%), so an
   * option never differs from the correct one only by rounding or by reading a table instead of computing exactly.
   */
  epsilon?: number;
}

export interface Mcq {
  options: Option[];
  correctAnswer: string;
  /** The distractors that were used, with their letter and mistake. */
  distractors: { id: string; text: string; why?: string }[];
}

const normText = (s: string) => s.replace(/\s+/g, '').replace(/\\left|\\right|\\,|\\;|\\!/g, '').toLowerCase();

/**
 * Pick `count − 1` distractors (in the given order of preference), dropping any that coincide with the correct
 * answer or with each other: a "mistake" that happens to give the right number must not be marked wrong.
 */
export function buildMcq(rng: Rng, correct: Choice, distractors: Choice[], o: McqOptions): Mcq {
  const eps = o.epsilon ?? 0.005;
  const same = (a: Choice, b: Choice) => {
    if (a.value !== undefined && b.value !== undefined) return Math.abs(a.value - b.value) <= eps * Math.max(Math.abs(a.value), Math.abs(b.value)) + 1e-12;
    return normText(a.text) === normText(b.text);
  };
  const chosen: Choice[] = [];
  const consider = (d: Choice) => {
    if (chosen.length >= o.count - 1) return;
    if (d.value !== undefined && !Number.isFinite(d.value)) return;
    if (same(d, correct) || normText(d.text) === normText(correct.text)) return;
    if (chosen.some((c) => same(c, d) || normText(c.text) === normText(d.text))) return;
    chosen.push(d);
  };
  distractors.forEach(consider);
  for (let i = 0; chosen.length < o.count - 1 && o.fallback && i < 200; i++) consider(o.fallback(i));
  if (chosen.length < o.count - 1) throw new Error(`buildMcq: only ${chosen.length + 1} distinct options`);

  let all = [{ ...correct, ok: true }, ...chosen.map((c) => ({ ...c, ok: false }))];
  const order = o.order ?? 'shuffle';
  if (order === 'shuffle') all = rng.shuffle(all);
  else if (order === 'ascending') all.sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
  const options = all.map((c, i) => ({ id: LETTERS[i], text: c.text }));
  const correctAnswer = LETTERS[all.findIndex((c) => c.ok)];
  const distractorsUsed = all.map((c, i) => ({ c, id: LETTERS[i] })).filter(({ c }) => !c.ok).map(({ c, id }) => ({ id, text: c.text, why: c.why }));
  return { options, correctAnswer, distractors: distractorsUsed };
}

/**
 * Multi-select: statements that are true or false. Picks `count` statements with at least `minTrue` true and at
 * least one false one, in random order.
 */
export function buildMulti(rng: Rng, statements: { text: string; correct: boolean; why: string }[], count: number, minTrue = 1) {
  const trues = rng.shuffle(statements.filter((s) => s.correct));
  const falses = rng.shuffle(statements.filter((s) => !s.correct));
  if (trues.length < minTrue || falses.length < 1) throw new Error('buildMulti: not enough true/false statements');
  const nTrue = Math.min(trues.length, Math.max(minTrue, rng.int(minTrue, Math.min(count - 1, trues.length))));
  const picked = rng.shuffle([...trues.slice(0, nTrue), ...falses.slice(0, count - nTrue)]);
  if (picked.length < count) throw new Error('buildMulti: not enough statements');
  const options = picked.map((s, i) => ({ id: LETTERS[i], text: s.text }));
  return {
    options,
    correctAnswer: picked.map((s, i) => (s.correct ? LETTERS[i] : '')).filter(Boolean),
    reasons: picked.map((s, i) => ({ id: LETTERS[i], correct: s.correct, why: s.why })),
  };
}

/** Matching: prompts each with one correct choice, plus extra unused choices, shuffled. */
export function buildMatching(rng: Rng, pairs: { prompt: string; answer: string }[], extraChoices: string[]) {
  const texts = [...new Set([...pairs.map((p) => p.answer), ...extraChoices])];
  const choices: Option[] = rng.shuffle(texts).map((text, i) => ({ id: `c${i + 1}`, text }));
  const idOf = (t: string) => choices.find((c) => c.text === t)!.id;
  const prompts: MatchingPrompt[] = pairs.map((p, i) => ({ id: `p${i + 1}`, text: p.prompt }));
  const correctAnswer = Object.fromEntries(pairs.map((p, i) => [`p${i + 1}`, idOf(p.answer)]));
  return { prompts, choices, correctAnswer };
}

/** A numeric answer field: the answer rounded to dp decimals, with a tolerance and optional extra accepted range. */
export function numericField(id: string, label: string | undefined, answer: number, dp: number, acceptRange?: [number, number]): NumericField {
  return { id, ...(label ? { label } : {}), answer: round(answer, dp), tolerance: tolFor(dp), ...(acceptRange ? { acceptRange } : {}) };
}

/** "Common mistakes" paragraph for a worked solution, from the distractors that were used. */
export function mistakesNote(d: Mcq['distractors']): string {
  const lines = d.filter((x) => x.why).map((x) => `- **${x.id}** (${x.text}): ${x.why}`);
  return lines.length ? `\n\n**Where the other options come from**\n${lines.join('\n')}` : '';
}
