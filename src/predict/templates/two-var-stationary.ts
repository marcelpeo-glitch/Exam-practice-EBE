// Templates for the topic "Two variables: stationary points" (QM1 past exams: the status of a given stationary point
// of 4(x−1)² + 4y² − (x−1)²y² or of 3x³ + 9x²y + 4y³ − 48y via C = f''xx·f''yy − (f''xy)²; how many (other) stationary
// points such a function has; the maximal profit of a monopolist who sets prices in two markets). Every function is a
// polynomial in u = x − p, v = y − q (Poly2 from _twovar) with exact derivatives, checked against mathjs; every listed
// stationary point is checked to make both partial derivatives exactly zero. See two-var-stationary.test.ts for the
// independent checks (Newton's method on the printed function, numerical Hessians, direct maximisation).
import { buildMcq, INSTRUCTION, mistakesNote, num, numericField, type Choice } from '../build';
import { gcd } from '../mathx';
import type { Rng } from '../rng';
import type { Generated, Template } from '../types';
import { choiceQuestion, ensure, euro, integerFallback, numericQuestion, valueMcq } from './_econ';
import { ratTex, termsTex } from './_fnderiv';
import {
  assertPartials,
  hessAt,
  p2Dx,
  p2Dy,
  p2Eval,
  p2Tex,
  prodTex,
  ptTex,
  secondOrderTex,
  shifted,
  statusMistakes,
  statusOf,
  statusText,
  statusWhyNot,
  type Poly2,
  type Shift,
  type Status,
} from './_twovar';

const TOPIC = 'Two variables: stationary points' as const;
const U: Poly2 = [[1, 1, 0]];
const V: Poly2 = [[1, 0, 1]];

// =====================================================================================================================
// Function families with known stationary points (in the shifted variables u = x − p, v = y − q)
// =====================================================================================================================

interface Family {
  P: Poly2;
  s: Shift;
  /** All stationary points (u, v). */
  pts: [number, number][];
  /** Worked solution of f'x = 0, f'y = 0. */
  solve: string;
  /** Wrong total numbers of stationary points and the mistakes behind them. */
  countMistakes: { value: number; why: string }[];
}

const uT = (s: Shift) => shifted('x', s.p);
const vT = (s: Shift) => shifted('y', s.q);
const xv = (s: Shift, u: number) => ratTex(s.p + u);
const yv = (s: Shift, v: number) => ratTex(s.q + v);
const listPts = (s: Shift, pts: [number, number][]) => pts.map(([u, v]) => `$${ptTex(s.p + u, s.q + v)}$`).join(', ');
const randShift = (rng: Rng, pZero = 0.3): Shift => (rng.chance(pZero) ? { p: 0, q: 0 } : { p: rng.int(-2, 2), q: rng.int(-2, 2) });

/** f = A·u² + B·v² + E·u²v²: f'x = 2u(A + Ev²), f'y = 2v(B + Eu²); 5 stationary points or only (p, q). */
function productFamily(rng: Rng, s: Shift): Family {
  let E: number, ru: number, rv: number;
  // ±4u² ± 4v² ∓ u²v² and ±9u² ± 9v² ∓ u²v² are (up to signs) the past exam functions: never reuse them
  do [E, ru, rv] = [rng.pick([-1, -1, -1, 1, -2, 2]), rng.int(1, 3), rng.int(1, 3)];
  while (Math.abs(E) === 1 && ru === rv && ru > 1);
  let [A, B] = [-E * rv * rv, -E * ru * ru];
  const flip = rng.pick(['none', 'none', 'none', 'A', 'B', 'AB']);
  if (flip.includes('A')) A = -A;
  if (flip.includes('B')) B = -B;
  const vReal = -A / E > 0;
  const uReal = -B / E > 0;
  const full = vReal && uReal;
  const P: Poly2 = [[A, 2, 0], [B, 0, 2], [E, 2, 2]];
  const pts: [number, number][] = [[0, 0], ...(full ? ([[ru, rv], [ru, -rv], [-ru, rv], [-ru, -rv]] as [number, number][]) : [])];
  const [X, Y] = [uT(s), vT(s)];
  const fx = prodTex(2, [U, [[A, 0, 0], [E, 0, 2]]], s);
  const fy = prodTex(2, [V, [[B, 0, 0], [E, 2, 0]]], s);
  const vCase = vReal
    ? `If $${Y}^2=${ratTex(-A / E)}$, i.e. $y=${yv(s, rv)}$ or $y=${yv(s, -rv)}$, then $${Y}\\ne 0$, so $f'_y=0$ requires $${X}^2=${ratTex(-B / E)}$` +
      (uReal ? `, i.e. $x=${xv(s, ru)}$ or $x=${xv(s, -ru)}$: four points.` : `, which has no solution.`)
    : `The equation $${Y}^2=${ratTex(-A / E)}$ has no solution.`;
  const solve =
    `$$f'_x=${fx},\\qquad f'_y=${fy}$$ ` +
    `$f'_x=0$ gives $x=${s.p}$ or $${Y}^2=${ratTex(-A / E)}$.\n\n` +
    `- If $x=${s.p}$, then $f'_y=${termsTex([[2 * B, Y]])}=0$, so $y=${s.q}$: the point $${ptTex(s.p, s.q)}$.\n` +
    `- ${vCase}`;
  const nx = 1 + (uReal ? 2 : 0);
  const ny = 1 + (vReal ? 2 : 0);
  const countMistakes = [
    { value: nx * ny, why: 'combines every $x$-value with every $y$-value that occurs, without checking that both equations hold at the same point.' },
    { value: full ? 4 : 0, why: `divides by $${X}$ and $${Y}$ and so loses the solutions $x=${s.p}$ and $y=${s.q}$.` },
    { value: full ? 2 : 1, why: 'only uses the positive square roots.' },
    { value: 1, why: `only finds the obvious point $${ptTex(s.p, s.q)}$.` },
    ...(!full ? [{ value: 5, why: 'takes square roots of a negative number.' }] : []),
  ];
  return { P, s, pts, solve, countMistakes };
}

