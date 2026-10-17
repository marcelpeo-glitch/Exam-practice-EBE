// Shared helpers for the templates of "Functions & domains", "Inverse functions" and "Derivatives" (no TEMPLATES
// export here): real-valued evaluation of mathjs expressions, LaTeX for sums and polynomials, interval sets, and
// multiple-choice builders whose options are formulas or sets. Two options that are the same function (numerically,
// on sample points inside the relevant domain) or the same set never both appear, and never next to an equivalent key.
import { buildMcq, type Choice, type Mcq } from '../build';
import { frac, M } from '../mathx';
import type { Rng } from '../rng';

export type RealFn = (...args: number[]) => number;

/** A real-valued JS function of the given variables from a mathjs expression (complex or invalid results → NaN). */
export function realFn(expr: string, vars: readonly string[] = ['x']): RealFn {
  const code = M.parse(expr).compile();
  return (...args: number[]) => {
    const scope: Record<string, number> = {};
    vars.forEach((v, i) => (scope[v] = args[i]));
    try {
      const r = code.evaluate(scope);
      return typeof r === 'number' ? r : NaN;
    } catch {
      return NaN;
    }
  };
}

/** True when g equals f (relative tolerance) at every sample point where f is finite (and there is at least one). */
export function agree(f: RealFn, g: RealFn, pts: readonly (readonly number[])[], tol = 1e-7): boolean {
  let compared = 0;
  for (const p of pts) {
    const a = f(...p);
    if (!Number.isFinite(a) || Math.abs(a) > 1e12) continue;
    const b = g(...p);
    if (!Number.isFinite(b)) return false;
    if (Math.abs(a - b) > tol * (1 + Math.abs(a))) return false;
    compared++;
  }
  return compared > 0;
}

// ---------- LaTeX / mathjs for sums of terms ----------

/** A coefficient in front of a symbol: 1 → "", −1 → "-", 3 → "3", 0.5 → "0.5". */
export function coef(c: number): string {
  return c === 1 ? '' : c === -1 ? '-' : String(c);
}

/** A term [coefficient, LaTeX symbol, mathjs symbol (defaults to the LaTeX one)]; '' is the constant term. */
export type Term = readonly [number, string, string?];

/** LaTeX of a sum of terms, zero terms dropped: [[2,'x^2'],[-3,'x'],[5,'']] → "2x^2-3x+5". */
export function termsTex(ts: readonly Term[]): string {
  let out = '';
  for (const [c, sym] of ts) {
    if (c === 0) continue;
    const abs = Math.abs(c);
    const body = sym === '' ? String(abs) : `${coef(abs)}${sym}`;
    out += out === '' ? (c < 0 ? `-${body}` : body) : c < 0 ? `-${body}` : `+${body}`;
  }
  return out === '' ? '0' : out;
}

/** The same sum as a mathjs expression. */
export function termsExpr(ts: readonly Term[]): string {
  const parts = ts.filter(([c]) => c !== 0).map(([c, sym, e]) => (sym === '' ? `(${c})` : `(${c})*(${e ?? sym})`));
  return parts.length ? parts.join(' + ') : '0';
}

/** a·v + b as LaTeX, e.g. lin(3, -2) = "3x-2", lin(-1, 4, 'y') = "-y+4". */
export const lin = (a: number, b: number, v = 'x') => termsTex([[a, v], [b, '']]);
/** a·v + b as a mathjs expression. */
export const linE = (a: number, b: number, v = 'x') => termsExpr([[a, v], [b, '']]);

// ---------- polynomials (coefficient arrays, index = power) ----------

export type Poly = number[];
const trim = (p: Poly) => {
  const q = [...p];
  while (q.length > 1 && q[q.length - 1] === 0) q.pop();
  return q;
};
export const pAdd = (p: Poly, q: Poly): Poly => trim(Array.from({ length: Math.max(p.length, q.length) }, (_, i) => (p[i] ?? 0) + (q[i] ?? 0)));
export const pScale = (p: Poly, k: number): Poly => trim(p.map((c) => c * k));
export const pSub = (p: Poly, q: Poly): Poly => pAdd(p, pScale(q, -1));
export const pMul = (p: Poly, q: Poly): Poly => {
  const out = new Array(p.length + q.length - 1).fill(0);
  p.forEach((a, i) => q.forEach((b, j) => (out[i + j] += a * b)));
  return trim(out);
};
export const pDer = (p: Poly): Poly => trim(p.length > 1 ? p.slice(1).map((c, i) => c * (i + 1)) : [0]);
const pTerms = (p: Poly, v: string): Term[] =>
  p.map((c, i): Term => [c, i === 0 ? '' : i === 1 ? v : `${v}^${i}`]).reverse();
