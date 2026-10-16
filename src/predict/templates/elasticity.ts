// Templates for the topic "Elasticity". Every key is computed in code (mathjs derivatives via mathx, or the sign rule
// El = x·f'(x)/f(x)); formula answers are checked against a mathjs elasticity at generation time. Wrong options come
// from modelled student mistakes. Independent checks (numerical differentiation, brute force): elasticity.test.ts.
import { buildMcq, buildMulti, INSTRUCTION, num, type Choice } from '../build';
import { diff, evalAt, frac, M } from '../mathx';
import type { Rng } from '../rng';
import type { Generated, Template } from '../types';
import {
  choiceQuestion,
  coefTex,
  intervalMcq,
  isNice,
  numericQuestion,
  numTex,
  positiveIntervals,
  powTex,
  scaledFallback,
  sumTex,
  texToExpr,
} from './_econ';

/** Elasticity v·f_v/f of a mathjs expression at a point (symbolic derivative by mathjs). */
export function elasticityAt(expr: string, v: string, scope: Record<string, number>): number {
  return (scope[v] * evalAt(diff(expr, v), scope)) / evalAt(expr, scope);
}

/** Guard: a formula answer (LaTeX) must equal the mathjs elasticity at a few points, otherwise the template is wrong. */
function assertFormula(keyTex: string, expr: string, v: string, points: Record<string, number>[]) {
  const code = M.parse(texToExpr(keyTex)).compile();
  for (const s of points) {
    const want = elasticityAt(expr, v, s);
    const got = code.evaluate({ ...s }) as number;
    if (!(Math.abs(want - got) <= 1e-7 * Math.max(1, Math.abs(want)))) throw new Error(`elasticity formula ${keyTex} ≠ ${want} at ${JSON.stringify(s)}`);
  }
}

/** c·body as LaTeX: 1 → body, −1 → −body, otherwise "c\cdot body" (negative c gives a leading minus). */
function scaled(c: number, body: string): string {
  if (c === 1) return body;
  if (c === -1) return `-${body}`;
  return c < 0 ? `-${numTex(-c)}\\cdot ${body}` : `${numTex(c)}\\cdot ${body}`;
}

/** Option text for a formula. */
const opt = (tex: string, why?: string): Choice => ({ text: `$${tex}$`, ...(why ? { why } : {}) });

/** Decimal places needed (0..3) to write x exactly, or 2 when it has more. */
function dpOf(x: number): number {
  for (let d = 0; d <= 3; d++) if (isNice(x, d)) return d;
  return 2;
}

// =====================================================================================================================
// 1. Partial elasticity of a function that is a power function in the variable asked.
// =====================================================================================================================

interface PartialCase {
  fName: string;
  args: string;
  v: string;
  fTex: string;
  keyTex: string;
  key: number | null;
  mistakes: Choice[];
  steps: string;
  context?: string;
}

function partialCase(rng: Rng, fam: 'diff' | 'root' | 'cobb' | 'expo'): PartialCase {
  if (fam === 'diff') {
    const v = rng.pick(['x', 'y']);
    const w = v === 'x' ? 'y' : 'x';
    const n = rng.int(2, 5);
    const m = rng.pick([2, 3, 4].filter((k) => k !== n));
    const A = rng.int(2, 9);
    const B = rng.int(1, 6) * rng.sign();
    const t2 = v === 'x' ? powTex('x', n) + powTex('y', m) : powTex('x', m) + powTex('y', n);
    const fTex = sumTex([
      [A, powTex(v, n)],
      [B, t2],
    ]);
    const expr = v === 'x' ? `${A}*x^${n} + (${B})*x^${n}*y^${m}` : `${A}*y^${n} + (${B})*x^${m}*y^${n}`;
    const key = Math.round(elasticityAt(expr, v, { x: 1.7, y: 0.6 }) * 1e6) / 1e6;
    const fvTex = sumTex([
      [A * n, powTex(v, n - 1)],
      [B * n, v === 'x' ? powTex('x', n - 1) + powTex('y', m) : powTex('x', m) + powTex('y', n - 1)],
    ]);
    const inner = sumTex([
      [A, ''],
      [B, powTex(w, m)],
    ]);
    return {
      fName: 'f',
      args: 'x,y',
      v,
      fTex,
      key,
      keyTex: numTex(key),
      mistakes: rng.shuffle([
        opt(`${n}${v}`, `keeping a factor $${v}$: in $\\frac{${v}}{f}\\,f_{${v}}$ all powers of $${v}$ cancel, so no $${v}$ is left.`),
        opt(fvTex, `giving the partial derivative $f_{${v}}$ instead of the elasticity $\\frac{${v}}{f}\\,f_{${v}}$.`),
        opt(`${m}`, `using the exponent of the other variable $${w}$.`),
        opt(frac(1, n), `inverting the elasticity (computing $\\frac{f}{${v}\\,f_{${v}}}$).`),
        opt(`${n - 1}`, `using the exponent $${n}-1$ that appears after differentiating.`),
        opt(`${n * A}`, `multiplying the exponent by the coefficient $${A}$.`),
        opt(`${n}xy`, `keeping factors $x$ and $y$ that cancel in $\\frac{${v}}{f}\\,f_{${v}}$.`),
      ]),
      steps:
        `For fixed $${w}$ the function is a power function of $${v}$: $$f(x,y)=${powTex(v, n)}\\left(${inner}\\right)$$` +
        `so $f_{${v}}=${n}${powTex(v, n - 1)}\\left(${inner}\\right)$ and $$El_{${v}}f(x,y)=\\frac{${v}}{f(x,y)}\\,f_{${v}}(x,y)=\\frac{${v}\\cdot ${n}${powTex(v, n - 1)}\\left(${inner}\\right)}{${powTex(v, n)}\\left(${inner}\\right)}=${n}.$$` +
        `The partial elasticity of a power function with respect to its variable is the exponent.`,
    };
  }
  if (fam === 'root') {
    const k = rng.pick([2, 2, 3]);
    const a = rng.int(1, 7);
    const b = rng.pick([1, 2, 3, 4, 5].filter((e) => e !== a));
    const v = rng.pick(['x', 'y']);
    const w = v === 'x' ? 'y' : 'x';
    const inside = powTex('x', a) + powTex('y', b);
    const fTex = k === 2 ? `\\sqrt{${inside}}` : `\\sqrt[3]{${inside}}`;
    const expr = `(x^${a}*y^${b})^(1/${k})`;
    const ev = v === 'x' ? a : b;
    const ew = v === 'x' ? b : a;
    const key = Math.round(elasticityAt(expr, v, { x: 1.3, y: 2.2 }) * 1e6) / 1e6;
    const rootWord = k === 2 ? 'square root' : 'cube root';
    return {
      fName: 'f',
      args: 'x,y',
      v,
      fTex,
      key,
      keyTex: numTex(key),
      mistakes: rng.shuffle([
        opt(`${ev}`, `forgetting the ${rootWord}: the exponent of $${v}$ inside the root is divided by ${k}.`),
        opt(numTex(ew / k), `using the exponent of the other variable $${w}$.`),
        opt(numTex(ev * k), `multiplying by the index of the root instead of dividing by it.`),
        opt(numTex(k / ev), `inverting the elasticity (computing $\\frac{f}{${v}\\,f_{${v}}}$).`),
        opt(numTex(ev / k - 1), `subtracting 1 from the exponent, as when differentiating.`),
        opt(`${coefTex(ev / k)}${v}`, `keeping a factor $${v}$ that cancels in $\\frac{${v}}{f}\\,f_{${v}}$.`),
        opt(numTex((a + b) / k), `adding the exponents of both variables (that is the sum of the two partial elasticities).`),
      ]),
      steps:
        `Write the root as a power: $$f(x,y)=\\left(${inside}\\right)^{${frac(1, k)}}=${powTex('x', a / k)}${powTex('y', b / k)}.$$` +
        `For fixed $${w}$ this is a power function of $${v}$ with exponent $${numTex(ev / k)}$, so $$El_{${v}}f(x,y)=\\frac{${v}}{f}\\,f_{${v}}=${numTex(ev / k)}.$$`,
    };
  }
  if (fam === 'cobb') {
    const exps = [0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8];
    const [a, b] = rng.sample(exps, 2);
    const A = rng.int(2, 20);
    const v = rng.pick(['K', 'L']);
    const w = v === 'K' ? 'L' : 'K';
    const ev = v === 'K' ? a : b;
    const ew = v === 'K' ? b : a;
    const fTex = `${A}K^{${num(a)}}L^{${num(b)}}`;
    const expr = `${A}*K^${a}*L^${b}`;
    const key = Math.round(elasticityAt(expr, v, { K: 3.1, L: 1.7 }) * 1e6) / 1e6;
    const ctx = rng.pick([
      { firm: 'a bakery', out: 'loaves', K: 'oven hours', L: 'labour hours' },
      { firm: 'a bicycle workshop', out: 'repaired bikes', K: 'machine hours', L: 'mechanic hours' },
      { firm: 'a small brewery', out: 'litres of beer', K: 'brewing-kettle hours', L: 'brewer hours' },
      { firm: 'a print shop', out: 'printed posters', K: 'printer hours', L: 'staff hours' },
    ]);
    return {
      fName: 'Q',
      args: 'K,L',
      v,
      fTex,
      key,
      keyTex: num(key),
      context: `The daily output (in ${ctx.out}) of ${ctx.firm} is modelled by the Cobb–Douglas function $$Q(K,L)=${fTex},$$ where $K$ is the number of ${ctx.K} and $L$ the number of ${ctx.L} ($K,L>0$).`,
      mistakes: rng.shuffle([
        opt(num(ew), `using the exponent of the other input $${w}$.`),
        opt(num(a + b), `adding both exponents (that measures returns to scale, not the partial elasticity).`),
        opt(num(A * ev), `multiplying the exponent by the constant $${A}$.`),
        opt(num(ev - 1), `using the exponent $${num(ev)}-1$ of the partial derivative.`),
        opt(num(1 / ev, 2), `inverting the elasticity.`),
        opt(`${num(ev)}${v}`, `keeping a factor $${v}$ that cancels in $\\frac{${v}}{Q}\\,Q_{${v}}$.`),
        opt(num(1 - ev), `using $1-${num(ev)}$ instead of the exponent.`),
      ]),
      steps:
        `For fixed $${w}$, $Q$ is a power function of $${v}$: $Q_{${v}}=${num(A * ev, 4)}${v === 'K' ? `K^{${num(a - 1)}}L^{${num(b)}}` : `K^{${num(a)}}L^{${num(b - 1)}}`}$, so ` +
        `$$El_{${v}}Q=\\frac{${v}}{Q}\\,Q_{${v}}=\\frac{${v}\\cdot ${num(ev)}\\cdot ${A}${v === 'K' ? `K^{${num(a - 1)}}L^{${num(b)}}` : `K^{${num(a)}}L^{${num(b - 1)}}`}}{${fTex}}=${num(ev)}.$$` +
        `In a Cobb–Douglas function each partial elasticity is the exponent of that input.`,
    };
  }
  // expo: f(x,y) = A x^a e^{cy}, elasticity with respect to y is c·y
  const A = rng.int(2, 9);
  const a = rng.int(2, 5);
  const c = rng.int(1, 4) * rng.sign();
  const fTex = `${A}x^{${a}}e^{${coefTex(c)}y}`;
  const expr = `${A}*x^${a}*exp(${c}*y)`;
  const y0 = 0.7;
  const cc = Math.round((elasticityAt(expr, 'y', { x: 1.3, y: y0 }) / y0) * 1e6) / 1e6;
  return {
    fName: 'f',
    args: 'x,y',
    v: 'y',
    fTex,
    key: null,
    keyTex: `${coefTex(cc)}y`,
    mistakes: rng.shuffle([
      opt(`${c}`, `forgetting to multiply by $y$ in $\\frac{y}{f}\\,f_y$.`),
      opt(`${a}`, `giving the elasticity with respect to $x$ instead of $y$.`),
      opt(`${A * c}x^{${a}}e^{${coefTex(c)}y}`, `giving the partial derivative $f_y$ instead of the elasticity.`),
      opt(`${a}${c < 0 ? '-' : '+'}${coefTex(Math.abs(c))}y`, `adding the elasticities with respect to $x$ and $y$.`),
      opt(sfrac(c, '', 'y'), `dividing by $y$ instead of multiplying by $y$.`),
      opt(`${coefTex(c)}xy`, `keeping a factor $x$ that cancels.`),
    ]),
    steps:
      `For fixed $x$: $f_y=${A}x^{${a}}\\cdot(${c})\\,e^{${coefTex(c)}y}$ (chain rule), so ` +
      `$$El_y f(x,y)=\\frac{y}{f}\\,f_y=\\frac{y\\cdot(${c})\\cdot ${A}x^{${a}}e^{${coefTex(c)}y}}{${fTex}}=${coefTex(c)}y.$$` +
      `Unlike a power function, the elasticity of an exponential depends on the point.`,
  };
}

