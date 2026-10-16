// Templates for the topic "Derivatives" (QM1 past exams: f'(x) of (3x−2)/(2x−3), x²/(x²+1), (1+ln x⁵)/x, 1/(1+ln x),
// ln(x²+1), √(x/(x−1)); tangent lines at x = 1; for which a a line is a tangent; h'(2) for h = f∘g from a table; a
// marginal approximation of a change). Every key is computed in code: formula keys are checked against mathjs' own
// derivative (assertSame), values come from mathjs or plain arithmetic. Wrong options come from modelled mistakes and
// are dropped when they are secretly equal to the key. See derivatives.test.ts for the independent checks.
import { buildMcq, INSTRUCTION, mistakesNote, num, numericField, sgn, type Choice } from '../build';
import { diff, evalAt, frac } from '../mathx';
import type { Rng } from '../rng';
import type { GenContext, Generated, Template } from '../types';
import { ensure, integerFallback, numTex, sumTex } from './_econ';
import { assertSame, coef, formulaMcq, lin, linE, termsExpr, termsTex, type FormulaChoice, type Term } from './_fnderiv';

/** f(x) = (a x + b) e^{c x}; asks for f'(0) — product rule + chain rule. */
const productExpAtZero: Template = {
  id: 'derivatives.product-exp-at-zero',
  topic: 'Derivatives',
  title: "Value of f'(0) for f(x) = (ax + b)e^{cx} (product and chain rule)",
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const a = rng.sign() * rng.int(2, 9);
    const b = rng.sign() * rng.int(1, 9);
    let c = rng.sign() * rng.int(2, 6);
    if (a + c * b === 0) c += 1; // keep the answer non-zero
    const expr = `(${a}*x + ${b}) * exp(${c}*x)`;
    // The answer, computed symbolically by mathjs (not by hand): f'(0).
    const answer = evalAt(diff(expr), { x: 0 });
    const fTex = `f(x)=\\left(${a}x ${sgn(b)}\\right)e^{${c}x}`;
    const stem = `A firm's cost per unit (in euros) depends on a production setting $x$ according to $$${fTex}$$ Calculate the rate of change $f'(0)$.`;
    const explanation =
      `Use the product rule with $u=${a}x ${sgn(b)}$ and $v=e^{${c}x}$, so $u'=${a}$ and (chain rule) $v'=${c}e^{${c}x}$:\n` +
      `$$f'(x)=${a}e^{${c}x}+\\left(${a}x ${sgn(b)}\\right)\\cdot ${c}e^{${c}x}$$` +
      `At $x=0$, $e^{0}=1$, so $$f'(0)=${a}+(${b})(${c})=${num(answer)}$$`;

    if (type === 'numeric') {
      return { type, stem, instruction: INSTRUCTION.numeric(0), correctAnswer: answer, tolerance: 0, explanation };
    }
    const mcq = buildMcq(
      rng,
      { text: `$${num(answer)}$`, value: answer },
      [
        { text: `$${num(a + b)}$`, value: a + b, why: `forgetting the chain rule: treating the derivative of $e^{${c}x}$ as $e^{${c}x}$.` },
        { text: `$${num(a * c)}$`, value: a * c, why: "multiplying the two derivatives ($u'v'$) instead of using the product rule." },
        { text: `$${num(a)}$`, value: a, why: "differentiating only the first factor ($u'v$)." },
        { text: `$${num(b * c)}$`, value: b * c, why: "differentiating only the second factor ($uv'$)." },
        { text: `$${num(b)}$`, value: b, why: "giving $f(0)$ instead of $f'(0)$." },
      ],
      { count: optionCount, fallback: (i) => ({ text: `$${num(answer + (i + 1) * rng.sign())}$`, value: answer + (i + 1) * rng.sign() }) },
    );
    return {
      type,
      stem,
      options: mcq.options,
      correctAnswer: mcq.correctAnswer,
      explanation: explanation + mistakesNote(mcq.distractors),
    };
  },
};

// =====================================================================================================================
// Shared: a question whose single-choice options are derivative formulas and whose numeric version asks f'(x0)
// =====================================================================================================================

const fname = (rng: Rng) => rng.pick(['f', 'g', 'h', 'q'] as const);
/** A number in brackets when negative (for substitutions such as 3·(−2)). */
const par = (x: number) => (x < 0 ? `(${x})` : `${x}`);
const pts = (xs: number[]) => xs.map((x) => [x]);

interface FormulaQ {
  name: string;
  fTex: string;
  fExpr: string;
  key: FormulaChoice;
  distractors: FormulaChoice[];
  /** Sample points inside the domain (to compare formulas). */
  pts: number[][];
  /** Worked derivation ending in the derivative. */
  steps: string;
  /** Point for the numeric version and f'(x0) with x0 substituted (LaTeX). */
  x0: number;
  atX0: string;
  fallback: (i: number) => FormulaChoice;
  stems: string[];
}

function finishFormula({ rng, type, optionCount }: GenContext, q: FormulaQ): Generated {
  const dExpr = diff(q.fExpr);
  assertSame(q.key.expr, dExpr, q.pts); // the printed key is mathjs' own derivative
  if (type === 'numeric') {
    const ans = evalAt(dExpr, { x: q.x0 });
    const dp = Math.abs(ans) < 1 ? 3 : 2;
    const f = numericField('value', undefined, ans, dp);
    const stem = rng.pick([
      `Let $$${q.name}(x)=${q.fTex}$$ Calculate $${q.name}'(${q.x0})$.`,
      `Find the slope of the graph of $$${q.name}(x)=${q.fTex}$$ at the point where $x=${q.x0}$, that is, the value of $${q.name}'(${q.x0})$.`,
      `How fast does $$${q.name}(x)=${q.fTex}$$ change at $x=${q.x0}$? Give $${q.name}'(${q.x0})$.`,
    ]);
    const explanation = `${q.steps}\nSubstitute $x=${q.x0}$: $$${q.name}'(${q.x0})=${q.atX0}\\approx ${num(ans, dp)}$$`;
    return { type, stem, instruction: INSTRUCTION.numeric(dp), correctAnswer: f.answer, tolerance: f.tolerance, explanation };
  }
  const mcq = formulaMcq(rng, q.key, rng.shuffle(q.distractors), { count: optionCount, pts: q.pts, label: `${q.name}'(x)=`, fallback: q.fallback });
  return {
    type,
    stem: rng.pick(q.stems),
    options: mcq.options,
    correctAnswer: mcq.correctAnswer,
    explanation: `${q.steps}\nSo $${q.name}'(x)=${q.key.tex}$ (option ${mcq.correctAnswer}).` + mistakesNote(mcq.distractors),
  };
}

