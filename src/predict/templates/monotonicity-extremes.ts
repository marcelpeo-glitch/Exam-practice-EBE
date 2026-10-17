// Templates for the topic "Monotonicity, convexity & extremes" (QM1 past exams: count extremes / stationary points /
// inflection points from a factored f' or f'' such as (x−1)³(x+1)²(x+2), (x²−1)³ or (x²+1)²; stationary points of
// ln(x⁵+1); where x/(x²+1), x/(x+1) or 1/(x+1) is convex or concave; the shape of x³−3x²−9x on an interval; and what the
// sign of f' says about g = 2 − 4f or g = 2/f). Keys are computed in code (sign changes of polynomials and of the
// analytic derivatives, checked against numerical derivatives of the printed function); wrong options come from
// modelled mistakes. See monotonicity-extremes.test.ts for the independent checks.
import { buildMcq, buildMulti, INSTRUCTION, mistakesNote, type Choice } from '../build';
import { fn, numDiff, numDiff2 } from '../mathx';
import type { Rng } from '../rng';
import type { Template } from '../types';
import { choiceQuestion, coefTex, ensure, numericQuestion, sumTex, valueMcq } from './_econ';
import { iv, lin, linE, pDer, pMul, pTex, ratTex, setMcq, setTex, type Interval, type Poly, type SetChoice } from './_fnderiv';

type Mistake = { value: number; why: string };
type Fx = (x: number) => number;

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const powTex = (base: string, e: number) => (e === 0 ? '' : e === 1 ? base : `${base}^{${e}}`);
const pEval = (p: Poly, x: number) => p.reduce((s, c, i) => s + c * x ** i, 0);
const pPow = (p: Poly, k: number): Poly => (k === 0 ? [1] : pMul(p, pPow(p, k - 1)));
/** "(x-3)" / "(x+2)" / "x" as a factor. */
const facTex = (r: number) => (r === 0 ? 'x' : `(${lin(1, -r)})`);
/** A linear expression as a factor: brackets unless it is just x. */
const par = (s: string) => (s === 'x' ? s : `(${s})`);

/** Number of sign changes of a polynomial, given (a superset of) its real zeros. */
function polySignChanges(p: Poly, zeros: number[]): number {
  const xs = [...new Set(zeros)].sort((a, b) => a - b);
  const probes = [xs[0] - 1, ...xs.slice(1).map((x, i) => (x + xs[i]) / 2), xs[xs.length - 1] + 1];
  let n = 0;
  for (let i = 1; i < probes.length; i++) if (Math.sign(pEval(p, probes[i])) !== Math.sign(pEval(p, probes[i - 1]))) n++;
  return n;
}

// =====================================================================================================================
// 1. Counting stationary points, extremes and inflection points
// =====================================================================================================================

type Count = 'stat' | 'ext' | 'infl';
const ASK: Record<Count, readonly string[]> = {
  stat: ['What is the number of stationary points of $f$?', 'At how many points is the tangent line to the graph of $f$ horizontal?'],
  ext: ['What is the number of local extreme points (maxima plus minima) of $f$?', 'At how many points does $f$ attain a local maximum or a local minimum?'],
  infl: ['What is the number of inflection points of $f$?', 'At how many points does the graph of $f$ switch between convex and concave?'],
};
const NOUN: Record<Count, string> = { stat: 'stationary point', ext: 'extreme point', infl: 'inflection point' };

interface Fac {
  tex: string;
  roots: number[];
  e: number;
  q?: number;
}
const linFac = (r: number, e: number): Fac => ({ tex: powTex(facTex(r), e), roots: [r], e });
const pairFac = (a: number, e: number): Fac => ({ tex: powTex(`(x^2-${a * a})`, e), roots: [-a, a], e });
const cplxFac = (q: number, e: number): Fac => ({ tex: powTex(`(x^2+${q})`, e), roots: [], e, q });

/** A product of factors with distinct integer zeros, at least one odd and one even power, maybe a factor x² + q. */
function factorProduct(rng: Rng): { facs: Fac[]; tex: string } {
  for (;;) {
    const facs: Fac[] = [];
    const used = new Set<number>();
    if (rng.chance(0.3)) {
      const a = rng.int(1, 3);
      facs.push(pairFac(a, rng.int(1, 3)));
      used.add(a).add(-a);
    }
    const nLin = facs.length ? rng.int(1, 2) : rng.int(2, 3);
    const lins: Fac[] = [];
    while (lins.length < nLin) {
      const r = rng.int(-4, 4);
      if (used.has(r)) continue;
      used.add(r);
      lins.push(linFac(r, rng.int(1, 4)));
    }
    facs.unshift(...lins.sort((p, q) => p.roots[0] - q.roots[0]));
    if (rng.chance(0.35)) facs.push(cplxFac(rng.pick([1, 2, 4, 9]), rng.int(1, 2)));
    const real = facs.filter((f) => f.roots.length);
    if (!real.some((f) => f.e % 2) || !real.some((f) => f.e % 2 === 0)) continue;
    const c = rng.chance(0.3) ? rng.pick([2, 3, 5, -1, -2]) : 1;
    const ordered = [...facs.filter((f) => f.tex.startsWith('x')), ...facs.filter((f) => !f.tex.startsWith('x'))];
    return { facs, tex: coefTex(c) + ordered.map((f) => f.tex).join('') };
  }
}

const zeroLine = (f: Fac, d: string) =>
  f.roots.length
    ? `- $${f.tex}$: zero${f.roots.length > 1 ? 's' : ''} ${f.roots.map((r) => `$x=${r}$`).join(' and ')} with power ${f.e} (${f.e % 2 ? `odd, so $${d}$ changes sign` : `even, so $${d}$ does not change sign`})`
    : `- $${f.tex}$: $x^2+${f.q}>0$ for every $x$, so no real zeros`;