/** (E, v*, u*) with A = −E·v*, B = −E·u*²/(2v*) integer: f = A·u² + B·v² + E·u²v has stationary points (0,0), (±u*, v*). */
const UUV: [number, number, number][] = [];
for (const E of [-2, -1, 1, 2])
  for (const vs of [-3, -2, -1, 1, 2, 3])
    for (const us of [1, 2, 3, 4]) {
      const B = (-E * us * us) / (2 * vs);
      if (Number.isInteger(B) && Math.abs(B) <= 12 && Math.abs(E * vs) <= 9) UUV.push([E, vs, us]);
    }

/** f = A·u² + B·v² + E·u²·v: f'x = 2u(A + Ev), f'y = 2Bv + Eu²; 3 stationary points or only (p, q). */
function uuvFamily(rng: Rng, s: Shift): Family {
  const [E, vs, us] = rng.pick(UUV);
  const A = -E * vs;
  let B = (-E * us * us) / (2 * vs);
  const full = rng.chance(0.75);
  if (!full) B = -B;
  const P: Poly2 = [[A, 2, 0], [B, 0, 2], [E, 2, 1]];
  const pts: [number, number][] = [[0, 0], ...(full ? ([[us, vs], [-us, vs]] as [number, number][]) : [])];
  const [X, Y] = [uT(s), vT(s)];
  const u2 = (-2 * B * vs) / E;
  const solve =
    `$$f'_x=${prodTex(2, [U, [[A, 0, 0], [E, 0, 1]]], s)},\\qquad f'_y=${p2Tex([[2 * B, 0, 1], [E, 2, 0]], s)}$$ ` +
    `$f'_x=0$ gives $x=${s.p}$ or $y=${yv(s, vs)}$.\n\n` +
    `- If $x=${s.p}$, then $f'_y=${termsTex([[2 * B, Y]])}=0$, so $y=${s.q}$: the point $${ptTex(s.p, s.q)}$.\n` +
    `- If $y=${yv(s, vs)}$, then $f'_y=${2 * B * vs}${E < 0 ? '-' : '+'}${Math.abs(E) === 1 ? '' : Math.abs(E)}${X}^2=0$, so $${X}^2=${u2}$` +
    (full ? `, i.e. $x=${xv(s, us)}$ or $x=${xv(s, -us)}$: two points.` : ', which has no solution.');
  const countMistakes = [
    { value: (full ? 3 : 1) * 2, why: 'combines every $x$-value with every $y$-value that occurs, without checking that both equations hold at the same point.' },
    { value: full ? 2 : 0, why: `divides $f'_x=0$ by $${X}$ and so loses the solution $x=${s.p}$.` },
    { value: full ? 2 : 1, why: 'only uses the positive square root.' },
    { value: 1, why: `only finds the obvious point $${ptTex(s.p, s.q)}$.` },
    ...(!full ? [{ value: 3, why: 'takes the square root of a negative number.' }] : []),
  ];
  return { P, s, pts, solve, countMistakes };
}

/** a·u³ + b·u²v + c·v³ + d·v whose stationary points are integers (|·| ≤ 6) and non-degenerate (enumerated once). */
interface Cubic {
  a: number;
  b: number;
  c: number;
  d: number;
  v1sq: number;
  v2sq: number;
  pts: [number, number][];
}
let cubicCache: Cubic[] | null = null;
function cubics(): Cubic[] {
  if (cubicCache) return cubicCache;
  const out: Cubic[] = [];
  const isSq = (t: number) => t > 0 && Number.isInteger(t) && Number.isInteger(Math.sqrt(t));
  for (const a of [-4, -3, -2, -1, 1, 2, 3, 4])
    for (let b = -12; b <= 12; b++)
      for (let c = -6; c <= 6; c++)
        for (let d = -75; d <= 75; d++) {
          // (|a|, |b|) = (3, 9) would come too close to the past exam function 3x³ + 9x²y + 4y³ − 48y
          if (!b || !c || !d || (Math.abs(a) === 3 && Math.abs(b) === 9)) continue;
          const N = 4 * b ** 3 + 27 * a * a * c; // 9a²·(b·m² + 3c) with m = −2b/(3a)
          if (N === 0) continue;
          const [v1sq, v2sq] = [-d / (3 * c), (-9 * a * a * d) / N];
          if (!(v1sq < 0 || isSq(v1sq)) || !(v2sq < 0 || isSq(v2sq)) || (v1sq < 0 && v2sq < 0)) continue;
          const pts: [number, number][] = [];
          if (v1sq > 0) pts.push([0, Math.sqrt(v1sq)], [0, -Math.sqrt(v1sq)]);
          if (v2sq > 0) {
            const s2 = Math.sqrt(v2sq);
            if ((2 * b * s2) % (3 * a) !== 0) continue;
            const u2 = (-2 * b * s2) / (3 * a);
            pts.push([u2, s2], [-u2, -s2]);
          }
          const C = ([u, v]: [number, number]) => (6 * a * u + 2 * b * v) * 6 * c * v - (2 * b * u) ** 2;
          if (pts.some((p) => Math.abs(p[0]) > 6 || Math.abs(p[1]) > 6 || C(p) === 0)) continue;
          out.push({ a, b, c, d, v1sq, v2sq, pts });
        }
  return (cubicCache = out);
}

