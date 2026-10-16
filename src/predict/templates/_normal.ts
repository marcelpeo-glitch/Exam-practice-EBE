// Shared helpers for the topics "Normal model" and "Sampling distributions" (no TEMPLATES export): Table Z look-ups
// with an accepted range around the exact value, z-values for a tail area (Table Z in reverse), z-score steps for the
// worked solutions, and two inline SVG figures: a Normal curve with a shaded region, and small multiples of histograms.
// The figures carry CSS classes ("shade", "xt", "bar", "panel") so that the tests can read the drawing back.
import { buildMcq, fixed, num, tolFor, type Choice } from '../build';
import type { Rng } from '../rng';
import { normCdf, normInv, normPdf, round, zTable } from '../stats';
import { niceStep, svgUri } from './_dist';

// ---------- Table Z ----------

/** z rounded to 2 decimals (the entry students look up in Table Z). */
export const z2 = (z: number) => round(z, 2);

/** True when rounding z to 2 decimals is unambiguous (z is not close to halfway between two Table Z entries). */
export const clearZ = (z: number) => Math.abs(100 * z - Math.round(100 * z)) < 0.4;

/** An event for a standard Normal Z: below z, above z, or between za and zb. */
export type Ev = { kind: 'below' | 'above'; z: number } | { kind: 'between'; za: number; zb: number };

export function probOf(e: Ev, F: (z: number) => number): number {
  if (e.kind === 'between') return F(e.zb) - F(e.za);
  return e.kind === 'below' ? F(e.z) : 1 - F(e.z);
}

/** The Table Z answer: each z rounded to 2 decimals, table probabilities with 4 decimals. */
export const tableP = (e: Ev) => round(probOf(e, zTable), 4);
/** The exact probability (no rounding of z). */
export const exactP = (e: Ev) => probOf(e, normCdf);

/** Inclusive accepted range covering all the given values, widened by the usual tolerance for dp decimals. */
export function acceptAround(dp: number, ...vals: number[]): [number, number] {
  const t = Math.max(tolFor(dp), 10 ** -(dp + 1));
  return [round(Math.min(...vals) - t, dp + 2), round(Math.max(...vals) + t, dp + 2)];
}

/**
 * The z with P(Z ≤ z) = q: exact, to 3 decimals (as in the past solutions; equal to the ∞ row of Table T for the
 * printed tail areas) and the two neighbouring 2-decimal entries a student may read from Table Z in reverse.
 */
export function zFor(q: number) {
  const z = normInv(q);
  return { z, z3: round(z, 3), lo: Math.floor(z * 100 + 1e-9) / 100, hi: Math.ceil(z * 100 - 1e-9) / 100 };
}

/** min and max of f over the z-values a student may use (3-decimal value and both Table Z neighbours). */
export function zSpread(f: (z: number) => number, zi: { z: number; z3: number; lo: number; hi: number }): number[] {
  return [f(zi.z), f(zi.z3), f(zi.lo), f(zi.hi)];
}

/** "z=\frac{x-\mu}{\sigma}=...\approx 0.63" for a worked solution (name, x, mu, sd already formatted). */
export function zStep(name: string, x: string, mu: string, sd: string, z: number): string {
  const r = z2(z);
  const exact = Math.abs(z - r) < 1e-9;
  return `${name}=\\frac{${x}-${mu}}{${sd}}=${exact ? fixed(r, 2) : `${num(z, 4)}\\approx ${fixed(r, 2)}`}`;
}

/** Table Z value as printed: P(Z<z) for z rounded to 2 decimals. */
export const phiTex = (z: number) => `P(Z<${fixed(z2(z), 2)})=${fixed(zTable(z), 4)}`;

/** A probability with 4 decimals. */
export const p4 = (x: number) => fixed(x, 4);

/** "2.5%" / "10%". */
export const pct = (p: number) => `${num(p, 2)}%`;

// ---------- figures ----------

