// Templates for the topic "Two variables: partial derivatives & level curves" (QM1 past exams: ∂f/∂x of e^{x²−y};
// the shape of the level curves of √(y − ln x), √(x − ln y), √ln(1 + 2y + 3x), (2x + y)²; which g = f + … has the same
// level curves as f; the marginal rate of substitution −U'w/U'n of a Cobb–Douglas utility). Derivatives come from
// exact polynomial rules (Poly2) and are checked against mathjs; see two-var-partials.test.ts for independent checks.
import { buildMcq, buildMulti, INSTRUCTION, mistakesNote, num, type Choice } from '../build';
import { diff, frac, gcd } from '../mathx';
import type { Rng } from '../rng';
import type { Generated, Template } from '../types';
import { choiceQuestion, numericQuestion, valueMcq } from './_econ';
import { assertSame, coef, formulaMcq, ratTex, termsTex, type FormulaChoice } from './_fnderiv';
import { assertPartials, p2Add, p2Dx, p2Dy, p2Eval, p2Expr, p2Scale, p2Tex, shifted, type Mono, type Poly2 } from './_twovar';

// =====================================================================================================================
// 1. A partial derivative of e^{g}, ln(g), √g or g^n with a polynomial g(x, y) (chain rule, other variable constant)
// =====================================================================================================================

type Outer = 'exp' | 'ln' | 'sqrt' | 'pow';
const ONE: Poly2 = [[1, 0, 0]];
const DW = { x: '\\dfrac{\\partial f}{\\partial x}', y: '\\dfrac{\\partial f}{\\partial y}' };

/** P·rest as LaTeX: a single term is written in front, a sum gets brackets. */
function times(P: Poly2, rest: string): string {
  const live = P.filter(([c]) => c !== 0);
  if (live.length !== 1) return `\\left(${p2Tex(live)}\\right)${rest}`;
  const [c, i, j] = live[0];
  return (i === 0 && j === 0 ? (c === 1 ? '' : c === -1 ? '-' : String(c)) : p2Tex(live)) + rest;
}

/** O'(g)·d: the chain rule with outer function O and "inner derivative" d (d = g_w when done right). */
function chainRule(o: Outer, n: number, g: Poly2, d: Poly2): FormulaChoice {
  const [G, Ge, D, De] = [p2Tex(g), p2Expr(g), p2Tex(d), p2Expr(d)];
  if (o === 'exp') return { tex: times(d, `e^{${G}}`), expr: `(${De})*exp(${Ge})` };
  if (o === 'ln') return { tex: `\\dfrac{${D}}{${G}}`, expr: `(${De})/(${Ge})` };
  if (o === 'sqrt') {
    // an even numerator is simplified against the 2 in the denominator, as students would write it
    if (d.every(([c]) => c % 2 === 0)) return { tex: `\\dfrac{${p2Tex(p2Scale(d, 0.5))}}{\\sqrt{${G}}}`, expr: `(${De})/(2*sqrt(${Ge}))` };
    return { tex: `\\dfrac{${D}}{2\\sqrt{${G}}}`, expr: `(${De})/(2*sqrt(${Ge}))` };
  }
  return { tex: times(p2Scale(d, n), `\\left(${G}\\right)^{${n - 1}}`), expr: `${n}*(${De})*(${Ge})^${n - 1}` };
}

function innerPoly(rng: Rng, o: Outer): Poly2 {
  const tx: Mono = [rng.sign() * rng.int(1, 4), rng.int(1, o === 'pow' ? 2 : 3), 0];
  const ty: Mono = [rng.sign() * rng.int(1, 4), 0, rng.int(1, 2)];
  const terms: Mono[] = rng.shuffle([tx, ty]);
  if (rng.chance(0.3)) terms.push([rng.sign() * rng.int(1, 3), 1, 1]);
  if (o === 'ln' || o === 'sqrt') terms.unshift([rng.int(1, 6), 0, 0]);
  return terms;
}

/** Integer points in [−2, 2]² where the value of the partial derivative is pleasant to compute by hand. */
function numericPoints(o: Outer, n: number, g: Poly2, w: 'x' | 'y') {
  const dw = w === 'x' ? p2Dx(g) : p2Dy(g);
  const out: { x: number; y: number; v: number; gv: number; dv: number; score: number }[] = [];
  for (let x = -2; x <= 2; x++)
    for (let y = -2; y <= 2; y++) {
      const gv = p2Eval(g, x, y);
      const dv = p2Eval(dw, x, y);
      const ok = { exp: Math.abs(gv) <= 2, ln: gv >= 1 && gv <= 40, sqrt: gv >= 1, pow: Math.abs(gv) <= 3 }[o];
      const v = { exp: dv * Math.exp(gv), ln: dv / gv, sqrt: dv / (2 * Math.sqrt(gv)), pow: n * dv * gv ** (n - 1) }[o];
      if (!ok || dv === 0 || Math.abs(v) > 2000) continue;
      const square = o === 'sqrt' && Number.isInteger(Math.sqrt(gv));
      out.push({ x, y, v, gv, dv, score: (x !== 0 ? 1 : 0) + (y !== 0 ? 1 : 0) + (square ? 2 : 0) });
    }
  return out;
}

