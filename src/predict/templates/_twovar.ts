// Shared helpers for the topics "Two variables: partial derivatives & level curves" and "Two variables: stationary
// points" (no TEMPLATES export): polynomials in the shifted variables u = x − p, v = y − q with exact derivatives,
// LaTeX and mathjs forms (cross-checked against mathjs' symbolic derivative), and the second-order test
// C = f''xx·f''yy − (f''xy)² with the ways students typically misread it.
import { diff, evalAt } from '../mathx';
import { ratTex, termsTex } from './_fnderiv';

/** c·u^i·v^j with u = x − p and v = y − q. */
export type Mono = readonly [number, number, number];
export type Poly2 = readonly Mono[];
export interface Shift {
  readonly p: number;
  readonly q: number;
}
export const ORIGIN: Shift = { p: 0, q: 0 };

/** "x", "(x-1)" or "(x+2)": the shifted variable as LaTeX. */
export const shifted = (v: 'x' | 'y', s: number) => (s === 0 ? v : `(${v}${s > 0 ? '-' : '+'}${Math.abs(s)})`);
const pw = (b: string, k: number) => (k === 0 ? '' : k === 1 ? b : `${b}^${k}`);

export const p2Tex = (P: Poly2, s: Shift = ORIGIN) => termsTex(P.map(([c, i, j]) => [c, pw(shifted('x', s.p), i) + pw(shifted('y', s.q), j)] as const));
export const p2Expr = (P: Poly2, s: Shift = ORIGIN) =>
  P.filter(([c]) => c !== 0)
    .map(([c, i, j]) => `(${c})*(x-(${s.p}))^${i}*(y-(${s.q}))^${j}`)
    .join(' + ') || '0';
export const p2Eval = (P: Poly2, x: number, y: number, s: Shift = ORIGIN) => P.reduce((t, [c, i, j]) => t + c * (x - s.p) ** i * (y - s.q) ** j, 0);
export const p2Dx = (P: Poly2): Poly2 => P.filter(([c, i]) => c !== 0 && i > 0).map(([c, i, j]) => [c * i, i - 1, j] as const);
export const p2Dy = (P: Poly2): Poly2 => P.filter(([c, , j]) => c !== 0 && j > 0).map(([c, i, j]) => [c * j, i, j - 1] as const);
export const p2Scale = (P: Poly2, k: number): Poly2 => P.map(([c, i, j]) => [c * k, i, j] as const);

/** Sum of polynomials, like terms combined (in order of first appearance), zero terms dropped. */
export function p2Add(...Ps: Poly2[]): Poly2 {
  const out: [number, number, number][] = [];
  for (const [c, i, j] of Ps.flat()) {
    const t = out.find((m) => m[1] === i && m[2] === j);
    if (t) t[0] += c;
    else out.push([c, i, j]);
  }
  const live = out.filter(([c]) => c !== 0);
  return live.length ? live : [[0, 0, 0]];
}

/** k times a product of polynomial factors as LaTeX: prodTex(2, [u, 4 − v²]) = "2(x-1)\left(4-y^2\right)". */
export function prodTex(k: number, factors: Poly2[], s: Shift = ORIGIN): string {
  const fs = factors.map((F) => (F.length === 1 && F[0][0] === 1 ? p2Tex(F, s) : `\\left(${p2Tex(F, s)}\\right)`));
  return (k === 1 ? '' : k === -1 ? '-' : String(k)) + fs.join('');
}
export const prodEval = (k: number, factors: Poly2[], x: number, y: number, s: Shift = ORIGIN) => k * factors.reduce((t, F) => t * p2Eval(F, x, y, s), 1);

const SAMPLE = [
  [0.3, -1.2],
  [1.7, 0.4],
  [-2.1, 2.6],
  [0.9, 1.9],
];

/** Template self-check: the exact partial derivatives agree with mathjs' symbolic ones. */
export function assertPartials(P: Poly2, s: Shift = ORIGIN): void {
  const e = p2Expr(P, s);
  const [dx, dy] = [diff(e, 'x'), diff(e, 'y')];
  for (const [x, y] of SAMPLE) {
    const a = [evalAt(dx, { x, y }), evalAt(dy, { x, y })];
    const b = [p2Eval(p2Dx(P), x, y, s), p2Eval(p2Dy(P), x, y, s)];
    if (a.some((v, i) => Math.abs(v - b[i]) > 1e-7 * (1 + Math.abs(v)))) throw new Error(`partial derivative check failed for ${e}`);
  }
}

/** Template self-check: a factorised form equals the polynomial. */
export function assertFactor(P: Poly2, k: number, factors: Poly2[], s: Shift = ORIGIN): void {
  for (const [x, y] of SAMPLE) {
    const a = p2Eval(P, x, y, s);
    if (Math.abs(a - prodEval(k, factors, x, y, s)) > 1e-7 * (1 + Math.abs(a))) throw new Error('factorisation check failed');
  }
}

/** A point as LaTeX, e.g. "(2,-1)" or "(\frac{3}{2},0)". */
export const ptTex = (x: number, y: number) => `(${ratTex(x)},${ratTex(y)})`;

// ---------- second-order test ----------

export type Status = 'min' | 'max' | 'saddle' | 'undMin' | 'undMax';
export interface Hess {
  fxx: number;
  fyy: number;
  fxy: number;
  C: number;
}