const formulaStems = (name: string, fTex: string, rule: string) => [
  `Differentiate $$${name}(x)=${fTex}$$ Which expression equals $${name}'(x)$?`,
  `Which of the following is the derivative of the function below? $$${name}(x)=${fTex}$$`,
  `Use the ${rule} to find the derivative of $$${name}(x)=${fTex}$$`,
];

/** Fallback offsets 1, −1, 2, −2, ... that never give 0 when added to `base`. */
const offset = (i: number, base: number) => {
  const o = (i % 2 ? -1 : 1) * (Math.floor(i / 2) + 1);
  return base + o === 0 ? o * 2 : o;
};

// =====================================================================================================================
// 1. Quotient rule
// =====================================================================================================================

function linfracQ(rng: Rng, name: string): FormulaQ {
  let a: number, b: number, c: number, d: number;
  do {
    a = rng.sign() * rng.int(1, 6);
    b = rng.sign() * rng.int(1, 9);
    c = rng.int(1, 5);
    d = rng.sign() * rng.int(1, 9);
  } while (a * d - b * c === 0 || (a === c && b === d));
  const D = a * d - b * c;
  const v = lin(c, d);
  const sq = `\\left(${v}\\right)^2`;
  const fTex = `\\dfrac{${lin(a, b)}}{${v}}`;
  const over = (n: string, nE: string, why?: string, squared = true): FormulaChoice => ({
    tex: `\\dfrac{${n}}{${squared ? sq : v}}`,
    expr: `(${nE})/(${linE(c, d)})${squared ? '^2' : ''}`,
    why,
  });
  const S = a * d + b * c;
  const x0 = rng.pick([-2, -1, 0, 1, 2, 3].filter((x) => c * x + d !== 0));
  return {
    name,
    fTex,
    fExpr: `(${linE(a, b)})/(${linE(c, d)})`,
    key: over(String(D), String(D)),
    distractors: [
      over(String(-D), String(-D), "subtracts in the wrong order ($uv'-u'v$ instead of $u'v-uv'$)."),
      { tex: frac(a, c), expr: `${a}/${c}`, why: "divides the derivative of the numerator by the derivative of the denominator ($u'/v'$)." },
      over(String(D), String(D), 'forgets to square the denominator.', false),
      over(lin(2 * a * c, S), linE(2 * a * c, S), "adds the two products ($u'v+uv'$, as in the product rule) instead of subtracting them."),
      over(String(a), String(a), "differentiates only the numerator ($u'/v$).", false),
      ...(Math.abs(S) !== Math.abs(D) ? [over(String(S), String(S), `a sign error when expanding $-${c}\\left(${lin(a, b)}\\right)$.`)] : []),
    ],
    pts: pts([-4.3, -1.7, 0.6, 2.9, 7.1].filter((x) => Math.abs(c * x + d) > 0.2)),
    steps:
      `Quotient rule with $u=${lin(a, b)}$, $u'=${a}$ and $v=${v}$, $v'=${c}$: ` +
      `$$${name}'(x)=\\frac{u'v-uv'}{v^2}=\\frac{${par(a)}\\left(${v}\\right)-${coef(c)}\\left(${lin(a, b)}\\right)}{${sq}}=\\frac{${lin(a * c, a * d)}-\\left(${lin(a * c, b * c)}\\right)}{${sq}}=\\frac{${D}}{${sq}}$$`,
    x0,
    atX0: `\\frac{${D}}{(${c * x0 + d})^2}`,
    fallback: (i) => {
      const n = D + offset(i, D);
      return over(String(n), String(n), 'an arithmetic slip in the numerator.');
    },
    stems: formulaStems(name, fTex, 'quotient rule'),
  };
}

function quadRatioQ(rng: Rng, name: string): FormulaQ {
  let a: number, b: number, k: number;
  do {
    a = rng.sign() * rng.int(1, 5);
    b = rng.sign() * rng.int(1, 9);
    k = rng.int(1, 6);
  } while (a * k - b === 0 || (a === 1 && k === 1));
  const E = 2 * (a * k - b);
  const v = `x^2+${k}`;
  const vE = `(x^2+${k})`;
  const sq = `\\left(${v}\\right)^2`;
  const u = termsTex([[a, 'x^2'], [b, '']]);
  const fTex = `\\dfrac{${u}}{${v}}`;
  const over = (ts: Term[], why?: string, squared = true): FormulaChoice => ({
    tex: `\\dfrac{${termsTex(ts)}}{${squared ? sq : v}}`,
    expr: `(${termsExpr(ts)})/${vE}${squared ? '^2' : ''}`,
    why,
  });
  const x0 = rng.pick([-2, -1, 1, 2, 3]);
  return {
    name,
    fTex,
    fExpr: `(${termsExpr([[a, 'x^2'], [b, '']])})/${vE}`,
    key: over([[E, 'x']]),
    distractors: [
      over([[-E, 'x']], "subtracts in the wrong order ($uv'-u'v$ instead of $u'v-uv'$)."),
      { tex: String(a), expr: String(a), why: `cancels $\\frac{u'}{v'}=\\frac{${2 * a}x}{2x}$ instead of using the quotient rule.` },
      over([[E, 'x']], 'forgets to square the denominator.', false),
      over([[4 * a, 'x^3'], [2 * (a * k + b), 'x']], "adds the two products ($u'v+uv'$) instead of subtracting them."),
      over([[2 * a * k, 'x'], [b, '']], `forgets the brackets around $u$ in $-uv'$: only $${coef(a)}x^2$ is multiplied by $2x$ and $${b}$ is simply added.`),
      over([[E / 2, 'x']], 'differentiates $x^2$ as $x$ (in both $u$ and $v$).'),
    ],
    pts: pts([-2.3, -0.7, 0.4, 1.3, 2.9]),
    steps:
      `Quotient rule with $u=${u}$, $u'=${2 * a}x$ and $v=${v}$, $v'=2x$: ` +
      `$$${name}'(x)=\\frac{${2 * a}x\\left(${v}\\right)-2x\\left(${u}\\right)}{${sq}}=\\frac{${termsTex([[2 * a, 'x^3'], [2 * a * k, 'x']])}-\\left(${termsTex([[2 * a, 'x^3'], [2 * b, 'x']])}\\right)}{${sq}}=\\frac{${E}x}{${sq}}$$`,
    x0,
    atX0: `\\frac{${E}\\cdot ${par(x0)}}{(${x0 * x0 + k})^2}`,
    fallback: (i) => over([[E + 2 * offset(i, E / 2), 'x']], 'an arithmetic slip in the numerator.'),
    stems: formulaStems(name, fTex, 'quotient rule'),
  };
}