export const pTex = (p: Poly, v = 'x') => termsTex(pTerms(p, v));
export const pExpr = (p: Poly, v = 'x') => termsExpr(pTerms(p, v));
/** True when the polynomial has a single non-zero term (so it needs no brackets as a factor). */
export const pIsMonomial = (p: Poly) => p.filter((c) => c !== 0).length <= 1;
/** Polynomial as a factor in a product: brackets unless it is a single term. */
export const pFactor = (p: Poly, v = 'x') => (pIsMonomial(p) && trim(p).length >= 1 && !(pTex(p, v).startsWith('-')) ? pTex(p, v) : `\\left(${pTex(p, v)}\\right)`);

// ---------- rational numbers as LaTeX ----------

/** A number as an integer or a fraction in lowest terms (denominator up to maxDen); otherwise rounded decimals. */
export function ratTex(x: number, maxDen = 60): string {
  for (let q = 1; q <= maxDen; q++) {
    const p = Math.round(x * q);
    if (Math.abs(p / q - x) < 1e-9) return frac(p, q);
  }
  return String(Math.round(x * 1000) / 1000);
}

// ---------- multiple choice with formula options ----------

export interface FormulaChoice {
  /** LaTeX (without the dollar signs and without the label). */
  tex: string;
  /** The same formula as a mathjs expression, used to spot options that are secretly equal to the key. */
  expr: string;
  why?: string;
}

export interface FormulaMcqOptions {
  count: number;
  /** Variables of the expressions, in the order of the sample points. */
  vars?: readonly string[];
  /** Sample points inside the relevant domain. */
  pts: readonly (readonly number[])[];
  /** Printed in front of every option, e.g. "f'(x)=". */
  label?: string;
  /** Extra wrong options (e.g. arithmetic slips) if the modelled mistakes coincide. */
  fallback?: (i: number) => FormulaChoice;
}

/**
 * Single-choice question whose options are formulas. Distractors that are the same function as the key (or as an
 * earlier distractor) on the sample points are dropped, whatever their printed form.
 */
export function formulaMcq(rng: Rng, key: FormulaChoice, distractors: FormulaChoice[], o: FormulaMcqOptions): Mcq {
  const vars = o.vars ?? ['x'];
  const keyF = realFn(key.expr, vars);
  const seen: RealFn[] = [keyF];
  const text = (tex: string) => `$${o.label ?? ''}${tex}$`;
  const keyText = text(key.tex);
  const accept = (d: FormulaChoice): Choice => {
    const f = realFn(d.expr, vars);
    if (seen.some((s) => agree(s, f, o.pts) || agree(f, s, o.pts))) return { text: keyText };
    seen.push(f);
    return { text: text(d.tex), why: d.why };
  };
  const choices = distractors.map(accept);
  return buildMcq(rng, { text: keyText }, choices, { count: o.count, fallback: o.fallback ? (i) => accept(o.fallback!(i)) : undefined });
}

/** Throws if the displayed formula (expr) differs from the reference (e.g. mathjs' own derivative) on the points. */
export function assertSame(shown: string, reference: string, pts: readonly (readonly number[])[], vars: readonly string[] = ['x']) {
  const a = realFn(reference, vars);
  const b = realFn(shown, vars);
  if (!agree(a, b, pts) || !agree(b, a, pts)) throw new Error(`formula check failed: ${shown} ≠ ${reference}`);
}

// ---------- sets of real numbers (unions of intervals) ----------

export interface Interval {
  lo: number;
  hi: number;
  loTex: string;
  hiTex: string;
  /** Closed at the lower / upper end. */
  lc: boolean;
  hc: boolean;
}

/** An end point: its value and its LaTeX. A plain number is printed as is. */
export type End = number | readonly [number, string];
const endOf = (e: End): [number, string] => (typeof e === 'number' ? [e, String(e)] : [e[0], e[1]]);

/** The interval between two end points; null = −∞ (lower) or ∞ (upper). */
export function iv(lo: End | null, hi: End | null, lc = false, hc = false): Interval {
  const [l, lt] = lo === null ? [-Infinity, '-\\infty'] : endOf(lo);
  const [h, ht] = hi === null ? [Infinity, '\\infty'] : endOf(hi);
  return { lo: l, hi: h, loTex: lt, hiTex: ht, lc: lc && lo !== null, hc: hc && hi !== null };
}

export const REALS = (): Interval[] => [iv(null, null)];

