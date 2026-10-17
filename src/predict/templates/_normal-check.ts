// Test support for the "Normal model" and "Sampling distributions" checks (no TEMPLATES export): an independent
// standard Normal CDF (Simpson integration of the density, not stats.normCdf), its inverse by bisection, Table Z as
// printed (4 decimals, z to 2 decimals) and its reverse use, and readers for the numbers in the stems and the shapes
// drawn in the inline SVG figures.

export const pdf = (z: number) => Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);

/** P(Z ≤ z) by composite Simpson integration of the density from 0 to |z|. */
export function Phi(z: number): number {
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  const a = Math.min(Math.abs(z), 12);
  const n = 2000;
  const h = a / n;
  let s = pdf(0) + pdf(a);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * pdf(i * h);
  const area = (s * h) / 3;
  return z >= 0 ? 0.5 + area : 0.5 - area;
}

/** The z with Phi(z) = q, by bisection. */
export function PhiInv(q: number): number {
  let lo = -12;
  let hi = 12;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (Phi(m) < q) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

export const rnd = (x: number, dp: number) => Math.round(x * 10 ** dp + Math.sign(x) * 1e-7) / 10 ** dp;

const TABLE = new Map<number, number>();
for (let k = -349; k <= 349; k++) TABLE.set(k, rnd(Phi(k / 100), 4));
/** Printed Table Z: P(Z < z) for z rounded to 2 decimals, 4 decimals. */
export const tableZ = (z: number) => (z <= -3.495 ? 0.0002 : z >= 3.495 ? 0.9998 : TABLE.get(Math.round(z * 100))!);

/** Table Z in reverse: the 2-decimal z whose printed probability is closest to q. */
export function zReverse(q: number): number {
  let best = 0;
  let bd = Infinity;
  for (const [k, p] of TABLE) {
    const d = Math.abs(p - q);
    if (d < bd - 1e-12) {
      bd = d;
      best = k / 100;
    }
  }
  return best;
}

/** First number after a pattern, e.g. num1(stem, /mean (?:of )?/). */
export function after(text: string, re: RegExp): number | null {
  const m = new RegExp(re.source + '(-?\\d+(?:\\.\\d+)?)').exec(text);
  return m ? Number(m[m.length - 1]) : null;
}

/** First number in a text. */
export const firstNumber = (s: string) => Number(/-?\d+(?:\.\d+)?/.exec(s)![0]);

// ---------- SVG ----------

export const svgText = (src: string) => decodeURIComponent(src.replace(/^data:image\/svg\+xml;utf8,/, ''));

export interface El {
  attrs: Record<string, string>;
  text: string;
}

/** All <tag ...> elements with class `cls` (with their text content for <text>). */
export function elements(svg: string, tag: string, cls: string): El[] {
  const out: El[] = [];
  const re = new RegExp(`<${tag}\\s([^>]*?)(/>|>([^<]*)</${tag}>)`, 'g');
  for (const m of svg.matchAll(re)) {
    const attrs: Record<string, string> = {};
    for (const a of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    if ((attrs.class ?? '').split(' ').includes(cls)) out.push({ attrs, text: (m[3] ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') });
  }
  return out;
}

/** Linear map from pixel x to data value, fitted through tick labels (pixel x, value). */
export function axisMap(ticks: { x: number; v: number }[]): (px: number) => number {
  const a = ticks[0];
  const b = ticks[ticks.length - 1];
  return (px: number) => a.v + ((px - a.x) * (b.v - a.v)) / (b.x - a.x);
}
