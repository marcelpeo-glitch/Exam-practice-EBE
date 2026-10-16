// Shared helpers for the templates of the topics "Elasticity", "Economic applications" and "Exponential & logistic
// growth" (no TEMPLATES export here). Contains LaTeX formatting helpers, question builders, interval options, and a
// small LaTeX → mathjs converter that the independent tests use to read functions back from the generated stems.
import { buildMcq, INSTRUCTION, mistakesNote, num, tolFor, type Choice, type Mcq } from '../build';
import { frac } from '../mathx';
import type { Rng } from '../rng';
import { round } from '../stats';
import type { Generated } from '../types';

// ---------- LaTeX formatting ----------

/** A number as LaTeX: integers as they are, simple fractions (denominator 2..8) as \frac, otherwise a decimal. */
export function numTex(x: number, dp = 4): string {
  if (Number.isInteger(x)) return String(x);
  for (const d of [2, 3, 4, 5, 6, 8]) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-9) return frac(n, d);
  }
  return num(x, dp);
}

/** A number as a decimal in LaTeX (no fractions), e.g. for options with values. */
export const decTex = (x: number, dp = 3) => num(x, dp);

/** Coefficient in front of a term: 1 → "", −1 → "-", 3 → "3", 1.5 → "\frac{3}{2}". */
export function coefTex(c: number): string {
  if (c === 1) return '';
  if (c === -1) return '-';
  return numTex(c);
}

/** v^k as LaTeX (k = 1 gives v, k = 0 gives an empty string). */
export function powTex(v: string, k: number): string {
  if (k === 0) return '';
  if (k === 1) return v;
  return `${v}^{${numTex(k)}}`;
}

/**
 * A sum of terms as LaTeX: [[3, 'x^{2}'], [-1, 'y'], [5, '']] → "3x^{2} - y + 5". A term with an empty body is a
 * constant (its coefficient is always printed). Zero coefficients are left out.
 */
export function sumTex(terms: [number, string][]): string {
  let out = '';
  terms
    .filter(([c]) => c !== 0)
    .forEach(([c, t], i) => {
      const mag = Math.abs(c);
      const body = t === '' ? numTex(mag) : (mag === 1 ? '' : numTex(mag)) + t;
      out += i === 0 ? (c < 0 ? '-' : '') + body : (c < 0 ? ' - ' : ' + ') + body;
    });
  return out || '0';
}

/** True when x has at most dp decimals (up to floating point noise). */
export const isNice = (x: number, dp: number) => Math.abs(round(x, dp) - x) < 1e-9;

/** "€1250" or "€12.50" (euro amounts in stems and options; no thousands separator). */
export const euro = (x: number, dp = 2) => `€${num(x, dp)}`;

// ---------- question builders ----------

/** A numeric question with one answer box. */
export function numericQuestion(stem: string, answer: number, dp: number, explanation: string, acceptRange?: [number, number]): Generated {
  return {
    type: 'numeric',
    stem,
    instruction: INSTRUCTION.numeric(dp),
    correctAnswer: round(answer, dp),
    tolerance: tolFor(dp),
    ...(acceptRange ? { acceptRange } : {}),
    explanation,
  };
}

