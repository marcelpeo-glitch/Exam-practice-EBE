// Templates for the topic "Normal model" (QM1 past exams: the probability above / below / between values with Table Z
// or the expected number out of N, the cut-off value for the highest or lowest p%, finding σ, μ or both from given
// percentiles, and which probability a shaded area under a Normal curve represents). Keys are computed in code with
// Table Z (stats.zTable) or the exact quantile (stats.normInv); numeric answers also accept everything between the
// table-based and the exact value. Wrong options come from modelled mistakes. Independent checks: normal-model.test.ts.
import { buildMcq, fixed, INSTRUCTION, mistakesNote, num, numericField, type Choice } from '../build';
import type { Rng } from '../rng';
import { round, zTable } from '../stats';
import type { Generated, Template } from '../types';
import { acceptAround, clearZ, exactP, normalCurveSvg, p4, pct, phiTex, tableP, z2, zFor, zSpread, zStep, type Ev } from './_normal';

const TOPIC = 'Normal model' as const;

/** A context: "a randomly chosen {item} {v1} {more} 210 g{suffix}" / "5% of the {items} {vn} {less} 190 g{suffix}". */
export interface Scn {
  thing: string;
  item: string;
  items: string;
  v1: string;
  vn: string;
  more: string;
  less: string;
  suffix: string;
  unit: string;
  noun: string;
  hi: string;
  lo: string;
  mus: number[];
  sds: number[];
  step: number;
}

const sc = (thing: string, [item, items]: [string, string], [v1, vn]: [string, string], unit: string, noun: string, [hi, lo]: [string, string], mus: number[], sds: number[], step = 1, o: Partial<Scn> = {}): Scn => ({
  thing, item, items, v1, vn, more: 'more than', less: 'less than', suffix: '', unit, noun, hi, lo, mus, sds, step, ...o,
});

export const SCENARIOS: Scn[] = [
  sc('The weight of a bag of crisps filled by a packing machine', ['bag', 'bags'], ['weighs', 'weigh'], 'g', 'weight', ['heaviest', 'lightest'], [150, 175, 200, 225, 250], [3, 4, 5, 6, 8]),
  sc('The delivery time of a parcel sent with a budget courier', ['parcel', 'parcels'], ['takes', 'take'], 'hours', 'delivery time', ['slowest', 'fastest'], [30, 36, 40, 44, 48], [5, 6, 8, 10], 1, { suffix: ' to arrive' }),
  sc('The lifetime of an e-bike battery', ['battery', 'batteries'], ['lasts', 'last'], 'charging cycles', 'lifetime', ['longest-lasting', 'shortest-lasting'], [800, 900, 1000, 1100, 1200], [60, 75, 80, 100, 120], 5, { less: 'fewer than' }),
  sc('The time a barista needs to make a cappuccino', ['cappuccino', 'cappuccinos'], ['takes', 'take'], 'seconds', 'preparation time', ['slowest', 'fastest'], [90, 100, 110, 120], [8, 10, 12, 15], 1, { suffix: ' to make' }),
  sc('The height of the sunflowers in a large field', ['sunflower', 'sunflowers'], ['is', 'are'], 'cm', 'height', ['tallest', 'shortest'], [160, 170, 180, 190, 200], [12, 15, 16, 20, 25], 1, { more: 'taller than', less: 'shorter than' }),
  sc('The score on a national arithmetic test for pupils', ['pupil', 'pupils'], ['scores', 'score'], 'points', 'score', ['best-scoring', 'lowest-scoring'], [300, 400, 500], [40, 50, 60, 80, 100], 5),
  sc('The amount of soup that a vending machine pours into a cup', ['cup', 'cups'], ['contains', 'contain'], 'ml', 'amount of soup', ['fullest', 'least-filled'], [200, 250, 300], [5, 6, 8, 10]),
  sc('The distance a bicycle tyre lasts before it needs replacing', ['tyre', 'tyres'], ['lasts', 'last'], 'km', 'lifetime', ['longest-lasting', 'shortest-lasting'], [4000, 5000, 6000], [400, 500, 600, 800], 10),
  sc('The finishing time of runners in a city half marathon', ['runner', 'runners'], ['needs', 'need'], 'minutes', 'finishing time', ['slowest', 'fastest'], [110, 120, 125, 130], [10, 12, 15, 18], 1, { suffix: ' to finish' }),
];

/** Base form of the verb, for "do you expect to {base} ...". */
const base = (s: Scn) => (s.vn === 'are' ? 'be' : s.vn);