const PTS = [[0.3, 0.4], [0.7, -0.2], [-0.5, 0.6], [1.1, 0.9], [-0.8, -0.3], [0.2, 1.3], [1.4, -0.7], [-1.2, 1.1], [0.5, -1.4]];

const partialDerivative: Template = {
  id: 'two-var-partials.partial-derivative',
  topic: 'Two variables: partial derivatives & level curves',
  title: 'Partial derivative of e^{g}, ln g, √g or g^n for a polynomial g(x, y) (formula, or its value at a point)',
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const o = rng.pick<Outer>(['exp', 'exp', 'ln', 'sqrt', 'pow']);
    const n = rng.int(3, 4);
    const w = rng.pick(['x', 'y'] as const);
    const other = w === 'x' ? 'y' : 'x';
    let g: Poly2, cands: { x: number; y: number; v: number; gv: number; dv: number; score: number }[];
    do {
      g = innerPoly(rng, o);
      cands = numericPoints(o, n, g, w);
      // ln and √ need enough sample points inside the domain to tell formulas apart
    } while ((type === 'numeric' && cands.length === 0) || PTS.filter(([x, y]) => o === 'exp' || o === 'pow' || p2Eval(g, x, y) > 0.05).length < 5);
    const [dw, dv] = w === 'x' ? [p2Dx(g), p2Dy(g)] : [p2Dy(g), p2Dx(g)];
    const G = p2Tex(g);
    const fTex = { exp: `e^{${G}}`, ln: `\\ln\\left(${G}\\right)`, sqrt: `\\sqrt{${G}}`, pow: `\\left(${G}\\right)^{${n}}` }[o];
    const fExpr = { exp: `exp(${p2Expr(g)})`, ln: `log(${p2Expr(g)})`, sqrt: `sqrt(${p2Expr(g)})`, pow: `(${p2Expr(g)})^${n}` }[o];
    const key = chainRule(o, n, g, dw);
    const pts = PTS.filter(([x, y]) => o === 'exp' || o === 'pow' || p2Eval(g, x, y) > 0.05);
    assertSame(key.expr, diff(fExpr, w), pts, ['x', 'y']);

    const rule = {
      exp: 'The derivative of $e^{g}$ is $e^{g}$ times the derivative of the exponent $g$.',
      ln: 'The derivative of $\\ln(g)$ is $\\dfrac{1}{g}$ times the derivative of $g$.',
      sqrt: 'The derivative of $\\sqrt{g}=g^{1/2}$ is $\\dfrac{1}{2\\sqrt{g}}$ times the derivative of $g$.',
      pow: `The derivative of $g^{${n}}$ is $${n}g^{${n - 1}}$ times the derivative of $g$.`,
    }[o];
    const explanation =
      `Treat $${other}$ as a constant and use the chain rule with the inner function $g(x,y)=${G}$, whose partial derivative is ` +
      `$\\dfrac{\\partial g}{\\partial ${w}}=${p2Tex(dw)}$. ${rule} So $$${DW[w]}=${key.tex}$$`;

    if (type === 'numeric') {
      const best = Math.max(...cands.map((c) => c.score));
      const c = rng.pick(cands.filter((k) => k.score === best));
      const dp = Number.isInteger(c.v) ? 0 : 2;
      const p = (z: number) => (z < 0 ? `(${z})` : String(z));
      const plug = {
        exp: `${p(c.dv)}\\cdot e^{${c.gv}}`,
        ln: `\\dfrac{${c.dv}}{${c.gv}}`,
        sqrt: `\\dfrac{${c.dv}}{2\\sqrt{${c.gv}}}`,
        pow: `${n}\\cdot ${p(c.dv)}\\cdot ${p(c.gv)}^{${n - 1}}`,
      }[o];
      const stem = rng.pick([
        `Consider the function $$f(x,y)=${fTex}$$ Calculate the partial derivative $${DW[w]}$ at the point $(x,y)=(${c.x},${c.y})$.`,
        `For $$f(x,y)=${fTex}$$ determine the value of $${DW[w]}$ in the point $(${c.x},${c.y})$.`,
      ]);
      const exact = Math.abs(Math.round(c.v * 1e4) - c.v * 1e4) < 1e-6;
      const sol = `${explanation} At $(${c.x},${c.y})$ we have $g=${c.gv}$ and $\\dfrac{\\partial g}{\\partial ${w}}=${c.dv}$, so $$${DW[w]}=${plug}${exact ? '=' : '\\approx'}${num(c.v, 4)}$$`;
      return numericQuestion(stem, c.v, dp, sol);
    }

    const withConst = p2Add(dw, g.filter(([, i, j]) => (w === 'x' ? i : j) === 0));
    const D = p2Tex(dw);
    const special: FormulaChoice[] = {
      exp: [{ tex: times(g, `e^{${G}}`), expr: `(${p2Expr(g)})*exp(${p2Expr(g)})`, why: 'multiplies by the exponent itself instead of by its derivative.' }],
      ln: [{ tex: D === '1' ? G : D === '-1' ? `-\\left(${G}\\right)` : `\\dfrac{${G}}{${D}}`, expr: `(${p2Expr(g)})/(${p2Expr(dw)})`, why: 'turns the fraction upside down.' }],
      sqrt: [
        { tex: `\\dfrac{${D}}{\\sqrt{${G}}}`, expr: `(${p2Expr(dw)})/sqrt(${p2Expr(g)})`, why: 'forgets the factor $\\tfrac12$ from the power rule.' },
        {
          tex: dw.every(([c]) => c % 2 === 0) ? times(p2Scale(dw, 0.5), `\\sqrt{${G}}`) : `\\dfrac{${times(dw, `\\sqrt{${G}}`)}}{2}`,
          expr: `(${p2Expr(dw)})*sqrt(${p2Expr(g)})/2`,
          why: 'keeps the power $+\\tfrac12$ instead of lowering it to $-\\tfrac12$.',
        },
      ],
      pow: [
        { tex: times(p2Scale(dw, n), `\\left(${G}\\right)^{${n}}`), expr: `${n}*(${p2Expr(dw)})*(${p2Expr(g)})^${n}`, why: 'does not lower the power by one.' },
        { tex: times(dw, `\\left(${G}\\right)^{${n - 1}}`), expr: `(${p2Expr(dw)})*(${p2Expr(g)})^${n - 1}`, why: `forgets the factor $${n}$ from the power rule.` },
      ],
    }[o];
    const distractors: FormulaChoice[] = rng.shuffle([
      { ...chainRule(o, n, g, ONE), why: `forgets the chain rule: the factor $\\frac{\\partial g}{\\partial ${w}}=${D}$ is missing.` },
      { ...chainRule(o, n, g, p2Add(dw, dv)), why: 'differentiates the inner function with respect to both $x$ and $y$ and adds the results.' },
      { ...chainRule(o, n, g, withConst), why: `keeps the terms without $${w}$ in the inner derivative; with $${other}$ constant they should vanish.` },
      { ...chainRule(o, n, g, dv), why: `differentiates with respect to $${other}$ instead of $${w}$.` },
      ...special,
    ]);
    const mcq = formulaMcq(rng, key, distractors, {
      count: optionCount,
      vars: ['x', 'y'],
      pts,
      fallback: (i) => ({ ...chainRule(o, n, g, p2Scale(dw, i + 2)), why: 'an arithmetic slip in the inner derivative.' }),
    });
    const stem = rng.pick([
      `Consider the function $$f(x,y)=${fTex}$$ Which expression equals the partial derivative $${DW[w]}$?`,
      `For $$f(x,y)=${fTex}$$ the partial derivative with respect to $${w}$ is`,
      `Determine $${DW[w]}$ for the function of two variables $$f(x,y)=${fTex}$$`,
    ]);
    return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
  },
};