const countPoints: Template = {
  id: 'monotonicity-extremes.count-points',
  topic: 'Monotonicity, convexity & extremes',
  title: "Number of stationary points, extreme points or inflection points from a factored f' or f'' (sign changes, even powers), or from f itself",
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const variant = rng.pick(['fp', 'fpp', 'fp-infl', 'f'] as const);
    let shown: string, given: string, ask: Count, key: number, work: string;
    let mistakes: Mistake[];
    if (variant === 'fp' || variant === 'fpp') {
      const { facs, tex } = factorProduct(rng);
      const d = variant === 'fp' ? "f'" : "f''";
      shown = `${d}(x)=${tex}`;
      ask = variant === 'fp' ? rng.pick(['stat', 'ext'] as const) : 'infl';
      const distinct = facs.reduce((s, f) => s + f.roots.length, 0);
      const odd = facs.filter((f) => f.e % 2).reduce((s, f) => s + f.roots.length, 0);
      const mult = facs.reduce((s, f) => s + f.roots.length * f.e, 0);
      const cplx = facs.some((f) => f.q) ? 2 : 0;
      const pair = facs.some((f) => f.roots.length === 2);
      key = ask === 'stat' ? distinct : odd;
      given =
        variant === 'fp'
          ? rng.pick(['The derivative of a function $f$ is', 'A differentiable function $f$ has derivative', 'For a function $f$ we know only its derivative,'])
          : rng.pick(['The second derivative of a function $f$ is', 'A twice differentiable function $f$ has second derivative', 'For a function $f$ we know only its second derivative,']);
      work =
        `The real zeros of $${d}$ come from the factors:\n${facs.map((f) => zeroLine(f, d)).join('\n')}\n` +
        (variant === 'fp'
          ? `Stationary points are the zeros of $f'$: there are ${distinct}. A stationary point is an extreme point only if $f'$ changes sign there: ${odd} of them. `
          : `An inflection point is a point where $f''$ changes sign (not merely a zero of $f''$): there are ${odd}. `) +
        `So $f$ has **${plural(key, NOUN[ask])}**.`;
      const cplxWhy = 'treats the factor $x^2+q$ as if it had two real zeros.';
      const pairWhy = 'counts brackets instead of zeros (a bracket $(x^2-a^2)$ has two zeros).';
      const brackets = facs.filter((f) => f.roots.length).length;
      const oddBrackets = facs.filter((f) => f.roots.length && f.e % 2).length;
      mistakes =
        ask === 'stat'
          ? [
              { value: odd, why: "only counts the zeros where $f'$ changes sign; a stationary point only needs $f'(x)=0$." },
              { value: mult, why: 'counts every zero as often as its power.' },
              ...(cplx ? [{ value: distinct + cplx, why: cplxWhy }] : []),
              ...(pair ? [{ value: brackets, why: pairWhy }] : []),
            ]
          : [
              { value: distinct, why: `counts every zero of $${d}$, also those with an even power where $${d}$ does not change sign.` },
              { value: mult, why: 'counts every zero as often as its power.' },
              ...(cplx ? [{ value: odd + cplx, why: cplxWhy }] : []),
              ...(pair ? [{ value: oddBrackets, why: pairWhy }] : []),
            ];
    } else if (variant === 'fp-infl') {
      const form = rng.pick(['pair', 'cplx', 'two'] as const);
      ask = 'infl';
      let fp: Poly, zeros: number[], stat: number, ext: number, zeros2: number, chainSkip: number | null, tex: string;
      if (form === 'pair' || form === 'cplx') {
        const a = form === 'pair' ? rng.int(1, 3) : 0;
        const q = form === 'pair' ? -a * a : rng.pick([1, 2, 3, 4, 9]);
        const k = rng.int(2, 3);
        fp = pPow([q, 0, 1], k);
        tex = `(x^2${q < 0 ? '-' : '+'}${Math.abs(q)})^{${k}}`;
        zeros = form === 'pair' ? [-a, 0, a] : [0];
        stat = form === 'pair' ? 2 : 0;
        ext = form === 'pair' && k % 2 ? 2 : 0;
        zeros2 = form === 'pair' ? 3 : 1;
        chainSkip = form === 'pair' && (k - 1) % 2 ? 2 : 0;
        const inner = `x^2${q < 0 ? '-' : '+'}${Math.abs(q)}`;
        work =
          `Chain rule: $$f''(x)=${k}${powTex(`(${inner})`, k - 1)}\\cdot 2x=${2 * k}x${powTex(`(${inner})`, k - 1)}$$` +
          (form === 'pair'
            ? `Zeros: $x=0$ (power 1, sign change) and $x=\\pm ${a}$ (power ${k - 1}, ${(k - 1) % 2 ? 'sign change' : 'no sign change'}).`
            : `Since $${inner}>0$, the only zero is $x=0$, where $f''$ changes sign.`);
      } else {
        let a: number, b: number, m: number, n: number;
        do {
          a = rng.int(-4, 3);
          b = rng.int(a + 1, 4);
          m = rng.int(1, 3);
          n = rng.int(1, 3);
        } while (m + n < 3);
        fp = pMul(pPow([-a, 1], m), pPow([-b, 1], n));
        const x0 = (m * b + n * a) / (m + n);
        tex = powTex(facTex(a), m) + powTex(facTex(b), n);
        zeros = [a, b, x0];
        stat = 2;
        ext = (m % 2) + (n % 2);
        zeros2 = 1 + (m >= 2 ? 1 : 0) + (n >= 2 ? 1 : 0);
        chainSkip = null;
        ensure(Math.abs(pEval(pDer(fp), x0)) < 1e-9, 'zero of f′′');
        const pre = powTex(facTex(a), m - 1) + powTex(facTex(b), n - 1);
        work =
          `Product rule: $$f''(x)=${m === 1 ? '' : m}${powTex(facTex(a), m - 1)}${powTex(facTex(b), n)}+${n === 1 ? '' : n}${powTex(facTex(a), m)}${powTex(facTex(b), n - 1)}=${pre}\\left(${lin(m + n, -(m * b + n * a))}\\right)$$` +
          `Zeros: $x=${ratTex(x0)}$ (power 1, sign change)` +
          (m >= 2 ? `, $x=${a}$ (power ${m - 1}, ${(m - 1) % 2 ? 'sign change' : 'no sign change'})` : '') +
          (n >= 2 ? `, $x=${b}$ (power ${n - 1}, ${(n - 1) % 2 ? 'sign change' : 'no sign change'})` : '') +
          '.';
      }
      shown = `f'(x)=${tex}`;
      key = polySignChanges(pDer(fp), zeros);
      given = rng.pick(['The derivative of a function $f$ is', 'A twice differentiable function $f$ has derivative']);
      work += ` So $f$ has **${plural(key, NOUN.infl)}** (inflection points are where $f''$ changes sign).`;
      mistakes = [
        { value: stat, why: "counts the zeros of $f'$ (the stationary points) instead of the sign changes of $f''$." },
        { value: ext, why: "counts the extreme points of $f$ (sign changes of $f'$) instead of its inflection points." },
        { value: zeros2, why: "counts every zero of $f''$, also those where $f''$ does not change sign." },
        ...(chainSkip !== null ? [{ value: chainSkip, why: "forgets the inner derivative $2x$ of the chain rule when computing $f''$." }] : []),
        ...(form === 'cplx' ? [{ value: 0, why: "thinks that $f'$ without real zeros means that there are no inflection points." }] : []),
      ];
    } else {
      const form = rng.pick(['ln', 'poly', 'exp'] as const);
      ask = rng.pick(['stat', 'ext'] as const);
      given = rng.pick(['Consider the function', 'Let', 'A function is given by']);
      let stat: number, ext: number, fTex: string;
      if (form === 'ln') {
        let n: number, k: number;
        do {
          n = rng.int(2, 6);
          k = rng.int(1, 9);
        } while (n === 5 && k === 1);
        fTex = `\\ln\\left(x^{${n}}+${k}\\right)`;
        stat = 1;
        ext = n % 2 ? 0 : 1;
        const xn1 = powTex('x', n - 1);
        work =
          `$$f'(x)=\\frac{${n}${xn1}}{x^{${n}}+${k}}$$ The only zero is $x=0$${n % 2 ? ` (which lies in the domain $x^{${n}}>-${k}$)` : ''}. ` +
          `The denominator is positive${n % 2 ? ' on the domain' : ''}, so $f'$ has the sign of $${xn1}$, which ${(n - 1) % 2 ? 'changes sign at $x=0$: a minimum' : 'does not change sign: no extreme'}. ` +
          `So $f$ has ${plural(stat, 'stationary point')} and ${plural(ext, 'extreme point')}.`;
        const den = n % 2 ? 1 : 0;
        mistakes = [
          { value: n - 1, why: `counts the zero $x=0$ of $${xn1}$ as ${n - 1} separate zeros.` },
          { value: ask === 'stat' ? ext : stat, why: ask === 'stat' ? "only counts the stationary points where $f'$ changes sign." : 'assumes every stationary point is an extreme point.' },
          { value: den, why: `solves $x^{${n}}+${k}=0$ (the denominator) instead of the numerator $=0$.` },
          { value: k === 1 ? 1 : n % 2, why: "solves $f(x)=0$ instead of $f'(x)=0$." },
        ];
      } else if (form === 'poly') {
        let m: number, n: number;
        do {
          m = rng.int(1, 3);
          n = rng.int(1, 3);
        } while (m + n < 3);
        const a = rng.sign() * rng.int(1, 4);
        fTex = powTex('x', m) + powTex(facTex(a), n);
        const x1 = (m * a) / (m + n);
        stat = 1 + (m >= 2 ? 1 : 0) + (n >= 2 ? 1 : 0);
        ext = 1 + (m % 2 === 0 ? 1 : 0) + (n % 2 === 0 ? 1 : 0);
        const pre = powTex('x', m - 1) + powTex(facTex(a), n - 1);
        work =
          `Product rule: $$f'(x)=${pre}\\left(${lin(m + n, -m * a)}\\right)$$` +
          `Zeros: $x=${ratTex(x1)}$ (power 1, sign change)` +
          (m >= 2 ? `, $x=0$ (power ${m - 1}, ${(m - 1) % 2 ? 'sign change' : 'no sign change'})` : '') +
          (n >= 2 ? `, $x=${a}$ (power ${n - 1}, ${(n - 1) % 2 ? 'sign change' : 'no sign change'})` : '') +
          `. So $f$ has ${plural(stat, 'stationary point')}, of which ${ext} ${ext === 1 ? 'is an extreme point' : 'are extreme points'}.`;
        mistakes = [
          { value: 2, why: "counts the zeros $x=0$ and $x=" + a + "$ of $f$ itself instead of the zeros of $f'$." },
          { value: stat - 1, why: `misses the zero $x=${ratTex(x1)}$ of the last bracket of $f'$.` },
          { value: ask === 'stat' ? ext : stat, why: ask === 'stat' ? "only counts the stationary points where $f'$ changes sign." : 'assumes every stationary point is an extreme point.' },
          { value: m - 1 + (n - 1) + 1, why: 'counts every zero as often as its power.' },
        ];
      } else {
        const kind = rng.pick(['two', 'double', 'none'] as const);
        let B: number, C: number;
        if (kind === 'two') {
          const r1 = rng.int(-4, 2);
          const r2 = rng.int(r1 + 1, 3);
          B = -(r1 + r2) - 2;
          C = r1 * r2 - B;
        } else if (kind === 'double') {
          const r = rng.int(-4, 3);
          B = -2 * r - 2;
          C = r * r - B;
        } else {
          B = rng.int(-4, 4);
          C = Math.floor((B + 2) ** 2 / 4 - B) + rng.int(1, 4);
        }
        const disc = (B + 2) ** 2 - 4 * (B + C);
        ensure(kind === 'two' ? disc > 0 : kind === 'double' ? disc === 0 : disc < 0, 'discriminant');
        const quad = sumTex([
          [1, 'x^2'],
          [B, 'x'],
          [C, ''],
        ]);
        const dquad = sumTex([
          [1, 'x^2'],
          [B + 2, 'x'],
          [B + C, ''],
        ]);
        fTex = `\\left(${quad}\\right)e^{x}`;
        stat = disc > 0 ? 2 : disc === 0 ? 1 : 0;
        ext = disc > 0 ? 2 : 0;
        const neg = (v: number) => (v < 0 ? `(${v})` : String(v));
        work =
          `Product rule: $$f'(x)=\\left(${sumTex([
            [2, 'x'],
            [B, ''],
          ])}\\right)e^{x}+\\left(${quad}\\right)e^{x}=\\left(${dquad}\\right)e^{x}$$` +
          `Since $e^{x}>0$, only the bracket can be zero. Its discriminant is $${neg(B + 2)}^2-4\\cdot ${neg(B + C)}=${disc}$, ` +
          (disc > 0
            ? 'positive: two zeros, at each of which $f\'$ changes sign. So 2 stationary points, both extreme points.'
            : disc === 0
              ? "zero: one (double) zero, where $f'$ does not change sign. So 1 stationary point and no extreme point."
              : 'negative: no zeros. So no stationary points and no extreme points.');
        const discF = B * B - 4 * C;
        mistakes = [
          { value: 1, why: 'forgets the product rule and only differentiates the bracket ($2x+b=0$ gives one point).' },
          { value: discF > 0 ? 2 : discF === 0 ? 1 : 0, why: "solves $f(x)=0$ instead of $f'(x)=0$." },
          { value: ask === 'stat' ? ext : stat, why: ask === 'stat' ? "only counts the stationary points where $f'$ changes sign." : 'assumes every stationary point is an extreme point.' },
          { value: stat + 1, why: 'also counts a solution of $e^{x}=0$, which does not exist.' },
        ];
      }
      shown = `f(x)=${fTex}`;
      key = ask === 'stat' ? stat : ext;
    }
    const stem = `${given} $$${shown}$$ ${rng.pick(ASK[ask])}`;
    const explanation = work;
    if (type === 'numeric') return numericQuestion(stem, key, 0, explanation);
    const mcq = valueMcq(rng, key, mistakes, optionCount, (v) => String(v), {
      epsilon: 1e-9,
      fallback: (i) => {
        const k = Math.floor(i / 2) + 1;
        const v = i % 2 && key - k >= 0 ? key - k : key + k;
        return { text: String(v), value: v, why: 'a miscount of the zeros or sign changes.' };
      },
    });
    return choiceQuestion(stem, mcq, explanation);
  },
};