export const setTex = (s: readonly Interval[]) =>
  s.map((i) => `${i.lc ? '[' : '('}${i.loTex},${i.hiTex}${i.hc ? ']' : ')'}`).join('\\cup ');

export const inSet = (s: readonly Interval[], x: number) =>
  s.some((i) => (x > i.lo || (i.lc && x === i.lo)) && (x < i.hi || (i.hc && x === i.hi)));

/** Points that decide whether two unions of intervals are equal: all end points, the gaps between them and beyond. */
function probePoints(sets: readonly (readonly Interval[])[]): number[] {
  const ends = [...new Set(sets.flatMap((s) => s.flatMap((i) => [i.lo, i.hi])).filter(Number.isFinite))].sort((a, b) => a - b);
  if (!ends.length) return [0];
  const pts = [ends[0] - 1, ends[ends.length - 1] + 1, ...ends];
  for (let i = 0; i + 1 < ends.length; i++) pts.push((ends[i] + ends[i + 1]) / 2);
  return pts;
}

export function sameSet(a: readonly Interval[], b: readonly Interval[]): boolean {
  return probePoints([a, b]).every((x) => inSet(a, x) === inSet(b, x));
}

/** Throws if the set does not match where f is defined (checked strictly inside and outside, not at end points). */
export function assertDomain(f: (x: number) => number, s: readonly Interval[]) {
  const ends = [...new Set(s.flatMap((i) => [i.lo, i.hi]).filter(Number.isFinite))].sort((a, b) => a - b);
  const pts = ends.length ? [ends[0] - 0.7, ends[ends.length - 1] + 0.9] : [-3.3, 0.4, 5.1];
  for (let i = 0; i + 1 < ends.length; i++) pts.push((ends[i] + ends[i + 1]) / 2);
  for (const e of ends) pts.push(e - 1e-3, e + 1e-3);
  for (const x of pts) {
    const y = f(x);
    const defined = Number.isFinite(y) && Math.abs(y) < 1e12;
    if (defined !== inSet(s, x)) throw new Error(`domain check failed at x = ${x}`);
  }
}

export interface SetChoice {
  set: Interval[];
  why?: string;
}

/** Single-choice question whose options are sets (domains); options that are the same set are dropped. */
export function setMcq(rng: Rng, key: Interval[], distractors: SetChoice[], count: number): Mcq {
  const kept: Interval[][] = [key];
  const text = (s: readonly Interval[]) => `$${setTex(s)}$`;
  const accept = (d: SetChoice): Choice => {
    if (kept.some((k) => sameSet(k, d.set))) return { text: text(key) };
    kept.push(d.set);
    return { text: text(d.set), why: d.why };
  };
  const choices = distractors.map(accept);
  // Last resort: half-lines starting at shifted end points (always a different set from the key).
  const ends = key.flatMap((i) => [i.lo, i.hi]).filter(Number.isFinite);
  const base = ends.length ? Math.max(...ends) : 0;
  return buildMcq(rng, { text: text(key) }, choices, {
    count,
    fallback: (i) => accept({ set: [iv(Math.round(base) + i + 1, null)], why: 'a wrong end point.' }),
  });
}

/** Throws unless inv(f(x)) = x for every sample x (the inverse formula, checked numerically in code). */
export function assertInverse(fExpr: string, invExpr: string, xs: readonly number[], fVar = 'x', invVar = 'y') {
  const f = realFn(fExpr, [fVar]);
  const g = realFn(invExpr, [invVar]);
  for (const x of xs) {
    const back = g(f(x));
    if (!(Math.abs(back - x) <= 1e-7 * (1 + Math.abs(x)))) throw new Error(`inverse check failed at ${x}: ${invExpr} for ${fExpr}`);
  }
}

/** Sample points [f(x)] for formula options in the variable y = f(x). */
export function imagePts(fExpr: string, xs: readonly number[], fVar = 'x'): number[][] {
  const f = realFn(fExpr, [fVar]);
  return xs.map((x) => [f(x)]);
}

/** LaTeX factor 1/k in front of a function: 1 → "", −1 → "-", 2 → "\frac{1}{2}", 0.5 → "2", −2 → "-\frac{1}{2}". */
export function recipCoef(k: number): string {
  const s = k < 0 ? '-' : '';
  const a = Math.abs(k);
  if (a === 1) return s;
  const r = 1 / a;
  if (Number.isInteger(r)) return `${s}${r}`;
  if (Number.isInteger(a)) return `${s}\\frac{1}{${a}}`;
  return `${s}\\frac{1}{${a}}`;
}