const partialPower: Template = {
  id: 'elasticity.partial-power',
  topic: 'Elasticity',
  title: 'Partial elasticity of f(x,y) that is a power function of the variable asked (or Cobb–Douglas / exponential factor)',
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const fam = rng.pick(type === 'numeric' ? (['diff', 'root', 'cobb'] as const) : (['diff', 'root', 'cobb', 'expo'] as const));
    const c = partialCase(rng, fam);
    const { v, fTex, fName, args } = c;
    let stem: string;
    if (c.context) {
      stem =
        c.context +
        (type === 'numeric'
          ? ` Calculate the partial elasticity $El_{${v}}Q(K,L)$ of output with respect to $${v}$.`
          : ` Which expression gives the partial elasticity $El_{${v}}Q(K,L)$ of output with respect to $${v}$?`);
    } else {
      stem = rng.pick([
        `Consider the function $$${fName}(${args})=${fTex}$$ for $x>0$ and $y>0$. Determine the partial elasticity of $f$ with respect to $${v}$.`,
        `Let $${fName}(${args})=${fTex}$, with $x>0$ and $y>0$. ${type === 'numeric' ? `What is the value of $El_{${v}}f(x,y)$, the elasticity of $f$ with respect to $${v}$?` : `Which expression equals $El_{${v}}f(x,y)$, the elasticity of $f$ with respect to $${v}$?`}`,
        `Calculate the partial elasticity $El_{${v}}f(x,y)$ of the function $$${fName}(${args})=${fTex}\\qquad(x>0,\\ y>0).$$`,
      ]);
    }
    const explanation = `The partial elasticity with respect to $${v}$ is $El_{${v}}${fName}=\\dfrac{${v}}{${fName}}\\cdot\\dfrac{\\partial ${fName}}{\\partial ${v}}$.\n\n${c.steps}`;
    if (type === 'numeric') {
      const key = c.key as number;
      // integers as whole numbers; otherwise at least 2 decimals (a 1-decimal tolerance of 0.06 would also accept a
      // neighbouring exponent such as 0.25 for 0.2)
      const dp = Number.isInteger(key) ? 0 : Math.max(2, dpOf(key));
      return numericQuestion(stem, key, dp, explanation);
    }
    const mcq = buildMcq(rng, opt(c.keyTex), c.mistakes, {
      count: optionCount,
      fallback: (i) => opt(`${i + 6}${v}`),
    });
    return choiceQuestion(stem, mcq, explanation);
  },
};

// =====================================================================================================================
// 2. Value of the price elasticity of a demand function at a given price (or the interval for a 1 % price change).
// =====================================================================================================================

interface DemandCase {
  /** Name of the demand variable in the stem. */
  q: string;
  /** What is shown: "d(p)=..." or a price–demand relation "p=...". */
  relTex: string;
  /** Demand as a mathjs expression in p. */
  expr: string;
  p0: number;
  /** LaTeX of the derivative (for the worked solution). */
  derivTex: string;
  /** Extra solution step (solving the relation for q). */
  solveNote?: string;
  wrong?: { E: number; why: string };
  /** Price where demand reaches 0 (upper end of the sensible price range). */
  pMax: number;
  /** Closed-form elasticity at p0, only used to pick parameters with a short decimal answer quickly. */
  quick: number;
}

const DEMAND_FAMS = ['ratio-sqrt', 'lin-sqrt', 'quad', 'hyper', 'inverse', 'log'] as const;
type DemandFam = (typeof DEMAND_FAMS)[number];

function demandCase(rng: Rng, fam: DemandFam): DemandCase {
  switch (fam) {
    case 'ratio-sqrt': {
      const A = rng.pick([12, 18, 20, 24, 30, 36, 40, 45, 60, 72]);
      const B = rng.int(1, 4);
      const r = rng.int(2, 9);
      const p0 = r * r;
      const denTex = sumTex([
        [B, ''],
        [1, '\\sqrt{p}'],
      ]);
      return {
        q: 'd',
        relTex: `d(p)=\\dfrac{${A}}{${denTex}}`,
        expr: `${A}/(${B} + sqrt(p))`,
        p0,
        derivTex: `d'(p)=-\\dfrac{${A}}{\\left(${denTex}\\right)^{2}}\\cdot\\dfrac{1}{2\\sqrt{p}}`,
        quick: -r / (2 * (B + r)),
        wrong: { E: -p0 / (B + r), why: 'forgetting the inner derivative $\\frac{1}{2\\sqrt{p}}$ of $\\sqrt{p}$ (chain rule).' },
        pMax: 1e4,
      };
    }
    case 'lin-sqrt': {
      const B = rng.pick([1, 2, 3, 4, 1.5, 2.5]);
      const r = rng.int(2, 10);
      const A = Math.ceil(B * r) + rng.int(4, 60);
      const dTex = sumTex([
        [A, ''],
        [-B, '\\sqrt{p}'],
      ]);
      return {
        q: 'd',
        relTex: `d(p)=${dTex}`,
        expr: `${A} - ${B}*sqrt(p)`,
        p0: r * r,
        derivTex: `d'(p)=-\\dfrac{${numTex(B)}}{2\\sqrt{p}}`,
        quick: -(B * r) / 2 / (A - B * r),
        wrong: { E: (-B * r * r) / (A - B * r), why: 'differentiating $\\sqrt{p}$ as if it were $p$.' },
        pMax: (A / B) ** 2,
      };
    }
    case 'quad': {
      const B = rng.pick([0.5, 1, 2, 3, 0.2]);
      const p0 = rng.int(2, 10);
      const A = Math.ceil(B * p0 * p0 * 1.2) + rng.int(5, 80);
      return {
        q: 'd',
        relTex: `d(p)=${sumTex([
          [A, ''],
          [-B, 'p^{2}'],
        ])}`,
        expr: `${A} - ${B}*p^2`,
        p0,
        derivTex: `d'(p)=${-2 * B === -1 ? '-' : num(-2 * B, 4)}p`,
        quick: (-2 * B * p0 * p0) / (A - B * p0 * p0),
        wrong: { E: (-B * p0 * p0) / (A - B * p0 * p0), why: 'differentiating $p^{2}$ as $p$ (forgetting the factor 2).' },
        pMax: Math.sqrt(A / B),
      };
    }
    case 'hyper': {
      const A = rng.pick([100, 120, 150, 200, 240, 300, 360, 400, 500, 600]);
      const B = rng.int(1, 20);
      const p0 = rng.int(2, 30);
      return {
        q: 'd',
        relTex: `d(p)=\\dfrac{${A}}{p+${B}}`,
        expr: `${A}/(p + ${B})`,
        p0,
        derivTex: `d'(p)=-\\dfrac{${A}}{\\left(p+${B}\\right)^{2}}`,
        quick: -p0 / (p0 + B),
        wrong: { E: -p0, why: 'not squaring the denominator in $d\'(p)$.' },
        pMax: 1e4,
      };
    }
    case 'inverse': {
      const c = rng.pick([2, 4, 5, 10]);
      const s = rng.int(3, 20);
      const m = rng.pick([1, 2, 4, 5, 10, 20]);
      const j = rng.int(5, 120);
      const K = s * s + m * j;
      const p0 = c * s;
      const wrongDen = K - (p0 * p0) / c;
      return {
        q: 'q',
        relTex: `p=${c}\\sqrt{${K}${m === 1 ? '-q' : `-${m}q`}}`,
        expr: `(${K} - (p/${c})^2)/${m}`,
        p0,
        derivTex: `q'(p)=-\\dfrac{2p}{${c * c}${m === 1 ? '' : `\\cdot ${m}`}}`,
        solveNote: `First solve the relation for the demand: $\\left(\\frac{p}{${c}}\\right)^{2}=${K}${m === 1 ? '-q' : `-${m}q`}$, so $$q(p)=\\frac{${K}-p^{2}/${c * c}}{${m}}.$$`,
        quick: (-2 * s * s) / (m * j),
        wrong: wrongDen > 0 ? { E: (((-2 * p0) / (c * m)) * p0) / (wrongDen / m), why: `solving for $q$ with $p^{2}/${c}$ instead of $p^{2}/${c * c}$ (forgetting to square ${c}).` } : undefined,
        pMax: c * Math.sqrt(K),
      };
    }
    case 'log': {
      const B = rng.int(2, 9);
      const p0 = rng.int(2, 30);
      const A = Math.round(B * Math.log(p0)) + rng.int(8, 50);
      return {
        q: 'd',
        relTex: `d(p)=${A}-${B}\\ln\\left(p\\right)`,
        expr: `${A} - ${B}*log(p)`,
        p0,
        derivTex: `d'(p)=-\\dfrac{${B}}{p}`,
        quick: -B / (A - B * Math.log(p0)),
        wrong: { E: (-B * p0) / (A - B * Math.log(p0)), why: 'differentiating $\\ln(p)$ as $1$ instead of $\\frac{1}{p}$.' },
        pMax: Math.exp(A / B),
      };
    }
  }
}