function logOverXQ(rng: Rng, name: string): FormulaQ {
  let a: number, b: number;
  do {
    a = rng.sign() * rng.int(1, 6);
    b = rng.int(1, 5);
  } while (a === b);
  const pow = b >= 2 && rng.chance(0.4); // write b ln(x) as ln(x^b), as in the 2025 exam
  const [Lc, Ls]: Term = pow ? [1, `\\ln\\left(x^{${b}}\\right)`] : [b, '\\ln(x)'];
  const lnE = `${b}*log(x)`;
  const u = termsTex([[a, ''], [Lc, Ls]]);
  const fTex = `\\dfrac{${u}}{x}`;
  const ratio = (n: string, nE: string, why?: string, den = 'x^2'): FormulaChoice => ({ tex: `\\dfrac{${n}}{${den}}`, expr: `(${nE})/${den}`, why });
  const keyNum = termsTex([[b - a, ''], [-Lc, Ls]]);
  const tail0 = termsTex([[-a, ''], [-Lc, Ls]]);
  const tail = tail0.startsWith('-') ? tail0 : `+${tail0}`;
  const x0 = rng.pick([2, 3, 4, 5]);
  return {
    name,
    fTex,
    fExpr: `(${a} + ${lnE})/x`,
    key: ratio(keyNum, `${b - a} - ${lnE}`),
    distractors: [
      ratio(termsTex([[a - b, ''], [Lc, Ls]]), `${a - b} + ${lnE}`, "subtracts in the wrong order ($uv'-u'v$ instead of $u'v-uv'$)."),
      ratio(keyNum, `${b - a} - ${lnE}`, 'forgets to square the denominator.', 'x'),
      { tex: `\\dfrac{${b}}{x}`, expr: `${b}/x`, why: "divides the derivative of the numerator by the derivative of the denominator ($u'/v'$)." },
      ratio(`\\frac{${b}}{x}${tail}`, `${b}/x - ${a} - ${lnE}`, "forgets to multiply $u'=\\frac{" + b + "}{x}$ by $v=x$."),
      ratio(termsTex([[b, ''], [-Lc, Ls]]), `${b} - ${lnE}`, `drops the constant $${a}$ of $u$ in the term $-uv'$.`),
      ratio(termsTex([[a + b, ''], [Lc, Ls]]), `${a + b} + ${lnE}`, "adds the two products ($u'v+uv'$) instead of subtracting them."),
    ],
    pts: pts([0.3, 0.8, 1.7, 3.2, 6.5]),
    steps:
      `Quotient rule with $u=${u}$${pow ? ` (note that $${Ls}=${b}\\ln(x)$)` : ''}, $u'=\\frac{${b}}{x}$, and $v=x$, $v'=1$: ` +
      `$$${name}'(x)=\\frac{\\frac{${b}}{x}\\cdot x-\\left(${u}\\right)\\cdot 1}{x^2}=\\frac{${keyNum}}{x^2}$$`,
    x0,
    atX0: `\\frac{${b - a}-${coef(b)}\\ln(${x0})}{${x0 * x0}}`,
    fallback: (i) => {
      const n = b - a + offset(i, b - a);
      return ratio(termsTex([[n, ''], [-Lc, Ls]]), `${n} - ${lnE}`, 'an arithmetic slip in the constant.');
    },
    stems: formulaStems(name, fTex, 'quotient rule'),
  };
}

const quotientRule: Template = {
  id: 'derivatives.quotient-rule',
  topic: 'Derivatives',
  title: "Quotient rule: f'(x) of (ax+b)/(cx+d), (ax²+b)/(x²+k) or (a+b ln x)/x as a formula, or f'(x0)",
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate(ctx) {
    const name = fname(ctx.rng);
    const kind = ctx.rng.pick(['linfrac', 'quad', 'log'] as const);
    const q = kind === 'linfrac' ? linfracQ(ctx.rng, name) : kind === 'quad' ? quadRatioQ(ctx.rng, name) : logOverXQ(ctx.rng, name);
    return finishFormula(ctx, q);
  },
};

// =====================================================================================================================
// 2. Chain rule: ln(u), √u, e^u, k/(a + b ln x) — and h = f∘g from a table
// =====================================================================================================================

/** p(x) = ax² + bx + c, positive for every x (negative discriminant). */
function positiveQuad(rng: Rng) {
  let a: number, b: number, c: number;
  do {
    a = rng.int(1, 4);
    b = rng.int(-6, 6);
    c = rng.int(1, 9);
  } while (b * b >= 4 * a * c || (a === 1 && b === 0 && c === 1));
  const ts: Term[] = [[a, 'x^2'], [b, 'x'], [c, '']];
  return { a, b, c, tex: termsTex(ts), expr: termsExpr(ts), d: lin(2 * a, b), dE: linE(2 * a, b), at: (x: number) => a * x * x + b * x + c };
}

const fc = (tex: string, expr: string, why?: string): FormulaChoice => ({ tex, expr, why });