type Range = { lo: number; hi: number };
/** "weighs more than 210 g" / "weighs between 190 and 210 g" (lo = −∞ or hi = ∞ for one-sided). */
function say(s: Scn, verb: string, r: Range): string {
  if (r.lo === -Infinity) return `${verb} ${s.less} ${num(r.hi, 2)} ${s.unit}${s.suffix}`;
  if (r.hi === Infinity) return `${verb} ${s.more} ${num(r.lo, 2)} ${s.unit}${s.suffix}`;
  return `${verb} between ${num(r.lo, 2)} and ${num(r.hi, 2)} ${s.unit}${s.suffix}`;
}

function intro(rng: Rng, s: Scn, mu: number, sd: number): string {
  const m = `${num(mu, 2)} ${s.unit}`;
  const d = `${num(sd, 2)} ${s.unit}`;
  return rng.pick([
    `${s.thing} is Normally distributed with mean ${m} and standard deviation ${d}.`,
    `${s.thing} follows a Normal model with a mean of ${m} and a standard deviation of ${d}.`,
    `${s.thing} is approximately Normal, with mean ${m} and standard deviation ${d}.`,
  ]);
}

const setup = (s: Scn, mu: number, sd: number) =>
  `Let $X$ be the ${s.noun} (in ${s.unit}), so $X\\sim N(${num(mu, 2)},\\,${num(sd, 2)})$: Normal with $\\mu=${num(mu, 2)}$ and $\\sigma=${num(sd, 2)}$. `;

/** A value x = μ + zσ on the scenario's grid with zmin ≤ |z| ≤ zmax, the given sign and an unambiguous 2-decimal z. */
function cut(rng: Rng, s: Scn, mu: number, sd: number, sign: number, zmin: number, zmax: number): number {
  for (let i = 0; i < 300; i++) {
    const x = round(mu + sign * Math.round((rng.step(zmin, zmax, 0.01) * sd) / s.step) * s.step, 6);
    const z = (x - mu) / sd;
    if (Math.abs(z) >= zmin - 1e-9 && Math.abs(z) <= zmax + 1e-9 && clearZ(z)) return x;
  }
  throw new Error('normal-model: no suitable cut-off value');
}

/** Numeric single-field question. */
const numeric = (stem: string, key: number, dp: number, explanation: string, acceptRange: [number, number], images?: Generated['images']): Generated => {
  const f = numericField('x', undefined, key, dp, acceptRange);
  return { type: 'numeric', stem, ...(images ? { images } : {}), instruction: INSTRUCTION.numeric(dp), correctAnswer: f.answer, tolerance: f.tolerance, acceptRange: f.acceptRange, explanation };
};

// =====================================================================================================================
// 1. Probabilities (and expected numbers) with Table Z
// =====================================================================================================================