const GOODS = [
  { seller: 'A cider farm', good: 'apple juice', unit: 'litres', per: 'litre' },
  { seller: 'A ferry company', good: 'day tickets', unit: 'tickets', per: 'ticket' },
  { seller: 'An olive grove', good: 'olive oil', unit: 'litres', per: 'litre' },
  { seller: 'A bakery', good: 'sourdough loaves', unit: 'loaves', per: 'loaf' },
  { seller: 'A cheese farm', good: 'goat cheese', unit: 'kilograms', per: 'kilogram' },
  { seller: 'A local roastery', good: 'coffee beans', unit: 'kilograms', per: 'kilogram' },
];

const valueAtPoint: Template = {
  id: 'elasticity.value-at-point',
  topic: 'Elasticity',
  title: 'Price elasticity of a demand function at a given price (value, or interval for the % change)',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const fam = rng.pick(DEMAND_FAMS);
    // a sensible elasticity (not −115 at a demand of 5 units), preferably with at most 3 decimals (2 for numeric
    // answers, so that no key ends in an exact half); closed form, for speed
    const sensible = (x: DemandCase) => Math.abs(x.quick) >= 0.05 && Math.abs(x.quick) <= 4;
    const nd = type === 'numeric' ? 2 : 3;
    let c = demandCase(rng, fam);
    for (let tries = 0; tries < 150 && !(sensible(c) && isNice(c.quick, nd)); tries++) c = demandCase(rng, fam);
    for (let tries = 0; tries < 300 && !sensible(c); tries++) c = demandCase(rng, fam);
    if (!sensible(c)) throw new Error(`value-at-point: no sensible elasticity for ${fam}`);
    // the key: computed with the mathjs derivative (and cross-checked against the closed form)
    const E = elasticityAt(c.expr, 'p', { p: c.p0 });
    if (Math.abs(E - c.quick) > 1e-9 * Math.max(1, Math.abs(E))) throw new Error(`value-at-point: closed form ${c.quick} ≠ ${E}`);
    const d0 = evalAt(c.expr, { p: c.p0 });
    const d1 = evalAt(diff(c.expr, 'p'), { p: c.p0 });
    const g = rng.pick(GOODS);
    const q = c.q;
    const intro =
      q === 'd'
        ? `${g.seller} sells ${g.good}. The daily demand $d$ (in ${g.unit}) depends on the price $p$ (in euros per ${g.per}) as $$${c.relTex}$$`
        : `For ${g.good}, the price $p$ (in euros per ${g.per}) and the weekly demand $q$ (in ${g.unit}) are related by $$${c.relTex}$$`;
    const explanation =
      (c.solveNote ? c.solveNote + '\n\n' : '') +
      `The price elasticity of demand is $$El_p\\,${q}(p)=\\frac{p\\,${q}'(p)}{${q}(p)}.$$` +
      `Here $${c.derivTex}$. At $p=${c.p0}$: $${q}(${c.p0})=${num(d0, 4)}$ and $${q}'(${c.p0})=${num(d1, 5)}$, so ` +
      `$$El_p\\,${q}(${c.p0})=\\frac{${c.p0}\\cdot(${num(d1, 5)})}{${num(d0, 4)}}=${num(E, 4)}.$$`;
    const mistakes = [
      { value: -E, why: `dropping the minus sign: demand falls when the price rises, so the elasticity is negative.` },
      { value: 1 / E, why: `inverting the elasticity (computing $\\frac{${q}(p)}{p\\,${q}'(p)}$).` },
      { value: d1, why: `giving the derivative $${q}'(${c.p0})$ instead of the elasticity.` },
      { value: d1 / d0, why: `forgetting to multiply by $p$ (this is $\\frac{${q}'(p)}{${q}(p)}$).` },
      ...(c.wrong ? [{ value: c.wrong.E, why: c.wrong.why }] : []),
      { value: c.p0 * d1, why: `forgetting to divide by $${q}(${c.p0})$.` },
    ];
    const mode = type === 'numeric' ? 'value' : rng.pick(['value', 'value', 'interval'] as const);
    if (type === 'numeric') {
      const stem = intro + ` Calculate the price elasticity of demand at $p=${c.p0}$.`;
      // an elasticity that ends in an exact half (e.g. −0.625) may be rounded either way
      const half = Math.abs(Math.abs(E * 100) % 1 - 0.5) < 1e-9;
      return numericQuestion(stem, E, 2, explanation + ` Rounded to two decimals: $${num(E, 2)}$.`, half ? [E - 0.005, E + 0.005] : undefined);
    }
    if (mode === 'interval') {
      const stem =
        intro +
        ` Suppose the price is raised by 1% from $p=${c.p0}$. Demand then drops by approximately $k$ percent. Which interval contains $k$?`;
      const im = intervalMcq(
        rng,
        -E,
        mistakes.map((m) => ({ value: Math.abs(m.value), why: m.why })),
        optionCount,
        { format: positiveIntervals, kind: 'small' },
      );
      if (im) {
        return choiceQuestion(
          stem,
          im,
          explanation + `\n\nSo a 1% price increase lowers demand by approximately $k=${num(-E, 4)}$ percent.`,
        );
      }
    }
    const stem = intro + rng.pick([` What is the price elasticity of demand at $p=${c.p0}$?`, ` Determine the elasticity of demand with respect to the price at $p=${c.p0}$.`]);
    const fmt = (x: number) => `$${num(x, 3)}$`;
    const mcq = buildMcq(
      rng,
      { text: fmt(E), value: E },
      rng.shuffle(mistakes).map((m) => ({ text: fmt(m.value), value: m.value, why: m.why })),
      { count: optionCount, order: 'ascending', fallback: scaledFallback(E, fmt, 0.3), epsilon: 0.05 },
    );
    return choiceQuestion(stem, mcq, explanation);
  },
};

// =====================================================================================================================
// 3. The elasticity as a formula in p.
// =====================================================================================================================

interface FormulaCase {
  name: 'd' | 's';
  fTex: string;
  expr: string;
  keyTex: string;
  mistakes: Choice[];
  steps: string;
  /** Prices to check the formula at (where the function is positive). */
  points: number[];
  pre?: string;
  /** Demand that rises with the price (only sensible for status goods). */
  luxury?: boolean;
}

const FORMULA_FAMS = ['lin-sqrt', 'supply-power', 'power-demand', 'log', 'exp', 'linear', 'hyper'] as const;
type FormulaFam = (typeof FORMULA_FAMS)[number];

/** -\dfrac{c·numBody}{den} with the sign of c in front. */
function sfrac(c: number, numBody: string, den: string): string {
  const mag = Math.abs(c);
  const numer = numBody === '' ? numTex(mag) : (mag === 1 ? '' : numTex(mag)) + numBody;
  return `${c < 0 ? '-' : ''}\\dfrac{${numer}}{${den}}`;
}