// =====================================================================================================================
// 2. The shape of the level curves of O(I(x, y)) with O strictly monotonic (√, ln, √ln, e^, cube)
// =====================================================================================================================

type Shape = 'line' | 'circle' | 'exp' | 'log' | 'sqrt' | 'parab';
const SHAPE_TEXT: Record<Shape, string> = {
  line: 'Straight lines',
  circle: 'Circles',
  exp: 'Graphs of exponential functions of $x$',
  log: 'Graphs of logarithmic functions of $x$',
  sqrt: 'Graphs of square-root functions of $x$',
  parab: 'Parabolas (graphs of quadratic functions of $x$)',
};
const SHAPE_PHRASE: Record<Shape, string> = {
  line: 'a straight line',
  circle: 'a circle',
  exp: 'the graph of an exponential function of $x$',
  log: 'the graph of a logarithmic function of $x$',
  sqrt: 'the graph of a square-root function of $x$',
  parab: 'a parabola (the graph of a quadratic function of $x$)',
};
type Out = 'sqrt' | 'ln' | 'sqrtln' | 'exp' | 'cube' | 'square';
const OUTER: Record<Out, { wrap: (I: string) => string; K: string; name: string; looks: Shape[] }> = {
  sqrt: { wrap: (I) => `\\sqrt{${I}}`, K: 'c^2', name: 'square root', looks: ['sqrt'] },
  ln: { wrap: (I) => `\\ln\\left(${I}\\right)`, K: 'e^{c}', name: 'logarithm', looks: ['log'] },
  sqrtln: { wrap: (I) => `\\sqrt{\\ln\\left(${I}\\right)}`, K: 'e^{c^2}', name: 'square root of a logarithm', looks: ['log', 'sqrt'] },
  exp: { wrap: (I) => `e^{${I}}`, K: '\\ln(c)', name: 'exponential', looks: ['exp'] },
  cube: { wrap: (I) => `\\left(${I}\\right)^3`, K: '\\sqrt[3]{c}', name: 'third power', looks: ['parab'] },
  square: { wrap: (I) => `\\left(${I}\\right)^2`, K: '\\sqrt{c}\\text{ or }K=-\\sqrt{c}', name: 'square', looks: ['parab'] },
};