// =====================================================================================================================
// 2. Where is f convex / concave?
// =====================================================================================================================

interface Brk {
  x: number;
  tex: string;
  pole?: boolean;
}
const brk = (x: number, tex = ratTex(x), pole = false): Brk => ({ x, tex, pole });

/** The set where g > 0, from the points where g can change sign (zeros and poles); runs are merged across zeros. */
function signSet(brks: Brk[], g: Fx): Interval[] {
  const bs = [...brks].sort((a, b) => a.x - b.x).filter((b, i, arr) => i === 0 || b.x !== arr[i - 1].x);
  const mk = (lo: Brk | null, hi: Brk | null) => iv(lo && ([lo.x, lo.tex] as const), hi && ([hi.x, hi.tex] as const));
  const out: Interval[] = [];
  let start: Brk | null | undefined;
  for (let i = 0; i <= bs.length; i++) {
    const lo = i === 0 ? null : bs[i - 1];
    const hi = i === bs.length ? null : bs[i];
    const mid = lo === null ? (hi === null ? 0 : hi.x - 1) : hi === null ? lo.x + 1 : (lo.x + hi.x) / 2;
    if (g(mid) > 0) {
      if (start === undefined || lo?.pole) {
        if (start !== undefined) out.push(mk(start, lo));
        start = lo;
      }
    } else if (start !== undefined) {
      out.push(mk(start, lo));
      start = undefined;
    }
  }
  if (start !== undefined) out.push(mk(start, null));
  return out;
}