function formulaCase(rng: Rng, fam: FormulaFam): FormulaCase {
  switch (fam) {
    case 'lin-sqrt': {
      const A = rng.int(20, 90);
      const B = rng.pick([1, 2, 3, 1.5, 2.5, 0.5]);
      const dTex = sumTex([
        [A, ''],
        [-B, '\\sqrt{p}'],
      ]);
      return {
        name: 'd',
        fTex: dTex,
        expr: `${A} - ${B}*sqrt(p)`,
        keyTex: scaled(-B / 2, `\\dfrac{\\sqrt{p}}{${dTex}}`),
        mistakes: [
          opt(scaled(B / 2, `\\dfrac{\\sqrt{p}}{${dTex}}`), "dropping the minus sign of $d'(p)$."),
          opt(scaled(-2 / B, `\\dfrac{${dTex}}{\\sqrt{p}}`), 'inverting the elasticity (computing $\\frac{d(p)}{p\\,d\'(p)}$).'),
          opt(scaled(-B / 2, `\\dfrac{1}{\\sqrt{p}\\left(${dTex}\\right)}`), "forgetting to multiply by $p$ (this is $\\frac{d'(p)}{d(p)}$)."),
          opt(scaled(-B / 2, '\\sqrt{p}'), 'forgetting to divide by $d(p)$.'),
          opt(sfrac(-B, 'p', dTex), 'differentiating $\\sqrt{p}$ as if it were $p$.'),
          opt(sfrac(-B / 2, '', '\\sqrt{p}'), "giving the derivative $d'(p)$ instead of the elasticity."),
        ],
        steps:
          `$d'(p)=-\\dfrac{${numTex(B)}}{2\\sqrt{p}}$, so $$El_p\\,d(p)=\\frac{p\\,d'(p)}{d(p)}=\\frac{-${numTex(B)}\\,p/(2\\sqrt{p})}{${dTex}}=${scaled(-B / 2, `\\frac{\\sqrt{p}}{${dTex}}`)}$$` +
          `using $\\frac{p}{\\sqrt{p}}=\\sqrt{p}$.`,
        points: [1, 4, 0.5 * (A / B) ** 2 * 0.5],
      };
    }
    case 'supply-power': {
      const C = rng.pick([2, 3, 4, 5, 6, 1.5, 2.5]);
      const form = rng.pick([
        { k: 1 / 2, tex: '\\sqrt{p}' },
        { k: 3 / 2, tex: 'p\\sqrt{p}' },
        { k: 1 / 3, tex: '\\sqrt[3]{p}' },
        { k: 2 / 3, tex: '\\sqrt[3]{p^{2}}' },
        { k: 2, tex: 'p^{2}' },
        { k: 5 / 2, tex: 'p^{2}\\sqrt{p}' },
      ]);
      const k = form.k;
      const sTex = `${numTex(C)}${form.tex}`;
      const A = rng.int(20, 60);
      const B = rng.pick([1, 2, 3, 1.5]);
      return {
        name: 's',
        fTex: sTex,
        expr: `${C}*p^(${k})`,
        keyTex: numTex(k),
        pre: `demand $d(p)=${sumTex([
          [A, ''],
          [-B, '\\sqrt{p}'],
        ])}$ and supply $s(p)=${sTex}$`,
        mistakes: [
          opt(numTex(C * k), `multiplying the exponent by the coefficient $${numTex(C)}$.`),
          opt(numTex(C), 'giving the coefficient instead of the exponent.'),
          opt(numTex(k - 1), "using the exponent of $s'(p)$."),
          opt(numTex(1 / k), 'inverting the elasticity.'),
          opt(`${numTex(C * k)}${powTex('p', k - 1)}`, "giving the derivative $s'(p)$ instead of the elasticity."),
          opt(`-${numTex(k)}`, 'a sign error: supply increases with the price, so its elasticity is positive.'),
        ],
        steps:
          `Write $s(p)=${numTex(C)}p^{${numTex(k)}}$, a power function. Then $s'(p)=${numTex(C * k)}${powTex('p', k - 1)}$ and ` +
          `$$El_p\\,s(p)=\\frac{p\\,s'(p)}{s(p)}=\\frac{${numTex(C * k)}p^{${numTex(k)}}}{${numTex(C)}p^{${numTex(k)}}}=${numTex(k)}.$$` +
          `The elasticity of a power function is its exponent, whatever the coefficient.`,
        points: [1, 2.5, 9],
      };
    }
    case 'power-demand': {
      const A = rng.pick([5, 8, 10, 12, 20, 50]);
      const form = rng.pick([
        { k: 3 / 2, tex: `\\dfrac{${A}}{p\\sqrt{p}}`, root: 1 / 2 },
        { k: 5 / 2, tex: `\\dfrac{${A}}{p^{2}\\sqrt{p}}`, root: 1 / 2 },
        { k: 1 / 2, tex: `\\dfrac{${A}}{\\sqrt{p}}`, root: 1 / 2 },
        { k: 4 / 3, tex: `\\dfrac{${A}}{p\\sqrt[3]{p}}`, root: 1 / 3 },
        { k: 2, tex: `\\dfrac{${A}}{p^{2}}`, root: 0 },
      ]);
      const k = form.k;
      return {
        name: 'd',
        fTex: form.tex,
        expr: `${A}*p^(-${k})`,
        keyTex: numTex(-k),
        mistakes: [
          opt(numTex(k), 'forgetting the minus sign of the negative exponent.'),
          opt(`${numTex(-k)}\\cdot\\dfrac{1}{p}`, "forgetting to multiply by $p$ (this is $\\frac{d'(p)}{d(p)}$)."),
          opt(numTex(-1 / k), 'inverting the elasticity.'),
          ...(form.root ? [opt(numTex(-(k - form.root)), 'ignoring the root in the denominator.')] : []),
          opt(`${numTex(-k * A)}${powTex('p', -k - 1)}`, "giving the derivative $d'(p)$ instead of the elasticity."),
          opt(numTex(-(k + 1)), "using the exponent of $d'(p)$."),
        ],
        steps:
          `Write $d(p)=${A}p^{${numTex(-k)}}$, a power function. Then $$El_p\\,d(p)=\\frac{p\\,d'(p)}{d(p)}=\\frac{p\\cdot\\left(${numTex(-k * A)}p^{${numTex(-k - 1)}}\\right)}{${A}p^{${numTex(-k)}}}=${numTex(-k)}.$$` +
          `A power function has constant elasticity equal to its exponent.`,
        points: [0.5, 2, 7],
      };
    }
    case 'log': {
      const B = rng.int(2, 9) * rng.sign();
      const A = rng.int(10, 60);
      const dTex = sumTex([
        [A, ''],
        [B, '\\ln\\left(p\\right)'],
      ]);
      return {
        name: 'd',
        fTex: dTex,
        expr: `${A} + (${B})*log(p)`,
        keyTex: sfrac(B, '', dTex),
        mistakes: [
          opt(sfrac(B, '', 'p'), "giving the derivative $d'(p)$ instead of the elasticity."),
          opt(sfrac(B, '', `p\\left(${dTex}\\right)`), "forgetting to multiply by $p$ (this is $\\frac{d'(p)}{d(p)}$)."),
          opt(sfrac(Math.sign(B), dTex, String(Math.abs(B))), 'inverting the elasticity.'),
          opt(sfrac(B, 'p', dTex), 'differentiating $\\ln(p)$ as $1$ instead of $\\frac{1}{p}$.'),
          opt('\\dfrac{p^{2}}{' + dTex + '}', "multiplying by $p$ twice instead of using $d'(p)$."),
          opt(sfrac(1, '', '\\ln\\left(p\\right)'), `dropping the constant ${A}.`),
        ],
        steps:
          `$d'(p)=${sfrac(B, '', 'p')}$, so $$El_p\\,d(p)=\\frac{p\\,d'(p)}{d(p)}=\\frac{p\\cdot\\left(${sfrac(B, '', 'p')}\\right)}{${dTex}}=${sfrac(B, '', dTex)}=${sfrac(B, '', 'd(p)')}.$$`,
        points: [1.5, 3, 6],
        luxury: B > 0,
      };
    }
    case 'exp': {
      const A = rng.pick([50, 80, 100, 120, 200, 500]);
      const k = rng.pick([0.02, 0.04, 0.05, 0.1, 0.2, 0.25, 0.5]);
      const fTex = `${A}e^{-${num(k)}p}`;
      return {
        name: 'd',
        fTex,
        expr: `${A}*exp(-${k}*p)`,
        keyTex: `-${num(k)}p`,
        mistakes: [
          opt(`-${num(k)}`, 'forgetting to multiply by $p$.'),
          opt(`${num(k)}p`, 'dropping the minus sign from the chain rule.'),
          opt(`-${num(A * k, 4)}e^{-${num(k)}p}`, "giving the derivative $d'(p)$ instead of the elasticity."),
          opt(`-\\dfrac{${num(k)}}{p}`, 'dividing by $p$ instead of multiplying by $p$.'),
          opt(`-\\dfrac{1}{${num(k)}p}`, 'inverting the elasticity.'),
          opt(`-${num(A * k, 4)}p\\,e^{-${num(k)}p}`, 'forgetting to divide by $d(p)$.'),
        ],
        steps: `$d'(p)=-${num(A * k, 4)}e^{-${num(k)}p}$ (chain rule), so $$El_p\\,d(p)=\\frac{p\\,d'(p)}{d(p)}=\\frac{-${num(A * k, 4)}p\\,e^{-${num(k)}p}}{${fTex}}=-${num(k)}p.$$`,
        points: [1, 5, 12],
      };
    }
    case 'linear': {
      const B = rng.pick([1, 2, 3, 4, 5, 0.5]);
      const A = rng.int(20, 200);
      const dTex = sumTex([
        [A, ''],
        [-B, 'p'],
      ]);
      return {
        name: 'd',
        fTex: dTex,
        expr: `${A} - ${B}*p`,
        keyTex: sfrac(-B, 'p', dTex),
        mistakes: [
          opt(numTex(-B), "giving the derivative $d'(p)$ instead of the elasticity."),
          opt(sfrac(B, 'p', dTex), "dropping the minus sign of $d'(p)$."),
          opt(`-\\dfrac{${dTex}}{${coefTex(B)}p}`, 'inverting the elasticity.'),
          opt(sfrac(-B, '', dTex), 'forgetting to multiply by $p$.'),
          opt(sfrac(-B, 'p', `${A}`), `dividing by the intercept ${A} instead of by $d(p)$.`),
        ],
        steps: `$d'(p)=${numTex(-B)}$, so $$El_p\\,d(p)=\\frac{p\\,d'(p)}{d(p)}=${sfrac(-B, 'p', dTex)}.$$ A linear demand function does not have a constant elasticity.`,
        points: [1, A / B / 3, A / B / 1.5],
      };
    }
    case 'hyper': {
      const A = rng.pick([60, 100, 150, 200, 400]);
      const B = rng.int(2, 15);
      return {
        name: 'd',
        fTex: `\\dfrac{${A}}{p+${B}}`,
        expr: `${A}/(p + ${B})`,
        keyTex: `-\\dfrac{p}{p+${B}}`,
        mistakes: [
          opt(`\\dfrac{p}{p+${B}}`, "dropping the minus sign of $d'(p)$."),
          opt('-1', `treating $d$ as the power function $${A}p^{-1}$, ignoring the $+${B}$.`),
          opt(`-\\dfrac{p+${B}}{p}`, 'inverting the elasticity.'),
          opt(`-\\dfrac{1}{p+${B}}`, 'forgetting to multiply by $p$.'),
          opt(`-\\dfrac{${A}p}{\\left(p+${B}\\right)^{2}}`, 'forgetting to divide by $d(p)$.'),
          opt(`-\\dfrac{${A}}{\\left(p+${B}\\right)^{2}}`, "giving the derivative $d'(p)$ instead of the elasticity."),
        ],
        steps: `$d'(p)=-\\dfrac{${A}}{\\left(p+${B}\\right)^{2}}$, so $$El_p\\,d(p)=\\frac{p\\,d'(p)}{d(p)}=\\frac{-${A}p/\\left(p+${B}\\right)^{2}}{${A}/\\left(p+${B}\\right)}=-\\frac{p}{p+${B}}.$$`,
        points: [1, 4, 10],
      };
    }
  }
}