interface Family {
  I: string;
  solve: string;
  /** Text before the displayed solution (default: "Solving for $y$:"). */
  lead?: string;
  shape: Shape;
  wrong: { shape: Shape; why: string }[];
}

/** (y − K)/k written with a positive denominator. */
const over = (k: number) => (k === 1 ? 'y-K' : k === -1 ? 'K-y' : k > 0 ? `\\frac{y-K}{${k}}` : `\\frac{K-y}{${-k}}`);

function levelFamily(rng: Rng): Family {
  const kind = rng.pick(['line', 'line', 'logx', 'lny', 'expx', 'parab', 'sqrtx', 'circle'] as const);
  const k = rng.sign() * rng.int(1, 3);
  const solveX = (sol: string, shape: Shape, what: string): { shape: Shape; why: string } => ({
    shape,
    why: `solves for $x$ instead of $y$: $${sol}$ is ${what} of $y$, but the level curve is described with $y$ as a function of $x$.`,
  });
  if (kind === 'line') {
    const a = rng.int(1, 6);
    const b = rng.sign() * rng.int(1, 5);
    const g = rng.sign() * rng.int(1, 5);
    const lin = rng.shuffle<[number, string]>([[b, 'y'], [g, 'x']]);
    const I = rng.chance(0.5) ? termsTex([[a, ''], ...lin]) : termsTex([...lin, [a, '']]);
    const rhs = termsTex([[1, 'K'], [-a, ''], [-g, 'x']]);
    const neg = termsTex([[-1, 'K'], [a, ''], [g, 'x']]);
    const y = b === 1 ? rhs : b === -1 ? neg : b > 0 ? `\\dfrac{${rhs}}{${b}}` : `\\dfrac{${neg}}{${-b}}`;
    return {
      I,
      solve: `${termsTex([[b, 'y']])}=${rhs} \\;\\Rightarrow\\; y=${y}`,
      shape: 'line',
      wrong: [{ shape: 'circle', why: 'a circle needs both $x^2$ and $y^2$; here $x$ and $y$ only appear linearly.' }],
    };
  }
  if (kind === 'logx') {
    const ln = '\\ln(x)';
    return {
      I: termsTex([[1, 'y'], [-k, ln]]),
      solve: `y=${termsTex([[1, 'K'], [k, ln]])}`,
      shape: 'log',
      wrong: [solveX(`x=e^{${over(k)}}`, 'exp', 'an exponential function')],
    };
  }
  if (kind === 'lny') {
    const ex = k === 1 ? 'x-K' : k === -1 ? 'K-x' : k > 0 ? `\\frac{x-K}{${k}}` : `\\frac{K-x}{${-k}}`;
    return {
      I: termsTex([[1, 'x'], [-k, '\\ln(y)']]),
      solve: `${termsTex([[k, '\\ln(y)']])}=x-K \\;\\Rightarrow\\; y=e^{${ex}}`,
      shape: 'exp',
      wrong: [{ shape: 'log', why: 'sees $\\ln(y)$ and stops there; solving $\\ln(y)=\\dots$ for $y$ gives an exponential function of $x$.' }],
    };
  }
  if (kind === 'expx') {
    const m = rng.int(1, 2);
    const E = m === 1 ? 'e^{x}' : `e^{${m}x}`;
    return {
      I: termsTex([[1, 'y'], [-k, E]]),
      solve: `y=${termsTex([[1, 'K'], [k, E]])}`,
      shape: 'exp',
      wrong: [solveX(`x=${m === 1 ? '' : `\\frac{1}{${m}}`}\\ln\\left(${over(k)}\\right)`, 'log', 'a logarithmic function')],
    };
  }
  if (kind === 'parab') {
    const kk = rng.sign() * rng.int(1, 4);
    return {
      I: termsTex([[1, 'y'], [-kk, 'x^2']]),
      solve: `y=${termsTex([[1, 'K'], [kk, 'x^2']])}`,
      shape: 'parab',
      wrong: [
        solveX(`x=\\pm\\sqrt{${over(kk)}}`, 'sqrt', 'a square-root function'),
        { shape: 'line', why: 'treats $x^2$ as if it were linear in $x$.' },
      ],
    };
  }
  if (kind === 'sqrtx') {
    return {
      I: termsTex([[1, 'y'], [-k, '\\sqrt{x}']]),
      solve: `y=${termsTex([[1, 'K'], [k, '\\sqrt{x}']])}`,
      shape: 'sqrt',
      wrong: [solveX(`x=\\left(${over(k)}\\right)^2`, 'parab', 'a quadratic function')],
    };
  }
  const p = rng.int(-3, 3);
  const q = rng.int(-3, 3);
  return {
    I: `${shifted('x', p)}^2+${shifted('y', q)}^2`,
    solve: `${shifted('x', p)}^2+${shifted('y', q)}^2=K`,
    lead: `This is the equation of a circle with centre $(${p},${q})$ and radius $\\sqrt{K}$ (for $K>0$):`,
    shape: 'circle',
    wrong: [
      { shape: 'parab', why: 'treats the expression as a quadratic function of $x$, but $y$ is squared as well: all points at distance $\\sqrt{K}$ from the centre form a circle.' },
      { shape: 'line', why: 'thinks a sum of squares gives straight lines.' },
    ],
  };
}