interface Family {
  tex: string;
  expr: string;
  f1: Fx;
  f2: Fx;
  b1: Brk[];
  b2: Brk[];
  poles: Brk[];
  extra: { b: Brk[]; s: Fx; why: string }[];
  work: string;
}

const rootTex = (v: number) => (Number.isInteger(Math.sqrt(v)) ? String(Math.sqrt(v)) : `\\sqrt{${v}}`);
const symm = (v: number): Brk[] => [brk(-Math.sqrt(v), `-${rootTex(v)}`), brk(Math.sqrt(v), rootTex(v))];

function famFrac(rng: Rng): Family {
  let p: number, q: number, b: number;
  do {
    p = rng.pick([0, 1, 2, 3, -1, -2]);
    q = rng.int(-6, 6);
    b = rng.int(-4, 4);
  } while (p * b + q === 0 || (p === 0 && q === 0));
  const K = p * b + q;
  const num = lin(p, q);
  const den = lin(1, -b);
  const dp = b === 0 ? 'x' : `(${den})`;
  const pole = brk(b, String(b), true);
  const extra: Family['extra'] = [];
  if (b !== 0) extra.push({ b: [brk(-b, String(-b), true)], s: (x) => K / (x + b) ** 3, why: `takes the vertical asymptote at $x=${-b}$ instead of $x=${b}$ (sign error).` });
  if (p !== 0 && -q / p !== b) extra.push({ b: [brk(-q / p)], s: (x) => K * (x + q / p), why: 'uses the zero of the numerator instead of the zero of the denominator.' });
  return {
    tex: `\\dfrac{${num}}{${den}}`,
    expr: `(${linE(p, q)})/(${linE(1, -b)})`,
    f1: (x) => -K / (x - b) ** 2,
    f2: (x) => (2 * K) / (x - b) ** 3,
    b1: [pole],
    b2: [pole],
    poles: [pole],
    extra,
    work:
      `Quotient rule: $$f'(x)=${p === 0 ? `\\frac{${-q}}{${dp}^2}` : `\\frac{${coefTex(p)}${dp}-(${num})}{${dp}^2}=\\frac{${-K}}{${dp}^2}`}, \\qquad f''(x)=\\frac{${2 * K}}{${dp}^3}$$` +
      `The sign of $f''$ is the sign of $${2 * K}${dp}^3$, which only changes at the vertical asymptote $x=${b}$ (where $f$ is not defined).`,
  };
}

