// Shared helpers for the topics "Data & displays" and "Describing distributions" (no TEMPLATES export): simple inline
// SVG figures (frequency histograms, small multiples of histograms, side-by-side boxplots) as data URIs, a class label,
// and a few descriptive helpers. The figures use CSS classes on their elements ("bar", "yt", "xt", "box", "med", ...)
// so that the independent tests can read the drawn numbers back from the picture.
import { num } from '../build';
import type { ImageRef } from '../../types';

export const svgUri = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const p2 = (x: number) => String(Math.round(x * 100) / 100);
const head = (w: number, h: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Arial, sans-serif" font-size="12">` +
  `<rect width="${w}" height="${h}" fill="#ffffff"/>`;
const FILL = '#93c5fd';
const STROKE = '#1e3a8a';

/** A tick step so that 0..max needs at most `maxTicks` intervals. */
export function niceStep(max: number, maxTicks = 6): number {
  for (const m of [1, 2, 2.5, 5]) for (let e = 0; e < 7; e++) if (max / (m * 10 ** e) <= maxTicks) return m * 10 ** e;
  return 10 ** 7;
}

const yTicks = (ymax: number, step: number, Y: (v: number) => number, x0: number, x1: number) => {
  let s = '';
  for (let k = 0; k * step <= ymax + 1e-9; k++) {
    const v = k * step;
    s += `<line class="grid" x1="${x0}" x2="${x1}" y1="${p2(Y(v))}" y2="${p2(Y(v))}" stroke="#e5e7eb"/>`;
    s += `<text class="yt" x="${x0 - 5}" y="${p2(Y(v))}" text-anchor="end" dominant-baseline="middle">${num(v, 2)}</text>`;
  }
  return s;
};

export interface HistFigure {
  /** Class boundaries (k + 1 numbers). */
  edges: number[];
  /** Bar heights (counts or percentages). */
  heights: number[];
  /** Optional label on top of each bar (e.g. the count). */
  labels?: string[];
  xLabel: string;
  yLabel: string;
}

/** A histogram with touching bars, labelled class boundaries and a value axis with grid lines. */
export function histogramSvg(f: HistFigure): string {
  const W = 500;
  const H = 300;
  const L = 58;
  const R = 18;
  const T = 22;
  const B = 56;
  const pw = W - L - R;
  const ph = H - T - B;
  const top = Math.max(...f.heights);
  const step = niceStep(top * 1.1, 6);
  const ymax = Math.ceil((top * 1.1) / step) * step;
  const e0 = f.edges[0];
  const eN = f.edges[f.edges.length - 1];
  const X = (v: number) => L + ((v - e0) / (eN - e0)) * pw;
  const Y = (v: number) => T + ph - (v / ymax) * ph;
  let s = head(W, H) + yTicks(ymax, step, Y, L, W - R);
  f.heights.forEach((h, i) => {
    const x0 = X(f.edges[i]);
    const x1 = X(f.edges[i + 1]);
    s += `<rect class="bar" x="${p2(x0)}" y="${p2(Y(h))}" width="${p2(x1 - x0)}" height="${p2(Y(0) - Y(h))}" fill="${FILL}" stroke="${STROKE}"/>`;
    if (f.labels && h > 0) s += `<text class="v" x="${p2((x0 + x1) / 2)}" y="${p2(Y(h) - 5)}" text-anchor="middle" fill="#111827">${esc(f.labels[i])}</text>`;
  });
  for (const e of f.edges) s += `<text class="xt" x="${p2(X(e))}" y="${H - B + 16}" text-anchor="middle">${num(e, 2)}</text>`;
  s += `<line x1="${L}" y1="${p2(Y(0))}" x2="${W - R}" y2="${p2(Y(0))}" stroke="#111827"/><line x1="${L}" y1="${T}" x2="${L}" y2="${p2(Y(0))}" stroke="#111827"/>`;
  s += `<text x="${L + pw / 2}" y="${H - 14}" text-anchor="middle" font-size="13">${esc(f.xLabel)}</text>`;
  s += `<text x="16" y="${T + ph / 2}" text-anchor="middle" font-size="13" transform="rotate(-90 16 ${T + ph / 2})">${esc(f.yLabel)}</text>`;
  return svgUri(s + '</svg>');
}

/** Small multiples: one histogram per panel over the same discrete values, all with the same scales. */
export function panelsSvg(panels: { name: string; counts: number[] }[], values: number[], xLabel: string): string {
  const cols = panels.length === 4 ? 2 : Math.min(3, panels.length);
  const rows = Math.ceil(panels.length / cols);
  const PW = 215;
  const PH = 175;
  const W = cols * PW;
  const H = rows * PH + 18;
  const top = Math.max(...panels.flatMap((p) => p.counts));
  const step = niceStep(top, 4);
  const ymax = Math.ceil(top / step) * step;
  let s = head(W, H);
  panels.forEach((p, i) => {
    const ox = (i % cols) * PW;
    const oy = Math.floor(i / cols) * PH;
    const L = ox + 40;
    const R = ox + PW - 12;
    const T = oy + 28;
    const Bt = oy + PH - 26;
    const Y = (v: number) => Bt - (v / ymax) * (Bt - T);
    const bw = (R - L) / values.length;
    s += `<g class="panel"><text class="pt" x="${(L + R) / 2}" y="${oy + 16}" text-anchor="middle" font-weight="bold" font-size="13">Histogram ${esc(p.name)}</text>`;
    s += yTicks(ymax, step, Y, L, R);
    p.counts.forEach((c, j) => {
      s += `<rect class="bar" x="${p2(L + j * bw)}" y="${p2(Y(c))}" width="${p2(bw)}" height="${p2(Bt - Y(c))}" fill="${FILL}" stroke="${STROKE}"/>`;
      s += `<text class="xt" x="${p2(L + (j + 0.5) * bw)}" y="${Bt + 15}" text-anchor="middle">${num(values[j], 2)}</text>`;
    });
    s += `<line x1="${L}" y1="${Bt}" x2="${R}" y2="${Bt}" stroke="#111827"/></g>`;
  });
  s += `<text x="${W / 2}" y="${H - 4}" text-anchor="middle" font-size="12" fill="#374151">${esc(xLabel)} (horizontal axis); number of observations (vertical axis)</text>`;
  return svgUri(s + '</svg>');
}

export interface Box {
  name: string;
  min: number;
  q1: number;
  med: number;
  q3: number;
  /** End of the upper whisker (the largest value that is not an outlier). */
  max: number;
  outliers?: number[];
}

/** Side-by-side vertical boxplots on one value axis (lo..hi, grid line every `step`). */
export function boxplotSvg(boxes: Box[], axis: { lo: number; hi: number; step: number; label: string }): string {
  const W = 120 + 140 * boxes.length;
  const H = 330;
  const L = 64;
  const R = 16;
  const T = 18;
  const B = 46;
  const ph = H - T - B;
  const Y = (v: number) => T + ph - ((v - axis.lo) / (axis.hi - axis.lo)) * ph;
  let s = head(W, H);
  for (let v = axis.lo; v <= axis.hi + 1e-9; v += axis.step) {
    s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${p2(Y(v))}" y2="${p2(Y(v))}" stroke="#e5e7eb"/>`;
    s += `<text class="yt" x="${L - 6}" y="${p2(Y(v))}" text-anchor="end" dominant-baseline="middle">${num(v, 2)}</text>`;
  }
  const slot = (W - L - R) / boxes.length;
  boxes.forEach((b, i) => {
    const cx = L + (i + 0.5) * slot;
    const bw = 64;
    const line = (cls: string, x1: number, y1: number, x2: number, y2: number, extra = '') =>
      `<line class="${cls}" x1="${p2(x1)}" y1="${p2(y1)}" x2="${p2(x2)}" y2="${p2(y2)}" stroke="${STROKE}" stroke-width="1.6"${extra}/>`;
    s += '<g class="bp">';
    s += line('wh', cx, Y(b.q3), cx, Y(b.max)) + line('wh', cx, Y(b.q1), cx, Y(b.min));
    s += line('cap', cx - 14, Y(b.max), cx + 14, Y(b.max)) + line('cap', cx - 14, Y(b.min), cx + 14, Y(b.min));
    s += `<rect class="box" x="${p2(cx - bw / 2)}" y="${p2(Y(b.q3))}" width="${bw}" height="${p2(Y(b.q1) - Y(b.q3))}" fill="#dbeafe" stroke="${STROKE}" stroke-width="1.6"/>`;
    s += line('med', cx - bw / 2, Y(b.med), cx + bw / 2, Y(b.med), ' stroke-width="3.2"');
    for (const o of b.outliers ?? []) s += `<circle class="out" cx="${p2(cx)}" cy="${p2(Y(o))}" r="4" fill="#ffffff" stroke="${STROKE}" stroke-width="1.6"/>`;
    s += `<text class="gl" x="${p2(cx)}" y="${H - B + 20}" text-anchor="middle" font-size="13">${esc(b.name)}</text></g>`;
  });
  s += `<line x1="${L}" y1="${T}" x2="${L}" y2="${H - B}" stroke="#111827"/>`;
  s += `<text x="16" y="${T + ph / 2}" text-anchor="middle" font-size="13" transform="rotate(-90 16 ${T + ph / 2})">${esc(axis.label)}</text>`;
  return svgUri(s + '</svg>');
}

export const figure = (src: string, alt: string): ImageRef[] => [{ src, alt }];

/** "from 20 to less than 30" (a histogram class). */
export const classText = (a: number, b: number, unit = '') => `from ${num(a, 2)} to less than ${num(b, 2)}${unit ? ` ${unit}` : ''}`;

/** Index of the class [edges[i], edges[i+1]) that contains x. */
export const classOf = (edges: readonly number[], x: number) => {
  for (let i = 0; i < edges.length - 1; i++) if (x >= edges[i] && x < edges[i + 1]) return i;
  return x >= edges[edges.length - 1] ? edges.length - 2 : 0;
};

/** The raw data behind class counts: the observations of each class spread evenly inside it (class mean = midpoint). */
export function spreadData(edges: readonly number[], counts: readonly number[]): number[] {
  const out: number[] = [];
  counts.forEach((c, i) => {
    const w = edges[i + 1] - edges[i];
    for (let j = 0; j < c; j++) out.push(edges[i] + (w * (j + 0.5)) / c);
  });
  return out;
}

/** Capitalise the first letter. */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "a, b and c". */
export const listText = (xs: readonly string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