const levelCurveShape: Template = {
  id: 'two-var-partials.level-curve-shape',
  topic: 'Two variables: partial derivatives & level curves',
  title: 'Shape of the level curves of √(…), ln(…), √ln(…), e^(…) or (…)³ of an inner expression (solve f = c for y)',
  types: ['single-choice'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const fam = levelFamily(rng);
    const o = rng.pick<Out>(['sqrt', 'sqrt', 'ln', 'sqrtln', 'sqrtln', 'exp', 'cube', 'square']);
    const O = OUTER[o];
    const fTex = O.wrap(fam.I);
    const undo =
      o === 'square'
        ? `The outer square is not one-to-one, but for $c\\ge 0$ we have $f(x,y)=c$ exactly when $${fam.I}=K$ with $K=${O.K}$: a constant (each level curve consists of at most two curves of the same shape). `
        : `The outer ${O.name} is strictly increasing, so it can be undone: $f(x,y)=c$ holds exactly when $${fam.I}=K$, where $K=${O.K}$ is a constant. `;
    const explanation =
      undo +
      `${fam.lead ?? 'Solving for $y$:'} $$${fam.solve}$$ So every level curve is ${SHAPE_PHRASE[fam.shape]}.`;
    const looks = O.looks.filter((s) => s !== fam.shape).map((s) => ({ shape: s, why: `judges the shape by the outer ${O.name}; it only changes the constant $K$, not the shape of the curves.` }));
    const wrong = [...fam.wrong, ...looks];
    const others = (Object.keys(SHAPE_TEXT) as Shape[]).filter((s) => s !== fam.shape && !wrong.some((w) => w.shape === s));
    const distractors: Choice[] = [
      ...wrong.map((w) => ({ text: SHAPE_TEXT[w.shape], why: w.why })),
      ...rng.shuffle(others).map((s) => ({ text: SHAPE_TEXT[s], why: `solving $f(x,y)=c$ for $y$ gives ${SHAPE_PHRASE[fam.shape]}, not ${SHAPE_PHRASE[s]}.` })),
    ];
    const mcq = buildMcq(rng, { text: SHAPE_TEXT[fam.shape] }, distractors, { count: optionCount });
    const stem = rng.pick([
      `Consider $$f(x,y)=${fTex}$$ on its domain. Each level curve $f(x,y)=c$ can be described by writing $y$ in terms of $x$ (where possible). Which description fits these level curves?`,
      `Every level curve $f(x,y)=c$ of the function $$f(x,y)=${fTex}$$ has the same shape in the $(x,y)$-plane. Which shape is it?`,
      `Take $$f(x,y)=${fTex}$$ What do its level curves $f(x,y)=c$ look like, as curves in the $(x,y)$-plane?`,
    ]);
    return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
  },
};

// =====================================================================================================================
// 3. Which g built from an arbitrary f has the same level curves as f? (g = φ(f) with φ strictly monotonic)
// =====================================================================================================================

