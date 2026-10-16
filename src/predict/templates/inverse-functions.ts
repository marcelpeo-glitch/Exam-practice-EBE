// Templates for the topic "Inverse functions" (QM1 past exams: (3x−2)/(2x−3), 1/(1+ln x), √(x/(x−1)) for x>1,
// x²/(x²+1) for x>0, ln(x²+1) for x>0, the sigmoid 1/(1+e^{−x})). The inverse is derived in code and checked
// numerically (f⁻¹(f(x)) = x on sample points, assertInverse); wrong options come from modelled algebra mistakes and are
// dropped when they happen to be the same function as the key. See inverse-functions.test.ts for the independent checks.
import { INSTRUCTION, mistakesNote, num, numericField, sgn } from '../build';
import { frac, gcd } from '../mathx';
import type { Rng } from '../rng';
import type { Generated, Template } from '../types';
import { assertInverse, coef, formulaMcq, imagePts, lin, linE, realFn, recipCoef, termsTex, type FormulaChoice } from './_fnderiv';

const pickName = (rng: Rng) => rng.pick(['g', 'h', 'k', 'q'] as const);

/** A ratio (n1·y + n0)/(d1·y + d0) with the y-coefficient of the denominator made positive. */
function ratio(n1: number, n0: number, d1: number, d0: number, why?: string, v = 'y'): FormulaChoice {
  if (d1 < 0 || (d1 === 0 && d0 < 0)) [n1, n0, d1, d0] = [-n1, -n0, -d1, -d0];
  return { tex: `\\dfrac{${lin(n1, n0, v)}}{${lin(d1, d0, v)}}`, expr: `(${linE(n1, n0, v)})/(${linE(d1, d0, v)})`, why };
}

/** Finishes a single-choice or numeric inverse question. */
function finish(
  type: Generated['type'],
  rng: Rng,
  optionCount: number,
  parts: {
    stem: string;
    numericStem: string;
    explanation: string;
    numericExplanation: string;
    key: FormulaChoice;
    distractors: FormulaChoice[];
    pts: number[][];
    label: string;
    answer: number;
    dp: number;
    fallback: (i: number) => FormulaChoice;
    vars?: string[];
  },
): Generated {
  if (type === 'numeric') {
    const f = numericField('x', undefined, parts.answer, parts.dp);
    return { type, stem: parts.numericStem, instruction: INSTRUCTION.numeric(parts.dp), correctAnswer: f.answer, tolerance: f.tolerance, explanation: parts.explanation + '\n' + parts.numericExplanation };
  }
  const mcq = formulaMcq(rng, parts.key, rng.shuffle(parts.distractors), { count: optionCount, pts: parts.pts, label: parts.label, vars: parts.vars ?? ['y'], fallback: parts.fallback });
  return { type, stem: parts.stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: parts.explanation + mistakesNote(mcq.distractors) };
}

// =====================================================================================================================
// 1. Linear fractional function (ax + b)/(cx + d)
// =====================================================================================================================

/** Worked substitution x = (b − d·y0)/(c·y0 − a): the fraction, reduced, and its decimal value ("=" when exact). */
function numericLF(name: string, a: number, b: number, c: number, d: number, y0: number, x0: number, fExpr: string): string {
  const N = b - d * y0;
  const Dn = c * y0 - a;
  const exact = Math.abs(x0 * 1e4 - Math.round(x0 * 1e4)) < 1e-6;
  const steps = [`\\dfrac{${b}-(${d})(${y0})}{(${c})(${y0})-(${a})}`, `\\dfrac{${N}}{${Dn}}`];
  const g = gcd(N, Dn);
  if (g > 1 && Math.abs(Dn / g) !== 1) steps.push(frac(N, Dn));
  const value = exact ? `=${num(x0, 4)}` : `\\approx ${num(x0, 4)}`;
  return `With $y=${y0}$: $$${name}^{-1}(${y0})=${steps.join('=')}${value}$$ Check: $${name}(${num(x0, 4)})${exact ? '=' : '\\approx '}${num(realFn(fExpr)(x0), 4)}$.`;
}