/** A coefficient that is a fraction, in front of a symbol: 1 → "", −1 → "-", 2/3 → "\frac{2}{3}". */
const fracCoef = (x: number) => (x === 1 ? '' : x === -1 ? '-' : ratTex(x));

/** Cubic functions: the general a·u³ + b·u²v + c·v³ + d·v, a separable one, or a·(u³ + v³) − 3ak·uv. */
function cubicFamily(rng: Rng, s: Shift): Family {
  const [X, Y] = [uT(s), vT(s)];
  const sub = rng.pick(['general', 'general', 'separable', 'folium'] as const);
  if (sub === 'separable') {
    const [a, r] = [rng.sign() * rng.int(1, 2), rng.int(1, 3)];
    const quad = rng.chance(0.3);
    const [b, t] = [rng.sign() * rng.int(1, 2), rng.int(1, 3)];
    const P: Poly2 = quad ? [[a, 3, 0], [-3 * a * r * r, 1, 0], [b, 0, 2]] : [[a, 3, 0], [b, 0, 3], [-3 * a * r * r, 1, 0], [-3 * b * t * t, 0, 1]];
    const pts: [number, number][] = quad ? [[r, 0], [-r, 0]] : [[r, t], [r, -t], [-r, t], [-r, -t]];
    const fy = quad ? termsTex([[2 * b, Y]]) : prodTex(3 * b, [[[1, 0, 2], [-t * t, 0, 0]]], s);
    const solve =
      `$$f'_x=${prodTex(3 * a, [[[1, 2, 0], [-r * r, 0, 0]]], s)},\\qquad f'_y=${fy}$$ ` +
      `$f'_x$ only depends on $x$ and $f'_y$ only on $y$. $f'_x=0$ gives $${X}^2=${r * r}$, so $x=${xv(s, r)}$ or $x=${xv(s, -r)}$; ` +
      (quad ? `$f'_y=0$ gives $y=${s.q}$.` : `$f'_y=0$ gives $${Y}^2=${t * t}$, so $y=${yv(s, t)}$ or $y=${yv(s, -t)}$. Every combination of these $x$- and $y$-values is a solution.`);
    const countMistakes = quad
      ? [
          { value: 1, why: 'only uses the positive square root.' },
          { value: 3, why: 'adds up the numbers of solutions of the two equations instead of combining them.' },
        ]
      : [
          { value: 1, why: 'only uses the positive square roots.' },
          { value: 2, why: 'pairs plus with plus and minus with minus instead of taking every combination.' },
        ];
    return { P, s, pts, solve, countMistakes };
  }
  if (sub === 'folium') {
    const [a, k] = [rng.sign() * rng.int(1, 2), rng.sign() * rng.int(1, 3)];
    const P: Poly2 = [[a, 3, 0], [a, 0, 3], [-3 * a * k, 1, 1]];
    const pts: [number, number][] = [[0, 0], [k, k]];
    const yOfX = k === 1 ? `${X}^2` : k === -1 ? `-${X}^2` : k > 0 ? `\\dfrac{${X}^2}{${k}}` : `-\\dfrac{${X}^2}{${-k}}`;
    const solve =
      `$$f'_x=${prodTex(3 * a, [[[1, 2, 0], [-k, 0, 1]]], s)},\\qquad f'_y=${prodTex(3 * a, [[[1, 0, 2], [-k, 1, 0]]], s)}$$ ` +
      `$f'_x=0$ gives $${Y}=${yOfX}$. Substituting this into $f'_y=0$: $$\\dfrac{${X}^4}{${k * k}}${k < 0 ? '+' : '-'}${Math.abs(k) === 1 ? '' : Math.abs(k)}${X}=0\;\\Leftrightarrow\; ${X}\\left(${X}^3${k < 0 ? '+' : '-'}${Math.abs(k ** 3)}\\right)=0$$ ` +
      `so $x=${s.p}$ (then $y=${s.q}$) or $${X}^3=${k ** 3}$, i.e. $x=${xv(s, k)}$ (then $y=${yv(s, k)}$).`;
    const countMistakes = [
      { value: 1, why: `divides by $${X}$ and so loses the solution $x=${s.p}$.` },
      { value: 3, why: `also takes $x=${xv(s, -k)}$, but $(${-k})^3\\ne ${k ** 3}$.` },
      { value: 4, why: 'combines every $x$-value with every $y$-value that occurs, without checking that both equations hold at the same point.' },
    ];
    return { P, s, pts, solve, countMistakes };
  }
  const all = cubics();
  const four = all.filter((k) => k.pts.length === 4);
  const { a, b, c, d, v1sq, v2sq, pts } = rng.pick(rng.chance(0.4) ? four : all);
  const P: Poly2 = [[a, 3, 0], [b, 2, 1], [c, 0, 3], [d, 0, 1]];
  const m = (-2 * b) / (3 * a);
  const den = b * m * m + 3 * c;
  const g = gcd(3 * a, 2 * b) * Math.sign(a);
  const [s1, s2] = [Math.sqrt(Math.abs(v1sq)), Math.sqrt(Math.abs(v2sq))];
  const solve =
    `$$f'_x=${prodTex(g, [U, [[(3 * a) / g, 1, 0], [(2 * b) / g, 0, 1]]], s)},\\qquad f'_y=${p2Tex([[b, 2, 0], [3 * c, 0, 2], [d, 0, 0]], s)}$$ ` +
    `$f'_x=0$ gives $x=${s.p}$ or $${termsTex([[3 * a, X], [2 * b, Y]])}=0$, i.e. $${X}=${fracCoef(m)}${Y}$.\n\n` +
    `- If $x=${s.p}$: $f'_y=${termsTex([[3 * c, `${Y}^2`], [d, '']])}=0$ gives $${Y}^2=${ratTex(v1sq)}$` +
    (v1sq > 0 ? `, so $y=${yv(s, s1)}$ or $y=${yv(s, -s1)}$: the points ${listPts(s, [[0, s1], [0, -s1]])}.\n` : ', which has no solution.\n') +
    `- If $${X}=${fracCoef(m)}${Y}$: $f'_y=${fracCoef(den)}${Y}^2${d < 0 ? '-' : '+'}${Math.abs(d)}=0$ gives $${Y}^2=${ratTex(v2sq)}$` +
    (v2sq > 0 ? `: the points ${listPts(s, [[m * s2, s2], [-m * s2, -s2]])}.` : ', which has no solution.');
  const [n1, n2] = [v1sq > 0 ? 2 : 0, v2sq > 0 ? 2 : 0];
  const countMistakes = [
    { value: n2, why: `divides $f'_x=0$ by $${X}$ and so loses the case $x=${s.p}$.` },
    { value: n1, why: `only uses $x=${s.p}$ and forgets the second factor of $f'_x$.` },
    { value: n1 / 2 + n2 / 2, why: 'only uses the positive square roots.' },
    ...(v1sq < 0 || v2sq < 0 ? [{ value: 4, why: 'takes the square root of a negative number.' }] : []),
  ];
  return { P, s, pts, solve, countMistakes };
}