const FORMULA_GOODS = ['rice', 'olive oil', 'concert tickets', 'organic honey', 'bicycle rentals', 'designer handbags', 'fresh mussels', 'museum passes'];
/** Status goods, for the (unusual) demand functions that rise with the price. */
const LUXURY_GOODS = ['designer handbags', 'luxury watches', 'vintage champagne', 'limited-edition sneakers'];

const formula: Template = {
  id: 'elasticity.formula',
  topic: 'Elasticity',
  title: 'Price elasticity of a demand or supply function as a formula in p',
  types: ['single-choice'],
  difficulty: 2,
  generate({ rng, optionCount }) {
    const fam = rng.pick(FORMULA_FAMS);
    const c = formulaCase(rng, fam);
    assertFormula(
      c.keyTex,
      c.expr,
      'p',
      c.points.map((p) => ({ p })),
    );
    const good = rng.pick(c.luxury ? LUXURY_GOODS : FORMULA_GOODS);
    const stem =
      c.name === 's'
        ? `For ${good}, the demand and the supply as functions of the price $p>0$ are given by ${c.pre}. What is the price elasticity $El_p\\,s(p)$ of the supply function?`
        : c.luxury
          ? `The market for ${good} is unusual: demand rises with the price. The weekly demand as a function of the price $p$ is $$d(p)=${c.fTex}.$$ Which expression gives the price elasticity $El_p\\,d(p)$ of this demand function?`
          : rng.pick([
            `The weekly demand for ${good} as a function of the price $p$ is $$d(p)=${c.fTex}.$$ Which expression gives the price elasticity $El_p\\,d(p)$ of this demand function?`,
            `Find the price elasticity $E_d(p)$ of the demand function $$d(p)=${c.fTex}$$ for ${good} (for prices $p>0$ with $d(p)>0$).`,
          ]);
    const fb = (i: number) => opt(`${i + 2}\\left(${c.keyTex}\\right)`);
    const mcq = buildMcq(rng, opt(c.keyTex), rng.shuffle(c.mistakes), { count: optionCount, fallback: fb });
    const name = c.name;
    const explanation = `The price elasticity is $El_p\\,${name}(p)=\\dfrac{p\\,${name}'(p)}{${name}(p)}$.\n\n${c.steps}`;
    return choiceQuestion(stem, mcq, explanation);
  },
};

// =====================================================================================================================
// 4. Percentage change approximated with the elasticity.
// =====================================================================================================================

/** An exponent as LaTeX: short decimals stay decimals, thirds become fractions. */
const expTex = (x: number) => (isNice(x, 2) ? num(x) : numTex(x));

const EXPS = [0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 1 / 3, 2 / 3, 1 / 4, 3 / 4];

const percentChange: Template = {
  id: 'elasticity.percent-change',
  topic: 'Elasticity',
  title: 'Approximate percentage change of a function from its (partial) elasticity',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const fam = rng.pick(['cobb', 'cobb', 'demand'] as const);
    const k = rng.pick([2, 3, 4, 5, 6, 8, 10]);
    const dir = rng.sign();
    let stem: string;
    let key: number;
    let explanation: string;
    let subject: string;
    let mistakes: { value: number; why: string }[];
    if (fam === 'cobb') {
      const [a, b] = rng.sample(EXPS, 2);
      const ctx = rng.pick([
        {
          f: 'Q',
          x: 'K',
          y: 'L',
          A: rng.int(2, 15),
          intro: (fTex: string) => `A furniture maker's weekly output is $Q(K,L)=${fTex}$, where $K$ is capital and $L$ is labour ($K,L>0$).`,
          what: (v: string) => (v === 'K' ? 'the amount of capital' : 'the amount of labour'),
          subj: 'output',
        },
        {
          f: 'U',
          x: 'c',
          y: 'b',
          A: 1,
          intro: (fTex: string) => `A student's utility from $c$ cups of coffee and $b$ pieces of cake per week is $U(c,b)=${fTex}$ ($c,b>0$).`,
          what: (v: string) => (v === 'c' ? 'the number of cups of coffee' : 'the number of pieces of cake'),
          subj: 'utility',
        },
        {
          f: 'Y',
          x: 'T',
          y: 'W',
          A: rng.int(3, 30),
          intro: (fTex: string) => `The harvest of a vineyard is modelled as $Y(T,W)=${fTex}$, where $T$ is the number of tractor hours and $W$ the number of workers ($T,W>0$).`,
          what: (v: string) => (v === 'T' ? 'the number of tractor hours' : 'the number of workers'),
          subj: 'the harvest',
        },
      ]);
      const v = rng.pick([ctx.x, ctx.y]);
      const ev = v === ctx.x ? a : b;
      const ew = v === ctx.x ? b : a;
      const fTex = `${ctx.A === 1 ? '' : ctx.A}${ctx.x}^{${expTex(a)}}${ctx.y}^{${expTex(b)}}`;
      const expr = `${ctx.A}*${ctx.x}^(${a})*${ctx.y}^(${b})`;
      const El = elasticityAt(expr, v, { [ctx.x]: 2.3, [ctx.y]: 1.9 });
      key = El * dir * k;
      subject = ctx.subj;
      const change = dir > 0 ? `increases by ${k}%` : `decreases by ${k}%`;
      stem =
        ctx.intro(fTex) +
        ` Suppose ${ctx.what(v)} ${change} while the other input stays the same. Use the partial elasticity of $${ctx.f}$ with respect to $${v}$ to approximate the percentage change of ${subject}.`;
      explanation =
        `For a Cobb–Douglas function the partial elasticity with respect to $${v}$ is its exponent: $El_{${v}}${ctx.f}=${expTex(ev)}$. ` +
        `Then $$\\frac{\\Delta ${ctx.f}}{${ctx.f}}\\approx El_{${v}}${ctx.f}\\cdot\\frac{\\Delta ${v}}{${v}}=${expTex(ev)}\\cdot(${dir * k}\\%)=${num(key, 2)}\\%.$$`;
      mistakes = [
        { value: ew * dir * k, why: `using the exponent of the other input.` },
        { value: (a + b) * dir * k, why: `adding both exponents (as if both inputs changed).` },
        { value: El * dir, why: `forgetting to multiply the elasticity by the ${k}% change.` },
        { value: (dir * k) / El, why: `dividing the percentage change by the elasticity instead of multiplying.` },
        { value: -key, why: `getting the direction wrong: with a positive elasticity, ${subject} moves in the same direction as the input.` },
        { value: dir * k, why: `assuming ${subject} changes by the same percentage as the input.` },
        { value: (1 - El) * dir * k, why: `using $1-${expTex(ev)}$ instead of the exponent.` },
      ];
    } else {
      const g = rng.pick(GOODS);
      const sub = rng.pick(['linear', 'lin-sqrt', 'hyper'] as const);
      let expr = '';
      let dTex = '';
      let p0 = 0;
      let El = 0;
      const sensible = (e: number) => Math.abs(e) >= 0.1 && Math.abs(e) <= 3 && Math.abs(e * k) < 60;
      for (let tries = 0; tries < 400; tries++) {
        if (sub === 'linear') {
          const B = rng.pick([1, 2, 4, 5, 0.5]);
          p0 = rng.int(4, 40);
          const A = Math.ceil(B * p0) + rng.int(5, 120);
          expr = `${A} - ${B}*p`;
          dTex = sumTex([
            [A, ''],
            [-B, 'p'],
          ]);
        } else if (sub === 'lin-sqrt') {
          const B = rng.pick([1, 2, 3, 4]);
          const r = rng.int(2, 10);
          p0 = r * r;
          const A = B * r + rng.int(4, 60);
          expr = `${A} - ${B}*sqrt(p)`;
          dTex = sumTex([
            [A, ''],
            [-B, '\\sqrt{p}'],
          ]);
        } else {
          const A = rng.pick([120, 200, 300, 600]);
          const B = rng.int(2, 30);
          p0 = rng.int(2, 40);
          expr = `${A}/(p + ${B})`;
          dTex = `\\dfrac{${A}}{p+${B}}`;
        }
        El = elasticityAt(expr, 'p', { p: p0 });
        if (isNice(El, 2) && sensible(El)) break;
      }
      if (!(isNice(El, 2) && sensible(El))) throw new Error(`percent-change: no sensible ${sub} demand found`);
      const d0 = evalAt(expr, { p: p0 });
      const d1 = evalAt(diff(expr, 'p'), { p: p0 });
      key = El * dir * k;
      subject = 'demand';
      stem =
        `${g.seller} faces the daily demand $$d(p)=${dTex}$$ for ${g.good} (in ${g.unit}), where $p$ is the price in euros per ${g.per}. The current price is $p=${p0}$. ` +
        `The seller ${dir > 0 ? 'raises' : 'lowers'} the price by ${k}%. Use the price elasticity to approximate the resulting percentage change in demand.`;
      explanation =
        `$$El_p\\,d(${p0})=\\frac{p\\,d'(p)}{d(p)}\\Big|_{p=${p0}}=\\frac{${p0}\\cdot(${num(d1, 5)})}{${num(d0, 4)}}=${num(El, 4)}.$$` +
        `Then $$\\frac{\\Delta d}{d}\\approx El_p\\,d\\cdot\\frac{\\Delta p}{p}=${num(El, 4)}\\cdot(${dir * k}\\%)=${num(key, 2)}\\%.$$`;
      mistakes = [
        { value: -key, why: 'getting the direction wrong: with a negative elasticity, demand moves opposite to the price.' },
        { value: (dir * k) / El, why: 'dividing the percentage change by the elasticity instead of multiplying.' },
        { value: d1 * dir * k, why: "using the derivative $d'(p)$ instead of the elasticity." },
        { value: El * dir, why: `forgetting to multiply the elasticity by the ${k}% price change.` },
        { value: -dir * k, why: 'assuming demand changes by the same percentage as the price.' },
        { value: (d1 / d0) * dir * k, why: 'forgetting the factor $p$ in the elasticity.' },
      ];
    }
    const pct = (x: number) => `${x >= 0 ? 'an increase' : 'a decrease'} of approximately ${num(Math.abs(x), 2)}%`;
    if (type === 'numeric') {
      return numericQuestion(
        stem + ` Give the approximate percentage change of ${subject} (a negative number for a decrease, e.g. −1.5 for a 1.5% decrease).`,
        key,
        2,
        explanation,
      );
    }
    const mcq = buildMcq(
      rng,
      { text: pct(key), value: key },
      mistakes.map((m) => ({ text: pct(m.value), value: m.value, why: m.why })),
      { count: optionCount, fallback: scaledFallback(key, pct, 0.4), epsilon: 0.1 },
    );
    return choiceQuestion(stem + ` The percentage change of ${subject} is`, mcq, explanation);
  },
};