const probability: Template = {
  id: 'normal-model.probability',
  topic: TOPIC,
  title: 'P(X < x), P(X > x) or P(a < X < b) for a Normal model with Table Z, or the expected number out of N',
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const s = rng.pick(SCENARIOS);
    const mu = rng.pick(s.mus);
    const sd = rng.pick(s.sds);
    const kind = rng.pick(['below', 'above', 'between', 'between'] as const);
    let a: number;
    let b = 0;
    if (kind === 'between') {
      if (rng.chance(0.25)) {
        const sg = rng.sign();
        const near = cut(rng, s, mu, sd, sg, 0.2, 1.2);
        const far = cut(rng, s, mu, sd, sg, Math.abs(near - mu) / sd + 0.4, 2.6);
        [a, b] = sg > 0 ? [near, far] : [far, near];
      } else {
        a = cut(rng, s, mu, sd, -1, 0.3, 2.4);
        b = cut(rng, s, mu, sd, 1, 0.3, 2.4);
      }
    } else a = cut(rng, s, mu, sd, rng.sign(), 0.3, 2.4);
    const za = (a - mu) / sd;
    const zb = (b - mu) / sd;
    const e: Ev = kind === 'between' ? { kind, za, zb } : { kind, z: za };
    const r: Range = kind === 'below' ? { lo: -Infinity, hi: a } : kind === 'above' ? { lo: a, hi: Infinity } : { lo: a, hi: b };
    const P = tableP(e);
    const Px = exactP(e);
    const count = rng.chance(0.35);
    const N = rng.pick([200, 250, 300, 400, 500, 600, 800, 1000, 1200]);
    const stem =
      intro(rng, s, mu, sd) +
      '\n' +
      (count
        ? `Consider ${N} randomly chosen ${s.items}. How many of them do you expect to ${say(s, base(s), r)}?`
        : `What is the probability that a randomly chosen ${s.item} ${say(s, s.v1, r)}?`);

    const [A, M, S] = [num(a, 2), num(mu, 2), num(sd, 2)];
    const ineq = kind === 'below' ? `P(X<${A})` : kind === 'above' ? `P(X>${A})` : `P(${A}<X<${num(b, 2)})`;
    let how = setup(s, mu, sd) + 'Standardise with $z=\\frac{x-\\mu}{\\sigma}$ and use Table Z, which gives the area to the **left** of $z$.\n';
    if (kind === 'below') how += `$$${zStep('z', A, M, S, za)}$$ $$${ineq}=P(Z<${z2(za).toFixed(2)})=${p4(P)}$$`;
    else if (kind === 'above')
      how += `$$${zStep('z', A, M, S, za)}$$ Table Z: $${phiTex(za)}$. We need the area to the **right**, so use the complement rule: $$${ineq}=1-${p4(zTable(za))}=${p4(P)}$$`;
    else
      how +=
        `$$${zStep('z_a', A, M, S, za)}\\qquad ${zStep('z_b', num(b, 2), M, S, zb)}$$ Table Z: $${phiTex(zb)}$ and $${phiTex(za)}$, so ` +
        `$$${ineq}=P(Z<z_b)-P(Z<z_a)=${p4(zTable(zb))}-${p4(zTable(za))}=${p4(P)}$$`;
    const key = count ? Math.round(N * P) : P;
    if (count) how += `\nExpected number: $$${N}\\times ${p4(P)}=${num(N * P, 2)}\\approx ${key}\\text{ ${s.items}}$$`;
    const exactNote = `\n(Software, which does not round $z$, gives ${p4(Px)}${count ? `, i.e. ${num(N * Px, 1)} ${s.items}` : ''}; answers based on that value are accepted too.)`;

    if (type === 'numeric')
      return count
        ? numeric(stem, key, 0, how + exactNote, [Math.floor(Math.min(N * P, N * Px)), Math.ceil(Math.max(N * P, N * Px))])
        : numeric(stem, P, 4, how + exactNote, acceptAround(4, P, Px));

    const F = zTable;
    const ds: [number, string][] = [];
    if (kind !== 'between') {
      const left = F(za);
      const other = kind === 'below' ? 'right' : 'left';
      ds.push([kind === 'below' ? 1 - left : left, `uses the wrong tail: the area to the ${other} of $z$ (complement rule applied the wrong way).`]);
      ds.push([Math.abs(left - 0.5), 'takes the area between the mean and $x$, as if Table Z gave the area from $0$ to $z$.']);
      ds.push([2 * Math.min(left, 1 - left), 'doubles the tail area, as for a two-sided probability.']);
      const zv = (a - mu) / (sd * sd);
      ds.push([kind === 'below' ? F(zv) : 1 - F(zv), 'divides by the variance $\\sigma^2$ instead of by the standard deviation $\\sigma$.']);
    } else {
      ds.push([F(zb), 'forgets to subtract the area below the lower bound (uses only $P(Z<z_b)$).']);
      ds.push([1 - F(za), 'uses only the lower bound: $P(Z>z_a)$.']);
      ds.push([1 - P, 'gives the area outside the interval instead of between the bounds.']);
      if (za < 0) ds.push([F(zb) - F(-za), 'drops the minus sign of $z_a$.']);
      ds.push([F(zb) + F(za), 'adds the two table values instead of subtracting them.']);
    }
    const mk = (v: number, why?: string): Choice =>
      count ? { text: String(Math.round(N * v)), value: Math.round(N * v), ...(why ? { why } : {}) } : { text: p4(v), value: round(v, 4), ...(why ? { why } : {}) };
    // a wrong option must be clearly away from both the Table Z answer and the exact answer
    const far = (v: number) => v > 0.0004 && v < 0.9996 && (count ? N * Math.min(Math.abs(v - P), Math.abs(v - Px)) > 2 : Math.min(Math.abs(v - P), Math.abs(v - Px)) > 0.003);
    const spare = [1, -1, 2, -2, 3, -3, 4, -4].map((k) => P + 0.06 * k).concat([0.05, 0.25, 0.5, 0.75, 0.95]).filter(far);
    const mcq = buildMcq(
      rng,
      mk(P),
      ds.filter(([v]) => far(v)).map(([v, why]) => mk(v, why)),
      { count: optionCount, order: 'ascending', fallback: (i) => mk(spare[i % spare.length], 'an error when reading Table Z.') },
    );
    return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: how + mistakesNote(mcq.distractors) };
  },
};

// =====================================================================================================================
// 2. Cut-off for the highest / lowest p%
// =====================================================================================================================

/** Table T ∞-row column that contains z for a one-sided tail p (in %), if any. */
const TABLE_T_COL: Record<string, number> = { '10': 80, '5': 90, '2.5': 95, '1': 98, '0.5': 99 };