/** Self-checks: derivatives agree with mathjs, every listed point is stationary, no point is listed twice. */
function checked(f: Family): Family {
  assertPartials(f.P, f.s);
  for (const [u, v] of f.pts) ensure(p2Eval(p2Dx(f.P), u, v) === 0 && p2Eval(p2Dy(f.P), u, v) === 0, `(${u},${v}) is stationary`);
  ensure(new Set(f.pts.map((p) => p.join(','))).size === f.pts.length, 'distinct points');
  return f;
}

const fDef = (f: Family) => `f(x,y)=${p2Tex(f.P, f.s)}`;

// =====================================================================================================================
// 1. Find the stationary point of a quadratic function
// =====================================================================================================================

const findPoint: Template = {
  id: 'two-var-stationary.find-point',
  topic: TOPIC,
  title: 'The stationary point of a quadratic f(x, y) = ax² + bxy + cy² + dx + ey (solve the two first-order conditions)',
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    let a: number, b: number, c: number, x0: number, y0: number;
    do {
      [a, b, c] = [rng.sign() * rng.int(1, 4), rng.sign() * rng.int(1, 4), rng.sign() * rng.int(1, 4)];
      [x0, y0] = [rng.int(-4, 4), rng.int(-4, 4)];
    } while (4 * a * c - b * b === 0 || x0 === 0 || y0 === 0 || x0 === y0 || 2 * a + b === 0 || b + 2 * c === 0 || a * c - b * b === 0);
    const d = -(2 * a * x0 + b * y0);
    const e = -(b * x0 + 2 * c * y0);
    const k = rng.chance(0.4) ? rng.sign() * rng.int(1, 9) : 0;
    const P: Poly2 = rng.chance(0.5)
      ? [[a, 2, 0], [b, 1, 1], [c, 0, 2], [d, 1, 0], [e, 0, 1], [k, 0, 0]]
      : [[a, 2, 0], [d, 1, 0], [c, 0, 2], [e, 0, 1], [b, 1, 1], [k, 0, 0]];
    assertPartials(P);
    ensure(p2Eval(p2Dx(P), x0, y0) === 0 && p2Eval(p2Dy(P), x0, y0) === 0, 'stationary point');
    const C = 4 * a * c - b * b;
    const status = C < 0 ? 'a saddle point' : a > 0 ? 'a minimum' : 'a maximum';
    const par = (n: number) => (n < 0 ? `(${n})` : String(n));
    const explanation =
      `Both first-order partial derivatives must be zero: $$f'_x=${termsTex([[2 * a, 'x'], [b, 'y'], [d, '']])}=0,\\qquad f'_y=${termsTex([[b, 'x'], [2 * c, 'y'], [e, '']])}=0$$ ` +
      `This is the linear system $${termsTex([[2 * a, 'x'], [b, 'y']])}=${-d}$ and $${termsTex([[b, 'x'], [2 * c, 'y']])}=${-e}$. ` +
      `Eliminating $x$ (multiply the first equation by $${par(b)}$, the second by $${2 * a}$ and subtract) gives ` +
      `$$y=\\dfrac{${2 * a}\\cdot ${par(-e)}-${par(b)}\\cdot ${par(-d)}}{${2 * a}\\cdot ${par(2 * c)}-${par(b)}^2}=\\dfrac{${-2 * a * e + b * d}}{${C}}=${y0}$$ ` +
      `and then, from the first equation, $$x=\\dfrac{${-d}-${par(b)}\\cdot ${par(y0)}}{${2 * a}}=${x0}$$ ` +
      `So the stationary point is $(${x0},${y0})$. (Not asked: $C=f''_{xx}f''_{yy}-\\left(f''_{xy}\\right)^2=${2 * a}\\cdot ${par(2 * c)}-${par(b)}^2=${C}$, so it is ${status}.)`;
    const stemF = `$$f(x,y)=${p2Tex(P)}$$`;
    if (type === 'numeric') {
      const stem = rng.pick([
        `The function ${stemF} has exactly one stationary point $(x_0,y_0)$. Find it.`,
        `Determine the point $(x_0,y_0)$ where both partial derivatives of ${stemF} are equal to zero.`,
      ]);
      return {
        type,
        stem,
        instruction: INSTRUCTION.numericFields(2),
        fields: [numericField('x0', '$x_0$', x0, 2), numericField('y0', '$y_0$', y0, 2)],
        explanation,
      };
    }
    const pt = (x: number, y: number) => `$${ptTex(x, y)}$`;
    const solve2 = (a11: number, a12: number, a21: number, a22: number, r1: number, r2: number): [number, number] | null => {
      const D = a11 * a22 - a12 * a21;
      return D === 0 ? null : [(r1 * a22 - a12 * r2) / D, (a11 * r2 - r1 * a21) / D];
    };
    const mistakes: { p: [number, number] | null; why: string }[] = [
      { p: [-x0, -y0], why: 'moves the constant terms to the other side without changing their signs.' },
      { p: [y0, x0], why: 'mixes up the two coordinates.' },
      { p: [-d / (2 * a), -e / (2 * c)], why: `forgets the term $${termsTex([[b, 'xy']])}$ when differentiating (it gives $${termsTex([[b, 'y']])}$ in $f'_x$ and $${termsTex([[b, 'x']])}$ in $f'_y$).` },
      { p: solve2(a, b, b, c, -d, -e), why: 'forgets the factor 2 when differentiating $x^2$ and $y^2$.' },
      { p: [-d / (2 * a + b), -e / (b + 2 * c)], why: `differentiates $${termsTex([[b, 'xy']])}$ with respect to $x$ as $${termsTex([[b, 'x']])}$ (and with respect to $y$ as $${termsTex([[b, 'y']])}$).` },
    ];
    const distractors: Choice[] = mistakes.filter((m) => m.p && m.p.every(Number.isFinite)).map((m) => ({ text: pt(m.p![0], m.p![1]), why: m.why }));
    const mcq = buildMcq(rng, { text: pt(x0, y0) }, distractors, {
      count: optionCount,
      fallback: (i) => ({ text: pt(x0 + (i % 2 ? -1 : 1) * (Math.floor(i / 2) + 1), y0 + (i % 3) - 1), why: 'an arithmetic slip while solving the two equations.' }),
    });
    const stem = rng.pick([
      `Which of the following points is the stationary point of ${stemF}`,
      `The function ${stemF} has exactly one stationary point. Which point is it?`,
      `Solve the first-order conditions $f'_x=0$ and $f'_y=0$ for ${stemF} Which point do you find?`,
    ]);
    return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
  },
};