const F = 'f(x,y)';
const sameLevelCurves: Template = {
  id: 'two-var-partials.same-level-curves',
  topic: 'Two variables: partial derivatives & level curves',
  title: 'Which g (f + c, kf, e^f, f³ versus f + x, xf, f + y², …) has the same level curves as an arbitrary f',
  types: ['single-choice', 'multi-select'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const [c, k, m] = [rng.int(1, 9), rng.int(2, 6), rng.int(2, 5)];
    const yes = [
      { text: `${F}${rng.chance(0.5) ? '+' : '-'}${c}`, why: 'adding a constant only renumbers the levels: $g=L$ exactly when $f$ equals $L$ minus that constant.' },
      { text: `${k}${F}`, why: `$g=L$ exactly when $f=\\frac{L}{${k}}$: multiplying by a non-zero constant keeps the level curves.` },
      { text: `${c}-${k}${F}`, why: `$g=L$ exactly when $f=\\frac{${c}-L}{${k}}$: a decreasing linear transformation keeps the level curves.` },
      { text: `\\dfrac{${F}}{${m}}+${c}`, why: `$g=L$ exactly when $f=${m}(L-${c})$.` },
      { text: `e^{${F}}`, why: '$e^{t}$ is strictly increasing: $e^{f}=L$ exactly when $f=\\ln(L)$.' },
      { text: `\\left(${F}\\right)^3`, why: '$t^3$ is strictly increasing: $f^3=L$ exactly when $f=\\sqrt[3]{L}$.' },
      { text: `${m}e^{${F}}`, why: '$e^{t}$ times a positive constant is strictly increasing: each level of $g$ corresponds to one level of $f$.' },
    ];
    const vary = (what: string) => `${what} changes along a level curve of $f$, so $g$ is not constant on it: the level curves change.`;
    const no = [
      { text: `${F}+${coef(k)}x`, why: vary(`the added term $${coef(k)}x$`) },
      { text: `${F}-${coef(m)}y`, why: vary(`the added term $-${coef(m)}y$`) },
      { text: `${F}+x+y`, why: vary('the added term $x+y$') },
      { text: `${F}+e^{x}`, why: vary('the added term $e^{x}$') },
      { text: `${F}+y^2`, why: vary('the added term $y^2$') },
      { text: `x${F}`, why: vary('the factor $x$') },
      { text: `${F}-${coef(k)}xy`, why: vary(`the added term $-${coef(k)}xy$`) },
      { text: `${F}+${coef(c)}x^2`, why: vary(`the added term $${coef(c)}x^2$`) },
    ];
    const g = (t: string) => `$g(x,y)=${t}$`;
    const theory =
      'The level curves of $g$ are the same as those of $f$ when $g=\\varphi(f)$ for a strictly increasing or strictly decreasing function $\\varphi$ of one variable: ' +
      'then $g(x,y)=L$ exactly when $f(x,y)=\\varphi^{-1}(L)$, so each level curve of $g$ is a level curve of $f$ (only the level values are renumbered). ' +
      'Adding a constant, multiplying by a non-zero constant, $e^{f}$ and $f^3$ are of this type. Adding (or multiplying by) an expression in $x$ or $y$ is not: ' +
      'that expression takes different values at different points of one level curve of $f$.';
    if (type === 'multi-select') {
      const statements = [...yes.map((s) => ({ text: g(s.text), correct: true, why: s.why })), ...no.map((s) => ({ text: g(s.text), correct: false, why: s.why }))];
      const multi = buildMulti(rng, statements, optionCount, 1);
      const stem = rng.pick([
        `Let $f(x,y)$ be an arbitrary function of two variables. Which of the functions $g$ below always have exactly the same level curves as $f$?`,
        `Suppose $f(x,y)$ is any function of two variables. For which of the following $g$ is every level curve of $g$ also a level curve of $f$ (and vice versa)?`,
      ]);
      const reasons = multi.reasons.map((r) => `- **${r.id}** (${r.correct ? 'correct' : 'wrong'}): ${r.why}`).join('\n');
      return { type, stem, instruction: INSTRUCTION.multi, options: multi.options, correctAnswer: multi.correctAnswer, explanation: `${theory}\n\n${reasons}` };
    }
    const right = rng.pick(yes);
    const mcq = buildMcq(
      rng,
      { text: g(right.text) },
      rng.shuffle(no).map((s) => ({ text: g(s.text), why: s.why })),
      { count: optionCount },
    );
    const stem = rng.pick([
      `Let $f(x,y)$ be an arbitrary function of two variables. Which function $g$ always has exactly the same level curves as $f$?`,
      `Suppose $f(x,y)$ is any function of two variables. For which of the following functions $g$ are the level curves of $g$ guaranteed to coincide with those of $f$?`,
    ]);
    return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: `${theory}\n\nHere: ${g(right.text)}; ${right.why}${mistakesNote(mcq.distractors)}` };
  },
};

// =====================================================================================================================
// 4. Marginal rate of substitution −U'a/U'b (Cobb–Douglas utility or production) or the slope −f'x/f'y of a level curve
// =====================================================================================================================

const CONSUMERS = [
  { who: 'Mila', a: ['c', 'cups of coffee'], b: ['k', 'cookies'], per: 'per week' },
  { who: 'A gamer', a: ['h', 'hours of online gaming'], b: ['s', 'bags of snacks'], per: 'per weekend' },
  { who: 'Tom', a: ['b', 'books'], b: ['m', 'cinema tickets'], per: 'per month' },
  { who: 'A commuter', a: ['t', 'train trips'], b: ['r', 'restaurant visits'], per: 'per month' },
  { who: 'Sanne', a: ['p', 'pizza slices'], b: ['g', 'glasses of lemonade'], per: 'per party' },
  { who: 'A runner', a: ['w', 'energy bars'], b: ['d', 'sports drinks'], per: 'per training week' },
] as const;
const FIRMS = ['A bakery', 'A bicycle workshop', 'A print shop', 'A small brewery', 'A furniture maker'];
const EXPONENTS: [number, number, number, number][] = [
  [3, 4, 1, 4], [1, 4, 3, 4], [1, 3, 2, 3], [2, 3, 1, 3], [2, 5, 3, 5], [3, 5, 2, 5], [1, 2, 1, 2], [1, 2, 1, 4], [1, 3, 1, 2],
];
const exTex = (n: number, d: number) => (d === 1 ? String(n) : frac(n, d));
const smallDen = (x: number) => !ratTex(x, 12).includes('.');