const p2 = (x: number) => String(Math.round(x * 100) / 100);
const head = (w: number, h: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Arial, sans-serif" font-size="12">` +
  `<rect width="${w}" height="${h}" fill="#ffffff"/>`;
const STROKE = '#1e3a8a';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Tick label for μ + kσ (k = −3..3), e.g. "μ − 2σ", "μ", "μ + σ". */
export const sigmaLabel = (k: number) => (k === 0 ? 'μ' : `μ ${k < 0 ? '−' : '+'} ${Math.abs(k) === 1 ? '' : Math.abs(k)}σ`);

/**
 * A Normal curve on z ∈ [−3.6, 3.6] with the area between za and zb shaded (±Infinity for a tail) and ticks at
 * μ − 3σ, ..., μ + 3σ labelled by `label(k)`.
 */
export function normalCurveSvg(za: number, zb: number, label: (k: number) => string = sigmaLabel): string {
  const W = 540;
  const H = 230;
  const L = 24;
  const R = 24;
  const T = 14;
  const B = 46;
  const lo = -3.6;
  const hi = 3.6;
  const X = (z: number) => L + ((z - lo) / (hi - lo)) * (W - L - R);
  const Y = (d: number) => H - B - (d / 0.42) * (H - T - B);
  const pts = (z0: number, z1: number) => {
    const n = Math.max(2, Math.ceil((z1 - z0) / 0.04));
    return Array.from({ length: n + 1 }, (_, i) => {
      const z = z0 + ((z1 - z0) * i) / n;
      return `${p2(X(z))},${p2(Y(normPdf(z)))}`;
    }).join(' ');
  };
  const s0 = Math.max(za, lo);
  const s1 = Math.min(zb, hi);
  let s = head(W, H);
  s += `<polygon class="shade" points="${p2(X(s0))},${p2(Y(0))} ${pts(s0, s1)} ${p2(X(s1))},${p2(Y(0))}" fill="#93c5fd" stroke="none"/>`;
  s += `<polyline class="curve" points="${pts(lo, hi)}" fill="none" stroke="${STROKE}" stroke-width="2"/>`;
  s += `<line x1="${L}" y1="${p2(Y(0))}" x2="${W - R}" y2="${p2(Y(0))}" stroke="#111827"/>`;
  for (let k = -3; k <= 3; k++) {
    s += `<line x1="${p2(X(k))}" y1="${p2(Y(0))}" x2="${p2(X(k))}" y2="${p2(Y(0) + 6)}" stroke="#111827"/>`;
    s += `<text class="xt" x="${p2(X(k))}" y="${H - B + 22}" text-anchor="middle" font-size="13">${esc(label(k))}</text>`;
  }
  return svgUri(s + '</svg>');
}

/** One histogram bar: from x0 to x1 (data units), height h (percentage of the observations). */
export interface Bar {
  x0: number;
  x1: number;
  h: number;
}

/** Small multiples of histograms on one x-axis (each panel with its own percentage scale). */
export function histPanelsSvg(panels: { title: string; bars: Bar[] }[], axis: { lo: number; hi: number; ticks: number[] }, cols: number, xLabel: string): string {
  const PW = 270;
  const PH = 185;
  const rows = Math.ceil(panels.length / cols);
  const W = cols * PW;
  const H = rows * PH + 22;
  let s = head(W, H);
  panels.forEach((p, i) => {
    const ox = (i % cols) * PW;
    const oy = Math.floor(i / cols) * PH;
    const L = ox + 48;
    const R = ox + PW - 14;
    const T = oy + 30;
    const Bt = oy + PH - 28;
    const X = (v: number) => L + ((v - axis.lo) / (axis.hi - axis.lo)) * (R - L);
    const top = Math.max(...p.bars.map((b) => b.h));
    const step = niceStep(top, 4);
    const ymax = Math.ceil(top / step - 1e-9) * step;
    const Y = (v: number) => Bt - (v / ymax) * (Bt - T);
    s += `<g class="panel"><text class="pt" x="${p2((L + R) / 2)}" y="${oy + 18}" text-anchor="middle" font-weight="bold" font-size="13">${esc(p.title)}</text>`;
    for (let k = 0; k * step <= ymax + 1e-9; k++) {
      s += `<line class="grid" x1="${L}" x2="${R}" y1="${p2(Y(k * step))}" y2="${p2(Y(k * step))}" stroke="#e5e7eb"/>`;
      s += `<text class="yt" x="${L - 5}" y="${p2(Y(k * step))}" text-anchor="end" dominant-baseline="middle">${num(k * step, 2)}%</text>`;
    }
    for (const b of p.bars)
      if (b.h > 0)
        s += `<rect class="bar" x="${p2(X(b.x0))}" y="${p2(Y(b.h))}" width="${p2(X(b.x1) - X(b.x0))}" height="${p2(Bt - Y(b.h))}" fill="#93c5fd" stroke="${STROKE}" stroke-width="0.8"/>`;
    for (const t of axis.ticks) s += `<text class="xt" x="${p2(X(t))}" y="${Bt + 16}" text-anchor="middle">${num(t, 2)}</text>`;
    s += `<line x1="${L}" y1="${Bt}" x2="${R}" y2="${Bt}" stroke="#111827"/></g>`;
  });
  s += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" fill="#374151">${esc(xLabel)}</text>`;
  return svgUri(s + '</svg>');
}

/** Bars of a discretised Normal(m, s) density on given bins (masses renormalised to 100%). */
export function normalBars(bins: { x0: number; x1: number }[], m: number, s: number): Bar[] {
  const mass = bins.map((b) => normCdf((b.x1 - m) / s) - normCdf((b.x0 - m) / s));
  const tot = mass.reduce((a, b) => a + b, 0);
  return bins.map((b, i) => ({ ...b, h: (100 * mass[i]) / tot }));
}

/** L1 distance ∫|f − g| between the densities of two histograms (0 = identical, 2 = disjoint), on a fine grid. */
export function histDistance(a: Bar[], b: Bar[], lo: number, hi: number): number {
  const dens = (bars: Bar[]) => {
    const tot = bars.reduce((s, x) => s + x.h, 0);
    return (x: number) => {
      for (const r of bars) if (x >= r.x0 && x < r.x1) return r.h / tot / (r.x1 - r.x0);
      return 0;
    };
  };
  const fa = dens(a);
  const fb = dens(b);
  const n = 4000;
  let d = 0;
  for (let i = 0; i < n; i++) {
    const x = lo + ((hi - lo) * (i + 0.5)) / n;
    d += Math.abs(fa(x) - fb(x));
  }
  return (d * (hi - lo)) / n;
}

// ---------- probability options ----------

/**
 * Single choice with probability options (4 decimals, ascending). Wrong options must be at least 0.003 away from
 * both the Table Z answer P and the exact answer Px; `extra` (e.g. "cannot be calculated") is offered after them.
 */
export function probMcq(rng: Rng, P: number, Px: number, ds: [number, string][], count: number, extra: Choice[] = []) {
  const mk = (v: number, why?: string): Choice => ({ text: p4(v), value: round(v, 4), ...(why ? { why } : {}) });
  const far = (v: number) => v > 0.0004 && v < 0.9996 && Math.min(Math.abs(v - P), Math.abs(v - Px)) > 0.003;
  const spare = [1, -1, 2, -2, 3, -3, 4, -4].map((k) => P + 0.06 * k).concat([0.05, 0.25, 0.5, 0.75, 0.95]).filter(far);
  return buildMcq(rng, mk(P), [...ds.filter(([v]) => far(v)).map(([v, why]) => mk(v, why)), ...extra], {
    count,
    order: 'ascending',
    fallback: (i) => mk(spare[i % spare.length], 'an error when reading Table Z.'),
  });
}