// =====================================================================================================================
// 2. The status of a given stationary point (second-order test, C = f''xx·f''yy − (f''xy)²)
// =====================================================================================================================

const ALL_STATUS: Status[] = ['min', 'max', 'saddle', 'undMin', 'undMax'];

/** f = A·u⁴ + B·v² + E·u²v²: at (p, q) we get C = 0 (the test is inconclusive). */
function degenerate(rng: Rng, s: Shift): Family {
  const [A, B, E] = [rng.sign() * rng.int(1, 3), rng.sign() * rng.int(1, 6), rng.sign() * rng.int(1, 2)];
  return { P: [[A, 4, 0], [B, 0, 2], [E, 2, 2]], s, pts: [[0, 0]], solve: '', countMistakes: [] };
}

const status: Template = {
  id: 'two-var-stationary.status',
  topic: TOPIC,
  title: 'Status of a given stationary point (minimum, maximum, saddle point or inconclusive) with the second-order test',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const kind = rng.pick(['prod', 'prod', 'uuv', 'cubic', 'cubic', 'degen'] as const);
    const s = randShift(rng, kind === 'cubic' ? 0.75 : 0.25);
    const fam = checked(kind === 'prod' ? productFamily(rng, s) : kind === 'uuv' ? uuvFamily(rng, s) : kind === 'cubic' ? cubicFamily(rng, s) : degenerate(rng, s));
    const [u0, v0] = fam.pts.length > 1 && rng.chance(kind === 'cubic' ? 1 : 0.35) ? rng.pick(fam.pts.slice(kind === 'cubic' ? 0 : 1)) : fam.pts[0];
    const [x0, y0] = [s.p + u0, s.q + v0];
    const pt = ptTex(x0, y0);
    const h = hessAt(fam.P, x0, y0, s);
    const right = statusOf(h);
    const fx = p2Dx(fam.P);
    const fy = p2Dy(fam.P);
    const explanation =
      `The first-order partial derivatives are $$f'_x=${p2Tex(fx, s)},\\qquad f'_y=${p2Tex(fy, s)}$$ and both are $0$ at $${pt}$, so it is indeed a stationary point. ` +
      `The second-order partial derivatives are $$f''_{xx}=${p2Tex(p2Dx(fx), s)},\\qquad f''_{yy}=${p2Tex(p2Dy(fy), s)},\\qquad f''_{xy}=${p2Tex(p2Dy(fx), s)}$$ ` +
      secondOrderTex(h, pt);
    const stemF = `$$${fDef(fam)}$$`;
    const intro = rng.pick([
      `The function ${stemF} has a stationary point at $${pt}$.`,
      `Both first-order partial derivatives of ${stemF} vanish at the point $${pt}$.`,
      `For ${stemF} one can check that $f'_x=f'_y=0$ at $${pt}$.`,
    ]);
    if (type === 'numeric') {
      return numericQuestion(
        `${intro} Calculate the value of the criterion $C=f''_{xx}f''_{yy}-\\left(f''_{xy}\\right)^2$ at this point.`,
        h.C || 0, // never −0
        0,
        `${explanation}\n\nSo $C=${h.C}$.`,
      );
    }
    const seen = new Set<Status>();
    const distractors: Choice[] = [];
    for (const m of statusMistakes(h))
      if (!seen.has(m.status)) {
        seen.add(m.status);
        distractors.push({ text: statusText(m.status, pt), why: m.why });
      }
    for (const st of rng.shuffle(ALL_STATUS)) if (st !== right && !seen.has(st)) distractors.push({ text: statusText(st, pt), why: statusWhyNot(st, h) });
    const mcq = buildMcq(rng, { text: statusText(right, pt) }, distractors, { count: optionCount });
    const stem = `${intro} ${rng.pick(['What does the second-order test say about this point?', `What is the status of $${pt}$?`, 'Classify this stationary point.'])}`;
    return choiceQuestion(stem, mcq, explanation);
  },
};