function famOdd(rng: Rng): Family {
  const a = rng.pick([1, 2, 3, 4, -1, -2]);
  const k = rng.pick([1, 2, 3, 4, 5, 12, 27]);
  const b2 = [...symm(3 * k), brk(0)];
  const ca = a === 1 ? '' : a === -1 ? '-' : String(a);
  return {
    tex: `\\dfrac{${ca}x}{x^2+${k}}`,
    expr: `${a}*x/(x^2+${k})`,
    f1: (x) => (a * (k - x * x)) / (x * x + k) ** 2,
    f2: (x) => (2 * a * x * (x * x - 3 * k)) / (x * x + k) ** 3,
    b1: symm(k),
    b2,
    poles: [],
    extra: [
      { b: symm(3 * k), s: (x) => a * (x * x - 3 * k), why: "drops the factor $x$ of $f''(x)$, which changes sign at $x=0$ too." },
      { b: [...symm(k), brk(0)], s: (x) => a * x * (x * x - k), why: `solves $x^2=${k}$ instead of $x^2=${3 * k}$.` },
    ],
    work:
      `Quotient rule (twice): $$f'(x)=\\frac{${ca === '' ? `${k}-x^2` : `${ca}(${k}-x^2)`}}{(x^2+${k})^2}, \\qquad f''(x)=\\frac{${2 * a}x(x^2-${3 * k})}{(x^2+${k})^3}$$` +
      `The denominator is positive, so $f''$ changes sign at $x=-${rootTex(3 * k)}$, $x=0$ and $x=${rootTex(3 * k)}$.`,
  };
}

function famLog(rng: Rng): Family {
  const a = rng.pick([1, 2, 3, -1, -2]);
  const k = rng.pick([1, 4, 9, 16, 25, 2, 3, 5]);
  return {
    tex: `${coefTex(a)}\\ln\\left(x^2+${k}\\right)`,
    expr: `${a}*log(x^2+${k})`,
    f1: (x) => (2 * a * x) / (x * x + k),
    f2: (x) => (2 * a * (k - x * x)) / (x * x + k) ** 2,
    b1: [brk(0)],
    b2: symm(k),
    poles: [],
    extra: k === 1 ? [] : [{ b: [brk(-k), brk(k)], s: (x) => a * (k * k - x * x), why: `forgets the square root when solving $x^2=${k}$ (the end points are $\\pm ${rootTex(k)}$, not $\\pm ${k}$).` }],
    work:
      `Chain rule and quotient rule: $$f'(x)=\\frac{${2 * a}x}{x^2+${k}}, \\qquad f''(x)=\\frac{${2 * a}(x^2+${k})-${a < 0 ? `(${2 * a}x)` : `${2 * a}x`}\\cdot 2x}{(x^2+${k})^2}=\\frac{${2 * a}(${k}-x^2)}{(x^2+${k})^2}$$` +
      `The denominator is positive, so $f''$ changes sign at $x=\\pm ${rootTex(k)}$.`,
  };
}

function famExp(rng: Rng): Family {
  const c = rng.pick([1, -1]);
  const b = rng.int(-4, 4);
  const x2 = c === 1 ? -b - 2 : 2 - b;
  const x1 = c === 1 ? -b - 1 : 1 - b;
  const ex = c === 1 ? 'e^{x}' : 'e^{-x}';
  const extra: Family['extra'] = [];
  if (c === -1) extra.push({ b: [brk(-b - 2)], s: (x) => x + b + 2, why: 'forgets the minus sign of the inner derivative of $e^{-x}$.' });
  if (x2 !== 0) extra.push({ b: [brk(-x2)], s: (x) => x + x2, why: `sign error when solving $f''(x)=0$: takes $x=${-x2}$ instead of $x=${x2}$.` });
  const work =
    c === 1
      ? `Product rule: $$f'(x)=e^{x}+${par(lin(1, b))}e^{x}=${par(lin(1, b + 1))}e^{x}, \\qquad f''(x)=e^{x}+${par(lin(1, b + 1))}e^{x}=${par(lin(1, b + 2))}e^{x}$$`
      : `Product and chain rule: $$f'(x)=e^{-x}-${par(lin(1, b))}e^{-x}=${par(lin(-1, 1 - b))}e^{-x}, \\qquad f''(x)=-e^{-x}-${par(lin(-1, 1 - b))}e^{-x}=${par(lin(1, b - 2))}e^{-x}$$`;
  return {
    tex: `${b === 0 ? 'x' : `\\left(${lin(1, b)}\\right)`}${ex}`,
    expr: `(x + ${b})*exp(${c}*x)`,
    f1: (x) => Math.exp(c * x) * (c === 1 ? x + b + 1 : 1 - b - x),
    f2: (x) => Math.exp(c * x) * (c === 1 ? x + b + 2 : x + b - 2),
    b1: [brk(x1)],
    b2: [brk(x2)],
    poles: [],
    extra,
    work: `${work}Since $${ex}>0$, $f''$ has the sign of $${lin(1, -x2)}$: it changes sign at $x=${x2}$.`,
  };
}