// =====================================================================================================================
// 5. Rules for elasticities: sign, constant factors, powers, products and quotients (single-choice and statements).
// =====================================================================================================================

export interface RuleParams {
  c: number;
  A: number;
  n: number;
  k: number;
  a: number;
  b: number;
  e: number;
}

/** Parameters of the statement bank (drawn first by the multi-select variant, so tests can rebuild the statements). */
export function ruleParams(rng: Rng): RuleParams {
  return {
    c: rng.pick([-5, -4, -3, -2, 2, 3, 4, 5, 6]),
    A: rng.int(2, 9),
    n: rng.pick([2, 3, 4, 5, -1, -2]),
    k: rng.pick([2, 3, 0.5, -2, -0.5]),
    a: rng.int(20, 90),
    b: rng.int(2, 6),
    e: rng.pick([2, 4, 0.5, 2.5, 0.8, 1.25]),
  };
}

export interface RuleStatement {
  key: string;
  text: string;
  correct: boolean;
  why: string;
}

/** The statement bank about elasticity rules; `correct` is checked numerically in elasticity.test.ts. */
export function ruleStatements(p: RuleParams): RuleStatement[] {
  const { c, A, n, k, a, b, e } = p;
  const El = (g: string) => `El_x\\,${g}`;
  return [
    {
      key: 'scale-same',
      text: `If $g(x)=${c}f(x)$, then $${El('g(x)')}=${El('f(x)')}$.`,
      correct: true,
      why: `$\\frac{x\\,g'(x)}{g(x)}=\\frac{x\\cdot ${c}f'(x)}{${c}f(x)}$: the constant cancels.`,
    },
    {
      key: 'scale-times',
      text: `If $g(x)=${c}f(x)$, then $${El('g(x)')}=${c}\\,${El('f(x)')}$.`,
      correct: false,
      why: 'a constant factor cancels in $\\frac{x\\,g\'(x)}{g(x)}$; the elasticity does not change.',
    },
    {
      key: 'power-const',
      text: `The elasticity of $f(x)=${A}x^{${n}}$ equals $${n}$ for every $x>0$.`,
      correct: true,
      why: `$\\frac{x\\cdot ${n < 0 ? `\\left(${A * n}${powTex('x', n - 1)}\\right)` : `${A * n}${powTex('x', n - 1)}`}}{${A}x^{${n}}}=${n}$: a power function has constant elasticity equal to its exponent.`,
    },
    {
      key: 'power-deriv',
      text: `The elasticity of $f(x)=${A}x^{${n}}$ equals $${A * n}${powTex('x', n - 1)}$.`,
      correct: false,
      why: 'that is the derivative $f\'(x)$, not the elasticity (which is the constant exponent).',
    },
    {
      key: 'product',
      text: `For positive differentiable $f$ and $g$: $El_x\\big(f(x)g(x)\\big)=${El('f(x)')}+${El('g(x)')}$.`,
      correct: true,
      why: 'the product rule gives $\\frac{x(f\'g+fg\')}{fg}=\\frac{xf\'}{f}+\\frac{xg\'}{g}$.',
    },
    {
      key: 'sum',
      text: `For positive differentiable $f$ and $g$: $El_x\\big(f(x)+g(x)\\big)=${El('f(x)')}+${El('g(x)')}$.`,
      correct: false,
      why: 'the elasticity of a sum is a weighted average of the elasticities, not their sum (e.g. $f=g=x$ gives 1, not 2).',
    },
    {
      key: 'quotient',
      text: `For positive differentiable $f$ and $g$: $El_x\\left(\\dfrac{f(x)}{g(x)}\\right)=${El('f(x)')}-${El('g(x)')}$.`,
      correct: true,
      why: 'the quotient rule gives $\\frac{x f\'}{f}-\\frac{x g\'}{g}$.',
    },
    {
      key: 'quotient-wrong',
      text: `For positive differentiable $f$ and $g$: $El_x\\left(\\dfrac{f(x)}{g(x)}\\right)=\\dfrac{${El('f(x)')}}{${El('g(x)')}}$.`,
      correct: false,
      why: 'elasticities of a quotient are subtracted, not divided.',
    },
    {
      key: 'exp',
      text: `The elasticity of $f(x)=e^{${coefTex(k)}x}$ equals $${coefTex(k)}x$.`,
      correct: true,
      why: `$\\frac{x\\cdot ${k < 0 ? `\\left(${numTex(k)}\\right)` : numTex(k)}e^{${coefTex(k)}x}}{e^{${coefTex(k)}x}}=${coefTex(k)}x$.`,
    },
    {
      key: 'exp-wrong',
      text: `The elasticity of $f(x)=e^{${coefTex(k)}x}$ is the constant $${numTex(k)}$.`,
      correct: false,
      why: `$${numTex(k)}$ is the relative growth rate $\\frac{f'}{f}$; the elasticity multiplies it by $x$.`,
    },
    {
      key: 'linear-const',
      text: `The linear demand function $d(p)=${a}-${b}p$ has the same price elasticity at every price.`,
      correct: false,
      why: `its elasticity $-\\frac{${b}p}{${a}-${b}p}$ changes with $p$.`,
    },
    {
      key: 'sign-increasing',
      text: 'If $f$ is positive and increasing on $(0,\\infty)$, then $El_x\\,f(x)>0$ for every $x>0$.',
      correct: true,
      why: 'with $x>0$ and $f(x)>0$ the elasticity has the sign of $f\'(x)$.',
    },
    {
      key: 'sign-convex',
      text: 'If $f$ is positive and convex on $(0,\\infty)$, then $El_x\\,f(x)>0$ for every $x>0$.',
      correct: false,
      why: 'a convex function can be decreasing (e.g. $f(x)=1/x$), and then its elasticity is negative.',
    },
    {
      key: 'pct',
      text: `If the price elasticity of demand at the current price is $-${num(e)}$, a 1% price increase lowers demand by approximately ${num(e)}%.`,
      correct: true,
      why: 'the elasticity is the approximate percentage change of demand per 1% change in price.',
    },
    {
      key: 'pct-wrong',
      text: `If the price elasticity of demand at the current price is $-${num(e)}$, a 1% price increase lowers demand by approximately ${num(1 / e, 3)}%.`,
      correct: false,
      why: `that inverts the elasticity; the change is about ${num(e)}%.`,
    },
    {
      key: 'constant',
      text: `The elasticity of the constant function $f(x)=${A}$ is $0$.`,
      correct: true,
      why: "$f'(x)=0$, so $\\frac{x f'(x)}{f(x)}=0$.",
    },
  ];
}

type SignCase = { domain: 'pos' | 'neg'; fSign: 1 | -1; target: 1 | -1 };