// =====================================================================================================================
// 3. How many (other) stationary points?
// =====================================================================================================================

const count: Template = {
  id: 'two-var-stationary.count',
  topic: TOPIC,
  title: 'Number of stationary points (or of the other ones, given one) of a polynomial f(x, y) whose first-order conditions factorise',
  types: ['single-choice', 'numeric'],
  difficulty: 3,
  generate({ rng, type, optionCount }): Generated {
    const kind = rng.pick(['prod', 'prod', 'uuv', 'cubic'] as const);
    const s = randShift(rng, kind === 'cubic' ? 0.75 : 0.25);
    const fam = checked(kind === 'prod' ? productFamily(rng, s) : kind === 'uuv' ? uuvFamily(rng, s) : cubicFamily(rng, s));
    const total = fam.pts.length;
    const other = rng.chance(0.45);
    const given = fam.pts[kind === 'cubic' ? rng.int(0, total - 1) : 0];
    const gp = ptTex(s.p + given[0], s.q + given[1]);
    const key = other ? total - 1 : total;
    const stemF = `$$${fDef(fam)}$$`;
    const stem = other
      ? rng.pick([
          `The function ${stemF} has a stationary point at $${gp}$ (check it!). Apart from $${gp}$, how many stationary points does $f$ have?`,
          `Besides $${gp}$, at how many further points are both partial derivatives of ${stemF} equal to zero?`,
        ])
      : rng.pick([
          `Determine the total number of stationary points of ${stemF}`,
          `At how many points $(x,y)$ are both first-order conditions $f'_x=0$ and $f'_y=0$ satisfied for ${stemF}`,
        ]);
    const explanation =
      `${fam.solve}\n\nSo $f$ has ${total} stationary point${total === 1 ? '' : 's'}: ${listPts(s, fam.pts)}.` +
      (other ? ` Apart from $${gp}$ there ${key === 1 ? 'is' : 'are'} ${key} other${key === 1 ? '' : 's'}.` : '');
    if (type === 'numeric') return numericQuestion(stem, key, 0, explanation);
    const mistakes = [
      ...fam.countMistakes.map((m) => ({ value: m.value - (other ? 1 : 0), why: m.why })),
      other ? { value: total, why: `also counts the given point $${gp}$.` } : { value: total - 1, why: 'overlooks one of the points.' },
    ].filter((m) => m.value >= 0);
    const fmt = (v: number) => String(v);
    const mcq = valueMcq(rng, key, mistakes, optionCount, fmt, { fallback: integerFallback(key, fmt, 0), epsilon: 0.001 });
    return choiceQuestion(stem, mcq, explanation);
  },
};

// =====================================================================================================================
// 4. Maximal profit: price discrimination in two markets, or two products with a joint cost function
// =====================================================================================================================

const SELLERS = [
  { who: 'A theatre', what: 'tickets', m1: 'students', m2: 'other visitors' },
  { who: 'A software company', what: 'licences of its planning tool', m1: 'Europe', m2: 'Asia' },
  { who: 'A climbing gym', what: 'day passes', m1: 'members of the university sports centre', m2: 'tourists' },
  { who: 'A publisher', what: 'an e-book', m1: 'the Dutch market', m2: 'the German market' },
  { who: 'A football club', what: 'season tickets', m1: 'youth fans', m2: 'adult fans' },
];
const PRODUCERS = [
  { who: 'A bakery', x: 'loaves of bread', y: 'cakes', per: 'day' },
  { who: 'A small brewery', x: 'crates of lager', y: 'crates of special beer', per: 'week' },
  { who: 'A furniture workshop', x: 'chairs', y: 'tables', per: 'month' },
  { who: 'A print shop', x: 'posters', y: 'banners', per: 'week' },
];

