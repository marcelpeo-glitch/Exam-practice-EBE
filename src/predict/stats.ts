// Statistics computed in code (no tables, no AI): normal and t distributions, binomial, descriptive statistics.
// The exam's own tables (Table Z with 4 decimals, Table T with 3 decimals) are reproduced from these functions,
// and stats.test.ts checks them against the printed tables.

export const round = (x: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round((x + Math.sign(x) * Number.EPSILON) * f) / f;
};

// ---------- normal distribution ----------

/** Standard normal CDF, double precision (Hart 1968, as given by West 2005). */
export function normCdf(x: number): number {
  const ax = Math.abs(x);
  let c: number;
  if (ax > 37) c = 0;
  else {
    const e = Math.exp((-ax * ax) / 2);
    if (ax < 7.07106781186547) {
      let b = 3.52624965998911e-2 * ax + 0.700383064443688;
      b = b * ax + 6.37396220353165;
      b = b * ax + 33.912866078383;
      b = b * ax + 112.079291497871;
      b = b * ax + 221.213596169931;
      b = b * ax + 220.206867912376;
      c = e * b;
      b = 8.83883476483184e-2 * ax + 1.75566716318264;
      b = b * ax + 16.064177579207;
      b = b * ax + 86.7807322029461;
      b = b * ax + 296.564248779674;
      b = b * ax + 637.333633378831;
      b = b * ax + 793.826512519948;
      b = b * ax + 440.413735824752;
      c /= b;
    } else {
      let b = ax + 0.65;
      b = ax + 4 / b;
      b = ax + 3 / b;
      b = ax + 2 / b;
      b = ax + 1 / b;
      c = e / b / 2.506628274631;
    }
  }
  return x > 0 ? 1 - c : c;
}

export const normPdf = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);

/** Inverse standard normal CDF (Acklam's approximation, polished with one Halley step). */
export function normInv(p: number): number {
  if (!(p > 0 && p < 1)) throw new Error(`normInv: p must be in (0, 1), got ${p}`);
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  let x: number;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - lo) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const e = normCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

// ---------- gamma / beta ----------

/** ln Γ(x) for x > 0 (Lanczos, g = 7). */
export function lgamma(x: number): number {
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let s = coef[0];
  for (let i = 1; i < g + 2; i++) s += coef[i] / (x + i);
  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(s);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300;
  const EPS = 1e-15;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta function I_x(a, b). */
export function incBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

// ---------- t distribution ----------

/** CDF of Student's t with df degrees of freedom (df = Infinity gives the normal CDF). */
export function tCdf(t: number, df: number): number {
  if (!Number.isFinite(df)) return normCdf(t);
  const x = df / (df + t * t);
  const tail = 0.5 * incBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** Inverse t CDF: the t with P(T ≤ t) = p. */
export function tInv(p: number, df: number): number {
  if (!(p > 0 && p < 1)) throw new Error(`tInv: p must be in (0, 1), got ${p}`);
  if (!Number.isFinite(df)) return normInv(p);
  let lo = -1e3;
  let hi = 1e3;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-12) break;
  }
  return (lo + hi) / 2;
}

/**
 * The exam's Table T (img/qm1-shared/table-t.png) exactly as printed: df → t* for 80/90/95/98/99% confidence.
 * Students read critical values from this table, so the generator uses the printed values (a few differ from the
 * exact quantile in the third decimal, e.g. df 35 at 99%: printed 2.725, exact 2.7238). stats.test.ts checks every
 * entry against tInv() to within that rounding.
 */