interface MrsCase {
  stem: string;
  what: string;
  key: number;
  explanation: string;
  mistakes: { value: number; why: string }[];
}

/** Cobb–Douglas utility v1^α·v2^β (asked: −U'v1/U'v2) or production A·K^α·L^β (asked: −Q'L/Q'K) at a point. */
function cobbDouglas(rng: Rng): MrsCase {
  const [an, ad, bn, bd] = rng.pick(EXPONENTS);
  const prod = rng.chance(0.35);
  const A = prod ? rng.int(2, 20) : 1;
  const N = prod ? 'Q' : 'U';
  const ctx = rng.pick(CONSUMERS);
  // the asked ratio is −N'_{v1}/N'_{v2}; e1, e2 are the exponents of v1 and v2
  const [v1, v2] = prod ? ['L', 'K'] : [ctx.a[0], ctx.b[0]];
  const [e1, e2]: [number, number][] = prod ? [[bn, bd], [an, ad]] : [[an, ad], [bn, bd]];
  const r = (e1[0] * e2[1]) / (e1[1] * e2[0]);
  let val1: number, val2: number;
  do {
    val1 = rng.int(1, 12);
    val2 = rng.int(1, 12);
  } while (val1 === val2 || !smallDen(r * (val2 / val1)));
  const key = -r * (val2 / val1);
  const g = gcd(e1[0] * e2[1], e1[1] * e2[0]);
  const [rn, rd] = [(e1[0] * e2[1]) / g, (e1[1] * e2[0]) / g];
  // partial derivatives, variables in display order (K before L for production)
  const order = prod ? [v2, v1] : [v1, v2];
  const powers = (p1: [number, number], p2: [number, number]) => {
    const pw: Record<string, string> = { [v1]: `${v1}^{${exTex(p1[0], p1[1])}}`, [v2]: `${v2}^{${exTex(p2[0], p2[1])}}` };
    return order.map((v) => pw[v]).join('');
  };
  const d1 = `${frac(A * e1[0], e1[1])}${powers([e1[0] - e1[1], e1[1]], e2)}`;
  const d2 = `${frac(A * e2[0], e2[1])}${powers(e1, [e2[0] - e2[1], e2[1]])}`;
  const simpl = `-\\dfrac{${rn === 1 ? '' : rn}${v2}}{${rd === 1 ? '' : rd}${v1}}`;
  const plugDone = rn === 1 && rd === 1 && gcd(val1, val2) === 1;
  let stem: string;
  if (prod) {
    stem =
      `${rng.pick(FIRMS)} produces $$Q(K,L)=${A}K^{${exTex(an, ad)}}L^{${exTex(bn, bd)}}$$ units per day with $K$ machines and $L$ workers. ` +
      `It currently uses $(K,L)=(${val2},${val1})$. The slope of the isoquant through this point (the marginal rate of technical substitution) is $$MRTS=-\\dfrac{Q'_{L}}{Q'_{K}}$$`;
  } else {
    stem =
      `${ctx.who} gets utility $$U(${v1},${v2})=${v1}^{${exTex(an, ad)}}${v2}^{${exTex(bn, bd)}}$$ from $${v1}$ ${ctx.a[1]} and $${v2}$ ${ctx.b[1]} ${ctx.per}. ` +
      `At the moment the bundle is $(${v1},${v2})=(${val1},${val2})$. The marginal rate of substitution of ${ctx.b[1]} for ${ctx.a[1]} is $$MRS=-\\dfrac{U'_{${v1}}}{U'_{${v2}}}$$`;
  }
  const explanation =
    `Power rule for each variable (the other one is held constant): $$${N}'_{${v1}}=${d1},\\qquad ${N}'_{${v2}}=${d2}$$ ` +
    `In the quotient the powers combine to $${v1}^{-1}$ and $${v2}^{1}$${prod ? ` (the constant ${A} cancels)` : ''}: $$-\\dfrac{${N}'_{${v1}}}{${N}'_{${v2}}}=${simpl}$$ ` +
    `At $${v1}=${val1}$ and $${v2}=${val2}$: $$-\\dfrac{${rn === 1 ? '' : `${rn}\\cdot `}${val2}}{${rd === 1 ? '' : `${rd}\\cdot `}${val1}}${plugDone ? '' : `=${ratTex(key)}`}$$`;
  return {
    stem,
    what: prod ? 'the MRTS at this input combination' : 'the MRS at this bundle',
    key,
    explanation,
    mistakes: [
      { value: -(1 / r) * (val1 / val2), why: `divides the partial derivatives the wrong way round ($-${N}'_{${v2}}/${N}'_{${v1}}$).` },
      { value: -key, why: 'forgets the minus sign.' },
      { value: -r * (val1 / val2), why: `combines the powers wrongly and ends up with $${v1}/${v2}$ instead of $${v2}/${v1}$.` },
      { value: -r, why: 'keeps only the ratio of the exponents and forgets the quantities.' },
      { value: -(1 / r) * (val2 / val1), why: 'swaps the two exponents.' },
      { value: -(val2 / val1), why: 'forgets the exponents that the power rule brings down.' },
      ...(prod ? [{ value: key * A, why: `keeps the constant ${A} in $Q'_{L}$ but drops it from $Q'_{K}$, so it does not cancel.` }] : []),
    ],
  };
}