interface ProfitCase {
  stem: string;
  question: string;
  key: number;
  explanation: string;
  mistakes: { value: number; why: string }[];
}

function twoMarkets(rng: Rng, askProfit: boolean): ProfitCase {
  const ctx = rng.pick(SELLERS);
  const c = rng.pick([2, 4, 5, 6, 8, 10, 12]);
  const [b1, b2] = [rng.int(1, 3), rng.int(1, 3)];
  let d1: number, d2: number;
  do [d1, d2] = [rng.int(4, 15), rng.int(3, 12)];
  while (d1 === d2);
  const F = rng.pick([0, 50, 100, 150, 200].filter((f) => f < (b1 * d1 * d1 + b2 * d2 * d2) / 2));
  const [P1, P2] = [c + d1, c + d2];
  const [a1, a2] = [b1 * (c + 2 * d1), b2 * (c + 2 * d2)];
  const Q = (a: number, b: number, P: number) => a - b * P;
  const profit = (p1: number, p2: number) => (p1 - c) * Q(a1, b1, p1) + (p2 - c) * Q(a2, b2, p2) - F;
  const best = profit(P1, P2);
  ensure(best === b1 * d1 * d1 + b2 * d2 * d2 - F && best > 0, 'maximal profit');
  const dem = (a: number, b: number, i: number) => `Q_${i}=${termsTex([[a, ''], [-b, `P_${i}`]])}`;
  const stem =
    `${ctx.who} sells ${ctx.what} to two separate groups, ${ctx.m1} (market 1) and ${ctx.m2} (market 2), and may charge a different price in each market. ` +
    `At prices $P_1$ and $P_2$ (in euros) it sells $$${dem(a1, b1, 1)},\\qquad ${dem(a2, b2, 2)}$$ ` +
    `Every unit costs €${c} to provide${F ? `, and there is a fixed cost of €${F}` : ''}: $$C=${c}(Q_1+Q_2)${F ? `+${F}` : ''}$$`;
  const pd = (a: number, b: number, i: number) => `\\dfrac{\\partial\\pi}{\\partial P_${i}}=${termsTex([[a + b * c, ''], [-2 * b, `P_${i}`]])}=0\\;\\Rightarrow\\; P_${i}=\\dfrac{${a + b * c}}{${2 * b}}=${ratTex((a + b * c) / (2 * b))}`;
  const explanation =
    `Profit is revenue minus cost: $$\\pi(P_1,P_2)=(P_1-${c})(${termsTex([[a1, ''], [-b1, 'P_1']])})+(P_2-${c})(${termsTex([[a2, ''], [-b2, 'P_2']])})${F ? `-${F}` : ''}$$ ` +
    `Setting both partial derivatives to zero (product rule): $$${pd(a1, b1, 1)}$$ $$${pd(a2, b2, 2)}$$ ` +
    `Second-order test: $\\pi''_{11}=${-2 * b1}<0$, $\\pi''_{22}=${-2 * b2}$ and $\\pi''_{12}=0$, so $C=${4 * b1 * b2}>0$: a maximum. ` +
    `Then $Q_1=${Q(a1, b1, P1)}$ and $Q_2=${Q(a2, b2, P2)}$, and $$\\pi=(${P1}-${c})\\cdot ${Q(a1, b1, P1)}+(${P2}-${c})\\cdot ${Q(a2, b2, P2)}${F ? `-${F}` : ''}=${best}$$`;
  const rev = (a: number, b: number) => a / (2 * b);
  const slip = (a: number, b: number) => (a - b * c) / (2 * b);
  if (askProfit)
    return {
      stem,
      question: 'What is the maximal profit?',
      key: best,
      explanation: `${explanation} So the maximal profit is €${best}.`,
      mistakes: [
        { value: profit(rev(a1, b1), rev(a2, b2)), why: 'maximises revenue instead of profit (forgets the cost per unit when choosing the prices).' },
        { value: best + F, why: 'forgets the fixed cost.' },
        { value: P1 * Q(a1, b1, P1) + P2 * Q(a2, b2, P2), why: 'reports the revenue at the optimal prices instead of the profit.' },
        { value: profit(slip(a1, b1), slip(a2, b2)), why: 'makes a sign error with the cost term in the derivative.' },
      ],
    };
  return {
    stem,
    question: 'Which price should be charged in market 1 to maximise the total profit?',
    key: P1,
    explanation: `${explanation} So in market 1 the price should be €${P1}.`,
    mistakes: [
      { value: rev(a1, b1), why: 'maximises revenue instead of profit.' },
      { value: slip(a1, b1), why: 'makes a sign error with the cost term in the derivative.' },
      { value: a1 / b1, why: 'takes the price at which demand in market 1 drops to zero.' },
      { value: c, why: 'sets the price equal to the cost per unit.' },
      { value: (a1 + b1 * c) / b1, why: 'forgets the factor 2 that comes from differentiating $-b_1P_1^2$.' },
    ],
  };
}