const rules: Template = {
  id: 'elasticity.rules',
  topic: 'Elasticity',
  title: 'Rules for elasticities: sign, constant factor, powers, products (single-choice) and true/false statements (multi-select)',
  types: ['single-choice', 'multi-select'],
  difficulty: 2,
  generate({ rng, type, optionCount }): Generated {
    if (type === 'multi-select') {
      const p = ruleParams(rng);
      const bank = ruleStatements(p);
      const m = buildMulti(rng, bank, optionCount, 1);
      const stem = rng.pick([
        'Which of the following statements about elasticities are correct? (All functions are differentiable; $El_x$ denotes the elasticity with respect to $x$.)',
        'A tutor collected some claims that students made about point elasticities ($El_x f(x)=\\frac{x f\'(x)}{f(x)}$). Which of these claims are true?',
      ]);
      const explanation =
        `Recall $El_x f(x)=\\dfrac{x\\,f'(x)}{f(x)}$.\n\n` + m.reasons.map((r) => `- **${r.id}** is ${r.correct ? '**correct**' : '**false**'}: ${r.why}`).join('\n');
      return { type, stem, instruction: INSTRUCTION.multi, options: m.options, correctAnswer: m.correctAnswer, explanation };
    }
    const variant = rng.pick(['sign', 'scale', 'power', 'xpow', 'divpow'] as const);
    if (variant === 'sign') {
      const sc: SignCase = { domain: rng.chance(0.7) ? 'pos' : 'neg', fSign: rng.sign(), target: rng.sign() };
      const xs = sc.domain === 'pos' ? 1 : -1;
      // El = x·f'(x)/f(x): its sign is sign(x)·sign(f')·sign(f), so the required sign of f' is:
      const fpSign = sc.target * xs * sc.fSign;
      const dom = sc.domain === 'pos' ? '(0,\\infty)' : '(-\\infty,0)';
      const posneg = (s: number) => (s > 0 ? 'positive' : 'negative');
      const stem =
        `A differentiable function $f(x)$ is defined on $${dom}$ and is ${posneg(sc.fSign)} on that whole domain. ` +
        `Which property of $f$ guarantees that its point elasticity $El_x f(x)$ is ${posneg(sc.target)} everywhere on $${dom}$?`;
      const inc = '$f$ is increasing.';
      const dec = '$f$ is decreasing.';
      const key = fpSign > 0 ? inc : dec;
      const wrongMono = fpSign > 0 ? dec : inc;
      const mcq = buildMcq(
        rng,
        { text: key },
        [
          { text: wrongMono, why: 'ignoring the sign of $x$ or of $f(x)$ in $El_x f=\\frac{x}{f(x)}f\'(x)$.' },
          { text: '$f$ is convex.', why: "convexity concerns $f''$; a convex function can increase or decrease, so the sign of the elasticity is not fixed." },
          { text: '$f$ is concave.', why: "concavity concerns $f''$; a concave function can increase or decrease." },
          { text: 'None of these: such a function cannot have an elasticity of that sign everywhere.', why: 'the sign of the elasticity is fixed once the sign of $f\'$ is fixed, so one of the properties does guarantee it.' },
        ],
        { count: optionCount },
      );
      const explanation =
        `$$El_x f(x)=\\frac{x}{f(x)}\\,f'(x).$$ On $${dom}$ we have $x${xs > 0 ? '>' : '<'}0$, and $f(x)${sc.fSign > 0 ? '>' : '<'}0$, so $\\frac{x}{f(x)}$ is ${posneg(xs * sc.fSign)}. ` +
        `The elasticity is therefore ${posneg(sc.target)} exactly when $f'(x)$ is ${posneg(fpSign)}, i.e. when $f$ is **${fpSign > 0 ? 'increasing' : 'decreasing'}**.`;
      return choiceQuestion(stem, mcq, explanation);
    }
    const intro = 'Let $f$ be a positive, differentiable function on $(0,\\infty)$ and write $E_f(x)$ for its elasticity.';
    let gTex: string;
    let key: string;
    let ms: Choice[];
    let steps: string;
    if (variant === 'scale') {
      const c = rng.pick([-5, -4, -3, -2, 2, 3, 4, 5, 10]);
      gTex = `${c}f(x)`;
      key = 'E_g(x)=E_f(x)';
      ms = [
        opt(`E_g(x)=${c}\\,E_f(x)`, 'multiplying the elasticity by the constant; it cancels in $\\frac{x g\'}{g}$.'),
        opt(`E_g(x)=\\dfrac{E_f(x)}{${c}}`, 'dividing by the constant; it cancels in $\\frac{x g\'}{g}$.'),
        opt(`E_g(x)=E_f(x)${c < 0 ? '-' : '+'}${Math.abs(c)}`, 'adding the constant to the elasticity.'),
        ...(c < 0 ? [opt('E_g(x)=-E_f(x)', 'thinking that a negative factor flips the sign of the elasticity; it cancels in the ratio.')] : []),
        opt('E_g(x)=0', 'thinking that a constant factor has elasticity 0 and therefore makes $E_g$ zero.'),
      ];
      steps = `$g'(x)=${c}f'(x)$, so $$E_g(x)=\\frac{x\\,g'(x)}{g(x)}=\\frac{x\\cdot ${c < 0 ? `(${c})` : c}f'(x)}{${c}f(x)}=E_f(x).$$ A constant factor (positive or negative) does not change the elasticity.`;
    } else if (variant === 'power') {
      const kk = rng.pick([2, 3, 4, 0.5]);
      gTex = kk === 0.5 ? '\\sqrt{f(x)}' : `\\left(f(x)\\right)^{${kk}}`;
      key = `E_g(x)=${numTex(kk)}E_f(x)`;
      ms = [
        opt('E_g(x)=E_f(x)', 'ignoring the power.'),
        opt(`E_g(x)=\\left(E_f(x)\\right)^{${numTex(kk)}}`, 'raising the elasticity to the same power.'),
        ...(kk !== 2 ? [opt(`E_g(x)=${numTex(kk)}\\left(E_f(x)\\right)^{${numTex(kk - 1)}}`, 'differentiating the elasticity as if it were a power.')] : []),
        opt(`E_g(x)=E_f(x)+${numTex(kk)}`, 'adding the exponent instead of multiplying by it.'),
        opt(`E_g(x)=\\dfrac{E_f(x)}{${numTex(kk)}}`, 'dividing by the exponent instead of multiplying.'),
      ];
      const fPow = (e: number) => (e === 1 ? 'f(x)' : `\\left(f(x)\\right)^{${numTex(e)}}`);
      steps = `Chain rule: $g'(x)=${numTex(kk)}${fPow(kk - 1)}f'(x)$, so $$E_g(x)=\\frac{x\\,g'(x)}{g(x)}=\\frac{x\\cdot ${numTex(kk)}${fPow(kk - 1)}f'(x)}{${fPow(kk)}}=${numTex(kk)}\\cdot\\frac{x f'(x)}{f(x)}=${numTex(kk)}E_f(x).$$`;
    } else if (variant === 'xpow') {
      const m = rng.int(1, 4);
      gTex = `${powTex('x', m)}f(x)`;
      key = `E_g(x)=${m}+E_f(x)`;
      ms = [
        ...(m > 1 ? [opt(`E_g(x)=${m}E_f(x)`, 'multiplying by the exponent instead of adding it.')] : []),
        opt('E_g(x)=E_f(x)', `forgetting the elasticity of the factor $${powTex('x', m)}$.`),
        ...(m > 1 ? [opt(`E_g(x)=${m}${powTex('x', m - 1)}E_f(x)`, 'multiplying the elasticity by the derivative of the power factor.')] : []),
        opt(`E_g(x)=${powTex('x', m)}E_f(x)`, 'multiplying the elasticity by the power factor.'),
        opt(`E_g(x)=E_f(x)-${m}`, 'subtracting instead of adding the exponent.'),
        opt(`E_g(x)=${powTex('x', m)}+E_f(x)`, `adding the factor $${powTex('x', m)}$ itself instead of its elasticity $${m}$.`),
      ];
      steps = `The elasticity of a product is the sum of the elasticities: $E_g(x)=El_x\\left(${powTex('x', m)}\\right)+E_f(x)=${m}+E_f(x)$. ` +
        `(Directly: $g'=${m === 1 ? '' : m}${powTex('x', m - 1)}f+${powTex('x', m)}f'$, so $\\frac{x g'}{g}=${m}+\\frac{x f'}{f}$.)`;
    } else {
      const m = rng.int(1, 4);
      gTex = `\\dfrac{f(x)}{${powTex('x', m)}}`;
      key = `E_g(x)=E_f(x)-${m}`;
      ms = [
        opt(`E_g(x)=E_f(x)+${m}`, 'adding the elasticity of the denominator instead of subtracting it.'),
        ...(m > 1 ? [opt(`E_g(x)=\\dfrac{E_f(x)}{${m}}`, 'dividing by the exponent instead of subtracting it.')] : []),
        opt('E_g(x)=E_f(x)', 'forgetting the elasticity of the denominator.'),
        opt(`E_g(x)=${coefTex(-m)}E_f(x)`, 'multiplying by minus the exponent instead of subtracting it.'),
        opt(`E_g(x)=\\dfrac{E_f(x)}{${powTex('x', m)}}`, 'dividing the elasticity by the power factor.'),
      ];
      steps = `The elasticity of a quotient is the difference of the elasticities: $E_g(x)=E_f(x)-El_x\\left(${powTex('x', m)}\\right)=E_f(x)-${m}$.`;
    }
    const stem = `${intro} A second function is defined by $g(x)=${gTex}$. Which expression gives the elasticity $E_g(x)$ of $g$?`;
    const mcq = buildMcq(rng, opt(key), ms, { count: optionCount, fallback: (i) => opt(`E_g(x)=E_f(x)+${i + 7}`) });
    return choiceQuestion(stem, mcq, `Use $E_g(x)=\\dfrac{x\\,g'(x)}{g(x)}$.\n\n${steps}`);
  },
};

// =====================================================================================================================
// 6. Solve for the point or parameter where the elasticity takes a given value.
// =====================================================================================================================