const cutoff: Template = {
  id: 'normal-model.cutoff',
  topic: TOPIC,
  title: 'The value that cuts off the highest or lowest p% of a Normal model (Table Z in reverse)',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const s = rng.pick(SCENARIOS);
    const mu = rng.pick(s.mus);
    const sd = rng.pick(s.sds);
    const top = rng.chance(0.5);
    const p = rng.pick([1, 2.5, 5, 10, 10, 15, 20, 25, 30]);
    const q = top ? 1 - p / 100 : p / 100;
    const zi = zFor(q);
    const key = mu + zi.z3 * sd;
    const dp = sd >= 20 ? 0 : 1;
    const ask = top
      ? rng.pick([`What is the minimum ${s.noun} of the ${s.hi} ${pct(p)} of ${s.items}?`, `Which ${s.noun} separates the ${s.hi} ${pct(p)} of ${s.items} from the rest?`])
      : rng.pick([`What is the maximum ${s.noun} of the ${s.lo} ${pct(p)} of ${s.items}?`, `Which ${s.noun} separates the ${s.lo} ${pct(p)} of ${s.items} from the rest?`]);
    const stem = `${intro(rng, s, mu, sd)}\n${ask}`;
    const col = TABLE_T_COL[String(p)];
    const how =
      setup(s, mu, sd) +
      (top
        ? `The ${s.hi} ${pct(p)} lie to the **right** of the cut-off $x$, so the area to the left of $x$ is $1-${num(p / 100, 3)}=${num(q, 3)}$. `
        : `The ${s.lo} ${pct(p)} lie to the **left** of the cut-off $x$: the area to the left of $x$ is $${num(q, 3)}$. `) +
      `Use Table Z in reverse: find the area closest to $${num(q, 3)}$ inside the table, which gives $z\\approx ${zi.lo.toFixed(2)}$ or $${zi.hi.toFixed(2)}$; more precisely $z=${num(zi.z3, 3)}$` +
      (col ? ` (also in Table T, row $\\infty$, column ${col}%: $z^*=${num(Math.abs(zi.z3), 3)}$)` : '') +
      `.\nSolve $z=\\frac{x-\\mu}{\\sigma}$ for $x$: $$x=\\mu+z\\sigma=${num(mu, 2)}${zi.z3 < 0 ? '-' : '+'}${num(Math.abs(zi.z3), 3)}\\times ${num(sd, 2)}=${num(key, 2)}\\text{ ${s.unit}}$$` +
      `So the cut-off is about ${fixed(key, dp)} ${s.unit}: the ${top ? s.hi : s.lo} ${pct(p)} of ${s.items} lie ${top ? 'above' : 'below'} it.`;
    // every value a student may compute (exact z, 3-decimal z, both Table Z neighbours), and each of them rounded to
    // the requested number of decimals (for whole numbers the tolerance alone does not cover e.g. 268.2 → 268)
    const spread = zSpread((z) => mu + z * sd, zi);
    const range = acceptAround(dp, ...spread, ...spread.map((v) => round(v, dp)));
    if (type === 'numeric') return numeric(stem, key, dp, how + '\n(Answers based on the 2-decimal $z$ from Table Z are accepted too.)', range);

    const sg = top ? 1 : -1;
    const ztwo = zFor(top ? 1 - p / 200 : p / 200).z3;
    const ds: [number, string][] = [
      [mu - zi.z3 * sd, `uses $z=${num(-zi.z3, 3)}$, the cut-off for the ${top ? s.lo : s.hi} ${pct(p)} (wrong tail).`],
      [mu + ztwo * sd, `splits the ${pct(p)} over two tails and uses $z=${num(ztwo, 3)}$ (the $z^*$ of a two-sided ${num(100 - p, 1)}% confidence level).`],
      [mu + sg * (1 - p / 100) * sd, `uses the area $${num(1 - p / 100, 3)}$ as if it were the $z$-value.`],
      [mu + sd / zi.z3, 'solves $z=\\frac{x-\\mu}{\\sigma}$ wrongly as $x=\\mu+\\frac{\\sigma}{z}$.'],
      [mu + zFor(top ? 1 - p / 50 : p / 50).z3 * sd, `puts twice the area in the tail: uses the $z$ for ${pct(2 * p)} instead of ${pct(p)}.`],
    ];
    const mk = (v: number, why?: string): Choice => ({ text: `${fixed(v, dp)} ${s.unit}`, value: round(v, dp), ...(why ? { why } : {}) });
    const mcq = buildMcq(
      rng,
      mk(key),
      ds.filter(([v]) => v > 0).map(([v, why]) => mk(v, why)),
      {
        count: optionCount,
        order: 'ascending',
        epsilon: (0.06 * sd) / Math.abs(key),
        fallback: (i) => mk(key + (i % 2 ? -1 : 1) * 0.3 * sd * (Math.floor(i / 2) + 1), 'an error when reading Table Z.'),
      },
    );
    return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: how + mistakesNote(mcq.distractors) };
  },
};

// =====================================================================================================================
// 3. Find σ, μ or both from percentiles
// =====================================================================================================================