const linearFractional: Template = {
  id: 'inverse-functions.linear-fractional',
  topic: 'Inverse functions',
  title: 'Inverse of f(x) = (ax + b)/(cx + d) (solve y(cx + d) = ax + b for x), or evaluate it',
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    let a: number, b: number, c: number, d: number;
    do {
      a = rng.sign() * rng.int(1, 6);
      b = rng.sign() * rng.int(1, 9);
      c = rng.sign() * rng.int(1, 5);
      d = rng.sign() * rng.int(1, 9);
    } while (a * d - b * c === 0);
    const name = pickName(rng);
    const fTex = `\\dfrac{${lin(a, b)}}{${lin(c, d)}}`;
    const fExpr = `(${linE(a, b)})/(${linE(c, d)})`;
    const key = ratio(-d, b, c, -a); // x = (b − dy)/(cy − a)
    const xs = [-4.3, -1.7, 0.6, 2.9, 7.1, 11.3].filter((x) => Math.abs(c * x + d) > 0.2);
    assertInverse(fExpr, key.expr, xs);

    const explanation =
      `Write $y=${fTex}$ and solve for $x$:\n` +
      `$$y\\left(${lin(c, d)}\\right)=${lin(a, b)} \\;\\Rightarrow\\; ${termsTex([[c, 'xy'], [d, 'y']])}=${lin(a, b)} \\;\\Rightarrow\\; ${termsTex([[c, 'xy'], [-a, 'x']])}=${termsTex([[b, ''], [-d, 'y']])}$$` +
      `$$x\\left(${lin(c, -a, 'y')}\\right)=${termsTex([[b, ''], [-d, 'y']])} \\;\\Rightarrow\\; x=\\dfrac{${termsTex([[b, ''], [-d, 'y']])}}{${lin(c, -a, 'y')}}$$` +
      `So $${'NAME'}^{-1}(y)=${key.tex}$.`;
    const named = explanation.replace('NAME', name);

    const distractors: FormulaChoice[] = [
      { ...ratio(c, d, a, b), why: `takes the reciprocal $1/${name}$ instead of the inverse function.` },
      { ...ratio(a, b, c, d), why: `only renames $x$ into $y$ without solving for $x$.` },
      ratio(d, b, c, -a, 'sign error when moving the term with $y$ to the other side.'),
      ratio(d, -b, c, -a, 'sign error when dividing by the factor in front of $x$.'),
      ...(b !== d ? [ratio(0, b - d, c, -a, `forgets to multiply $${d}$ by $y$ when expanding the brackets.`)] : []),
      ratio(-a, b, c, -d, `mixes up the coefficient of $x$ in the numerator ($${a}$) and the constant in the denominator ($${d}$).`),
      ratio(c, -a, -d, b, 'turns the correct fraction upside down.'),
    ];
    const pts = imagePts(fExpr, xs);
    // numeric: f⁻¹(y0) for a small integer y0, preferring an answer with at most 2 decimals
    let y0 = 0;
    let x0 = NaN;
    for (const cand of rng.shuffle([-4, -3, -2, -1, 2, 3, 4, 5, 6])) {
      if (c * cand - a === 0) continue;
      const v = (b - d * cand) / (c * cand - a);
      if (Number.isNaN(x0) || (Math.abs(Math.round(v * 100) - v * 100) < 1e-9 && !(Math.abs(Math.round(x0 * 100) - x0 * 100) < 1e-9))) {
        y0 = cand;
        x0 = v;
      }
    }
    const stem = rng.pick([
      `Consider the function $$${name}(x)=${fTex}$$ Which formula describes its inverse function $${name}^{-1}(y)$?`,
      `The function $$${name}(x)=${fTex}$$ is invertible on its domain. Its inverse $${name}^{-1}(y)$ equals`,
      `Find the inverse function $${name}^{-1}(y)$ of $$${name}(x)=${fTex}$$`,
    ]);
    return finish(type, rng, optionCount, {
      stem,
      numericStem: `The function $$${name}(x)=${fTex}$$ is invertible on its domain. Calculate $${name}^{-1}(${y0})$, i.e. the value of $x$ for which $${name}(x)=${y0}$.`,
      explanation: named,
      numericExplanation: numericLF(name, a, b, c, d, y0, x0, fExpr),
      key,
      distractors,
      pts,
      label: `${name}^{-1}(y)=`,
      answer: x0,
      dp: 2,
      fallback: (i) => ratio(-d, b + i + 1, c, -a, 'an arithmetic slip in the constant term.'),
    });
  },
};

// =====================================================================================================================
// 2. Logarithms and exponentials: c/(a + b ln x), ln(ax² + b), B e^{kx} + A
// =====================================================================================================================

type LKind = 'log-recip' | 'ln-quad' | 'exp-affine';