export function hessAt(P: Poly2, x: number, y: number, s: Shift = ORIGIN): Hess {
  const fx = p2Dx(P);
  const fy = p2Dy(P);
  const fxx = p2Eval(p2Dx(fx), x, y, s);
  const fyy = p2Eval(p2Dy(fy), x, y, s);
  const fxy = p2Eval(p2Dy(fx), x, y, s);
  return { fxx, fyy, fxy, C: fxx * fyy - fxy * fxy };
}

/** The course's criterion: C > 0 → extremum (sign of f''xx), C < 0 → saddle point, C = 0 → inconclusive. */
export function statusOf(h: Hess): Status {
  if (h.C > 0) return h.fxx > 0 ? 'min' : 'max';
  if (h.C < 0) return 'saddle';
  return h.fxx > 0 || h.fyy > 0 ? 'undMin' : 'undMax';
}

export function statusText(st: Status, pt: string): string {
  return {
    min: `$${pt}$ is a local minimum`,
    max: `$${pt}$ is a local maximum`,
    saddle: `$${pt}$ is a saddle point`,
    undMin: `The test is inconclusive: $${pt}$ is either a minimum or a saddle point`,
    undMax: `The test is inconclusive: $${pt}$ is either a maximum or a saddle point`,
  }[st];
}

const FLIP: Record<Status, Status> = { min: 'max', max: 'min', saddle: 'saddle', undMin: 'undMax', undMax: 'undMin' };

/** Misreadings of the second-order test and the status each one leads to (only those that differ from the truth). */
export function statusMistakes(h: Hess): { status: Status; why: string }[] {
  const { fxx, fyy, fxy, C } = h;
  const right = statusOf(h);
  // with C = 0 and f''xx = 0 the direction comes from f''yy (see secondOrderTex)
  const w = C === 0 && fxx === 0 ? 'yy' : 'xx';
  const out: { status: Status; why: string }[] = [
    { status: FLIP[right], why: `mixes up the sign rule: $f''_{${w}}>0$ (the graph curves upwards) belongs to a minimum, $f''_{${w}}<0$ to a maximum.` },
    { status: statusOf({ ...h, C: fxx * fyy }), why: `forgets to subtract $\\left(f''_{xy}\\right)^2$, so gets $C=${fxx * fyy}$.` },
    { status: statusOf({ ...h, C: fxx * fyy + fxy * fxy }), why: `adds $\\left(f''_{xy}\\right)^2$ instead of subtracting it, so gets $C=${fxx * fyy + fxy * fxy}$.` },
  ];
  if (fxx !== 0) out.push({ status: fxx > 0 ? 'min' : 'max', why: `only looks at the sign of $f''_{xx}=${fxx}$ and ignores $C$.` });
  if (C === 0) {
    out.push({ status: 'saddle', why: 'reads $C=0$ as a saddle point, but with $C=0$ the second-order test does not decide.' });
    out.push({ status: fxx > 0 || fyy > 0 ? 'min' : 'max', why: 'treats $C=0$ as if it were positive.' });
  }
  return out.filter((m) => m.status !== right);
}

/** Why a status is not the right conclusion (used when the modelled mistakes do not fill all options). */
export function statusWhyNot(st: Status, h: Hess): string {
  const need = {
    min: "$C>0$ and $f''_{xx}>0$",
    max: "$C>0$ and $f''_{xx}<0$",
    saddle: '$C<0$',
    undMin: "$C=0$ with $f''_{xx}>0$ or $f''_{yy}>0$",
    undMax: "$C=0$ with $f''_{xx}<0$ or $f''_{yy}<0$",
  }[st];
  return `this conclusion needs ${need}, but here $C=${h.C}$ and $f''_{xx}=${h.fxx}$.`;
}

const par = (n: number) => (n < 0 ? `(${n})` : String(n));

/** Worked second-order test at a point: the three second derivatives, C, and the conclusion. */
export function secondOrderTex(h: Hess, pt: string): string {
  const pos = h.fxx > 0 || (h.fxx === 0 && h.fyy > 0);
  const which = h.fxx !== 0 ? 'xx' : 'yy';
  const verdict = {
    min: `Since $C>0$ and $f''_{xx}>0$, $${pt}$ is a local minimum.`,
    max: `Since $C>0$ and $f''_{xx}<0$, $${pt}$ is a local maximum.`,
    saddle: `Since $C<0$, $${pt}$ is a saddle point.`,
    undMin: '',
    undMax: '',
  }[statusOf(h)];
  const inconclusive =
    `Since $C=0$ the test is inconclusive. Because $f''_{${which}}${pos ? '>' : '<'}0$, the function curves ${pos ? 'upwards' : 'downwards'} in that direction, ` +
    `so $${pt}$ cannot be a ${pos ? 'maximum' : 'minimum'}: it is either a ${pos ? 'minimum' : 'maximum'} or a saddle point.`;
  return (
    `At $${pt}$: $f''_{xx}=${h.fxx}$, $f''_{yy}=${h.fyy}$ and $f''_{xy}=${h.fxy}$, so ` +
    `$$C=f''_{xx}f''_{yy}-\\left(f''_{xy}\\right)^2=${par(h.fxx)}\\cdot ${par(h.fyy)}-${par(h.fxy)}^2=${h.C}$$` +
    (h.C === 0 ? inconclusive : verdict)
  );
}