function famQuartic(rng: Rng): Family {
  const s = rng.pick([1, -1]);
  const r = rng.pick([-3, -2, -1, 1, 2, 3]);
  return {
    tex: pTex([0, 0, 0, -2 * s * r, s]),
    expr: `${s}*(x^4 - ${2 * r}*x^3)`,
    f1: (x) => s * (4 * x ** 3 - 6 * r * x * x),
    f2: (x) => 12 * s * x * (x - r),
    b1: [brk(0), brk(1.5 * r)],
    b2: [brk(0), brk(r)],
    poles: [],
    extra: [
      { b: [brk(r)], s: (x) => s * (x - r), why: "divides $f''(x)=0$ by $x$ and loses the solution $x=0$." },
      { b: [brk(-r), brk(0)], s: (x) => s * x * (x + r), why: `sign error: takes $x=${-r}$ instead of $x=${r}$ as a zero of $f''$.` },
    ],
    work: `$$f'(x)=${pTex([0, 0, -6 * s * r, 4 * s])}, \\qquad f''(x)=${pTex([0, -12 * s * r, 12 * s])}=${12 * s}x(${lin(1, -r)})$$ So $f''$ changes sign at $x=0$ and $x=${r}$.`,
  };
}

const convexitySet: Template = {
  id: 'monotonicity-extremes.convexity-set',
  topic: 'Monotonicity, convexity & extremes',
  title: "Set on which f is convex or concave (sign of f'' for rational, logarithmic, exponential and quartic functions)",
  types: ['single-choice'],
  difficulty: 2,
  generate({ rng, optionCount }) {
    const fam = rng.pick([famFrac, famOdd, famLog, famExp, famQuartic])(rng);
    // self-check: the analytic derivatives agree with numerical derivatives of the shown function
    const f = fn(fam.expr);
    for (const x of [-3.7, -1.3, 0.6, 2.2, 4.9]) {
      if (fam.poles.some((p) => Math.abs(p.x - x) < 0.5)) continue;
      ensure(Math.abs(numDiff(f, x) - fam.f1(x)) < 1e-5 * (1 + Math.abs(fam.f1(x))), "f' formula");
      ensure(Math.abs(numDiff2(f, x) - fam.f2(x)) < 1e-3 * (1 + Math.abs(fam.f2(x))), "f'' formula");
    }
    const want = rng.chance(0.55) ? 1 : -1;
    const word = want > 0 ? 'convex' : 'concave';
    const key = signSet(fam.b2, (x) => want * fam.f2(x));
    ensure(key.length > 0, 'non-empty key');
    const ds: SetChoice[] = [
      {
        set: signSet(fam.b2, (x) => -want * fam.f2(x)),
        why: `this is where $f''(x)${want > 0 ? '<' : '>'}0$, i.e. where $f$ is ${want > 0 ? 'concave' : 'convex'}: convex and concave mixed up.`,
      },
      ...rng.shuffle<SetChoice>([
        { set: signSet(fam.b1, (x) => want * fam.f1(x)), why: `uses the sign of $f'$ instead of $f''$: this is where $f$ is ${want > 0 ? 'increasing' : 'decreasing'}.` },
        { set: signSet(fam.poles, () => 1), why: 'assumes the function has the same curvature on its whole domain.' },
        ...fam.extra.map((e) => ({ set: signSet(e.b, (x) => want * e.s(x)), why: e.why })),
      ]),
    ].filter((d) => d.set.length > 0);
    const mcq = setMcq(rng, key, ds, optionCount);
    const name = rng.pick(['f', 'g', 'h']);
    const fTex = `${name}(x)=${fam.tex}`;
    const stem = rng.pick([
      `Determine where the function $$${fTex}$$ is ${word}.`,
      `On which set is the function $$${fTex}$$ ${word}?`,
      `For which values of $x$ is $$${fTex}$$ ${word}?`,
    ]);
    const explanation = `${fam.work}\n$f$ is ${word} where $f''(x)${want > 0 ? '>' : '<'}0$, which is the set $$${setTex(key)}$$` + mistakesNote(mcq.distractors);
    // use the function's own letter in the worked solution (f, f', f'' → g, g', g'')
    const renamed = name === 'f' ? explanation : explanation.replace(/(?<![A-Za-z\\])f(?=['(]|\$)/g, name);
    return { type: 'single-choice', stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: renamed };
  },
};

// =====================================================================================================================
// 3. Shape of a cubic on an interval
// =====================================================================================================================

const MONO = (s: number) => (s > 0 ? 'increasing' : 'decreasing');
const CURV = (s: number) => (s > 0 ? 'convex' : 'concave');

const cubicShape: Template = {
  id: 'monotonicity-extremes.cubic-shape',
  topic: 'Monotonicity, convexity & extremes',
  title: 'Increasing/decreasing and convex/concave on an interval for a cubic (signs of f′ and f′′ around the stationary and inflection points)',
  types: ['single-choice', 'multi-select'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const a = rng.pick([1, -1]);
    const third = rng.chance(0.5);
    let r1: number, r2: number;
    do {
      r1 = rng.int(-4, 3);
      r2 = r1 + 2 * rng.int(1, 3);
    } while (r2 > 5 || (r1 * r2 === -3 && Math.abs(r1 + r2) === 2)); // would print like the past exam's x³ − 3x² − 9x
    const m = (r1 + r2) / 2;
    const h = (r2 - r1) / 2;
    const A = third ? a : 3 * a; // f'(x) = A(x − r1)(x − r2)
    const e = rng.int(-6, 6);
    const tex = sumTex([
      [A / 3, 'x^3'],
      [-A * m, 'x^2'],
      [A * r1 * r2, 'x'],
      [e, ''],
    ]);
    const f = (x: number) => (A / 3) * x ** 3 - A * m * x * x + A * r1 * r2 * x + e;
    const f1 = (x: number) => A * (x - r1) * (x - r2);
    const f2 = (x: number) => 2 * A * (x - m);
    ensure([-2.3, 0.7, 3.1].every((x) => Math.abs(numDiff(f, x) - f1(x)) < 1e-5 && Math.abs(numDiff2(f, x) - f2(x)) < 1e-3), 'cubic derivatives');
    const sA = Math.sign(A);
    // intervals with the sign of f' and f'' on them (0 = changes sign inside)
    const ivs = [
      { lo: r1 - h, hi: r1, d1: sA, d2: -sA },
      { lo: r1, hi: m, d1: -sA, d2: -sA },
      { lo: m, hi: r2, d1: -sA, d2: sA },
      { lo: r2, hi: r2 + h, d1: sA, d2: sA },
      { lo: r1, hi: r2, d1: -sA, d2: 0 },
    ];
    type St = { text: string; correct: boolean; why: string };
    const statement = (i: (typeof ivs)[number], mono: number, curv: number): St => {
      const correct = i.d1 === mono && i.d2 === curv;
      const actual =
        i.d2 === 0
          ? `$f''$ changes sign at the inflection point $x=${m}$, inside $(${i.lo},${i.hi})$, so $f$ is neither convex nor concave on the whole interval`
          : `on $(${i.lo},${i.hi})$ we have $f'(x)${i.d1 > 0 ? '>' : '<'}0$ and $f''(x)${i.d2 > 0 ? '>' : '<'}0$, so $f$ is ${MONO(i.d1)} and ${CURV(i.d2)} there`;
      return { text: `$f$ is ${MONO(mono)} and ${CURV(curv)} on $(${i.lo},${i.hi})$`, correct, why: `${actual}.` };
    };
    const fpTex = `${coefTex(A)}${[r1, r2].sort((u, v) => Number(v === 0) - Number(u === 0)).map(facTex).join('')}`; // a bare x first: 3x(x-4)
    const explanation =
      `$$f'(x)=${sumTex([
        [A, 'x^2'],
        [-2 * A * m, 'x'],
        [A * r1 * r2, ''],
      ])}=${fpTex}, \\qquad f''(x)=${sumTex([
        [2 * A, 'x'],
        [-2 * A * m, ''],
      ])}$$` +
      `So $f'=0$ at $x=${r1}$ and $x=${r2}$, and $f''=0$ at $x=${m}$. Signs:\n` +
      `- $x<${r1}$: $f'${sA > 0 ? '>' : '<'}0$, $f''${sA > 0 ? '<' : '>'}0$: ${MONO(sA)} and ${CURV(-sA)}\n` +
      `- $${r1}<x<${m}$: $f'${sA > 0 ? '<' : '>'}0$, $f''${sA > 0 ? '<' : '>'}0$: ${MONO(-sA)} and ${CURV(-sA)}\n` +
      `- $${m}<x<${r2}$: $f'${sA > 0 ? '<' : '>'}0$, $f''${sA > 0 ? '>' : '<'}0$: ${MONO(-sA)} and ${CURV(sA)}\n` +
      `- $x>${r2}$: $f'${sA > 0 ? '>' : '<'}0$, $f''${sA > 0 ? '>' : '<'}0$: ${MONO(sA)} and ${CURV(sA)}`;
    const name = rng.pick(['Consider the cubic', 'Let', 'We study the polynomial']);
    const lead = rng.pick(['Use the signs of $f\'$ and $f\'\'$ to decide', 'Determine', 'Without drawing the graph, decide']);
    if (type === 'multi-select') {
      const pool = ivs.flatMap((i) => [1, -1].flatMap((mo) => [1, -1].map((cu) => statement(i, mo, cu))));
      const multi = buildMulti(rng, pool, optionCount, 1);
      return {
        type,
        stem: `${name} $$f(x)=${tex}$$ ${lead} which of the following statements about its shape are true.`,
        instruction: INSTRUCTION.multi,
        options: multi.options,
        correctAnswer: multi.correctAnswer,
        explanation: `${explanation}\n\n**The statements**\n${multi.reasons.map((r) => `- **${r.id}** ${r.correct ? 'true' : 'false'}: ${r.why}`).join('\n')}`,
      };
    }
    const T = ivs[rng.int(0, 3)];
    const key = statement(T, T.d1, T.d2);
    const others = ivs.filter((i) => i !== T);
    const cands: (St & { why: string })[] = [
      { ...statement(T, T.d1, -T.d2), why: "mixes up convex and concave (reads the sign of $f''$ wrongly)." },
      { ...statement(T, -T.d1, T.d2), why: "reads the sign of $f'$ on this interval wrongly." },
      ...rng.shuffle([
        { ...statement(ivs[4], T.d1, T.d2), why: `overlooks the inflection point $x=${m}$ inside $(${r1},${r2})$.` },
        ...others.slice(0, 4).map((i) => statement(i, T.d1, T.d2)),
        statement(T, -T.d1, -T.d2),
      ]),
    ].filter((c) => !c.correct);
    const mcq = buildMcq(
      rng,
      { text: key.text },
      cands.map((c) => ({ text: c.text, why: c.why })),
      { count: optionCount },
    );
    return choiceQuestion(`${name} $$f(x)=${tex}$$ ${lead} which of the following statements about its shape is true.`, mcq, explanation);
  },
};

// =====================================================================================================================
// 4. What the sign of f' says about a transformed function g
// =====================================================================================================================

const transformed: Template = {
  id: 'monotonicity-extremes.transformed-function',
  topic: 'Monotonicity, convexity & extremes',
  title: "Sign pattern of f' around x = c and g = A + B·f, k/f, e^{±f} or B·ln f: maximum or minimum of g (convexity cannot be concluded)",
  types: ['single-choice', 'multi-select'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const c = rng.int(-4, 4);
    const fMax = rng.chance(0.5); // f' > 0 for x < c and f' < 0 for x > c
    const form = rng.pick(['lin', 'recip', 'exp', 'log'] as const);
    const positive = form === 'recip' || form === 'log' || rng.chance(0.3);
    let gTex: string, gPrime: string, flip: boolean;
    if (form === 'lin') {
      const A = rng.int(-5, 5);
      const B = rng.pick([2, 3, 4, 5, -1, -2, -3, -4, -5]);
      gTex = `${A === 0 ? '' : A}${B < 0 ? '-' : A === 0 ? '' : '+'}${Math.abs(B) === 1 ? '' : Math.abs(B)}f(x)`;
      gPrime = `g'(x)=${coefTex(B)}f'(x)`;
      flip = B < 0;
    } else if (form === 'recip') {
      const k = rng.pick([1, 2, 3, 5, -1, -2, -4]);
      gTex = `${k < 0 ? '-' : ''}\\dfrac{${Math.abs(k)}}{f(x)}`;
      gPrime = `g'(x)=${k > 0 ? '-' : ''}\\dfrac{${Math.abs(k) === 1 ? '' : Math.abs(k)}f'(x)}{f(x)^2}$, where $f(x)^2>0`;
      flip = k > 0;
    } else if (form === 'exp') {
      const neg = rng.chance(0.5);
      gTex = `e^{${neg ? '-' : ''}f(x)}`;
      gPrime = `g'(x)=${neg ? '-' : ''}f'(x)\\,e^{${neg ? '-' : ''}f(x)}$, where $e^{${neg ? '-' : ''}f(x)}>0`;
      flip = neg;
    } else {
      const B = rng.pick([1, 2, -1, -3]);
      gTex = `${coefTex(B)}\\ln\\left(f(x)\\right)`;
      gPrime = `g'(x)=${coefTex(B)}\\dfrac{f'(x)}{f(x)}$, where $f(x)>0`;
      flip = B < 0;
    }
    const gMax = fMax !== flip;
    const s1 = fMax ? '>' : '<';
    const s2 = fMax ? '<' : '>';
    const opening = rng.pick(['Let $f$ be a differentiable function', 'Suppose $f$ is a differentiable function', 'A differentiable function $f$ is given']);
    const stem =
      `${opening}${positive ? ' with $f(x)>0$ for every $x$' : ''}. Its derivative satisfies $f'(x)${s1}0$ for $x<${c}$ and $f'(x)${s2}0$ for $x>${c}$. ` +
      `Define $$g(x)=${gTex}$$ ${type === 'multi-select' ? 'Which of the following statements about $g$ must be true?' : 'Which statement about $g$ must be true?'}`;
    const gl = gMax ? '>' : '<';
    const gr = gMax ? '<' : '>';
    const explanation =
      `Differentiate: $${gPrime}$. So $g'$ has ${flip ? 'the opposite sign of' : 'the same sign as'} $f'$: ` +
      `$g'(x)${gl}0$ for $x<${c}$ and $g'(x)${gr}0$ for $x>${c}$. Hence $g$ is ${MONO(gMax ? 1 : -1)} before $x=${c}$ and ${MONO(gMax ? -1 : 1)} after it: ` +
      `$g$ has a **${gMax ? 'maximum' : 'minimum'}** at $x=${c}$ (and $g'(${c})=0$). ` +
      `Nothing is known about $f''$, so nothing can be concluded about convexity, concavity or inflection points of $g$.`;
    const ext = (max: boolean) => `$g$ has a ${max ? 'maximum' : 'minimum'} at $x=${c}$`;
    const side = (left: boolean, inc: boolean) => `$g$ is ${inc ? 'increasing' : 'decreasing'} for $x${left ? '<' : '>'}${c}$`;
    const extWhy = flip
      ? "overlooks that $g'$ has the opposite sign of $f'$ (a maximum of $f$ becomes a minimum of $g$ and vice versa)."
      : "thinks the transformation reverses the sign of the derivative, but $g'$ has the same sign as $f'$.";
    const curvWhy = "convexity depends on the sign of $g''$, about which nothing is known; a sign change of $g'$ only gives an extreme.";
    const statements = [
      { text: ext(gMax), correct: true, why: `$g'$ changes from ${gMax ? 'positive to negative' : 'negative to positive'} at $x=${c}$.` },
      { text: side(true, gMax), correct: true, why: `$g'(x)${gl}0$ for $x<${c}$.` },
      { text: side(false, !gMax), correct: true, why: `$g'(x)${gr}0$ for $x>${c}$.` },
      { text: `$g'(${c})=0$`, correct: true, why: `$f'(${c})=0$ (an extreme of the differentiable $f$), so $g'(${c})=0$ as well.` },
      { text: ext(!gMax), correct: false, why: extWhy },
      { text: side(true, !gMax), correct: false, why: `$g'(x)${gl}0$ for $x<${c}$.` },
      { text: side(false, gMax), correct: false, why: `$g'(x)${gr}0$ for $x>${c}$.` },
      { text: '$g$ is convex on its whole domain', correct: false, why: curvWhy },
      { text: '$g$ is concave on its whole domain', correct: false, why: curvWhy },
      { text: `$g$ has an inflection point at $x=${c}$`, correct: false, why: `at $x=${c}$ the first derivative changes sign (an extreme), not the second derivative.` },
      { text: '$g$ is increasing on its whole domain', correct: false, why: `$g'$ changes sign at $x=${c}$, so $g$ is not monotonic.` },
      { text: '$g$ is decreasing on its whole domain', correct: false, why: `$g'$ changes sign at $x=${c}$, so $g$ is not monotonic.` },
    ];
    if (type === 'multi-select') {
      const multi = buildMulti(rng, statements, optionCount, 1);
      return {
        type,
        stem,
        instruction: INSTRUCTION.multi,
        options: multi.options,
        correctAnswer: multi.correctAnswer,
        explanation: `${explanation}\n\n**The statements**\n${multi.reasons.map((r) => `- **${r.id}** ${r.correct ? 'true' : 'false'}: ${r.why}`).join('\n')}`,
      };
    }
    // single choice: only global statements, exactly one of which must be true
    const pick = (t: string): Choice => {
      const s = statements.find((x) => x.text === t)!;
      return { text: s.text, why: s.why };
    };
    const mcq = buildMcq(
      rng,
      { text: ext(gMax) },
      [
        pick(ext(!gMax)),
        ...rng.shuffle([
          pick('$g$ is convex on its whole domain'),
          pick('$g$ is concave on its whole domain'),
          pick(`$g$ has an inflection point at $x=${c}$`),
          pick(rng.chance(0.5) ? '$g$ is increasing on its whole domain' : '$g$ is decreasing on its whole domain'),
        ]),
      ],
      { count: optionCount },
    );
    return choiceQuestion(stem, mcq, explanation);
  },
};

export const TEMPLATES: Template[] = [countPoints, convexitySet, cubicShape, transformed];