const expLog: Template = {
  id: 'inverse-functions.exp-log',
  topic: 'Inverse functions',
  title: 'Inverse of c/(a + b ln x), ln(ax² + b) (x > 0) or Be^{kx} + A: undo ln with e and e with ln',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const kind = rng.pick<LKind>(['log-recip', 'ln-quad', 'exp-affine']);
    const name = pickName(rng);
    if (kind === 'log-recip') {
      let a: number, b: number, c: number;
      do {
        a = rng.int(1, 5);
        b = rng.int(1, 3);
        c = rng.int(1, 6);
      } while (a === 1 && b === 1 && c === 1);
      const fTex = `\\dfrac{${c}}{${a}+${coef(b)}\\ln(x)}`;
      const fExpr = `${c}/(${a} + ${b}*log(x))`;
      const by = `${coef(b)}y`;
      const numT = termsTex([[c, ''], [-a, 'y']]);
      const key: FormulaChoice = { tex: `e^{\\frac{${numT}}{${by}}}`, expr: `exp((${c} - ${a}*y)/(${b}*y))` };
      const xs = [1.3, 2, 3.7, 6, 15];
      assertInverse(fExpr, key.expr, xs);
      const explanation =
        `For $x>1$ the denominator is positive and $${name}$ is decreasing, so it has an inverse. Solve $y=${fTex}$ for $x$:\n` +
        `$$${a}+${coef(b)}\\ln(x)=\\frac{${c}}{y} \\;\\Rightarrow\\; ${coef(b)}\\ln(x)=\\frac{${c}}{y}-${a}=\\frac{${numT}}{y} \\;\\Rightarrow\\; \\ln(x)=\\frac{${numT}}{${by}}$$` +
        `Undo the logarithm with the exponential: $$${name}^{-1}(y)=${key.tex}$$`;
      const t = rng.int(1, 3);
      const distractors: FormulaChoice[] = [
        { tex: `e^{\\frac{${termsTex([[a, 'y'], [-c, '']])}}{${by}}}`, expr: `exp((${a}*y - ${c})/(${b}*y))`, why: 'sign error when isolating $\\ln(x)$.' },
        { tex: `\\dfrac{${numT}}{${by}}`, expr: `(${c} - ${a}*y)/(${b}*y)`, why: 'forgets to undo the logarithm: this is $\\ln(x)$, not $x$.' },
        { tex: `\\ln\\left(\\dfrac{${numT}}{${by}}\\right)`, expr: `log((${c} - ${a}*y)/(${b}*y))`, why: 'takes the logarithm instead of the exponential to undo $\\ln$.' },
        { tex: `e^{\\frac{${by}}{${numT}}}`, expr: `exp((${b}*y)/(${c} - ${a}*y))`, why: 'turns the fraction in the exponent upside down.' },
        { tex: `e^{\\frac{${termsTex([[c, 'y'], [-a, '']])}}{${b}}}`, expr: `exp((${c}*y - ${a})/${b})`, why: `writes $${a}+${coef(b)}\\ln(x)=${c}y$ instead of $\\frac{${c}}{y}$.` },
        ...(b !== 1 ? [{ tex: `e^{\\frac{${numT}}{y}}`, expr: `exp((${c} - ${a}*y)/y)`, why: `forgets to divide by $${b}$.` }] : []),
      ];
      return finish(type, rng, optionCount, {
        stem: rng.pick([
          `Consider the function $$${name}(x)=${fTex}$$ for $x>1$. Which formula gives the inverse function $${name}^{-1}(y)$?`,
          `On the domain $x>1$ the function $$${name}(x)=${fTex}$$ is invertible. Its inverse $${name}^{-1}(y)$ is`,
        ]),
        numericStem: `On the domain $x>1$ the function $$${name}(x)=${fTex}$$ is invertible. Calculate $${name}^{-1}\\left(${frac(c, a + b * t)}\\right)$.`,
        explanation,
        numericExplanation: `With $y=${frac(c, a + b * t)}$: $$\\frac{${c}}{y}-${a}=${a + b * t}-${a}=${b * t}, \\quad \\ln(x)=${b === 1 ? '' : `\\frac{${b * t}}{${b}}=`}${t}, \\quad x=${t === 1 ? 'e' : `e^{${t}}`}\\approx ${num(Math.exp(t), 4)}$$`,
        key,
        distractors,
        pts: imagePts(fExpr, xs),
        label: `${name}^{-1}(y)=`,
        answer: Math.exp(t),
        dp: 2,
        fallback: (i) => ({ tex: `e^{\\frac{${termsTex([[c + i + 1, ''], [-a, 'y']])}}{${by}}}`, expr: `exp((${c + i + 1} - ${a}*y)/(${b}*y))`, why: 'an arithmetic slip.' }),
      });
    }
    if (kind === 'ln-quad') {
      let a: number, b: number;
      do {
        a = rng.int(1, 5);
        b = rng.int(1, 9);
      } while (a === 1 && b === 1);
      const inner = termsTex([[a, 'x^2'], [b, '']]);
      const fTex = `\\ln\\left(${inner}\\right)`;
      const fExpr = `log(${a}*x^2 + ${b})`;
      const over = (s: string) => (a === 1 ? s : `\\dfrac{${s}}{${a}}`);
      const overE = (s: string) => (a === 1 ? `(${s})` : `(${s})/${a}`);
      const key: FormulaChoice = { tex: `\\sqrt{${over(`e^{y}-${b}`)}}`, expr: `sqrt(${overE(`exp(y) - ${b}`)})` };
      const xs = [0.4, 1, 1.7, 3, 5.5];
      assertInverse(fExpr, key.expr, xs);
      const explanation =
        `For $x>0$ the function is increasing, so it has an inverse. Solve $y=${fTex}$ for $x$:\n` +
        `$$e^{y}=${inner} \\;\\Rightarrow\\; ${coef(a)}x^2=e^{y}-${b}${a === 1 ? '' : ` \\;\\Rightarrow\\; x^2=${over(`e^{y}-${b}`)}`}$$` +
        `Since $x>0$ we take the positive root: $$${name}^{-1}(y)=${key.tex}$$`;
      const y0 = Math.ceil(Math.log(b + 1)) + rng.int(0, 1);
      const x0 = Math.sqrt((Math.exp(y0) - b) / a);
      const distractors: FormulaChoice[] = [
        { tex: `\\sqrt{${over(`${b}-e^{y}`)}}`, expr: `sqrt(${overE(`${b} - exp(y)`)})`, why: `sign error when moving $${b}$ to the other side.` },
        { tex: over(`e^{y}-${b}`), expr: overE(`exp(y) - ${b}`), why: 'forgets to take the square root (this is $x^2$).' },
        { tex: `e^{\\sqrt{${over(`y-${b}`)}}}`, expr: `exp(sqrt(${overE(`y - ${b}`)}))`, why: 'undoes the steps in the wrong order (root and constants before the exponential).' },
        { tex: `\\sqrt{${over(`e^{y-${b}}`)}}`, expr: `sqrt(${overE(`exp(y - ${b})`)})`, why: `treats $\\ln\\left(${inner}\\right)$ as $\\ln\\left(${coef(a)}x^2\\right)+${b}$.` },
        { tex: `\\sqrt{${over(`\\ln(y)-${b}`)}}`, expr: `sqrt(${overE(`log(y) - ${b}`)})`, why: 'undoes the logarithm with another logarithm instead of the exponential.' },
        ...(a !== 1 ? [{ tex: `\\sqrt{\\dfrac{e^{y}}{${a}}-${b}}`, expr: `sqrt(exp(y)/${a} - ${b})`, why: `divides only $e^{y}$ by $${a}$.` }] : []),
      ];
      return finish(type, rng, optionCount, {
        stem: rng.pick([
          `Consider $$${name}(x)=${fTex}$$ restricted to $x>0$. Which expression is the inverse function $${name}^{-1}(y)$?`,
          `Restricted to $x>0$, the function $$${name}(x)=${fTex}$$ has an inverse. This inverse $${name}^{-1}(y)$ is`,
        ]),
        numericStem: `Restricted to $x>0$, the function $$${name}(x)=${fTex}$$ has an inverse. Calculate $${name}^{-1}(${y0})$.`,
        explanation,
        numericExplanation: `With $y=${y0}$: $$x=\\sqrt{${over(`e^{${y0}}-${b}`)}}=\\sqrt{${num((Math.exp(y0) - b) / a, 4)}}\\approx ${num(x0, 4)}$$`,
        key,
        distractors,
        pts: imagePts(fExpr, xs),
        label: `${name}^{-1}(y)=`,
        answer: x0,
        dp: 2,
        fallback: (i) => ({ tex: `\\sqrt{${over(`e^{y}-${b + i + 1}`)}}`, expr: `sqrt(${overE(`exp(y) - ${b + i + 1}`)})`, why: 'an arithmetic slip.' }),
      });
    }
    // exp-affine: B e^{kx} + A
    const A = rng.sign() * rng.int(1, 9);
    const B = rng.int(2, 9);
    const k = rng.pick([1, 2, 3, -1, -2, 0.5]);
    const kx = `${coef(k)}x`;
    const fTex = `${B}e^{${kx}}${sgn(A)}`;
    const fExpr = `${B}*exp(${k}*x) + (${A})`;
    const pre = recipCoef(k);
    const preE = `(1/(${k}))`;
    const inside = `\\dfrac{${lin(1, -A, 'y')}}{${B}}`;
    const insideE = `(y - (${A}))/${B}`;
    const key: FormulaChoice = { tex: `${pre}\\ln\\left(${inside}\\right)`, expr: `${preE}*log(${insideE})` };
    const xs = [-1.2, -0.3, 0.4, 1.1];
    assertInverse(fExpr, key.expr, xs);
    const explanation =
      `The function is strictly ${B * k > 0 ? 'increasing' : 'decreasing'}, so it has an inverse. Solve $y=${fTex}$ for $x$:\n` +
      `$$${B}e^{${kx}}=${lin(1, -A, 'y')} \\;\\Rightarrow\\; e^{${kx}}=${inside} \\;\\Rightarrow\\; ${kx}=\\ln\\left(${inside}\\right)$$` +
      `$$${name}^{-1}(y)=${key.tex}$$`;
    const m = rng.pick([2, 3, 4, 0.5]);
    const y0 = A + B * m;
    const x0 = Math.log(m) / k;
    const distractors: FormulaChoice[] = [
      ...(Math.abs(k) !== 1 ? [{ tex: `${coef(k)}\\ln\\left(${inside}\\right)`, expr: `${k}*log(${insideE})`, why: `multiplies by $${k}$ instead of dividing by it.` }] : []),
      { tex: `${pre}\\ln\\left(\\dfrac{y}{${B}}${sgn(-A)}\\right)`, expr: `${preE}*log(y/${B} - (${A}))`, why: `divides $y$ by $${B}$ before removing the constant $${A}$.` },
      { tex: `${pre}\\ln\\left(\\dfrac{${lin(1, A, 'y')}}{${B}}\\right)`, expr: `${preE}*log((y + (${A}))/${B})`, why: `sign error when moving $${A}$ to the other side.` },
      { tex: `${pre}\\ln\\left(\\dfrac{${B}}{${lin(1, -A, 'y')}}\\right)`, expr: `${preE}*log(${B}/(y - (${A})))`, why: 'turns the fraction inside the logarithm upside down.' },
      { tex: `${pre}\\dfrac{\\ln\\left(${lin(1, -A, 'y')}\\right)}{${B}}`, expr: `${preE}*log(y - (${A}))/${B}`, why: `divides by $${B}$ after taking the logarithm instead of before.` },
      { tex: `${pre}e^{\\frac{${lin(1, -A, 'y')}}{${B}}}`, expr: `${preE}*exp((y - (${A}))/${B})`, why: 'uses the exponential instead of the logarithm.' },
      ...(k !== 1 ? [{ tex: `\\ln\\left(${inside}\\right)`, expr: `log(${insideE})`, why: `forgets to divide by $${k}$.` }] : []),
    ];
    return finish(type, rng, optionCount, {
      stem: rng.pick([
        `Consider the function $$${name}(x)=${fTex}$$ Which formula gives its inverse function $${name}^{-1}(y)$?`,
        `The function $$${name}(x)=${fTex}$$ is invertible. Determine its inverse $${name}^{-1}(y)$.`,
      ]),
      numericStem: `The function $$${name}(x)=${fTex}$$ is invertible. Calculate $${name}^{-1}(${num(y0)})$.`,
      explanation,
      numericExplanation: `With $y=${num(y0)}$: $$e^{${kx}}=\\frac{${num(y0)}${sgn(-A)}}{${B}}=${num(m)} \\;\\Rightarrow\\; ${kx}=\\ln(${num(m)}) \\;\\Rightarrow\\; x\\approx ${num(x0, 4)}$$`,
      key,
      distractors,
      pts: imagePts(fExpr, xs),
      label: `${name}^{-1}(y)=`,
      answer: x0,
      dp: 2,
      fallback: (i) => ({ tex: `${pre}\\ln\\left(\\dfrac{${lin(1, -A - i - 1, 'y')}}{${B}}\\right)`, expr: `${preE}*log((y - (${A + i + 1}))/${B})`, why: 'an arithmetic slip.' }),
    });
  },
};