type Cond = { dir: 'more' | 'less'; p: number; x: number; q: number };
const condText = (s: Scn, c: Cond) => `${pct(c.p)} of the ${s.items} ${s.vn} ${c.dir === 'more' ? s.more : s.less} ${num(c.x, 2)} ${s.unit}${s.suffix}`;
const LEVELS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95];

const parameters: Template = {
  id: 'normal-model.parameters',
  topic: TOPIC,
  title: 'Find σ, μ or both from given percentiles of a Normal model (z from Table Z in reverse)',
  types: ['single-choice', 'numeric'],
  difficulty: 3,
  generate({ rng, type, optionCount }) {
    const s = rng.pick(SCENARIOS);
    const mu0 = rng.pick(s.mus);
    const sd0 = rng.pick(s.sds);
    const mode = rng.pick(['sigma', 'mu', 'both', 'both'] as const);
    const xs = sd0 >= 20 ? s.step : sd0 >= 5 ? 1 : 0.5;
    const cond = (q: number): Cond => {
      const dir = rng.pick(['more', 'less'] as const);
      return { dir, q, p: round(100 * (dir === 'less' ? q : 1 - q), 6), x: round(Math.round((mu0 + zFor(q).z * sd0) / xs) * xs, 6) };
    };
    const zLine = (c: Cond, name: string) => {
      const zi = zFor(c.q);
      return (
        `"${condText(s, c)}" means the area to the left of $${num(c.x, 2)}$ is ${c.dir === 'less' ? `$${num(c.q, 2)}$` : `$1-${num(c.p / 100, 2)}=${num(c.q, 2)}$`}; ` +
        `Table Z in reverse gives $${name}\\approx ${zi.lo.toFixed(2)}$ or $${zi.hi.toFixed(2)}$, more precisely $${name}=${num(zi.z3, 3)}$.`
      );
    };
    const mcqOf = (correct: Choice, ds: Choice[], fallback: (i: number) => Choice, eps?: number) =>
      buildMcq(rng, correct, ds, { count: optionCount, order: mode === 'both' ? 'shuffle' : 'ascending', fallback, ...(eps ? { epsilon: eps } : {}) });

    if (mode !== 'both') {
      const c = cond(rng.pick(LEVELS.filter((l) => Math.abs(l - 0.5) >= 0.15)));
      const zi = zFor(c.q);
      const z = zi.z3;
      const known = mode === 'sigma' ? `mean ${num(mu0, 2)} ${s.unit}` : `standard deviation ${num(sd0, 2)} ${s.unit}`;
      const stem =
        `${s.thing} follows a Normal model with ${known}. Moreover, ${condText(s, c)}.\n` +
        (mode === 'sigma' ? 'What is the standard deviation $\\sigma$ of this Normal model?' : 'What is the mean $\\mu$ of this Normal model?');
      const key = mode === 'sigma' ? (c.x - mu0) / z : c.x - z * sd0;
      const how =
        zLine(c, 'z') +
        '\nThen $z=\\frac{x-\\mu}{\\sigma}$ gives ' +
        (mode === 'sigma'
          ? `$$\\sigma=\\frac{x-\\mu}{z}=\\frac{${num(c.x, 2)}-${num(mu0, 2)}}{${num(z, 3)}}=${num(key, 2)}\\text{ ${s.unit}}$$`
          : `$$\\mu=x-z\\sigma=${num(c.x, 2)}-(${num(z, 3)})\\times ${num(sd0, 2)}=${num(key, 2)}\\text{ ${s.unit}}$$`);
      const f = mode === 'sigma' ? (zz: number) => (c.x - mu0) / zz : (zz: number) => c.x - zz * sd0;
      if (type === 'numeric') return numeric(stem, key, 2, how + '\n(Answers based on the 2-decimal $z$ from Table Z are accepted too.)', acceptAround(2, ...zSpread(f, zi)));
      const tail = Math.min(c.q, 1 - c.q);
      const ztwo = Math.sign(z) * zFor(1 - tail / 2).z3;
      const area = Math.sign(z) * Math.max(c.q, 1 - c.q);
      const ds: [number, string][] =
        mode === 'sigma'
          ? [
              [(c.x - mu0) / ztwo, `uses $z=${num(ztwo, 3)}$: the area $${num(tail, 2)}$ split over two tails.`],
              [(c.x - mu0) * z, 'multiplies by $z$ instead of dividing by it.'],
              [(c.x - mu0) / area, `uses the area $${num(Math.abs(area), 2)}$ as if it were the $z$-value.`],
              [c.x / z, 'forgets to subtract the mean: $\\sigma=x/z$.'],
              [((c.x - mu0) / z) ** 2, 'gives the variance $\\sigma^2$ instead of the standard deviation.'],
            ]
          : [
              [c.x + z * sd0, `sign error: uses $z=${num(-z, 3)}$ (the area on the wrong side).`],
              [c.x - ztwo * sd0, `uses $z=${num(ztwo, 3)}$: the area $${num(tail, 2)}$ split over two tails.`],
              [c.x - area * sd0, `uses the area $${num(Math.abs(area), 2)}$ as if it were the $z$-value.`],
              [c.x - sd0 / z, 'solves for $\\mu$ wrongly as $\\mu=x-\\frac{\\sigma}{z}$.'],
            ];
      const scale = mode === 'sigma' ? key : sd0;
      const mk = (v: number, why?: string): Choice => ({ text: `${num(v, 2)} ${s.unit}`, value: round(v, 2), ...(why ? { why } : {}) });
      const mcq = mcqOf(
        mk(key),
        ds.filter(([v]) => v > 0).map(([v, why]) => mk(v, why)),
        (i) => mk(key + (i % 2 ? -1 : 1) * 0.2 * scale * (Math.floor(i / 2) + 1), 'an error when reading Table Z.'),
        (0.05 * scale) / Math.abs(key),
      );
      return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: how + mistakesNote(mcq.distractors) };
    }

    // both μ and σ from two percentiles
    let q1: number;
    let q2: number;
    do {
      [q1, q2] = rng.sample(LEVELS, 2).sort((u, v) => u - v);
    } while (zFor(q2).z - zFor(q1).z < 0.6);
    const c1 = cond(q1);
    const c2 = cond(q2);
    const [z1, z2] = [zFor(q1), zFor(q2)];
    const solve = (a: number, b: number) => {
      const sig = (c2.x - c1.x) / (b - a);
      return { m: c1.x - a * sig, sig };
    };
    const k = solve(z1.z3, z2.z3);
    const shown = rng.chance(0.5) ? [c1, c2] : [c2, c1];
    const stem = `${s.thing} is approximately Normally distributed. ${shown.map((c, i) => (i === 0 ? condText(s, c).replace(/^./, (ch) => ch.toUpperCase()) : condText(s, c))).join(', while ')}.\nDetermine the mean $\\mu$ and the standard deviation $\\sigma$ of this Normal model.`;
    const how =
      zLine(c1, 'z_1') +
      '\n' +
      zLine(c2, 'z_2') +
      `\nEach percentile gives an equation $x=\\mu+z\\sigma$: $$\\mu${z1.z3 < 0 ? '-' : '+'}${num(Math.abs(z1.z3), 3)}\\sigma=${num(c1.x, 2)}\\qquad \\mu${z2.z3 < 0 ? '-' : '+'}${num(Math.abs(z2.z3), 3)}\\sigma=${num(c2.x, 2)}$$` +
      `Subtract the first from the second: $$${num(z2.z3 - z1.z3, 3)}\\,\\sigma=${num(c2.x - c1.x, 2)}\\;\\Rightarrow\\;\\sigma=${num(k.sig, 2)}$$` +
      `and then $\\mu=${num(c1.x, 2)}-(${num(z1.z3, 3)})\\times ${num(k.sig, 2)}=${num(k.m, 2)}$.`;
    if (type === 'numeric') {
      const all = [z1.z, z1.z3, z1.lo, z1.hi].flatMap((a) => [z2.z, z2.z3, z2.lo, z2.hi].map((b) => solve(a, b)));
      return {
        type,
        stem,
        instruction: INSTRUCTION.numericFields(2),
        fields: [
          numericField('mu', '$\\mu$', k.m, 2, acceptAround(2, ...all.map((v) => v.m))),
          numericField('sigma', '$\\sigma$', k.sig, 2, acceptAround(2, ...all.map((v) => v.sig))),
        ],
        explanation: how + '\n(Answers based on the 2-decimal $z$-values from Table Z are accepted too.)',
      };
    }
    const pair = (v: { m: number; sig: number }, why?: string): Choice & { v: { m: number; sig: number } } => ({ text: `$\\mu=${num(v.m, 2)}$, $\\sigma=${num(v.sig, 2)}$`, v, ...(why ? { why } : {}) });
    const flip = (c: Cond, zz: number) => `uses $z=${num(-zz, 3)}$ instead of $${num(zz, 3)}$ for "${condText(s, c)}" (mixes up the area to the left and to the right).`;
    const cands = [
      pair(solve(-z1.z3, z2.z3), flip(c1, z1.z3)),
      pair(solve(z1.z3, -z2.z3), flip(c2, z2.z3)),
      pair(solve(-z1.z3, -z2.z3), 'uses the wrong tail for both percentiles (signs of both $z$-values flipped).'),
      pair(solve(q1, q2), 'uses the areas themselves as $z$-values.'),
      pair({ m: (c1.x + c2.x) / 2, sig: (c2.x - c1.x) / 2 }, 'takes the midpoint of the two values as the mean and half their distance as $\\sigma$.'),
    ];
    const far = (a: { m: number; sig: number }, b: { m: number; sig: number }) => Math.abs(a.m - b.m) > 0.05 * k.sig || Math.abs(a.sig - b.sig) > 0.05 * k.sig;
    const ok: Choice[] = [];
    for (const c of cands) if (c.v.sig > 0 && Number.isFinite(c.v.sig) && far(c.v, k) && ok.every((o) => far((o as typeof c).v, c.v))) ok.push(c);
    ok.push({ text: 'The mean and standard deviation cannot be determined from this information.', why: 'two percentiles give two equations in the two unknowns $\\mu$ and $\\sigma$, which can be solved.' });
    const mcq = mcqOf(pair(k), ok, (i) => pair({ m: k.m + (i % 2 ? -1 : 1) * 0.3 * k.sig * (Math.floor(i / 2) + 1), sig: k.sig * (1 + 0.25 * (Math.floor(i / 2) + 1)) }, 'an arithmetic slip.'));
    return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: how + mistakesNote(mcq.distractors) };
  },
};