const solveFor: Template = {
  id: 'elasticity.solve-for',
  topic: 'Elasticity',
  title: 'Find the base, price or level at which the elasticity takes a given value',
  types: ['single-choice', 'numeric'],
  difficulty: 3,
  generate({ rng, type, optionCount }) {
    const fam = rng.pick(['base', 'linear', 'exp-demand', 'xexp'] as const);
    let stem: string;
    let key: number;
    let keyText: string;
    let explanation: string;
    let mistakes: { value: number; text?: string; why: string }[];
    let dp = 2;
    let fmt = (x: number) => `$${num(x, 2)}$`;
    if (fam === 'base') {
      const t0 = rng.pick([2, 3, 4, 5]);
      const r = rng.pick([1, 2, 0.5, 3, -1]);
      const target = r * t0;
      // E(t) = t·ln(b) for g(t) = b^t, so b = e^{target/t0}; computed numerically via mathjs below.
      key = Math.exp(target / t0);
      // check with the symbolic elasticity
      const check = elasticityAt(`${key}^t`, 't', { t: t0 });
      if (Math.abs(check - target) > 1e-9) throw new Error('base: elasticity check failed');
      const eTex = (z: number) => (z === 1 ? 'e' : z === 0.5 ? '\\sqrt{e}' : `e^{${numTex(z)}}`);
      keyText = `$b=${eTex(target / t0)}$`;
      const ctx = rng.pick([
        'The number of followers of a new channel is modelled as',
        'The value of a rare coin collection is modelled as',
        'The size of a bacteria culture is modelled as',
      ]);
      stem = `${ctx} $g(t)=b^{t}$, where $t$ is time and the base $b>0$ is unknown. For which value of $b$ is the elasticity of $g$ at $t=${t0}$ equal to $${numTex(target)}$?`;
      explanation =
        `$g'(t)=\\ln(b)\\,b^{t}$, so $$El_t\\,g(t)=\\frac{t\\,g'(t)}{g(t)}=\\frac{t\\ln(b)\\,b^{t}}{b^{t}}=t\\ln(b).$$` +
        `At $t=${t0}$: $${t0}\\ln(b)=${numTex(target)}$, so $\\ln(b)=${numTex(target / t0)}$ and $b=${eTex(target / t0)}\\approx ${num(key, 4)}$.`;
      mistakes = [
        { value: Math.exp(target * t0), text: `$b=${eTex(target * t0)}$`, why: `multiplying by $t=${t0}$ instead of dividing: $\\ln(b)=${numTex(target)}\\cdot ${t0}$.` },
        { value: target / t0, text: `$b=${numTex(target / t0)}$`, why: 'forgetting the logarithm: solving $\\ln(b)=\\ldots$ as $b=\\ldots$.' },
        ...(target !== 0 ? [{ value: Math.exp(t0 / target), text: `$b=${eTex(t0 / target)}$`, why: 'solving $\\ln(b)=\\frac{t}{El}$ (fraction upside down).' }] : []),
        { value: target, text: `$b=${numTex(target)}$`, why: 'taking the base equal to the required elasticity.' },
        { value: 1, text: '$b=1$', why: 'a base of 1 gives a constant function with elasticity 0.' },
        { value: Math.exp(-target / t0), text: `$b=${eTex(-target / t0)}$`, why: 'a sign error when solving for $\\ln(b)$.' },
        { value: Math.exp(target), text: `$b=${eTex(target)}$`, why: `forgetting the factor $t=${t0}$ in $El_t\\,g(t)=t\\ln(b)$.` },
      ];
      if (key <= 0) throw new Error('base must be positive');
      fmt = (x: number) => `$b=${num(x, 3)}$`;
      dp = 2;
    } else if (fam === 'linear') {
      // d(p) = A − Bp, El = −Bp/(A − Bp) = −k  ⇔  p = kA/(B(1+k))
      let A = 0;
      let B = 0;
      let kk = 1;
      for (let tries = 0; tries < 100; tries++) {
        kk = rng.pick([1, 1, 0.5, 2, 3, 0.25, 1.5]);
        B = rng.pick([1, 2, 4, 5, 0.5]);
        A = rng.int(4, 60) * 5;
        key = (kk * A) / (B * (1 + kk));
        if (isNice(key, 2)) break;
      }
      key = (kk * A) / (B * (1 + kk));
      const dTex = sumTex([
        [A, ''],
        [-B, 'p'],
      ]);
      const El = elasticityAt(`${A} - ${B}*p`, 'p', { p: key });
      if (Math.abs(El + kk) > 1e-9) throw new Error('linear: elasticity check failed');
      keyText = `$p=${num(key, 2)}$`;
      const g = rng.pick(FORMULA_GOODS);
      stem =
        kk === 1
          ? `The demand for ${g} is $d(p)=${dTex}$, with $p$ the price in euros. At which price is demand unit elastic, i.e. $El_p\\,d(p)=-1$?`
          : `The demand for ${g} is $d(p)=${dTex}$, with $p$ the price in euros. At which price is the price elasticity of demand equal to $-${num(kk)}$?`;
      explanation =
        `$$El_p\\,d(p)=\\frac{p\\,d'(p)}{d(p)}=${sfrac(-B, 'p', dTex)}.$$ Setting this equal to $-${num(kk)}$: ` +
        `$${coefTex(B)}p=${kk === 1 ? '' : num(kk)}\\left(${dTex}\\right)$, so $${num(B * (1 + kk), 4)}p=${num(kk * A, 4)}$ and $p=${num(key, 4)}$.`;
      mistakes = [
        { value: A / B, why: 'taking the price where demand is zero.' },
        { value: (kk * A) / B, why: 'dividing by the intercept instead of by $d(p)$: solving $\\frac{Bp}{A}=k$.' },
        { value: A / (2 * B), why: 'using the unit-elastic price regardless of the required elasticity.' },
        { value: A / (B * (1 + kk)), why: 'losing the factor $k$ when solving.' },
        { value: (kk * A) / (B * (1 + kk)) / 2, why: 'dividing by 2 one time too many.' },
        { value: A / (B * kk), why: 'solving $\\frac{A}{Bp}=k$ (fraction upside down).' },
        { value: kk / B, why: 'forgetting to divide by $d(p)$: solving $Bp=k$.' },
        { value: (kk * A) / (B * (kk - 1)), why: 'a sign error when collecting the terms with $p$.' },
        { value: A / (4 * B), why: 'halving the unit-elastic price.' },
      ];
      fmt = (x: number) => `$p=${num(x, 2)}$`;
    } else if (fam === 'exp-demand') {
      const c = rng.pick([0.02, 0.04, 0.05, 0.1, 0.2, 0.25]);
      const kk = rng.pick([0.5, 1, 1.5, 2, 3]);
      const A = rng.pick([100, 250, 400, 800]);
      key = kk / c;
      const El = elasticityAt(`${A}*exp(-${c}*p)`, 'p', { p: key });
      if (Math.abs(El + kk) > 1e-9) throw new Error('exp-demand: elasticity check failed');
      keyText = `$p=${num(key, 2)}$`;
      const what = rng.pick(['parking permits', 'theatre tickets', 'boat tours', 'yoga classes', 'e-scooter rides']);
      stem = `Daily demand for ${what} at price $p$ (in euros) is $d(p)=${A}e^{-${num(c)}p}$. At which price is the price elasticity of demand equal to $-${num(kk)}$?`;
      explanation = `$d'(p)=-${num(c)}\\cdot ${A}e^{-${num(c)}p}$, so $El_p\\,d(p)=\\frac{p\\,d'(p)}{d(p)}=-${num(c)}p$. Setting $-${num(c)}p=-${num(kk)}$ gives $p=\\frac{${num(kk)}}{${num(c)}}=${num(key, 4)}$.`;
      mistakes = [
        { value: c / kk, why: 'solving the equation upside down: $p=\\frac{c}{k}$.' },
        { value: kk * c, why: 'multiplying instead of dividing.' },
        { value: 1 / c, why: 'giving the unit-elastic price $1/c$ regardless of the required elasticity.' },
        { value: kk, why: `forgetting the inner derivative $-${num(c)}$ (chain rule), which gives $El=-p$.` },
        { value: (kk / c) * 2, why: 'an extra factor 2 from a wrong derivative.' },
      ];
      fmt = (x: number) => `$p=${num(x, 2)}$`;
    } else {
      // f(x) = x^n e^{-cx}: El = n − c·x; level where El = k
      const n = rng.int(2, 5);
      const c = rng.pick([0.1, 0.2, 0.25, 0.5, 1]);
      const kk = rng.pick([0, 1, -1, 0.5].filter((z) => z < n));
      key = (n - kk) / c;
      const El = elasticityAt(`x^${n}*exp(-${c}*x)`, 'x', { x: key });
      if (Math.abs(El - kk) > 1e-9) throw new Error('xexp: elasticity check failed');
      keyText = `$x=${num(key, 2)}$`;
      const cx = c === 1 ? 'x' : `${num(c)}x`; // no "e^{-1x}"
      stem =
        `The yield of a crop (in tonnes) depends on the amount of fertiliser $x>0$ (in 100 kg) as $f(x)=x^{${n}}e^{-${cx}}$. ` +
        `For which amount of fertiliser is the elasticity of the yield with respect to $x$ equal to $${num(kk)}$?`;
      explanation =
        `$f'(x)=${n}${powTex('x', n - 1)}e^{-${cx}}-${cx}^{${n}}e^{-${cx}}$, so $$El_x f(x)=\\frac{x\\,f'(x)}{f(x)}=${n}-${cx}.$$` +
        `Setting $${n}-${cx}=${num(kk)}$ gives $x=\\frac{${sumTex([[n, ''], [-kk, '']])}}{${num(c)}}=${num(key, 4)}$.`;
      mistakes = [
        { value: (n + kk) / c, why: 'a sign error when moving $k$ to the other side.' },
        { value: (n - kk) * c, why: 'multiplying by $c$ instead of dividing.' },
        ...(kk !== 0 ? [{ value: n / c, why: 'solving $El=0$ (the stationary point) instead of the required value.' }] : []),
        { value: (n - 1 - kk) / c, why: 'using the exponent $n-1$ of the derivative.' },
        { value: kk / c, why: 'forgetting the contribution $n$ of the power factor.' },
        { value: (n - kk) / (2 * c), why: 'an extra factor 2.' },
      ];
      fmt = (x: number) => `$x=${num(x, 2)}$`;
    }
    if (type === 'numeric') {
      const dpx = isNice(key, 2) ? dpOf(key) : dp;
      return numericQuestion(stem, key, dpx, explanation);
    }
    const mcq = buildMcq(
      rng,
      { text: keyText, value: key },
      mistakes.filter((m) => Number.isFinite(m.value) && m.value > 0).map((m) => ({ text: m.text ?? fmt(m.value), value: m.value, why: m.why })),
      { count: optionCount, fallback: scaledFallback(key, fmt, 0.25), order: fam === 'base' ? 'shuffle' : 'ascending', epsilon: 0.01 },
    );
    return choiceQuestion(stem, mcq, explanation);
  },
};

export const TEMPLATES: Template[] = [partialPower, valueAtPoint, formula, percentChange, rules, solveFor];