// =====================================================================================================================
// 3. Rational functions of x² and roots of quotients (restricted domain)
// =====================================================================================================================

type RKind = 'ratio-sq' | 'root-frac' | 'one-plus';

const rootRational: Template = {
  id: 'inverse-functions.root-rational',
  topic: 'Inverse functions',
  title: 'Inverse of ax²/(x² + k) or (ax² + k)/x² for x > 0, or of √(ax/(x − k)) for x > k',
  types: ['single-choice'],
  difficulty: 2,
  generate({ rng, optionCount }) {
    const kind = rng.pick<RKind>(['ratio-sq', 'root-frac', 'one-plus']);
    const name = pickName(rng);
    let a: number, k: number;
    do {
      a = rng.int(1, kind === 'root-frac' ? 4 : 6);
      k = rng.int(kind === 'one-plus' ? 2 : 1, kind === 'root-frac' ? 6 : 9);
    } while (a === 1 && k === 1);
    let fTex: string, fExpr: string, restrict: string, explanation: string;
    let key: FormulaChoice;
    let distractors: FormulaChoice[];
    let xs: number[];
    let fallback: (i: number) => FormulaChoice;
    if (kind === 'ratio-sq') {
      fTex = `\\dfrac{${coef(a)}x^2}{x^2+${k}}`;
      fExpr = `${a}*x^2/(x^2 + ${k})`;
      restrict = '$x>0$';
      xs = [0.3, 0.8, 1.5, 2.6, 4.2];
      const ky = `${coef(k)}y`;
      key = { tex: `\\sqrt{\\dfrac{${ky}}{${a}-y}}`, expr: `sqrt(${k}*y/(${a} - y))` };
      explanation =
        `Solve $y=${fTex}$ for $x$:\n` +
        `$$y\\left(x^2+${k}\\right)=${coef(a)}x^2 \\;\\Rightarrow\\; yx^2+${ky}=${coef(a)}x^2 \\;\\Rightarrow\\; x^2\\left(${a}-y\\right)=${ky} \\;\\Rightarrow\\; x^2=\\dfrac{${ky}}{${a}-y}$$` +
        `Because $x>0$ we take the positive root: $$${name}^{-1}(y)=${key.tex}$$`;
      distractors = [
        { tex: `\\sqrt{\\dfrac{${ky}}{y-${a}}}`, expr: `sqrt(${k}*y/(y - ${a}))`, why: 'sign error when collecting the $x^2$ terms.' },
        { tex: `\\dfrac{${ky}}{${a}-y}`, expr: `${k}*y/(${a} - y)`, why: 'forgets to take the square root (this is $x^2$).' },
        { tex: `\\sqrt{\\dfrac{${a}-y}{${ky}}}`, expr: `sqrt((${a} - y)/(${k}*y))`, why: 'turns the fraction upside down.' },
        { tex: `\\dfrac{\\sqrt{${ky}}}{${a}-y}`, expr: `sqrt(${k}*y)/(${a} - y)`, why: 'takes the root of the numerator only.' },
        { tex: `\\dfrac{${coef(k)}y^2}{${a}-y^2}`, expr: `${k}*y^2/(${a} - y^2)`, why: 'squares $y$ instead of taking the root of $x^2$.' },
        ...(k !== 1 ? [{ tex: `\\sqrt{\\dfrac{y}{${a}-y}}`, expr: `sqrt(y/(${a} - y))`, why: `loses the factor $${k}$.` }] : []),
        ...(a !== k ? [{ tex: `\\sqrt{\\dfrac{${coef(a)}y}{${k}-y}}`, expr: `sqrt(${a}*y/(${k} - y))`, why: `mixes up the constants $${a}$ and $${k}$.` }] : []),
      ];
      fallback = (i) => ({ tex: `\\sqrt{\\dfrac{${coef(k + i + 1)}y}{${a}-y}}`, expr: `sqrt(${k + i + 1}*y/(${a} - y))`, why: 'an arithmetic slip.' });
    } else if (kind === 'root-frac') {
      fTex = `\\sqrt{\\dfrac{${coef(a)}x}{x-${k}}}`;
      fExpr = `sqrt(${a}*x/(x - ${k}))`;
      restrict = `$x>${k}$`;
      xs = [0.4, 1.1, 2.5, 4, 9].map((t) => k + t);
      key = { tex: `\\dfrac{${coef(k)}y^2}{y^2-${a}}`, expr: `${k}*y^2/(y^2 - ${a})` };
      explanation =
        `Square both sides of $y=${fTex}$ and solve for $x$:\n` +
        `$$y^2=\\dfrac{${coef(a)}x}{x-${k}} \\;\\Rightarrow\\; y^2x-${coef(k)}y^2=${coef(a)}x \\;\\Rightarrow\\; x\\left(y^2-${a}\\right)=${coef(k)}y^2$$` +
        `$$${name}^{-1}(y)=${key.tex}$$`;
      distractors = [
        { tex: `\\dfrac{${coef(k)}y^2}{${a}-y^2}`, expr: `${k}*y^2/(${a} - y^2)`, why: 'sign error when collecting the terms with $x$.' },
        { tex: `\\dfrac{${coef(k)}y}{y-${a}}`, expr: `${k}*y/(y - ${a})`, why: 'forgets to square $y$ when squaring both sides.' },
        { tex: `\\dfrac{y^2-${a}}{${coef(k)}y^2}`, expr: `(y^2 - ${a})/(${k}*y^2)`, why: 'turns the result upside down.' },
        { tex: `\\sqrt{\\dfrac{${coef(k)}y}{y-${a}}}`, expr: `sqrt(${k}*y/(y - ${a}))`, why: 'takes a root instead of squaring.' },
        ...(k !== 1 ? [{ tex: `\\dfrac{y^2}{y^2-${a}}`, expr: `y^2/(y^2 - ${a})`, why: `loses the factor $${k}$.` }] : []),
        ...(a !== k ? [{ tex: `\\dfrac{${coef(a)}y^2}{y^2-${k}}`, expr: `${a}*y^2/(y^2 - ${k})`, why: `mixes up the constants $${a}$ and $${k}$.` }] : []),
      ];
      fallback = (i) => ({ tex: `\\dfrac{${coef(k + i + 1)}y^2}{y^2-${a}}`, expr: `${k + i + 1}*y^2/(y^2 - ${a})`, why: 'an arithmetic slip.' });
    } else {
      fTex = `\\dfrac{${termsTex([[a, 'x^2'], [k, '']])}}{x^2}`;
      fExpr = `(${a}*x^2 + ${k})/x^2`;
      restrict = '$x>0$';
      xs = [0.3, 0.8, 1.5, 2.6, 4.2];
      key = { tex: `\\sqrt{\\dfrac{${k}}{${lin(1, -a, 'y')}}}`, expr: `sqrt(${k}/(y - ${a}))` };
      explanation =
        `Split the fraction: $${name}(x)=${a}+\\dfrac{${k}}{x^2}$. Solve $y=${a}+\\dfrac{${k}}{x^2}$ for $x$:\n` +
        `$$\\dfrac{${k}}{x^2}=${lin(1, -a, 'y')} \\;\\Rightarrow\\; x^2=\\dfrac{${k}}{${lin(1, -a, 'y')}}$$` +
        `Because $x>0$ we take the positive root: $$${name}^{-1}(y)=${key.tex}$$`;
      distractors = [
        { tex: `\\sqrt{\\dfrac{${k}}{${a}-y}}`, expr: `sqrt(${k}/(${a} - y))`, why: `sign error when moving $${a}$ to the other side.` },
        { tex: `\\dfrac{${k}}{${lin(1, -a, 'y')}}`, expr: `${k}/(y - ${a})`, why: 'forgets to take the square root (this is $x^2$).' },
        { tex: `\\sqrt{\\dfrac{${lin(1, -a, 'y')}}{${k}}}`, expr: `sqrt((y - ${a})/${k})`, why: 'turns the fraction upside down.' },
        { tex: `\\sqrt{\\dfrac{${k}}{y}-${a}}`, expr: `sqrt(${k}/y - ${a})`, why: `divides by $y$ before subtracting $${a}$.` },
        { tex: `\\sqrt{\\dfrac{${k}}{y}}`, expr: `sqrt(${k}/y)`, why: `ignores the constant $${a}$ that comes from $\\frac{${coef(a)}x^2}{x^2}$.` },
        ...(a !== 1 ? [{ tex: `\\sqrt{\\dfrac{${k}}{y-1}}`, expr: `sqrt(${k}/(y - 1))`, why: `simplifies $\\frac{${a}x^2}{x^2}$ to $1$ instead of $${a}$.` }] : []),
      ];
      fallback = (i) => ({ tex: `\\sqrt{\\dfrac{${k + i + 1}}{${lin(1, -a, 'y')}}}`, expr: `sqrt(${k + i + 1}/(y - ${a}))`, why: 'an arithmetic slip.' });
    }
    assertInverse(fExpr, key.expr, xs);
    const stem = rng.pick([
      `Consider the function $$${name}(x)=${fTex}$$ for ${restrict}. Which formula gives the inverse function $${name}^{-1}(y)$?`,
      `Restricted to ${restrict}, the function $$${name}(x)=${fTex}$$ is invertible. Its inverse $${name}^{-1}(y)$ is`,
    ]);
    const mcq = formulaMcq(rng, key, rng.shuffle(distractors), { count: optionCount, pts: imagePts(fExpr, xs), label: `${name}^{-1}(y)=`, vars: ['y'], fallback });
    return { type: 'single-choice', stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
  },
};

// =====================================================================================================================
// 4. Logistic function K/(1 + a e^{−bx})
// =====================================================================================================================

const LOGISTIC_CONTEXTS = [
  { intro: (n: string) => `The number of subscribers (in thousands) of a new streaming service $x$ months after its launch is modelled by $$${n}(x)=`, unit: 'thousand subscribers', time: 'months' },
  { intro: (n: string) => `The number of trees (in hundreds) in a newly planted forest area $x$ years after planting is modelled by $$${n}(x)=`, unit: 'hundred trees', time: 'years' },
  { intro: (n: string) => `The number of households (in thousands) that own a smart thermostat $x$ years after its introduction is $$${n}(x)=`, unit: 'thousand households', time: 'years' },
  { intro: (n: string) => `Logistic curves like $$${n}(x)=`, unit: '', time: '' },
];

const logistic: Template = {
  id: 'inverse-functions.logistic',
  topic: 'Inverse functions',
  title: 'Inverse of a logistic function K/(1 + a e^{−bx}) (and the time at which a level is reached)',
  types: ['single-choice', 'numeric'],
  difficulty: 3,
  generate({ rng, type, optionCount }) {
    const K = rng.pick([2, 4, 5, 10, 20, 50, 100]);
    const a = rng.int(2, 9);
    const b = rng.pick([0.5, 1, 2, 3]);
    const name = rng.pick(['N', 'L', 'S'] as const);
    const bx = `${coef(b)}x`;
    const fTex = `\\dfrac{${K}}{1+${a}e^{-${bx}}}`;
    const fExpr = `${K}/(1 + ${a}*exp(-${b}*x))`;
    const pre = recipCoef(b);
    const preE = `(1/${b})`;
    const frac1 = (n: string, d: string) => `\\dfrac{${n}}{${d}}`;
    const key: FormulaChoice = { tex: `${pre}\\ln\\left(${frac1(`${a}y`, `${K}-y`)}\\right)`, expr: `${preE}*log(${a}*y/(${K} - y))` };
    const xs = [-1, 0.2, 1.3, 2.5, 4];
    assertInverse(fExpr, key.expr, xs);
    const ctx = rng.pick(LOGISTIC_CONTEXTS);
    const intro = ctx.unit
      ? `${ctx.intro(name)}${fTex}$$`
      : `${ctx.intro(name)}${fTex}$$ are used to describe how a new product spreads through a market (the level $${K}$ is the saturation level).`;
    const explanation =
      `$${name}$ is increasing (it is ${K} divided by a decreasing positive function), so it has an inverse on $0<y<${K}$. Solve $y=${fTex}$ for $x$:\n` +
      `$$1+${a}e^{-${bx}}=\\frac{${K}}{y} \\;\\Rightarrow\\; ${a}e^{-${bx}}=\\frac{${K}-y}{y} \\;\\Rightarrow\\; e^{-${bx}}=\\frac{${K}-y}{${a}y}$$` +
      `$$-${bx}=\\ln\\left(\\frac{${K}-y}{${a}y}\\right) \\;\\Rightarrow\\; x=-${pre === '' ? '' : pre}\\ln\\left(\\frac{${K}-y}{${a}y}\\right)=${key.tex}$$` +
      `(using $-\\ln(u)=\\ln(1/u)$).`;
    const r = rng.pick([0.25, 0.5, 0.75, 0.8, 0.9].filter((v) => (a * v) / (1 - v) > 1.05));
    const y0 = r * K;
    const x0 = Math.log((a * r) / (1 - r)) / b;
    const distractors: FormulaChoice[] = [
      { tex: `-${pre}\\ln\\left(${frac1(`${a}y`, `${K}-y`)}\\right)`, expr: `-${preE}*log(${a}*y/(${K} - y))`, why: `loses the minus sign of the exponent $-${bx}$.` },
      { tex: `${pre}\\ln\\left(${frac1('y', `${a}\\left(${K}-y\\right)`)}\\right)`, expr: `${preE}*log(y/(${a}*(${K} - y)))`, why: `multiplies by $${a}$ where it should divide (or vice versa).` },
      { tex: `${pre}\\ln\\left(${frac1('y', `${K}-y`)}\\right)`, expr: `${preE}*log(y/(${K} - y))`, why: `loses the factor $${a}$.` },
      { tex: `${pre}\\ln\\left(${frac1(`${a}y`, `y-${K}`)}\\right)`, expr: `${preE}*log(${a}*y/(y - ${K}))`, why: `sign error: writes $y-${K}$ instead of $${K}-y$.` },
      { tex: `${pre}\\ln\\left(${frac1(`${a}y`, '1-y')}\\right)`, expr: `${preE}*log(${a}*y/(1 - y))`, why: `forgets the saturation level $${K}$ (as if the curve levelled off at $1$).` },
      ...(b !== 1 ? [{ tex: `${b}\\ln\\left(${frac1(`${a}y`, `${K}-y`)}\\right)`, expr: `${b}*log(${a}*y/(${K} - y))`, why: `multiplies by $${b}$ instead of dividing by it.` }] : []),
    ];
    const stem = `${intro} Which formula gives the inverse function $${name}^{-1}(y)$, i.e. $x$ expressed in terms of $y$?`;
    const numericStem = ctx.unit
      ? `${intro} After how many ${ctx.time} does it reach $${num(y0)}$ ${ctx.unit}? (That is, calculate $${name}^{-1}(${num(y0)})$.)`
      : `${intro} Calculate $${name}^{-1}(${num(y0)})$, the value of $x$ at which the curve reaches $${num(y0)}$.`;
    return finish(type, rng, optionCount, {
      stem,
      numericStem,
      explanation,
      numericExplanation: `With $y=${num(y0)}$: $$x=${pre}\\ln\\left(\\frac{${a}\\cdot ${num(y0)}}{${K}-${num(y0)}}\\right)=${pre}\\ln(${num((a * r) / (1 - r), 4)})\\approx ${num(x0, 4)}$$`,
      key,
      distractors,
      pts: imagePts(fExpr, xs),
      label: `${name}^{-1}(y)=`,
      answer: x0,
      dp: 2,
      fallback: (i) => ({ tex: `${pre}\\ln\\left(${frac1(`${a + i + 1}y`, `${K}-y`)}\\right)`, expr: `${preE}*log(${a + i + 1}*y/(${K} - y))`, why: 'an arithmetic slip.' }),
    });
  },
};

// =====================================================================================================================
// 5. Inverse demand function
// =====================================================================================================================

const GOODS = ['bottles of sunscreen', 'concert tickets', 'e-bike rentals', 'bags of coffee beans', 'museum day passes', 'yoga classes', 'phone cases'];
type DKind = 'hyper' | 'exp' | 'sqrt';

const inverseDemand: Template = {
  id: 'inverse-functions.inverse-demand',
  topic: 'Inverse functions',
  title: 'Inverse demand function p(q) from q = A/(p + c), q = Ae^{−kp} or q = A − B√p (and the price for a given quantity)',
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const kind = rng.pick<DKind>(['hyper', 'exp', 'sqrt']);
    const good = rng.pick(GOODS);
    const period = rng.pick(['weekly', 'daily', 'monthly']);
    let dTex: string, dExpr: string, explanation: string, numExpl: string;
    let key: FormulaChoice;
    let distractors: FormulaChoice[];
    let ps: number[];
    let q0: number, p0: number, dp: number;
    let fallback: (i: number) => FormulaChoice;
    if (kind === 'hyper') {
      const A = rng.pick([120, 180, 240, 300, 360, 480, 600]);
      const c = rng.int(2, 12);
      dTex = `\\dfrac{${A}}{p+${c}}`;
      dExpr = `${A}/(p + ${c})`;
      key = { tex: `\\dfrac{${A}}{q}-${c}`, expr: `${A}/q - ${c}` };
      explanation = `Solve $q=${dTex}$ for $p$: $$q\\left(p+${c}\\right)=${A} \\;\\Rightarrow\\; p+${c}=\\dfrac{${A}}{q} \\;\\Rightarrow\\; p=${key.tex}$$`;
      distractors = [
        { tex: `\\dfrac{${A}}{q}+${c}`, expr: `${A}/q + ${c}`, why: `sign error when moving $${c}$ to the other side.` },
        { tex: `\\dfrac{${A}}{q+${c}}`, expr: `${A}/(q + ${c})`, why: 'only swaps the letters $p$ and $q$ in the demand function.' },
        { tex: `\\dfrac{${A - c}}{q}`, expr: `${A - c}/q`, why: `forgets to multiply $${c}$ by $q$ when expanding $q(p+${c})$.` },
        { tex: `\\dfrac{q}{${A}}-${c}`, expr: `q/${A} - ${c}`, why: `turns $\\frac{${A}}{q}$ upside down.` },
        { tex: `${A}q-${c}`, expr: `${A}*q - ${c}`, why: `multiplies by $q$ instead of dividing.` },
      ];
      ps = [1, 3, 7, 12, 20];
      p0 = 0;
      q0 = 0;
      // A price whose quantity is a whole number of units (exists for every A and c used here); else 2 decimals.
      const cands = rng.shuffle([2, 3, 4, 5, 6, 8, 10, 12, 13, 15, 18, 20]);
      const pick = cands.find((v) => Number.isInteger(A / (v + c))) ?? cands.find((v) => Math.abs((A / (v + c)) * 100 - Math.round((A / (v + c)) * 100)) < 1e-9) ?? cands[0];
      p0 = pick;
      q0 = A / (p0 + c);
      dp = 2;
      numExpl = `With $q=${num(q0)}$: $$p=\\dfrac{${A}}{${num(q0)}}-${c}=${num(A / q0, 4)}-${c}=${num(p0, 4)}$$`;
      fallback = (i) => ({ tex: `\\dfrac{${A}}{q}-${c + i + 1}`, expr: `${A}/q - ${c + i + 1}`, why: 'an arithmetic slip.' });
    } else if (kind === 'exp') {
      const A = rng.pick([400, 500, 800, 1000, 1200, 2000]);
      const k = rng.pick([0.02, 0.04, 0.05, 0.1, 0.2, 0.25]);
      const inv = Math.round(1 / k);
      dTex = `${A}e^{-${k}p}`;
      dExpr = `${A}*exp(-${k}*p)`;
      key = { tex: `${inv}\\ln\\left(\\dfrac{${A}}{q}\\right)`, expr: `${inv}*log(${A}/q)` };
      explanation =
        `Solve $q=${dTex}$ for $p$: $$e^{-${k}p}=\\dfrac{q}{${A}} \\;\\Rightarrow\\; -${k}p=\\ln\\left(\\dfrac{q}{${A}}\\right) \\;\\Rightarrow\\; p=-\\dfrac{1}{${k}}\\ln\\left(\\dfrac{q}{${A}}\\right)=${key.tex}$$` +
        `(since $\\frac{1}{${k}}=${inv}$ and $-\\ln(u)=\\ln(1/u)$).`;
      distractors = [
        { tex: `${inv}\\ln\\left(\\dfrac{q}{${A}}\\right)`, expr: `${inv}*log(q/${A})`, why: 'loses the minus sign of the exponent.' },
        { tex: `${k}\\ln\\left(\\dfrac{${A}}{q}\\right)`, expr: `${k}*log(${A}/q)`, why: `multiplies by $${k}$ instead of dividing by it.` },
        { tex: `${inv}\\cdot\\dfrac{\\ln(${A})}{q}`, expr: `${inv}*log(${A})/q`, why: `treats $\\ln\\left(\\frac{${A}}{q}\\right)$ as $\\frac{\\ln(${A})}{q}$.` },
        { tex: `${inv}\\ln\\left(${A}-q\\right)`, expr: `${inv}*log(${A} - q)`, why: 'subtracts instead of dividing when isolating the exponential.' },
        { tex: `\\ln\\left(\\dfrac{${A}}{q}\\right)`, expr: `log(${A}/q)`, why: `forgets to divide by $${k}$.` },
      ];
      ps = [2, 5, 10, 20, 30];
      const m = rng.pick([2, 4, 5, 8, 10]);
      q0 = A / m;
      p0 = Math.log(m) / k;
      dp = 2;
      numExpl = `With $q=${num(q0)}$: $$p=${inv}\\ln\\left(\\dfrac{${A}}{${num(q0)}}\\right)=${inv}\\ln(${m})\\approx ${num(p0, 4)}$$`;
      fallback = (i) => ({ tex: `${inv + i + 1}\\ln\\left(\\dfrac{${A}}{q}\\right)`, expr: `${inv + i + 1}*log(${A}/q)`, why: 'an arithmetic slip.' });
    } else {
      const A = rng.pick([60, 80, 90, 100, 120]);
      const B = rng.int(2, 8);
      dTex = `${A}-${B}\\sqrt{p}`;
      dExpr = `${A} - ${B}*sqrt(p)`;
      key = { tex: `\\left(\\dfrac{${A}-q}{${B}}\\right)^2`, expr: `((${A} - q)/${B})^2` };
      explanation = `Solve $q=${dTex}$ for $p$: $$${B}\\sqrt{p}=${A}-q \\;\\Rightarrow\\; \\sqrt{p}=\\dfrac{${A}-q}{${B}} \\;\\Rightarrow\\; p=${key.tex}$$`;
      distractors = [
        { tex: `\\dfrac{${A}-q}{${B}}`, expr: `(${A} - q)/${B}`, why: 'forgets to square (this is $\\sqrt{p}$).' },
        { tex: `\\left(${A}-\\dfrac{q}{${B}}\\right)^2`, expr: `(${A} - q/${B})^2`, why: `divides only $q$ by $${B}$.` },
        { tex: `\\left(\\dfrac{${A}+q}{${B}}\\right)^2`, expr: `((${A} + q)/${B})^2`, why: 'sign error when isolating the root.' },
        { tex: `\\sqrt{\\dfrac{${A}-q}{${B}}}`, expr: `sqrt((${A} - q)/${B})`, why: 'takes a root instead of squaring to undo $\\sqrt{p}$.' },
        { tex: `\\dfrac{\\left(${A}-q\\right)^2}{${B}}`, expr: `(${A} - q)^2/${B}`, why: `forgets to square the $${B}$ in the denominator as well.` },
        { tex: `\\left(\\dfrac{${B}}{${A}-q}\\right)^2`, expr: `(${B}/(${A} - q))^2`, why: 'turns the fraction upside down.' },
      ];
      ps = [1, 4, 9, 16, 25];
      p0 = rng.pick([4, 9, 16, 25, 36].filter((v) => A - B * Math.sqrt(v) > 5));
      q0 = A - B * Math.sqrt(p0);
      dp = 0;
      numExpl = `With $q=${num(q0)}$: $$p=\\left(\\dfrac{${A}-${num(q0)}}{${B}}\\right)^2=${num((A - q0) / B)}^2=${num(p0)}$$`;
      fallback = (i) => ({ tex: `\\left(\\dfrac{${A + i + 1}-q}{${B}}\\right)^2`, expr: `((${A + i + 1} - q)/${B})^2`, why: 'an arithmetic slip.' });
    }
    assertInverse(dExpr, key.expr, ps, 'p', 'q');
    const intro = `The ${period} demand $q$ for ${good} at a price of $p$ euros is $$q=${dTex}$$`;
    return finish(type, rng, optionCount, {
      stem: `${intro} Which expression gives the inverse demand function, i.e. the price $p$ as a function of the quantity $q$?`,
      numericStem: `${intro} At which price $p$ (in euros) is the ${period} demand equal to $${num(q0)}$?`,
      explanation,
      numericExplanation: numExpl,
      key,
      distractors,
      pts: imagePts(dExpr, ps, 'p'),
      label: 'p=',
      answer: p0,
      dp,
      fallback,
      vars: ['q'],
    });
  },
};

export const TEMPLATES: Template[] = [linearFractional, expLog, rootRational, logistic, inverseDemand];