function lnChainQ(rng: Rng, name: string): FormulaQ {
  const p = positiveQuad(rng);
  const m = rng.pick([1, 1, 2, 3, 5]);
  const fTex = `${coef(m)}\\ln\\left(${p.tex}\\right)`;
  const num1 = lin(2 * p.a * m, p.b * m);
  const x0 = rng.pick([-2, -1, 1, 2, 3].filter((x) => 2 * p.a * x + p.b !== 0));
  return {
    name,
    fTex,
    fExpr: `${m}*log(${p.expr})`,
    key: fc(`\\dfrac{${num1}}{${p.tex}}`, `(${linE(2 * p.a * m, p.b * m)})/(${p.expr})`),
    distractors: [
      fc(`\\dfrac{${m}}{${p.tex}}`, `${m}/(${p.expr})`, `forgets the chain rule: the derivative of the inside, $${p.d}$, is missing.`),
      fc(`\\dfrac{${num1}}{\\left(${p.tex}\\right)^2}`, `(${linE(2 * p.a * m, p.b * m)})/(${p.expr})^2`, 'squares the denominator, as if it were the quotient rule.'),
      fc(`\\dfrac{${m}}{${p.d}}`, `${m}/(${p.dE})`, "takes one over the derivative of the inside ($1/u'$) instead of $u'/u$."),
      fc(`${coef(m)}\\left(${p.d}\\right)\\ln\\left(${p.tex}\\right)`, `${m}*(${p.dE})*log(${p.expr})`, "treats $\\ln$ like $e^{u}$: keeps $\\ln(u)$ and multiplies by $u'$."),
      fc(`${coef(m)}\\ln\\left(${p.d}\\right)`, `${m}*log(${p.dE})`, 'differentiates only the inside and keeps the logarithm.'),
      ...(m !== 1 ? [fc(`\\dfrac{${p.d}}{${p.tex}}`, `(${p.dE})/(${p.expr})`, `drops the constant factor $${m}$.`)] : []),
    ],
    pts: pts([-2.1, -0.6, 0.7, 1.9, 3.4]),
    steps:
      `Chain rule: $\\frac{d}{dx}\\ln(u)=\\frac{u'}{u}$ with $u=${p.tex}$ and $u'=${p.d}$${m !== 1 ? `, times the constant $${m}$` : ''}: ` +
      `$$${name}'(x)=${m !== 1 ? `${m}\\cdot\\frac{${p.d}}{${p.tex}}=` : ''}\\frac{${num1}}{${p.tex}}$$`,
    x0,
    atX0: `\\frac{${m * (2 * p.a * x0 + p.b)}}{${p.at(x0)}}`,
    fallback: (i) => fc(`\\dfrac{${lin(2 * p.a * m, p.b * m + offset(i, p.b * m))}}{${p.tex}}`, `(${linE(2 * p.a * m, p.b * m + offset(i, p.b * m))})/(${p.expr})`, 'an arithmetic slip in the derivative of the inside.'),
    stems: formulaStems(name, fTex, 'chain rule'),
  };
}

function sqrtChainQ(rng: Rng, name: string): FormulaQ {
  const p = positiveQuad(rng);
  const fTex = `\\sqrt{${p.tex}}`;
  const root = `\\sqrt{${p.tex}}`;
  const rootE = `sqrt(${p.expr})`;
  const x0 = rng.pick([-2, -1, 1, 2, 3].filter((x) => 2 * p.a * x + p.b !== 0));
  return {
    name,
    fTex,
    fExpr: rootE,
    key: fc(`\\dfrac{${p.d}}{2${root}}`, `(${p.dE})/(2*${rootE})`),
    distractors: [
      fc(`\\dfrac{1}{2${root}}`, `1/(2*${rootE})`, `forgets the chain rule: the derivative of the inside, $${p.d}$, is missing.`),
      fc(`\\dfrac{${p.d}}{${root}}`, `(${p.dE})/${rootE}`, 'forgets the factor $\\frac12$ from $\\frac{d}{du}u^{1/2}=\\frac12u^{-1/2}$.'),
      fc(`\\frac{1}{2}\\left(${p.d}\\right)${root}`, `0.5*(${p.dE})*${rootE}`, "does not lower the exponent: writes $\\frac12u^{1/2}u'$ instead of $\\frac12u^{-1/2}u'$."),
      fc(`\\dfrac{1}{2\\sqrt{${p.d}}}`, `1/(2*sqrt(${p.dE}))`, 'takes the root of the derivative of the inside.'),
      fc(`-\\dfrac{${p.d}}{2\\left(${p.tex}\\right)${root}}`, `-(${p.dE})/(2*(${p.expr})*${rootE})`, "lowers the exponent twice: uses $-\\frac12u^{-3/2}u'$."),
    ],
    pts: pts([-2.1, -0.6, 0.7, 1.9, 3.4]),
    steps:
      `Write $${name}(x)=u^{1/2}$ with $u=${p.tex}$, $u'=${p.d}$. Chain rule: $$${name}'(x)=\\frac12u^{-1/2}\\cdot u'=\\frac{${p.d}}{2${root}}$$`,
    x0,
    atX0: `\\frac{${2 * p.a * x0 + p.b}}{2\\sqrt{${p.at(x0)}}}`,
    fallback: (i) => fc(`\\dfrac{${lin(2 * p.a, p.b + offset(i, p.b))}}{2${root}}`, `(${linE(2 * p.a, p.b + offset(i, p.b))})/(2*${rootE})`, 'an arithmetic slip in the derivative of the inside.'),
    stems: formulaStems(name, fTex, 'chain rule'),
  };
}