/** Slope dy/dx = −f'x/f'y of the level curve of a quadratic f through a point. */
function levelSlope(rng: Rng): MrsCase {
  let P: Poly2, x0: number, y0: number, fx: number, fy: number;
  do {
    const [a, b, c] = [rng.sign() * rng.int(1, 4), rng.sign() * rng.int(1, 5), rng.sign() * rng.int(1, 4)];
    const lin: Mono[] = rng.chance(0.5) ? [[rng.sign() * rng.int(1, 6), 1, 0]] : [];
    P = [...rng.shuffle<Mono>([[a, 2, 0], [b, 1, 1], [c, 0, 2]]), ...lin];
    x0 = rng.int(-3, 3);
    y0 = rng.int(-3, 3);
    fx = p2Eval(p2Dx(P), x0, y0);
    fy = p2Eval(p2Dy(P), x0, y0);
  } while (fx === 0 || fy === 0 || x0 * y0 === 0 || !smallDen(fx / fy) || Math.abs(fx / fy) > 15);
  assertPartials(P);
  const key = -fx / fy;
  const L = p2Eval(P, x0, y0);
  const noCross = p2Dx(P.filter(([, i, j]) => i === 0 || j === 0));
  const noCrossY = p2Dy(P.filter(([, i, j]) => i === 0 || j === 0));
  // "forgets the 2 of the squares": a·x² differentiated as a·x
  const no2 = (v: 'x' | 'y') => (v === 'x' ? p2Dx : p2Dy)(P.map(([c, i, j]) => [(v === 'x' ? i : j) === 2 ? c / 2 : c, i, j] as Mono));
  const stem =
    `The level curve $f(x,y)=${L}$ of $$f(x,y)=${p2Tex(P)}$$ passes through the point $(x,y)=(${x0},${y0})$. ` +
    `Near this point the curve is the graph of a function $y(x)$ with slope $$\\dfrac{dy}{dx}=-\\dfrac{f'_{x}}{f'_{y}}$$`;
  const explanation =
    `The partial derivatives are $$f'_x=${p2Tex(p2Dx(P))},\\qquad f'_y=${p2Tex(p2Dy(P))}$$ ` +
    `At $(${x0},${y0})$: $f'_x=${fx}$ and $f'_y=${fy}$, so $$\\dfrac{dy}{dx}=-\\dfrac{${fx}}{${fy}}=${ratTex(key)}$$`;
  return {
    stem,
    what: `this slope at $(x,y)=(${x0},${y0})$`,
    key,
    explanation,
    mistakes: [
      { value: -fy / fx, why: "divides the partial derivatives the wrong way round ($-f'_y/f'_x$)." },
      { value: fx / fy, why: 'forgets the minus sign.' },
      { value: -p2Eval(noCross, x0, y0) / p2Eval(noCrossY, x0, y0), why: 'forgets the cross term with $xy$ when differentiating.' },
      { value: -p2Eval(no2('x'), x0, y0) / p2Eval(no2('y'), x0, y0), why: 'forgets the factor 2 when differentiating the squares.' },
    ],
  };
}

const mrsSlope: Template = {
  id: 'two-var-partials.mrs-slope',
  topic: 'Two variables: partial derivatives & level curves',
  title: "MRS −U'a/U'b of a Cobb–Douglas utility (or MRTS of a production function), or the slope −f'x/f'y of a level curve",
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }): Generated {
    const cs = rng.chance(0.7) ? cobbDouglas(rng) : levelSlope(rng);
    if (type === 'numeric') return numericQuestion(`${cs.stem} Calculate ${cs.what}.`, cs.key, 2, cs.explanation);
    const mcq = valueMcq(rng, cs.key, cs.mistakes, optionCount, (v) => `$${ratTex(v)}$`);
    return choiceQuestion(`${cs.stem} What is ${cs.what}?`, mcq, cs.explanation);
  },
};

export const TEMPLATES: Template[] = [partialDerivative, levelCurveShape, sameLevelCurves, mrsSlope];