/** A single-choice question from a built Mcq; the worked solution gets the "where the other options come from" note. */
export function choiceQuestion(stem: string, mcq: Mcq, explanation: string): Generated {
  return { type: 'single-choice', stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
}

/** Mistake → numeric choice, with the option text produced by `fmt`. */
export const valueChoice = (value: number, why: string | undefined, fmt: (v: number) => string): Choice => ({ text: fmt(value), value, ...(why ? { why } : {}) });

/** Fallback for numeric options: the key scaled by ±10 %, ±20 %, ... (alternating), formatted by `fmt`. */
export function scaledFallback(key: number, fmt: (v: number) => string, step = 0.15) {
  return (i: number): Choice => {
    const k = Math.floor(i / 2) + 1;
    const v = key * (1 + (i % 2 ? -1 : 1) * step * k);
    return { text: fmt(v), value: v };
  };
}

/** Fallback for integer options: key ± 1, ± 2, ... */
export function integerFallback(key: number, fmt: (v: number) => string, min = -Infinity) {
  return (i: number): Choice => {
    const k = Math.floor(i / 2) + 1;
    let v = key + (i % 2 ? -k : k);
    if (v < min) v = key + k + 3;
    return { text: fmt(v), value: v };
  };
}

// ---------- interval options ----------

const LADDERS_SMALL: number[][] = [
  [0.1, 0.25, 0.5, 1, 2, 5, 10, 20],
  [0.2, 0.4, 0.75, 1.5, 3, 6, 12],
  [0.3, 0.6, 1, 2.5, 4, 8, 16],
];

/** Ladders of "nice" boundaries for amounts (1-2-5, 1-2.5-5, 1-3-6 and 1.5-3-7.5 per decade). */
function amountLadders(): number[][] {
  const mants = [
    [1, 2, 5],
    [1, 2.5, 5],
    [1, 3, 6],
    [1.5, 3, 7.5],
  ];
  return mants.map((ms) => {
    const out: number[] = [];
    for (let e = -2; e <= 7; e++) for (const m of ms) out.push(Number((m * 10 ** e).toPrecision(6)));
    return out;
  });
}

export interface IntervalFormat {
  /** Text of the lowest interval (key below hi). */
  below: (hi: number) => string;
  /** Text of a middle interval. */
  between: (lo: number, hi: number) => string;
  /** Text of the highest interval (key above lo). */
  above: (lo: number) => string;
}

/** Interval texts "below €500", "between €500 and €1000", "above €1000". */
export const amountIntervals = (fmt: (x: number) => string): IntervalFormat => ({
  below: (hi) => `below ${fmt(hi)}`,
  between: (lo, hi) => `between ${fmt(lo)} and ${fmt(hi)}`,
  above: (lo) => `above ${fmt(lo)}`,
});

/** Interval texts "$(0,\ 0.5]$", "$(0.5,\ 1]$", "$(2,\ \infty)$" for a positive quantity. */
export const positiveIntervals: IntervalFormat = {
  below: (hi) => `$(0,\\ ${num(hi, 3)}]$`,
  between: (lo, hi) => `$(${num(lo, 3)},\\ ${num(hi, 3)}]$`,
  above: (lo) => `$(${num(lo, 3)},\\ \\infty)$`,
};

/**
 * Multiple choice with `count` consecutive intervals as options (in increasing order), taken from a ladder of nice
 * boundaries so that the key lies inside one interval, at least `margin` (relative) away from every boundary.
 * Mistakes whose value falls in another interval give that interval its explanation. Returns null when no ladder
 * keeps the key away from the boundaries (the caller then uses value options instead).
 */
export function intervalMcq(
  rng: Rng,
  key: number,
  mistakes: { value: number; why: string }[],
  count: number,
  o: { format: IntervalFormat; kind: 'small' | 'amount'; margin?: number; low?: number },
): (Mcq & { bounds: number[] }) | null {
  const margin = o.margin ?? 0.04;
  const low = o.low ?? 0;
  if (!(key > low)) return null;
  for (const ladder of rng.shuffle(o.kind === 'small' ? LADDERS_SMALL : amountLadders())) {
    const L = ladder.filter((b) => b > low);
    const i = L.findIndex((b) => key <= b);
    if (i < 0) continue;
    const starts: number[] = [];
    for (let s = Math.max(0, i - (count - 1)); s <= i && s + count - 2 < L.length; s++) starts.push(s);
    for (const s of rng.shuffle(starts)) {
      const bounds = L.slice(s, s + count - 1);
      if (bounds.length !== count - 1) continue;
      if (bounds.some((b) => Math.abs(key - b) <= margin * Math.abs(key))) continue;
      const texts = [o.format.below(bounds[0]), ...bounds.slice(1).map((b, j) => o.format.between(bounds[j], b)), o.format.above(bounds[bounds.length - 1])];
      const idx = (x: number) => {
        let j = 0;
        while (j < bounds.length && x > bounds[j]) j++;
        return j;
      };
      const k = idx(key);
      const whys: (string | undefined)[] = texts.map(() => undefined);
      for (const m of mistakes) {
        if (!Number.isFinite(m.value) || !(m.value > low)) continue;
        const j = idx(m.value);
        if (j !== k && whys[j] === undefined) whys[j] = m.why;
      }
      const choices: Choice[] = texts.map((text, j) => ({ text, value: j + 1, ...(whys[j] ? { why: whys[j] } : {}) }));
      const mcq = buildMcq(
        rng,
        choices[k],
        choices.filter((_, j) => j !== k),
        { count, order: 'ascending' },
      );
      return { ...mcq, bounds };
    }
  }
  return null;
}

// ---------- LaTeX → mathjs (used by the independent tests to read functions and options back) ----------

const KEEP = new Set(['sqrt', 'exp', 'log', 'pi', 'e']);

function convert(str: string): string {
  let out = '';
  let i = 0;
  const readGroup = (): string => {
    while (str[i] === ' ') i++;
    if (str[i] !== '{') return str[i++] ?? '';
    let depth = 0;
    const start = i;
    for (; i < str.length; i++) {
      if (str[i] === '{') depth++;
      else if (str[i] === '}' && --depth === 0) break;
    }
    const inner = str.slice(start + 1, i);
    i++;
    return convert(inner);
  };
  while (i < str.length) {
    const fracCmd = ['\\dfrac', '\\tfrac', '\\frac'].find((c) => str.startsWith(c, i));
    if (fracCmd) {
      i += fracCmd.length;
      const a = readGroup();
      const b = readGroup();
      out += ` ((${a})/(${b}))`;
      continue;
    }
    if (str.startsWith('\\sqrt', i)) {
      i += 5;
      let n = '';
      if (str[i] === '[') {
        const j = str.indexOf(']', i);
        n = convert(str.slice(i + 1, j));
        i = j + 1;
      }
      const a = readGroup();
      out += n ? ` ((${a})^(1/(${n})))` : ` sqrt(${a})`;
      continue;
    }
    if (str[i] === 'e' && str[i + 1] === '^' && !/[A-Za-z]/.test(str[i - 1] ?? '')) {
      i += 2;
      out += ` exp(${readGroup()})`;
      continue;
    }
    if (str[i] === '^') {
      i++;
      out += `^(${readGroup()})`;
      continue;
    }
    if (str[i] === '{') {
      out += `(${readGroup()})`;
      continue;
    }
    if (str[i] === '\\') throw new Error(`texToExpr: unsupported command at "${str.slice(i, i + 12)}"`);
    out += str[i++];
  }
  return out;
}

/**
 * Convert the LaTeX this group's templates write for functions and option formulas into a mathjs expression:
 * \frac/\dfrac, \sqrt and \sqrt[n], e^{..}, powers, \ln, \cdot/\times, \left/\right. Runs of letters other than
 * sqrt/exp/log are split into single-letter variables (so "xy" means x·y).
 */
export function texToExpr(tex: string): string {
  const pre = tex
    .replace(/\\left|\\right|\\displaystyle|\\big|\\Big/g, '')
    .replace(/\\[,;!:]|\\quad|\\qquad|~/g, ' ')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\ln/g, ' log')
    .replace(/\\exp/g, ' exp')
    .replace(/\\infty/g, 'Infinity');
  const out = convert(pre).replace(/Infinity/g, ' 1e300 ');
  return out
    .replace(/[A-Za-z]+/g, (w) => (KEEP.has(w) ? w : w.split('').join(' ')))
    .replace(/(^|[^A-Za-z])([A-Za-z])\s*\(/g, '$1$2*('); // a variable before "(" multiplies, it is not a function call
}

/**
 * The LaTeX right-hand side after `lhs` (e.g. "d(p)=") in a stem, up to the closing $ of that formula, without
 * trailing punctuation or a "\qquad(...)" remark. Used by the tests to read functions back from stems.
 */
export function grabTex(stem: string, lhs: string): string | null {
  const i = stem.indexOf(lhs);
  if (i < 0) return null;
  const start = i + lhs.length;
  const end = stem.indexOf('$', start);
  let s = stem.slice(start, end < 0 ? undefined : end);
  s = s.replace(/\\qquad.*$/, '').trim();
  return s.replace(/[.,]+$/, '').trim();
}

/**
 * Multiple choice with numeric options: the key plus modelled mistakes (non-finite ones dropped, and with
 * `positive` also those ≤ 0), formatted by `fmt`, by default in ascending order.
 */
export function valueMcq(
  rng: Rng,
  key: number,
  mistakes: { value: number; why: string }[],
  count: number,
  fmt: (v: number) => string,
  o: { fallback?: (i: number) => Choice; order?: 'ascending' | 'shuffle'; epsilon?: number; positive?: boolean } = {},
): Mcq {
  const ms = mistakes.filter((m) => Number.isFinite(m.value) && (!o.positive || m.value > 0));
  return buildMcq(
    rng,
    { text: fmt(key), value: key },
    ms.map((m) => ({ text: fmt(m.value), value: m.value, why: m.why })),
    { count, order: o.order ?? 'ascending', fallback: o.fallback ?? scaledFallback(key, fmt, 0.2), epsilon: o.epsilon ?? 0.01 },
  );
}

/**
 * Like valueMcq, but the key lands at a uniformly random position among the ascending options: first a rank r is
 * drawn (among the ranks that enough candidates allow), then r distractors are taken from below the key and the rest
 * from above (modelled mistakes first, then `near(dir, i)`, the i-th extra value in direction dir, or null when there
 * are no more). Without this, modelled mistakes that mostly lie on one side of the key give the answer away by its
 * place in the list (e.g. "never the smallest option").
 */
export function rankedValueMcq(
  rng: Rng,
  key: number,
  mistakes: { value: number; why: string }[],
  count: number,
  fmt: (v: number) => string,
  near: (dir: -1 | 1, i: number) => number | null,
  o: { epsilon?: number; positive?: boolean } = {},
): Mcq {
  const eps = o.epsilon ?? 0.01;
  const same = (a: number, b: number) => Math.abs(a - b) <= eps * Math.max(Math.abs(a), Math.abs(b)) + 1e-12;
  const pool = (dir: -1 | 1) => {
    const out: Choice[] = [];
    const add = (v: number, why?: string) => {
      if (!Number.isFinite(v) || (o.positive && !(v > 0)) || dir * (v - key) <= 0 || same(v, key)) return;
      const text = fmt(v);
      if (text === fmt(key) || out.some((c) => same(c.value!, v) || c.text === text)) return;
      out.push({ text, value: v, ...(why ? { why } : {}) });
    };
    mistakes.forEach((m) => add(m.value, m.why));
    for (let i = 0; i < 60; i++) {
      const v = near(dir, i);
      if (v === null) break;
      add(v);
    }
    return out;
  };
  const lo = pool(-1);
  const hi = pool(1);
  const ranks = Array.from({ length: count }, (_, r) => r).filter((r) => lo.length >= r && hi.length >= count - 1 - r);
  if (!ranks.length) throw new Error(`rankedValueMcq: only ${lo.length} + ${hi.length} distractors for ${count} options`);
  const r = rng.pick(ranks);
  return buildMcq(rng, { text: fmt(key), value: key }, [...lo.slice(0, r), ...hi.slice(0, count - 1 - r)], { count, order: 'ascending', epsilon: eps });
}

/** Throw when a computed optimum/equilibrium fails its own check (a template bug must never reach students). */
export function ensure(ok: boolean, what: string): void {
  if (!ok) throw new Error(`template self-check failed: ${what}`);
}