function expChainQ(rng: Rng, name: string): FormulaQ {
  const a = rng.sign() * rng.int(1, 3);
  const b = rng.sign() * rng.int(1, 6);
  const qT: Term[] = [[a, 'x^2'], [b, 'x']];
  const qTex = termsTex(qT);
  const qE = termsExpr(qT);
  const d = lin(2 * a, b);
  const dE = linE(2 * a, b);
  const fTex = `e^{${qTex}}`;
  const x0 = [-1, 1, 2, -2].find((x) => Math.abs(a * x * x + b * x) <= 4 && 2 * a * x + b !== 0) ?? 0;
  return {
    name,
    fTex,
    fExpr: `exp(${qE})`,
    key: fc(`\\left(${d}\\right)e^{${qTex}}`, `(${dE})*exp(${qE})`),
    distractors: [
      fc(`e^{${qTex}}`, `exp(${qE})`, `forgets the chain rule: the derivative of the exponent, $${d}$, is missing.`),
      fc(`\\left(${qTex}\\right)e^{${termsTex([...qT, [-1, '']])}}`, `(${qE})*exp(${qE} - 1)`, 'uses the power rule on $e^{u}$ (as if $e$ were the variable).'),
      fc(`e^{${d}}`, `exp(${dE})`, 'differentiates only the exponent and keeps the $e$.'),
      fc(`\\left(${d}\\right)e^{${d}}`, `(${dE})*exp(${dE})`, 'also replaces the exponent by its derivative.'),
      fc(d, dE, 'drops the exponential factor altogether.'),
      fc(`\\left(${lin(a, b)}\\right)e^{${qTex}}`, `(${linE(a, b)})*exp(${qE})`, `differentiates $${coef(a)}x^2$ as $${coef(a)}x$.`),
    ],
    pts: pts([-1.3, -0.4, 0.3, 0.9, 1.6]),
    steps: `Chain rule: $\\frac{d}{dx}e^{u}=e^{u}\\cdot u'$ with $u=${qTex}$ and $u'=${d}$: $$${name}'(x)=\\left(${d}\\right)e^{${qTex}}$$`,
    x0,
    atX0: `(${2 * a * x0 + b})\\,e^{${a * x0 * x0 + b * x0}}`,
    fallback: (i) => fc(`\\left(${lin(2 * a, b + offset(i, b))}\\right)e^{${qTex}}`, `(${linE(2 * a, b + offset(i, b))})*exp(${qE})`, 'an arithmetic slip in the derivative of the exponent.'),
    stems: formulaStems(name, fTex, 'chain rule'),
  };
}

function recipLnQ(rng: Rng, name: string): FormulaQ {
  const a = rng.int(1, 6);
  const b = rng.int(1, 4);
  const k = rng.int(1, 9);
  const den = `${a}+${coef(b)}\\ln(x)`;
  const denE = `(${a} + ${b}*log(x))`;
  const fTex = `\\dfrac{${k}}{${den}}`;
  const x0 = rng.pick([1, 2, 3]);
  return {
    name,
    fTex,
    fExpr: `${k}/${denE}`,
    key: fc(`-\\dfrac{${k * b}}{x\\left(${den}\\right)^2}`, `-${k * b}/(x*${denE}^2)`),
    distractors: [
      fc(`-\\dfrac{${k}}{\\left(${den}\\right)^2}`, `-${k}/${denE}^2`, `forgets the derivative of the inside, $\\frac{${b}}{x}$.`),
      fc(`\\dfrac{${k * b}}{x\\left(${den}\\right)^2}`, `${k * b}/(x*${denE}^2)`, 'loses the minus sign of $\\frac{d}{du}u^{-1}=-u^{-2}$.'),
      fc(`-\\dfrac{${k * b}}{x\\left(${den}\\right)}`, `-${k * b}/(x*${denE})`, 'does not square the denominator (uses $-u^{-1}$ instead of $-u^{-2}$).'),
      fc(`-\\dfrac{${k * b}}{\\left(${den}\\right)^2}`, `-${k * b}/${denE}^2`, `forgets the factor $\\frac1x$ from the derivative of $\\ln(x)$.`),
      fc(`\\dfrac{${k}x}{${b}}`, `${k}*x/${b}`, `divides $${k}$ by the derivative of the denominator.`),
      ...(b !== 1 ? [fc(`-\\dfrac{${k}}{x\\left(${den}\\right)^2}`, `-${k}/(x*${denE}^2)`, `forgets the factor $${b}$ in front of $\\ln(x)$.`)] : []),
    ],
    pts: pts([1.1, 1.6, 2.5, 4, 7]),
    steps:
      `Write $${name}(x)=${coef(k)}u^{-1}$ with $u=${den}$ and $u'=\\frac{${b}}{x}$. Chain rule: ` +
      `$$${name}'(x)=-${coef(k)}u^{-2}\\cdot u'=-\\frac{${k}}{\\left(${den}\\right)^2}\\cdot\\frac{${b}}{x}=-\\frac{${k * b}}{x\\left(${den}\\right)^2}$$`,
    x0,
    atX0: `-\\frac{${k * b}}{${x0}\\left(${a}+${b}\\ln(${x0})\\right)^2}`,
    fallback: (i) => {
      const n = k * b + offset(i, k * b);
      return fc(`-\\dfrac{${n}}{x\\left(${den}\\right)^2}`, `-${n}/(x*${denE}^2)`, 'an arithmetic slip in the constant.');
    },
    stems: formulaStems(name, fTex, 'chain rule'),
  };
}