function twoProducts(rng: Rng, askProfit: boolean): ProfitCase {
  const ctx = rng.pick(PRODUCERS);
  let a: number, b: number, c: number;
  do [a, b, c] = [rng.pick([0.5, 1, 1.5, 2]), rng.pick([0.5, 1, 1.5]), rng.pick([0.5, 1, 1.5, 2])];
  while (4 * a * c - b * b <= 0 || a * c === b * b);
  let x0: number, y0: number;
  do [x0, y0] = [2 * rng.int(5, 30), 2 * rng.int(5, 30)];
  while (x0 === y0);
  const F = rng.pick([100, 200, 250, 400, 500]);
  const [p, q] = [2 * a * x0 + b * y0, b * x0 + 2 * c * y0];
  const cost = (x: number, y: number) => a * x * x + b * x * y + c * y * y + F;
  const profit = (x: number, y: number) => p * x + q * y - cost(x, y);
  const best = profit(x0, y0);
  ensure(best > 0 && Number.isInteger(p) && Number.isInteger(q), 'two products');
  const costTex = termsTex([[a, 'x^2'], [b, 'xy'], [c, 'y^2'], [F, '']]);
  const stem =
    `${ctx.who} produces $x$ ${ctx.x} and $y$ ${ctx.y} per ${ctx.per}. It sells them at €${p} and €${q} each (whatever the quantities). ` +
    `The cost per ${ctx.per} (in euros) is $$C(x,y)=${costTex}$$`;
  const det = 4 * a * c - b * b;
  const explanation =
    `Profit is $\\pi(x,y)=${p}x+${q}y-\\left(${costTex}\\right)$. The first-order conditions are $$\\pi'_x=${termsTex([[p, ''], [-2 * a, 'x'], [-b, 'y']])}=0,\\qquad \\pi'_y=${termsTex([[q, ''], [-b, 'x'], [-2 * c, 'y']])}=0$$ ` +
    `From the first, $x=${2 * a === 1 ? termsTex([[p, ''], [-b, 'y']]) : `\\dfrac{${termsTex([[p, ''], [-b, 'y']])}}{${num(2 * a)}}`}$. Substituting this into the second equation and solving for $y$ (or eliminating $x$) gives $$y=\\dfrac{${num(2 * a)}\\cdot ${q}-${num(b)}\\cdot ${p}}{${num(2 * a)}\\cdot ${num(2 * c)}-${num(b)}^2}=\\dfrac{${num(2 * a * q - b * p)}}{${num(det)}}=${y0}$$ and then $x=${x0}$. ` +
    `Second-order test: $\\pi''_{xx}=${num(-2 * a)}<0$, $\\pi''_{yy}=${num(-2 * c)}$, $\\pi''_{xy}=${num(-b)}$, so $C=(${num(-2 * a)})\\cdot(${num(-2 * c)})-(${num(-b)})^2=${num(det)}>0$: a maximum. ` +
    `$$\\pi(${x0},${y0})=${p}\\cdot ${x0}+${q}\\cdot ${y0}-${num(cost(x0, y0))}=${num(best)}$$`;
  const solve2 = (a11: number, a12: number, a21: number, a22: number): [number, number] => {
    const D = a11 * a22 - a12 * a21;
    return [(p * a22 - a12 * q) / D, (a11 * q - p * a21) / D];
  };
  const [x2, y2] = solve2(a, b, b, c);
  const [xc, yc] = [p / (2 * a), q / (2 * c)];
  const pos = (x: number, y: number) => x > 0 && y > 0;
  if (askProfit)
    return {
      stem,
      question: `What is the maximal profit per ${ctx.per}?`,
      key: best,
      explanation: `${explanation} So the maximal profit is €${num(best)}.`,
      mistakes: [
        { value: pos(x2, y2) ? profit(x2, y2) : NaN, why: 'forgets the factor 2 when differentiating $x^2$ and $y^2$ in the cost.' },
        { value: profit(xc, yc), why: 'ignores the term with $xy$ when differentiating.' },
        { value: best + F, why: 'forgets the fixed cost.' },
        { value: p * x0 + q * y0, why: 'reports the revenue instead of the profit.' },
      ],
    };
  return {
    stem,
    question: `How many ${ctx.x} should be produced per ${ctx.per} to maximise the profit?`,
    key: x0,
    explanation: `${explanation} So $${x0}$ ${ctx.x} per ${ctx.per}.`,
    mistakes: [
      { value: pos(x2, y2) ? x2 : NaN, why: 'forgets the factor 2 when differentiating $x^2$ and $y^2$ in the cost.' },
      { value: xc, why: 'ignores the term with $xy$ when differentiating.' },
      { value: y0, why: 'gives the optimal $y$ instead of $x$.' },
      { value: p / a, why: 'ignores the term with $xy$ and forgets the factor 2.' },
    ],
  };
}

const profit: Template = {
  id: 'two-var-stationary.profit',
  topic: TOPIC,
  title: 'Maximal profit (or optimal price/quantity) of a firm with two markets or two products, via the first-order conditions',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const askProfit = rng.chance(0.6);
    const cs = rng.chance(0.5) ? twoMarkets(rng, askProfit) : twoProducts(rng, askProfit);
    const isMoney = !cs.question.startsWith('How many');
    if (type === 'numeric') return numericQuestion(`${cs.stem} ${cs.question}`, cs.key, isMoney ? 2 : 0, cs.explanation);
    const fmt = (v: number) => (isMoney ? euro(v) : num(v, 2));
    const mcq = valueMcq(rng, cs.key, cs.mistakes, optionCount, fmt, { positive: true });
    return choiceQuestion(`${cs.stem} ${cs.question}`, mcq, cs.explanation);
  },
};

export const TEMPLATES: Template[] = [findPoint, status, count, profit];