// =====================================================================================================================
// 4. Shaded area under a Normal curve
// =====================================================================================================================

const INTERVALS: [number, number][] = [
  [-2, 1], [-1, 2], [-1, 1], [-2, 2], [0, 2], [-3, 1], [-1, 3], [0, 1], [-2, 0], [1, 3], [-3, -1], [1, 2], [-2, -1],
  [1, Infinity], [2, Infinity], [-1, Infinity], [-Infinity, -1], [-Infinity, -2], [-Infinity, 1], [-Infinity, 2],
];
/** 68–95–99.7 rule: the area between consecutive whole z-values (−∞..−3, −3..−2, −2..−1, −1..0, then mirrored). */
const RULE = [0.0015, 0.0235, 0.135, 0.34, 0.34, 0.135, 0.0235, 0.0015];
export const ruleArea = (a: number, b: number) => RULE.reduce((t, m, i) => t + (i - 4 >= Math.max(a, -4) && i - 3 <= Math.min(b, 4) ? m : 0), 0);

const shaded: Template = {
  id: 'normal-model.shaded-area',
  topic: TOPIC,
  title: 'Which probability does a shaded area under a Normal curve (between μ + aσ and μ + bσ) represent, or how large is it',
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const s = rng.pick(SCENARIOS);
    const mu = rng.pick(s.mus);
    const sd = rng.pick(s.sds);
    // a boundary at μ ± 3σ is invisible (the curve is practically on the axis there), so the size of such an area is
    // only asked when the region is read from the options (single choice), never as a number
    const [a, b] = rng.pick(type === 'numeric' ? INTERVALS.filter(([lo, hi]) => Math.abs(lo) !== 3 && Math.abs(hi) !== 3) : INTERVALS);
    const v = (k: number) => (Number.isFinite(k) ? mu + k * sd : k);
    const images = [{ src: normalCurveSvg(a, b), alt: 'Normal curve with a shaded area; the axis is marked at μ − 3σ, μ − 2σ, μ − σ, μ, μ + σ, μ + 2σ and μ + 3σ' }];
    const lab = (k: number) => `\\mu${k === 0 ? '' : `${k < 0 ? '-' : '+'}${Math.abs(k) === 1 ? '' : Math.abs(k)}\\sigma`}`;
    const zr = a === -Infinity ? `Z<${b}` : b === Infinity ? `Z>${a}` : `${a}<Z<${b}`;
    const region = a === -Infinity ? `to the left of $${lab(b)}$` : b === Infinity ? `to the right of $${lab(a)}$` : `between $${lab(a)}$ and $${lab(b)}$`;
    const head = `${intro(rng, s, mu, sd)} The figure shows this Normal model; the shaded area represents a probability.`;
    const vals = (k: number) => (k === 0 ? `$\\mu=${num(mu, 2)}$` : `$${lab(k)}=${num(mu, 2)}${k < 0 ? '-' : '+'}${Math.abs(k) === 1 ? '' : `${Math.abs(k)}\\times `}${num(sd, 2)}=${num(v(k), 2)}$`);
    if (type === 'numeric') {
      const e: Ev = a === -Infinity ? { kind: 'below', z: b } : b === Infinity ? { kind: 'above', z: a } : { kind: 'between', za: a, zb: b };
      const P = tableP(e);
      const rule = ruleArea(a, b);
      const stem = `${head}\nHow large is the shaded area? Use the 68–95–99.7 rule or Table Z.`;
      const how =
        `The shaded area lies ${region}, i.e. it is $P(${zr})$ for a standard Normal $Z$.\n` +
        `With Table Z: ${e.kind === 'below' ? `$P(Z<${b})=${p4(P)}$` : e.kind === 'above' ? `$P(Z>${a})=1-${p4(zTable(a))}=${p4(P)}$` : `$P(${zr})=${p4(zTable(b))}-${p4(zTable(a))}=${p4(P)}$`}.\n` +
        `With the 68–95–99.7 rule (68% within $1\\sigma$, 95% within $2\\sigma$, 99.7% within $3\\sigma$ of the mean, split symmetrically): $${num(rule, 4)}$. Both answers are accepted.`;
      return numeric(stem, P, 4, how, acceptAround(4, P, rule, exactP(e)), images);
    }
    const r = (lo: number, hi: number): Range => ({ lo, hi });
    const opt = (x: Range, why?: string): Choice => ({ text: say(s, s.v1, x), ...(why ? { why } : {}) });
    const ok = (k: number) => k === -Infinity || k === Infinity || (k >= -3 && k <= 3);
    const ds: Choice[] = [];
    /** Regions that look the same in the figure: an edge at μ ± 3σ is indistinguishable from an open tail. */
    const open = (k: number) => (k <= -3 ? -Infinity : k >= 3 ? Infinity : k);
    const looksLikeKey = (lo: number, hi: number) => open(lo) === open(a) && open(hi) === open(b);
    const add = (lo: number, hi: number, why: string) => {
      if (ok(lo) && ok(hi) && lo < hi && !(lo === -Infinity && hi === Infinity) && !looksLikeKey(lo, hi)) ds.push(opt(r(v(lo), v(hi)), why));
    };
    if (Number.isFinite(a) && Number.isFinite(b)) {
      if (sd !== 1) ds.push(opt(r(mu + a, mu + b), `reads $\\mu+k\\sigma$ as $\\mu+k$ (forgets to multiply by $\\sigma=${num(sd, 2)}$).`));
      add(-b, -a, 'mirrors the picture: swaps the left and right side of the mean.');
      add(a - 1, b, 'is one standard deviation off at the lower boundary.');
      add(a, b + 1, 'is one standard deviation off at the upper boundary.');
      add(a + 1, b, 'is one standard deviation off at the lower boundary.');
      add(a, b - 1, 'is one standard deviation off at the upper boundary.');
      const m = Math.max(Math.abs(a), Math.abs(b));
      add(-m, m, 'assumes the shaded area is symmetric around the mean.');
    } else {
      const k = Number.isFinite(a) ? a : b;
      add(Number.isFinite(a) ? -Infinity : k, Number.isFinite(a) ? k : Infinity, 'takes the unshaded part of the curve (wrong tail).');
      add(Number.isFinite(a) ? -Infinity : -k, Number.isFinite(a) ? -k : Infinity, 'mirrors the picture: swaps the left and right side of the mean.');
      add(Number.isFinite(a) ? k + 1 : -Infinity, Number.isFinite(a) ? Infinity : k - 1, 'is one standard deviation off at the boundary.');
      add(Number.isFinite(a) ? k - 1 : -Infinity, Number.isFinite(a) ? Infinity : k + 1, 'is one standard deviation off at the boundary.');
      const x = mu + k;
      if (sd !== 1) ds.push(opt(Number.isFinite(a) ? r(x, Infinity) : r(-Infinity, x), `reads $\\mu+k\\sigma$ as $\\mu+k$ (forgets to multiply by $\\sigma=${num(sd, 2)}$).`));
    }
    const correct = opt(r(v(a), v(b)));
    const all = [-3, -2, -1, 0, 1, 2, 3];
    const mcq = buildMcq(rng, correct, ds, {
      count: optionCount,
      fallback: (i) => {
        const lo = all[(i * 3) % 7];
        const hi = all[(i * 5 + 2) % 7];
        const [x0, x1] = lo < hi ? [lo, hi] : [lo, Infinity];
        // a look-alike of the shaded region is replaced by a region that is clearly different
        return looksLikeKey(x0, x1) ? opt(r(v(-1), v(1)), 'reads the wrong boundaries from the axis.') : opt(r(v(x0), v(x1)), 'reads the wrong boundaries from the axis.');
      },
    });
    const stem = `${head}\nWhich probability does the shaded area represent? The probability that a randomly chosen ${s.item} ...`;
    const bounds = [a, b].filter((k) => Number.isFinite(k));
    const how =
      `The shaded area lies ${region}. With $\\mu=${num(mu, 2)}$ and $\\sigma=${num(sd, 2)}$: ${bounds.map(vals).join(' and ')}.\n` +
      `So the shaded area is the probability that a randomly chosen ${s.item} ${say(s, s.v1, r(v(a), v(b)))}.`;
    return { type, stem, images, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: how + mistakesNote(mcq.distractors) };
  },
};

export const TEMPLATES: Template[] = [probability, cutoff, parameters, shaded];