/** h(x) = F(G(x)) with values of F, G, F', G' read from a table (chain rule with numbers). */
function chainTable({ rng, type, optionCount }: GenContext): Generated {
  const [F, G] = rng.pick([['f', 'g'], ['p', 'q'], ['u', 'v']] as const);
  const s = rng.int(0, 1);
  const xs = [s, s + 1, s + 2, s + 3];
  let rows: { x: number; f: number; g: number; df: number; dg: number }[];
  let x0: number;
  do {
    rows = xs.map((x) => ({ x, f: rng.int(-6, 9), g: rng.pick(xs), df: rng.sign() * rng.int(1, 6), dg: rng.sign() * rng.int(1, 6) }));
    x0 = rng.pick(xs);
  } while (rows[x0 - s].g === x0);
  const r = (x: number) => rows[x - s];
  const gx = r(x0).g;
  const key = r(gx).df * r(x0).dg;
  const stem =
    `The table lists some values of two differentiable functions $${F}$ and $${G}$ and of their derivatives. ` +
    `Define $h(x)=${F}\\big(${G}(x)\\big)$. What is $h'(${x0})$?`;
  const table = {
    header: ['$x$', `$${F}(x)$`, `$${G}(x)$`, `$${F}'(x)$`, `$${G}'(x)$`],
    rows: rows.map((w) => [w.x, w.f, w.g, w.df, w.dg].map((v) => `$${v}$`)),
  };
  const explanation =
    `Chain rule: $h'(x)=${F}'\\big(${G}(x)\\big)\\cdot ${G}'(x)$. From the table, $${G}(${x0})=${gx}$ and $${G}'(${x0})=${r(x0).dg}$, and in the row $x=${gx}$: $${F}'(${gx})=${r(gx).df}$. So ` +
    `$$h'(${x0})=${F}'(${gx})\\cdot ${G}'(${x0})=${r(gx).df}\\cdot ${par(r(x0).dg)}=${key}$$`;
  if (type === 'numeric') return { type, stem, table, instruction: INSTRUCTION.numeric(0), correctAnswer: key, tolerance: 0, explanation };
  const fx = r(x0).f;
  const mistakes: Choice[] = [
    { text: '', value: r(x0).df * r(x0).dg, why: `evaluates $${F}'$ at $${x0}$ instead of at $${G}(${x0})=${gx}$.` },
    { text: '', value: r(gx).df, why: `forgets the inner derivative $${G}'(${x0})$.` },
    { text: '', value: r(gx).f * r(x0).dg, why: `uses $${F}(${gx})$ instead of $${F}'(${gx})$.` },
    { text: '', value: r(gx).df * gx, why: `multiplies by $${G}(${x0})$ instead of $${G}'(${x0})$.` },
    ...(xs.includes(fx) ? [{ text: '', value: r(fx).dg * r(x0).df, why: `differentiates $${G}\\big(${F}(x)\\big)$ instead: inner and outer function swapped.` }] : []),
  ].map((c) => ({ ...c, text: `$${c.value}$` }));
  const mcq = buildMcq(rng, { text: `$${key}$`, value: key }, mistakes, { count: optionCount, order: 'ascending', fallback: integerFallback(key, (v) => `$${v}$`) });
  return { type, stem, table, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
}

const chainRule: Template = {
  id: 'derivatives.chain-rule',
  topic: 'Derivatives',
  title: "Chain rule: f'(x) of k·ln(p(x)), √p(x), e^{q(x)} or k/(a + b ln x) as a formula or f'(x0); or h'(x0) for h = f∘g from a table",
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate(ctx) {
    const name = fname(ctx.rng);
    const kind = ctx.rng.pick(['ln', 'sqrt', 'exp', 'recip-ln', 'table'] as const);
    if (kind === 'table') return chainTable(ctx);
    const q = { ln: lnChainQ, sqrt: sqrtChainQ, exp: expChainQ, 'recip-ln': recipLnQ }[kind](ctx.rng, name);
    return finishFormula(ctx, q);
  },
};

// =====================================================================================================================
// 3. Tangent lines, tangency parameter, marginal (linear) approximation
// =====================================================================================================================

const lineTex = (m: number, q: number) => sumTex([[m, 'x'], [q, '']]);
const lineChoice = (m: number, q: number, why?: string): FormulaChoice => ({ tex: lineTex(m, q), expr: `(${m})*x + (${q})`, why });

function tangentLine({ rng, type, optionCount }: GenContext): Generated {
  const name = fname(rng);
  const fam = rng.pick(['ln-ratio', 'sqrt', 'exp'] as const);
  let fTex: string, fExpr: string, x0: number, y0: number, m: number, deriv: string;
  let wrong: { m: number; why: string }[];
  if (fam === 'ln-ratio') {
    let a: number, b: number;
    do {
      a = rng.sign() * rng.int(1, 6);
      b = rng.sign() * rng.int(1, 5);
    } while (a === b);
    fTex = `\\dfrac{${termsTex([[a, ''], [b, '\\ln(x)']])}}{x}`;
    fExpr = `(${a} + ${b}*log(x))/x`;
    [x0, y0, m] = [1, a, b - a];
    deriv =
      `Quotient rule: $$${name}'(x)=\\frac{\\frac{${b}}{x}\\cdot x-\\left(${termsTex([[a, ''], [b, '\\ln(x)']])}\\right)}{x^2}=\\frac{${termsTex([[b - a, ''], [-b, '\\ln(x)']])}}{x^2}$$` +
      `Since $\\ln(1)=0$: $${name}(1)=${a}$ and $${name}'(1)=${b}-(${a})=${b - a}$.`;
    wrong = [
      { m: a + b, why: "adds the two products in the quotient rule ($u'v+uv'$), giving slope " + `$${a + b}$.` },
      { m: b, why: `differentiates only the numerator, giving slope $${b}$.` },
      { m: a - b, why: "subtracts in the wrong order in the quotient rule, giving slope " + `$${a - b}$.` },
    ];
  } else if (fam === 'sqrt') {
    const s = rng.int(2, 4);
    const a = rng.int(1, 9);
    x0 = rng.int(1, 6);
    const b = s * s - a * x0;
    fTex = `\\sqrt{${lin(a, b)}}`;
    fExpr = `sqrt(${linE(a, b)})`;
    [y0, m] = [s, a / (2 * s)];
    deriv = `Chain rule: $$${name}'(x)=\\frac{${a}}{2\\sqrt{${lin(a, b)}}}$$ At $x=${x0}$: $${a}\\cdot ${x0} ${sgn(b)}=${s * s}$, so $${name}(${x0})=\\sqrt{${s * s}}=${s}$ and $${name}'(${x0})=\\frac{${a}}{2\\cdot ${s}}=${numTex(m)}$.`;
    wrong = [
      { m: 1 / (2 * s), why: `forgets the inner derivative $${a}$, giving slope $${numTex(1 / (2 * s))}$.` },
      { m: a / s, why: `forgets the factor $\\frac12$, giving slope $${numTex(a / s)}$.` },
      { m: (a * s) / 2, why: `does not lower the exponent ($\\frac12u^{1/2}u'$), giving slope $${numTex((a * s) / 2)}$.` },
    ];
  } else {
    const a = rng.sign() * rng.int(1, 5);
    let b = rng.sign() * rng.int(1, 6);
    if (a + b === 0) b += rng.sign() * 2; // f(1) = a + b ≠ 0 (a tangent through the origin is too degenerate)
    const c = rng.sign() * rng.int(1, 3);
    const ex = `${coef(c)}(x-1)`;
    fTex = `\\left(${lin(a, b)}\\right)e^{${ex}}`;
    fExpr = `(${linE(a, b)})*exp(${c}*(x-1))`;
    [x0, y0, m] = [1, a + b, a + c * (a + b)];
    deriv =
      `Product rule and chain rule: $$${name}'(x)=${a}e^{${ex}}+${par(c)}\\left(${lin(a, b)}\\right)e^{${ex}}$$` +
      `Since $e^{0}=1$: $${name}(1)=${a + b}$ and $${name}'(1)=${a}+${par(c)}\\cdot ${par(a + b)}=${m}$.`;
    wrong = [
      { m: a, why: `forgets to differentiate the factor $e^{${ex}}$, giving slope $${a}$.` },
      { m: c * (a + b), why: `differentiates only the exponential factor, giving slope $${c * (a + b)}$.` },
      { m: a * c, why: `multiplies the two derivatives ($u'v'$), giving slope $${a * c}$.` },
    ];
  }
  // self-check of the hand-derived value and slope against mathjs
  ensure(Math.abs(evalAt(fExpr, { x: x0 }) - y0) < 1e-9 && Math.abs(evalAt(diff(fExpr), { x: x0 }) - m) < 1e-9, `tangent at ${fExpr}`);
  const q = y0 - m * x0;
  const pm = (v: number) => (v < 0 ? `-${numTex(-v)}` : `+${numTex(v)}`);
  const explanation = `${deriv}\nThe tangent line is $$y=${name}(${x0})+${name}'(${x0})(x-${x0})=${numTex(y0)}${pm(m)}(x-${x0})$$ which simplifies to $y=${lineTex(m, q)}$.`;
  if (type === 'numeric') {
    const dp = 2;
    const f = numericField('value', undefined, q, dp);
    const stem = `The tangent line to the graph of $$${name}(x)=${fTex}$$ at the point with $x=${x0}$ can be written as $y=mx+b$. Calculate $b$, the height at which this line crosses the vertical axis.`;
    return { type, stem, instruction: INSTRUCTION.numeric(dp), correctAnswer: f.answer, tolerance: f.tolerance, explanation: `${explanation}\nSo $b=${numTex(q)}${Number.isInteger(q) ? '' : `\\approx ${num(q, dp)}`}$.` };
  }
  const key = lineChoice(m, q);
  const distractors = [
    lineChoice(m, y0, `forgets to shift to the point: uses $y=${name}'(${x0})\\,x+${name}(${x0})$.`),
    lineChoice(m, y0 + m * x0, `a sign error: uses $(x+${x0})$ instead of $(x-${x0})$.`),
    lineChoice(y0, m - y0 * x0, `swaps the roles of $${name}(${x0})$ (value) and $${name}'(${x0})$ (slope).`),
    lineChoice(0, y0, 'takes the horizontal line through the point, as if the slope were 0.'),
    ...wrong.map((w) => lineChoice(w.m, y0 - w.m * x0, w.why)),
  ];
  const stem = rng.pick([
    `Find the tangent line to the graph of $$${name}(x)=${fTex}$$ at the point where $x=${x0}$.`,
    `Which line touches the graph of $$${name}(x)=${fTex}$$ at $x=${x0}$?`,
    `The line $l$ is tangent to the graph of $$${name}(x)=${fTex}$$ at $x=${x0}$. What is the equation of $l$?`,
  ]);
  const mcq = formulaMcq(rng, key, rng.shuffle(distractors), {
    count: optionCount,
    pts: [[-1], [0], [2], [3.5]],
    label: 'y=',
    fallback: (i) => lineChoice(m, q + offset(i, q), 'an arithmetic slip in the constant term.'),
  });
  return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
}

function tangentParameter({ rng, type, optionCount }: GenContext): Generated {
  const name = fname(rng);
  let k: number, xs: number, p: number, q: number, m: number, a: number;
  do {
    k = rng.pick([1, 1, 2, 3, -1, -2]);
    xs = rng.sign() * rng.int(1, 3);
    p = rng.int(-6, 6);
    q = rng.int(-9, 9);
    m = 2 * k * xs + p;
    a = m * xs + q - k * xs * xs - p * xs;
  } while (m === 0 || a === q);
  const ys = m * xs + q;
  const fTex = `${termsTex([[k, 'x^2'], [p, 'x']])}+a`;
  const line = `y=${termsTex([[m, 'x'], [q, '']])}`;
  const stem = rng.pick([
    `The line $${line}$ touches the graph of $$${name}(x)=${fTex}$$ for exactly one value of the constant $a$. Determine this value of $a$.`,
    `Let $$${name}(x)=${fTex}$$ where $a$ is a constant. Find $a$ such that the line $${line}$ is a tangent line of $${name}$.`,
  ]);
  const fAt = (x: number) => k * x * x + p * x;
  const explanation =
    `At the touching point the slopes are equal: $${name}'(x)=${lin(2 * k, p)}=${m}$, so $x=${xs}$. ` +
    `The line passes through $(${xs},\\,${ys})$ because $${m}\\cdot ${par(xs)}${q === 0 ? '' : sgn(q)}=${ys}$. ` +
    `The graph must pass through the same point: $$${name}(${xs})=${fAt(xs)}+a=${ys}\\;\\Rightarrow\\; a=${a}$$`;
  if (type === 'numeric') return { type, stem, instruction: INSTRUCTION.numeric(0), correctAnswer: a, tolerance: 0, explanation };
  const at = (x: number) => m * x + q - fAt(x); // the value of a that makes the graph pass through the line at x
  const xv = -p / (2 * k);
  const xsign = (m + p) / (2 * k);
  const mistakes = [
    { value: q, why: `sets the constant terms equal ($a=${q}$) without using the slope.` },
    { value: at(xv), why: `solves $${name}'(x)=0$ (the top of the parabola) instead of $${name}'(x)=${m}$.` },
    { value: at(xsign), why: `a sign error when solving $${lin(2 * k, p)}=${m}$ (gets $x=${numTex(xsign)}$).` },
    { value: ys, why: 'takes the $y$-coordinate of the touching point as $a$.' },
    { value: q - fAt(xs), why: `uses the intercept $${q}$ of the line instead of its value at $x=${xs}$.` },
  ];
  const fmt = (v: number) => `$a=${numTex(v)}$`;
  const mcq = buildMcq(
    rng,
    { text: fmt(a), value: a },
    mistakes.map((c) => ({ text: fmt(c.value), value: c.value, why: c.why })),
    { count: optionCount, order: 'ascending', fallback: integerFallback(a, fmt) },
  );
  return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
}

const MARGINAL = [
  { x: 'p', y: 'v', xd: 'the ticket price $p$ (in euros) of a theme park', yd: 'the number of visitors $v$ (in hundreds per day)', yw: 'number of visitors', unit: 'hundred visitors', inc: false },
  { x: 'w', y: 'R', xd: 'the cargo weight $w$ (in kg) of a delivery drone', yd: 'its range $R$ (in km)', yw: 'range', unit: 'km', inc: false },
  { x: 's', y: 'T', xd: 'the number of staff hours $s$ per day at a help desk', yd: 'the average waiting time $T$ (in minutes)', yw: 'waiting time', unit: 'minutes', inc: false },
  { x: 'b', y: 'S', xd: 'the advertising budget $b$ (in thousands of euros)', yd: 'the weekly sales $S$ (in thousands of units)', yw: 'weekly sales', unit: 'thousand units', inc: true },
  { x: 'h', y: 'G', xd: 'the number of study hours $h$', yd: 'the expected exam grade $G$', yw: 'expected grade', unit: 'grade points', inc: true },
  { x: 'd', y: 'Y', xd: 'the dose of fertiliser $d$ (in kg per hectare)', yd: 'the crop yield $Y$ (in tonnes per hectare)', yw: 'yield', unit: 'tonnes per hectare', inc: true },
] as const;

function marginalApprox({ rng, type, optionCount }: GenContext): Generated {
  const c = rng.pick(MARGINAL);
  let D: number, A: number, dmag: number, C: number;
  do {
    D = rng.pick([10, 20, 25, 40, 50]);
    A = rng.pick([2, 4, 5, 8, 10].filter((v) => v < D));
    dmag = rng.pick([0.04, 0.05, 0.06, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4]);
    C = Math.round(dmag * D * D);
  } while (Math.abs(C - dmag * D * D) > 1e-9 || C / D < 2.5);
  const x0 = D - A;
  const B = c.inc ? Math.ceil(C / D) + rng.int(1, 8) : rng.int(1, Math.floor(C / D - 1));
  const dx = rng.pick([1, 2, 5, -1, -2, -5, 0.5, -0.5].filter((v) => x0 + v > 0));
  const slope = (c.inc ? 1 : -1) * dmag; // y'(x0) = ±C/(x0 + A)²
  const v = slope * dx;
  const dp = Math.abs(v) < 0.1 ? 3 : 2;
  const rel = c.inc ? `\\left(${c.x}+${A}\\right)\\left(${B}-${c.y}\\right)=${C}` : `\\left(${c.x}+${A}\\right)\\left(${c.y}+${B}\\right)=${C}`;
  const yOf = c.inc ? `${B}-\\frac{${C}}{${c.x}+${A}}` : `\\frac{${C}}{${c.x}+${A}}-${B}`;
  const dyOf = `${c.inc ? '' : '-'}\\frac{${C}}{\\left(${c.x}+${A}\\right)^2}`;
  const cap = c.xd.charAt(0).toUpperCase() + c.xd.slice(1);
  const base =
    `${cap} and ${c.yd} are related by $$${rel}$$ Consider $${c.y}$ as a function of $${c.x}$. ` +
    `Use the derivative of $${c.y}(${c.x})$ to approximate the change in the ${c.yw} when $${c.x}$ ${dx > 0 ? 'increases' : 'decreases'} from $${x0}$ to $${num(x0 + dx)}$.`;
  const explanation =
    `Solve for $${c.y}$: $${c.y}(${c.x})=${yOf}$, so $${c.y}'(${c.x})=${dyOf}$. ` +
    `At $${c.x}=${x0}$: $${c.y}'(${x0})=${c.inc ? '' : '-'}\\frac{${C}}{${D}^2}=${num(slope, 4)}$. With $\\Delta ${c.x}=${num(dx)}$: ` +
    `$$\\Delta ${c.y}\\approx ${c.y}'(${x0})\\cdot\\Delta ${c.x}=${num(slope, 4)}\\cdot ${par(dx)}=${num(v, 4)}$$` +
    `The ${c.yw} ${v > 0 ? 'increases' : 'decreases'} by about ${num(Math.abs(v), dp)} ${c.unit}.`;
  if (type === 'numeric') {
    const f = numericField('value', undefined, v, dp);
    return {
      type,
      stem: `${base} Give the approximate change in $${c.y}$ (in ${c.unit}; negative for a decrease).`,
      instruction: INSTRUCTION.numeric(dp),
      correctAnswer: f.answer,
      tolerance: f.tolerance,
      explanation,
    };
  }
  const fmt = (w: number) => `The ${c.yw} ${w > 0 ? 'increases' : 'decreases'} by about ${num(Math.abs(w), Math.abs(w) < 0.1 ? 3 : 2)} ${c.unit}.`;
  const mistakes = [
    { value: -v, why: `gets the sign of the derivative wrong (${c.inc ? 'misses that' : 'misses the minus sign:'} $${c.y}'(${c.x})=${dyOf}$).` },
    { value: 10 * v, why: 'misplaces the decimal point (a factor 10 too large).' },
    { value: v / 10, why: 'misplaces the decimal point (a factor 10 too small).' },
    { value: -10 * v, why: 'wrong sign and a factor 10 too large.' },
    { value: -v / 10, why: 'wrong sign and a factor 10 too small.' },
    { value: slope, why: `forgets to multiply by $\\Delta ${c.x}=${num(dx)}$ and gives the derivative itself.` },
  ];
  const mcq = buildMcq(
    rng,
    { text: fmt(v), value: v },
    mistakes.map((w) => ({ text: fmt(w.value), value: w.value, why: w.why })),
    { count: optionCount, order: 'ascending', fallback: (i) => ({ text: fmt(v * (2 + i)), value: v * (2 + i) }) },
  );
  return { type, stem: base, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
}

const tangentLines: Template = {
  id: 'derivatives.tangent-line',
  topic: 'Derivatives',
  title: 'Tangent line at a point (quotient with ln, root, product with e), parameter a that makes a line tangent, or marginal approximation of a change',
  types: ['single-choice', 'numeric'],
  difficulty: 3,
  generate(ctx) {
    const kind = ctx.rng.pick(['line', 'line', 'parameter', 'marginal'] as const);
    return kind === 'line' ? tangentLine(ctx) : kind === 'parameter' ? tangentParameter(ctx) : marginalApprox(ctx);
  },
};

export const TEMPLATES: Template[] = [productExpAtZero, quotientRule, chainRule, tangentLines];