export const T_TABLE: ReadonlyArray<readonly [number, readonly [number, number, number, number, number]]> = [
  [1, [3.078, 6.314, 12.706, 31.821, 63.657]],
  [2, [1.886, 2.92, 4.303, 6.965, 9.925]],
  [3, [1.638, 2.353, 3.182, 4.541, 5.841]],
  [4, [1.533, 2.132, 2.776, 3.747, 4.604]],
  [5, [1.476, 2.015, 2.571, 3.365, 4.032]],
  [6, [1.44, 1.943, 2.447, 3.143, 3.707]],
  [7, [1.415, 1.895, 2.365, 2.998, 3.499]],
  [8, [1.397, 1.86, 2.306, 2.896, 3.355]],
  [9, [1.383, 1.833, 2.262, 2.821, 3.25]],
  [10, [1.372, 1.812, 2.228, 2.764, 3.169]],
  [11, [1.363, 1.796, 2.201, 2.718, 3.106]],
  [12, [1.356, 1.782, 2.179, 2.681, 3.055]],
  [13, [1.35, 1.771, 2.16, 2.65, 3.012]],
  [14, [1.345, 1.761, 2.145, 2.624, 2.977]],
  [15, [1.341, 1.753, 2.131, 2.602, 2.947]],
  [16, [1.337, 1.746, 2.12, 2.583, 2.921]],
  [17, [1.333, 1.74, 2.11, 2.567, 2.898]],
  [18, [1.33, 1.734, 2.101, 2.552, 2.878]],
  [19, [1.328, 1.729, 2.093, 2.539, 2.861]],
  [20, [1.325, 1.725, 2.086, 2.528, 2.845]],
  [21, [1.323, 1.721, 2.08, 2.518, 2.831]],
  [22, [1.321, 1.717, 2.074, 2.508, 2.819]],
  [23, [1.319, 1.714, 2.069, 2.5, 2.807]],
  [24, [1.318, 1.711, 2.064, 2.492, 2.797]],
  [25, [1.316, 1.708, 2.06, 2.485, 2.787]],
  [26, [1.315, 1.706, 2.056, 2.479, 2.779]],
  [27, [1.314, 1.703, 2.052, 2.473, 2.771]],
  [28, [1.313, 1.701, 2.048, 2.467, 2.763]],
  [29, [1.311, 1.699, 2.045, 2.462, 2.756]],
  [30, [1.31, 1.697, 2.042, 2.457, 2.75]],
  [32, [1.309, 1.694, 2.037, 2.449, 2.738]],
  [35, [1.306, 1.69, 2.03, 2.438, 2.725]],
  [40, [1.303, 1.684, 2.021, 2.423, 2.704]],
  [45, [1.301, 1.679, 2.014, 2.412, 2.69]],
  [50, [1.299, 1.676, 2.009, 2.403, 2.678]],
  [60, [1.296, 1.671, 2.0, 2.39, 2.66]],
  [75, [1.293, 1.665, 1.992, 2.377, 2.643]],
  [100, [1.29, 1.66, 1.984, 2.364, 2.626]],
  [120, [1.289, 1.658, 1.98, 2.358, 2.617]],
  [140, [1.288, 1.656, 1.977, 2.353, 2.611]],
  [180, [1.286, 1.653, 1.973, 2.347, 2.603]],
  [250, [1.285, 1.651, 1.969, 2.341, 2.596]],
  [400, [1.284, 1.649, 1.966, 2.336, 2.588]],
  [1000, [1.282, 1.646, 1.962, 2.33, 2.581]],
  [Infinity, [1.282, 1.645, 1.96, 2.326, 2.576]],
];

/** The df rows printed in Table T (∞ = Infinity). */
export const T_TABLE_DF: readonly number[] = T_TABLE.map(([df]) => df);

/** The confidence levels printed in Table T (two-sided). One-sided tail areas are (1 − level) / 2. */
export const T_TABLE_LEVELS = [0.8, 0.9, 0.95, 0.98, 0.99] as const;
export type TableLevel = (typeof T_TABLE_LEVELS)[number];

/** Table row to use for df: round down to the nearest printed df (as the exam instructs). */
export function tTableDf(df: number): number {
  let row = T_TABLE_DF[0];
  for (const r of T_TABLE_DF) if (r <= df) row = r;
  return row;
}

/** Critical value t* read from Table T for a two-sided confidence level and df (rounded down to a table row). */
export function tStar(confidence: TableLevel, df: number): number {
  const col = T_TABLE_LEVELS.indexOf(confidence);
  if (col < 0) throw new Error(`Table T has no ${confidence} column`);
  const row = tTableDf(df);
  return T_TABLE.find(([d]) => d === row)![1][col];
}

/** Critical value z* for a two-sided confidence level: the ∞ row of Table T. */
export function zStar(confidence: TableLevel): number {
  return tStar(confidence, Infinity);
}

/** P(Z ≤ z) as read from Table Z: z rounded to 2 decimals, probability to 4 decimals. */
export function zTable(z: number): number {
  return round(normCdf(round(z, 2)), 4);
}

// ---------- binomial ----------

export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

export const binomPmf = (k: number, n: number, p: number) => choose(n, k) * p ** k * (1 - p) ** (n - k);

/** P(X ≤ k) for X ~ Bin(n, p). */
export function binomCdf(k: number, n: number, p: number): number {
  let s = 0;
  for (let i = 0; i <= Math.min(k, n); i++) s += binomPmf(i, n, p);
  return Math.min(1, s);
}

// ---------- descriptive statistics ----------

export const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: readonly number[]) => sum(xs) / xs.length;

/** Sample variance (n − 1 in the denominator). */
export function variance(xs: readonly number[]): number {
  const m = mean(xs);
  return sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1);
}
export const sd = (xs: readonly number[]) => Math.sqrt(variance(xs));

export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

/** Quartiles as in the course book: medians of the lower and upper halves (the median itself excluded when n is odd). */
export function quartiles(xs: readonly number[]): { q1: number; q3: number } {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  const half = Math.floor(n / 2);
  return { q1: median(s.slice(0, half)), q3: median(s.slice(n - half)) };
}

export function fiveNumber(xs: readonly number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const { q1, q3 } = quartiles(s);
  return { min: s[0], q1, median: median(s), q3, max: s[s.length - 1] };
}

/** Pearson correlation. */
export function correlation(xs: readonly number[], ys: readonly number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}
