// Templates for the topic "Confidence intervals" (QM1 past exams: the one-sample t-interval for a mean with t* from
// Table T (df rounded down to a printed row; the 2025 numeric question asks t*, lower and upper bound), the
// one-proportion z-interval (also for the complementary proportion, or from a given standard error), the minimum
// sample size for a margin of error (rounded up), and interpreting an interval / the effect of the confidence level
// and of n). Every key is computed in code (critical values from stats.tStar / zStar, as printed in Table T); wrong
// options come from modelled student mistakes. Independent checks: confidence-intervals.test.ts.
import { buildMcq, buildMulti, fixed, INSTRUCTION, mistakesNote, num, numericField, type Choice } from '../build';
import type { Rng } from '../rng';
import { normInv, round, T_TABLE_DF, tInv, tStar, tTableDf, zStar, zTable, type TableLevel } from '../stats';
import type { Generated, Template } from '../types';
import { acceptAround } from './_normal';

const TOPIC = 'Confidence intervals' as const;
const pc = (c: number) => String(Math.round(c * 100));
const LEVELS: TableLevel[] = [0.9, 0.95, 0.95, 0.99];
const tExact = (conf: number, df: number) => tInv(1 - (1 - conf) / 2, df);
const zExact = (conf: number) => normInv(1 - (1 - conf) / 2);
/**
 * z* as a student may read it from Table Z in reverse: the 2-decimal entry whose printed probability is closest to
 * 1 − (1 − C)/2, or both neighbours when they are equally close (90%: 1.64/1.65, 99%: 2.57/2.58; 95%: 1.96, 98%: 2.33).
 */
function zTableZ(conf: number): number[] {
  const q = 1 - (1 - conf) / 2;
  const z = normInv(q);
  const nb = [Math.floor(z * 100 + 1e-9) / 100, Math.ceil(z * 100 - 1e-9) / 100];
  const d = (c: number) => Math.abs(zTable(c) - q);
  const best = Math.min(...nb.map(d));
  return [...new Set(nb.filter((c) => d(c) <= best + 1e-9))];
}
/** Every z* a student may use: Table T (row ∞, the key), the exact quantile and the Table Z reading(s). */
const zRoutes = (conf: TableLevel) => [zStar(conf), zExact(conf), ...zTableZ(conf)];
/** Note for a worked solution when Table Z in reverse gives a different z* than the ∞ row of Table T. */
function zNote(conf: TableLevel): string {
  const zs = zTableZ(conf).filter((z) => Math.abs(z - zStar(conf)) > 1e-9);
  return zs.length ? ` (Reading Table Z in reverse gives $z^*\\approx ${zs.map((z) => fixed(z, 2)).join('$ or $')}$; answers based on that are accepted too.)` : '';
}
/** Rounded up, ignoring floating-point noise (600.0000000001 → 600). */
const ceil = (x: number) => Math.ceil(x - 1e-9);

// ---------- scenarios ----------

interface MScn {
  intro: string;
  sample: (n: number) => string;
  /** Noun phrase that works in "a … between": "weight", "waiting time". */
  measure: string;
  unit: string;
  pop: string;
  ind: string;
  mean: [number, number, number];
  sd: [number, number, number];
}
const MSCN: MScn[] = [
  { intro: 'A bakery chain sells sourdough loaves of a nominal 800 grams.', sample: (n) => `A food inspector weighs a random sample of $n=${n}$ loaves from different branches.`, measure: 'weight', unit: 'g', pop: 'all loaves of this type', ind: 'loaves', mean: [790, 812, 0.5], sd: [6, 18, 0.5] },
  { intro: 'A city council wants to know how long cyclists need to get to work.', sample: (n) => `A random sample of $n=${n}$ cycling commuters records the duration of their trip.`, measure: 'commuting time', unit: 'minutes', pop: 'all cycling commuters in the city', ind: 'commuters', mean: [14, 32, 0.1], sd: [4, 11, 0.1] },
  { intro: 'A streaming platform studies how much its subscribers watch.', sample: (n) => `It records last week's viewing time of a random sample of $n=${n}$ subscribers.`, measure: 'weekly viewing time', unit: 'hours', pop: 'all subscribers', ind: 'subscribers', mean: [6, 16, 0.1], sd: [2.5, 7, 0.1] },
  { intro: 'A student union compares mobile phone plans.', sample: (n) => `A random sample of $n=${n}$ students reports the amount of their last monthly phone bill.`, measure: 'monthly phone bill', unit: 'euros', pop: 'all students at the university', ind: 'students', mean: [18, 45, 0.5], sd: [6, 15, 0.5] },
  { intro: "A beekeepers' cooperative estimates this summer's harvest.", sample: (n) => `The honey from a random sample of $n=${n}$ hives is weighed.`, measure: 'honey yield', unit: 'kg', pop: 'all hives of the cooperative', ind: 'hives', mean: [15, 32, 0.1], sd: [3, 9, 0.1] },
  { intro: 'An amusement park wants to advertise the typical waiting time for its new water slide.', sample: (n) => `The waiting time of $n=${n}$ randomly chosen visitors is recorded.`, measure: 'waiting time', unit: 'minutes', pop: 'all visitors of the water slide', ind: 'visitors', mean: [12, 45, 0.5], sd: [5, 15, 0.5] },
  { intro: 'The HR department of a large company is curious about coffee habits.', sample: (n) => `A random sample of $n=${n}$ employees counts the cups of coffee they drink on one working day.`, measure: 'daily coffee consumption', unit: 'cups', pop: 'all employees of the company', ind: 'employees', mean: [1.8, 4.2, 0.05], sd: [0.8, 1.8, 0.05] },
  { intro: 'A sleep researcher studies first-year students during the exam period.', sample: (n) => `A random sample of $n=${n}$ first-year students wears a sleep tracker for one night.`, measure: 'sleep duration', unit: 'hours', pop: 'all first-year students', ind: 'students', mean: [5.8, 7.6, 0.05], sd: [0.7, 1.6, 0.05] },
  { intro: 'A pizzeria advertises fast delivery.', sample: (n) => `The owner records the delivery time of a random sample of $n=${n}$ orders.`, measure: 'delivery time', unit: 'minutes', pop: 'all orders of the pizzeria', ind: 'orders', mean: [22, 38, 0.1], sd: [5, 12, 0.1] },
];

interface PScn {
  org: string;
  intro: (n: number) => string;
  who: string;
  yes: string;
  no: string;
  pop: string;
  p: [number, number];
}
const PSCN: PScn[] = [
  { org: 'A consumer organisation', intro: (n) => `A consumer organisation surveys a random sample of $n=${n}$ Dutch households.`, who: 'households', yes: 'have solar panels on their roof', no: 'do not have solar panels on their roof', pop: 'all Dutch households', p: [0.2, 0.5] },
  { org: 'The university library', intro: (n) => `The university library asks a random sample of $n=${n}$ students about their study habits.`, who: 'students', yes: 'study in the library at least twice a week', no: 'study in the library less than twice a week', pop: 'all students of the university', p: [0.25, 0.65] },
  { org: 'A quality inspector', intro: (n) => `A quality inspector tests a random sample of $n=${n}$ phone chargers from a large shipment.`, who: 'chargers', yes: 'are defective', no: 'work properly', pop: 'all chargers in the shipment', p: [0.06, 0.2] },
  { org: 'A cinema chain', intro: (n) => `A cinema chain asks a random sample of $n=${n}$ visitors how they bought their ticket.`, who: 'visitors', yes: 'bought their ticket online', no: 'bought their ticket at the counter', pop: 'all visitors of the chain', p: [0.45, 0.85] },
  { org: 'A park ranger', intro: (n) => `A park ranger catches (and releases) a random sample of $n=${n}$ frogs in a national park.`, who: 'frogs', yes: 'carry a skin fungus', no: 'are free of the skin fungus', pop: 'all frogs in the park', p: [0.1, 0.4] },
  { org: 'A wizard', intro: (n) => `A wizard tests his new love potion on a random sample of $n=${n}$ volunteers.`, who: 'volunteers', yes: 'fall in love with the first person they see', no: 'show no effect at all', pop: 'all potential users of the potion', p: [0.3, 0.7] },
  { org: 'A fitness app developer', intro: (n) => `A fitness app asks a random sample of $n=${n}$ of its users about last week.`, who: 'users', yes: 'reached their weekly step goal', no: 'missed their weekly step goal', pop: 'all users of the app', p: [0.3, 0.6] },
];

// ---------- data ----------

const NS = [10, 12, 14, 16, 18, 20, 24, 25, 28, 34, 38, 44, 49, 52, 64, 70, 85, 110, 130, 160, 185, 199, 230, 300, 520];

function meanData(rng: Rng, s: MScn, conf: TableLevel) {
  for (let i = 0; i < 1000; i++) {
    const n = rng.pick(NS);
    const ybar = rng.step(...s.mean);
    const sd = rng.step(...s.sd);
    const df = n - 1;
    const ts = tStar(conf, df);
    const se = sd / Math.sqrt(n);
    const me = ts * se;
    if (me >= 0.15 && me <= 0.3 * ybar) return { n, ybar, sd, df, row: tTableDf(df), ts, tx: tExact(conf, df), se, me, L: ybar - me, U: ybar + me };
  }
  throw new Error('confidence-intervals: no suitable sample');
}
type MD = ReturnType<typeof meanData>;

const meanStem = (s: MScn, d: MD) =>
  `${s.intro} ${s.sample(d.n)} The sample mean is $\\bar y=${num(d.ybar, 2)}$ ${s.unit} and the sample standard deviation is $s=${num(d.sd, 2)}$ ${s.unit}.` +
  (d.n < 30 ? ' A histogram of the data is unimodal and roughly symmetric.' : '');

/** Sample sizes for which x/n has at most 3 decimals for suitable x. */
const PN = [100, 125, 200, 250, 400, 500, 800, 1000];
function propCounts(rng: Rng, s: PScn) {
  for (let i = 0; i < 1000; i++) {
    const n = rng.pick(PN);
    const x = rng.int(Math.ceil(s.p[0] * n), Math.floor(s.p[1] * n));
    if ((1000 * x) % n === 0 && x >= 10 && n - x >= 10 && 2 * x !== n) return { n, x };
  }
  throw new Error('confidence-intervals: no suitable count');
}

/** Wrong options that differ from every reference (and from each other) by at least `gap` in the distance d. */
function distinct<T>(cands: T[], refs: T[], d: (a: T, b: T) => number, gap: number): T[] {
  const out: T[] = [];
  for (const c of cands) if ([...refs, ...out].every((r) => d(r, c) >= gap)) out.push(c);
  return out;
}

const choice = (stem: string, mcq: ReturnType<typeof buildMcq>, explanation: string): Generated => ({
  type: 'single-choice',
  stem,
  options: mcq.options,
  correctAnswer: mcq.correctAnswer,
  explanation: explanation + mistakesNote(mcq.distractors),
});

// =====================================================================================================================
// 1. One-sample t-interval for a mean
// =====================================================================================================================

const tInterval: Template = {
  id: 'confidence-intervals.t-interval',
  topic: TOPIC,
  title: 'One-sample t-interval for a mean: t* from Table T (df rounded down to a row), SE = s/√n, lower and upper bound',
  types: ['numeric', 'single-choice'],
  difficulty: 3,
  generate({ rng, type, optionCount }) {
    const s = rng.pick(MSCN);
    const conf = rng.pick(LEVELS);
    const C = pc(conf);
    const d = meanData(rng, s, conf);
    const stem =
      meanStem(s, d) +
      '\n' +
      rng.pick([
        `Construct a **${C}% confidence interval** for the mean ${s.measure} of ${s.pop}.`,
        `Give the **${C}% confidence interval for the population mean** ${s.measure} (of ${s.pop}).`,
        `What is the **${C}% confidence interval** for the mean ${s.measure} of ${s.pop}?`,
      ]);
    const [Lx, Ux] = [d.ybar - d.tx * d.se, d.ybar + d.tx * d.se];
    // a student who rounds SE to 3 decimals (and the margin of error to 3) may end one unit away in the 2nd decimal
    const me3 = d.ts * round(d.se, 3);
    const exactNote = Math.abs(d.tx - d.ts) >= 0.0005 ? ` (The exact critical value for $df=${d.df}$ is ${fixed(d.tx, 3)}; answers based on it are accepted too.)` : '';
    const how =
      `**Conditions.** The ${s.ind} were sampled at random, and ${d.n >= 30 ? `with $n=${d.n}$ the sample is large enough for the Central Limit Theorem` : 'the data are unimodal and roughly symmetric (Nearly Normal condition)'}. ` +
      'Because $\\sigma$ is unknown and estimated by $s$, the critical value comes from the $t$-distribution.\n' +
      `**Critical value.** $df=n-1=${d.df}$. ${d.row !== d.df ? `Table T has no row for ${d.df}, so round down to $df=${d.row}$. ` : ''}In the ${C}% column: $t^*=${fixed(d.ts, 3)}$.${exactNote}\n` +
      `**Standard error.** $SE(\\bar y)=\\dfrac{s}{\\sqrt n}=\\dfrac{${num(d.sd, 2)}}{\\sqrt{${d.n}}}=${num(d.se, 4)}$\n` +
      `**Interval.** $$\\bar y\\pm t^*\\cdot SE(\\bar y)=${num(d.ybar, 2)}\\pm ${fixed(d.ts, 3)}\\times ${num(d.se, 4)}=${num(d.ybar, 2)}\\pm ${num(d.me, 3)}=[${fixed(d.L, 2)},\\ ${fixed(d.U, 2)}]$$\n` +
      `**Conclusion.** We are ${C}% confident that the mean ${s.measure} of ${s.pop} lies between ${fixed(d.L, 2)} and ${fixed(d.U, 2)} ${s.unit}.`;
    if (type === 'numeric')
      return {
        type,
        stem,
        instruction:
          'Instruction: round the degrees of freedom down to the nearest row of Table T and fill in the critical value $t^*$ (3 decimals). Then fill in the lower and upper bound of the interval (2 decimals). To separate decimals, use a dot and not a comma (example: 0.51 instead of 0,51)!',
        fields: [
          numericField('t', 'Critical t-value $t^*$', d.ts, 3, acceptAround(3, d.ts, d.tx)),
          numericField('lo', 'Lower bound of the confidence interval', d.L, 2, acceptAround(2, d.L, Lx, d.ybar - me3)),
          numericField('hi', 'Upper bound of the confidence interval', d.U, 2, acceptAround(2, d.U, Ux, d.ybar + me3)),
        ],
        explanation: how,
      };
    const oneLvl = round(2 * conf - 1, 2) as TableLevel;
    const other: TableLevel = conf === 0.95 ? 0.99 : 0.95;
    const z = zStar(conf);
    const upRow = d.row !== d.df ? T_TABLE_DF.find((r) => r > d.df) : undefined;
    const mistakes: [number, string][] = [
      [z * d.se, `uses $z^*=${fixed(z, 3)}$ from the Normal model instead of $t^*$ ($\\sigma$ is unknown, so the $t$-distribution with $n-1$ degrees of freedom applies).`],
      [tStar(oneLvl, d.df) * d.se, `takes $t^*=${fixed(tStar(oneLvl, d.df), 3)}$ from the ${pc(oneLvl)}% column: puts the whole ${num(1 - conf, 2)} in one tail.`],
      [d.ts * d.sd, 'uses the standard deviation $s$ instead of the standard error $s/\\sqrt n$.'],
      [(d.ts * d.sd) / d.n, 'divides $s$ by $n$ instead of by $\\sqrt n$.'],
      [tStar(other, d.df) * d.se, `uses the ${pc(other)}% column of Table T instead of the ${C}% column.`],
      [d.ts * Math.sqrt(d.sd / d.n), 'computes $\\sqrt{s/n}$ instead of $s/\\sqrt n$.'],
      ...(upRow !== undefined && Number.isFinite(upRow) ? [[tStar(conf, upRow) * d.se, `rounds the degrees of freedom up to the row $df=${upRow}$ instead of down to $${d.row}$.`] as [number, string]] : []),
      ...[1.5, 0.6, 2, 0.45, 2.5, 0.3, 3].map((f): [number, string] => [d.me * f, 'an arithmetic slip in the margin of error.']),
    ];
    const ok = distinct<[number, string]>(
      mistakes.filter(([m]) => m > 0 && m < d.ybar),
      [[d.me, ''], [d.tx * d.se, '']],
      (a, b) => Math.abs(a[0] - b[0]),
      Math.max(0.04 * d.me, 0.03),
    );
    const iv = (m: number, why?: string): Choice => ({ text: `[${fixed(d.ybar - m, 2)}, ${fixed(d.ybar + m, 2)}]`, value: m, ...(why ? { why } : {}) });
    const mcq = buildMcq(rng, iv(d.me), ok.map(([m, why]) => iv(m, why)), { count: optionCount });
    return choice(stem, mcq, how);
  },
};

// =====================================================================================================================
// 2. One-proportion z-interval
// =====================================================================================================================

const proportion: Template = {
  id: 'confidence-intervals.proportion',
  topic: TOPIC,
  title: 'Confidence interval for a proportion: p̂ ± z*·√(p̂(1−p̂)/n), from counts (also the complementary proportion) or from a given SE',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const s = rng.pick(PSCN);
    const conf = rng.pick(LEVELS);
    const C = pc(conf);
    const zt = zStar(conf);
    const kind = rng.pick(['count', 'count', 'complement', 'se'] as const);
    const comp = kind === 'complement';
    const asked = comp ? s.no : s.yes;
    const other = comp ? s.yes : s.no;
    const ask = rng.pick([
      `Construct a ${C}% confidence interval for the proportion of ${s.pop} that ${asked}.`,
      `What is the ${C}% confidence interval for the proportion of ${s.pop} that ${asked}?`,
    ]);
    let ph: number;
    let se: number;
    let n = 0;
    let x = 0;
    let stem: string;
    let setup: string;
    if (kind === 'se') {
      const pct = rng.int(Math.round(s.p[0] * 100), Math.round(s.p[1] * 100));
      ph = pct / 100;
      let sePct = 0;
      for (let i = 0; i < 100; i++) {
        sePct = rng.step(1.2, 3.5, 0.1);
        if (zStar(0.99) * (sePct / 100) < Math.min(ph, 1 - ph) - 0.02) break;
        sePct = 1;
      }
      se = sePct / 100;
      stem = `A large survey estimates that ${pct}% of ${s.pop} ${s.yes}. The standard error of this estimate is ${num(sePct, 1)} percentage points, and the sampling distribution of the sample proportion is approximately Normal.\n${ask}`;
      setup = `The estimate is $\\hat p=${num(ph, 2)}$ with standard error $SE(\\hat p)=${num(se, 3)}$ (given; a Normal model applies).\n`;
    } else {
      ({ n, x } = propCounts(rng, s));
      ph = comp ? (n - x) / n : x / n;
      se = Math.sqrt((ph * (1 - ph)) / n);
      stem = `${s.intro(n)} Of them, ${x} ${s.yes}.\n${ask}`;
      setup =
        (comp
          ? `The question is about the ${s.who} that ${asked}: $${n}-${x}=${n - x}$ of the ${n}, so $\\hat p=\\dfrac{${n - x}}{${n}}=${num(ph, 3)}$.\n`
          : `$\\hat p=\\dfrac{${x}}{${n}}=${num(ph, 3)}$.\n`) +
        `**Conditions.** Random sample; Success/Failure condition: $n\\hat p=${num(n * ph, 0)}$ and $n(1-\\hat p)=${num(n * (1 - ph), 0)}$ are both at least 10.\n` +
        `**Standard error.** $$SE(\\hat p)=\\sqrt{\\frac{\\hat p(1-\\hat p)}{n}}=\\sqrt{\\frac{${num(ph, 3)}\\times ${num(1 - ph, 3)}}{${n}}}=${num(se, 4)}$$\n`;
    }
    const me = zt * se;
    const [L, U] = [ph - me, ph + me];
    const how =
      setup +
      `**Critical value.** For ${C}% confidence, $z^*=${fixed(zt, 3)}$ (Table T, row $\\infty$).${type === 'numeric' ? zNote(conf) : ''}\n` +
      `**Interval.** $$\\hat p\\pm z^*\\cdot SE(\\hat p)=${num(ph, 3)}\\pm ${fixed(zt, 3)}\\times ${num(se, 4)}=${num(ph, 3)}\\pm ${num(me, 4)}=[${fixed(L, 3)},\\ ${fixed(U, 3)}]$$\n` +
      `**Conclusion.** We are ${C}% confident that between ${num(100 * L, 1)}% and ${num(100 * U, 1)}% of ${s.pop} ${asked}.`;
    if (type === 'numeric')
      return {
        type,
        stem,
        instruction: INSTRUCTION.numericFields(3),
        fields: [
          numericField('lo', 'Lower bound of the confidence interval', L, 3, acceptAround(3, ...zRoutes(conf).map((z) => ph - z * se))),
          numericField('hi', 'Upper bound of the confidence interval', U, 3, acceptAround(3, ...zRoutes(conf).map((z) => ph + z * se))),
        ],
        explanation: how,
      };
    const z1 = round(normInv(conf), 3);
    const oc: TableLevel = conf === 0.95 ? 0.99 : 0.95;
    type Iv = { lo: number; hi: number; why: string };
    const at = (c: number, m: number, why: string): Iv => ({ lo: c - m, hi: c + m, why });
    const cands: Iv[] = [
      at(1 - ph, me, `gives the interval for the proportion that ${other}, not for the proportion that ${asked}.`),
      at(ph, z1 * se, `uses $z^*=${fixed(z1, 3)}$, which puts the whole ${num(1 - conf, 2)} in one tail.`),
      at(ph, zStar(oc) * se, `uses $z^*=${fixed(zStar(oc), 3)}$, the critical value for ${pc(oc)}% confidence.`),
      at(ph, se, 'takes $\\hat p\\pm SE$: forgets to multiply by $z^*$.'),
      ...(kind === 'se'
        ? [at(ph, 2 * se, `uses the 68–95–99.7 rule ($\\pm 2\\,SE$) instead of $z^*=${fixed(zt, 3)}$.`)]
        : [
            at(ph, zt * Math.sqrt(0.25 / n), 'uses $p=0.5$ in the standard error (as in the sample-size formula) instead of $\\hat p$.'),
            at(1 - ph, zStar(oc) * se, `gives the interval for the proportion that ${other}, and uses $z^*=${fixed(zStar(oc), 3)}$ (the value for ${pc(oc)}% confidence).`),
          ]),
      ...[1.5, 0.5, 2, 0.3, 2.5].map((f) => at(ph, f * me, 'an arithmetic slip in the margin of error.')),
    ];
    const dist = (a: Iv, b: Iv) => Math.max(Math.abs(a.lo - b.lo), Math.abs(a.hi - b.hi));
    // No near-degenerate intervals (e.g. [0.816, 0.816] from forgetting the square root): nobody would pick them.
    const ok = distinct(
      cands.filter((c) => c.lo >= 0 && c.hi <= 1 && c.hi - c.lo >= 0.25 * 2 * me),
      [at(ph, me, ''), ...zRoutes(conf).map((z) => at(ph, z * se, ''))],
      dist,
      0.005,
    );
    const txt = (c: Iv) => `[${fixed(c.lo, 3)}, ${fixed(c.hi, 3)}]`;
    const mcq = buildMcq(rng, { text: txt(at(ph, me, '')) }, ok.map((c) => ({ text: txt(c), why: c.why })), { count: optionCount });
    return choice(stem, mcq, how);
  },
};

// =====================================================================================================================
// 3. Minimum sample size for a given margin of error
// =====================================================================================================================

const sampleSize: Template = {
  id: 'confidence-intervals.sample-size',
  topic: TOPIC,
  title: 'Minimum sample size for a margin of error: n = z*²p(1−p)/ME² (p = 0.5 or a pilot estimate) or n = (z*σ/ME)², rounded up',
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const conf = rng.pick<TableLevel>([0.9, 0.95, 0.95, 0.98, 0.99]);
    const C = pc(conf);
    const zt = zStar(conf);
    const kind = rng.pick(['worst', 'worst', 'pilot', 'mean'] as const);
    let nOf: (z: number) => number;
    let stem: string;
    let how: string;
    let mist: [(z: number) => number, string][];
    const z1 = round(normInv(conf), 3);
    const zo = conf === 0.95 ? zStar(0.99) : zStar(0.95);
    const zMist: [number, string][] = [
      [z1, `uses $z^*=${fixed(z1, 3)}$, which puts the whole ${num(1 - conf, 2)} in one tail.`],
      [zo, `uses $z^*=${fixed(zo, 3)}$, the critical value for ${conf === 0.95 ? 99 : 95}% confidence.`],
    ];
    if (kind === 'mean') {
      const s = rng.pick(MSCN);
      let sig = 0;
      let E = 0;
      for (let i = 0; i < 1000; i++) {
        sig = rng.step(...s.sd);
        E = round(sig * rng.pick([0.1, 0.15, 0.2, 0.25, 0.3, 0.4]), sig < 2 ? 2 : 1);
        const n = (zt * sig / E) ** 2;
        if (E > 0 && n >= 12 && n <= 3000) break;
      }
      nOf = (z) => ((z * sig) / E) ** 2;
      stem =
        `${s.intro} From earlier studies, the standard deviation of the ${s.measure} is known to be about $\\sigma=${num(sig, 2)}$ ${s.unit}. ` +
        `The goal is to estimate the mean ${s.measure} of ${s.pop} to within $\\pm${num(E, 2)}$ ${s.unit} with ${C}% confidence (use $z^*$, because $\\sigma$ is known).\n` +
        `How many ${s.ind} must be sampled at least?`;
      how =
        `The margin of error is $ME=z^*\\dfrac{\\sigma}{\\sqrt n}$ with $z^*=${fixed(zt, 3)}$ for ${C}% confidence (Table T, row $\\infty$). Solve for $n$: ` +
        `$$n=\\left(\\frac{z^*\\sigma}{ME}\\right)^2=\\left(\\frac{${fixed(zt, 3)}\\times ${num(sig, 2)}}{${num(E, 2)}}\\right)^2=${num(nOf(zt), 2)}$$`;
      mist = [
        [(z) => (z * sig) / E, 'forgets to square: computes $z^*\\sigma/ME$, which is $\\sqrt n$.'],
        [(z) => (z * z * sig) / (E * E), 'uses $\\sigma$ instead of $\\sigma^2$ in $n=(z^*)^2\\sigma^2/ME^2$.'],
        [(z) => (z * sig * sig) / (E * E), 'forgets to square $z^*$.'],
        [(z) => ((z * sig) / (2 * E)) ** 2, 'uses $2\\,ME$, the full width of the interval, in place of the margin of error.'],
      ];
    } else {
      const s = rng.pick(PSCN);
      const E = rng.pick([0.02, 0.025, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1]);
      const meText = rng.chance(0.5) ? `a margin of error of at most ${num(E, 3)}` : `a margin of error of no more than ${num(100 * E, 1)} percentage points`;
      let p = 0.5;
      let pText: string;
      if (kind === 'pilot') {
        let pct = 50;
        for (let i = 0; i < 100 && Math.abs(pct - 50) < 10; i++) pct = rng.int(Math.round(s.p[0] * 100), Math.round(s.p[1] * 100));
        if (Math.abs(pct - 50) < 10) pct = 20;
        p = pct / 100;
        pText = `A pilot study suggests that about ${pct}% of them ${s.yes}; use this as the guess for $p$.`;
      } else pText = rng.pick(['There is no earlier estimate of this proportion, so assume $p=0.5$ (the worst case).', 'Nothing is known in advance about this proportion; use the conservative guess $p=0.5$.']);
      nOf = (z) => (z * z * p * (1 - p)) / (E * E);
      stem = `${s.org} wants to estimate, with a ${C}% confidence interval and ${meText}, the proportion of ${s.pop} that ${s.yes}. ${pText}\nWhat is the minimum sample size $n$ needed?`;
      how =
        `The margin of error of a one-proportion interval is $ME=z^*\\sqrt{\\dfrac{p(1-p)}{n}}$, with $z^*=${fixed(zt, 3)}$ for ${C}% confidence (Table T, row $\\infty$)` +
        (kind === 'pilot' ? ` and the pilot estimate $p=${num(p, 2)}$` : ' and $p=0.5$, which gives the largest possible $p(1-p)=0.25$ and so a sample size that is large enough whatever the true $p$') +
        `. Solve for $n$: $$n=\\frac{(z^*)^2\\,p(1-p)}{ME^2}=\\frac{${fixed(zt, 3)}^2\\times ${num(p, 2)}\\times ${num(1 - p, 2)}}{${num(E, 3)}^2}=${num(nOf(zt), 2)}$$`;
      mist = [
        [(z) => (z * p * (1 - p)) / (E * E), 'forgets to square $z^*$.'],
        [(z) => (z / E) ** 2, 'forgets the factor $p(1-p)$.'],
        [(z) => (z * z * p) / (E * E), 'uses $p$ instead of $p(1-p)$.'],
        [(z) => (z * z * p * (1 - p)) / E, 'divides by $ME$ instead of by $ME^2$.'],
        [(z) => (z * z * p * (1 - p)) / (4 * E * E), 'uses $2\\,ME$, the full width of the interval, in place of the margin of error.'],
        ...(kind === 'pilot' ? [[(z: number) => (z * z * 0.25) / (E * E), 'ignores the pilot estimate and uses $p=0.5$.'] as [(z: number) => number, string]] : []),
      ];
    }
    const key = ceil(nOf(zt));
    // accepted: rounding down (as the official solutions allow), the exact z*, or z* read from Table Z in reverse
    const ns = zRoutes(conf).map(nOf);
    const range: [number, number] = [Math.floor(Math.min(...ns) + 1e-9), ceil(Math.max(...ns))];
    const zz = zTableZ(conf).filter((z) => Math.abs(z - zt) > 1e-9);
    how +=
      `\nAlways round **up**: with fewer observations the margin of error would be larger than required. So $n=${key}$.` +
      (type === 'numeric' && range[0] < range[1]
        ? ` (Answers from ${range[0]} to ${range[1]} are accepted: rounding down, as the official solutions allow, ${zz.length ? `taking $z^*\\approx ${zz.map((z) => fixed(z, 2)).join('$ or $')}$ from Table Z in reverse, ` : ''}or using the exact $z^*$ changes the result only slightly.)`
        : '');
    if (type === 'numeric') {
      const f = numericField('n', undefined, key, 0, range);
      return { type, stem, instruction: INSTRUCTION.numeric(0), correctAnswer: f.answer, tolerance: f.tolerance, acceptRange: range, explanation: how };
    }
    const cands: [number, string][] = [...mist.map(([f, why]): [number, string] => [ceil(f(zt)), why]), ...zMist.map(([z, why]): [number, string] => [ceil(nOf(z)), why])];
    const fall = [2, 0.5, 4, 0.25, 1.5, 3, 0.7].map((f): [number, string] => [ceil(key * f), 'an arithmetic slip.']);
    const ok = distinct<[number, string]>(
      [...cands, ...fall].filter(([v]) => v >= 2),
      [[key, ''], [range[0], ''], [range[1], '']],
      (a, b) => Math.abs(a[0] - b[0]),
      Math.max(3, 0.03 * key),
    );
    const mk = (v: number, why?: string): Choice => ({ text: String(v), value: v, ...(why ? { why } : {}) });
    const mcq = buildMcq(rng, mk(key), ok.map(([v, why]) => mk(v, why)), { count: optionCount, order: 'ascending' });
    return choice(stem, mcq, how);
  },
};

// =====================================================================================================================
// 4. Interpretation; effect of the confidence level and of n
// =====================================================================================================================

interface St {
  text: string;
  correct: boolean;
  why: string;
}
const reasonsNote = (rs: { id: string; correct: boolean; why: string }[]) =>
  '\n\n**Option by option**\n' + rs.map((r) => `- **${r.id}** ${r.correct ? '(correct)' : '(wrong)'}: ${r.why}`).join('\n');

/** A value inside (not near the bounds or the centre) or clearly outside [lo, hi]. */
function valueNear(rng: Rng, lo: number, hi: number, inside: boolean, dps: number[]): number {
  const me = (hi - lo) / 2;
  const c = (lo + hi) / 2;
  for (const dp of dps)
    for (let i = 0; i < 20; i++) {
      const f = rng.step(0.35, 0.8, 0.05);
      const v = round(inside ? c + rng.sign() * f * me : rng.chance(0.5) ? lo - f * me : hi + f * me, dp);
      const good = inside ? v > lo + 0.15 * me && v < hi - 0.15 * me && Math.abs(v - c) > 0.1 * me : v < lo - 0.15 * me || v > hi + 0.15 * me;
      if (good && v > 0) return v;
    }
  return round(inside ? c + 0.5 * me : hi + 0.6 * me, 4);
}

const FRAC: Record<number, string> = { 2: 'half', 3: 'one third', 4: 'one quarter', 9: 'one ninth', 16: 'one sixteenth' };

const interpretation: Template = {
  id: 'confidence-intervals.interpretation',
  topic: TOPIC,
  title: 'Interpreting a confidence interval; effect of the confidence level and the sample size; margin of error and plausible values',
  types: ['single-choice', 'multi-select'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const conf = rng.pick(LEVELS);
    const C = pc(conf);
    const isMean = rng.chance(0.5);
    let stem: string;
    let L: number;
    let U: number;
    let dp: number;
    let crit: (c: TableLevel) => number;
    let PAR: string;
    let I: string;
    let base: string;
    const w: Record<string, string> = {};
    const extra: St[] = [];
    if (isMean) {
      const s = rng.pick(MSCN);
      const d = meanData(rng, s, conf);
      dp = 2;
      [L, U] = [round(d.L, 2), round(d.U, 2)];
      crit = (c) => tStar(c, d.df);
      PAR = `the mean ${s.measure} of ${s.pop}`;
      I = `${fixed(L, 2)} and ${fixed(U, 2)} ${s.unit}`;
      Object.assign(w, { param: 'population mean', stat: 'sample mean', who: s.ind, n: String(d.n), spread: 'standard deviation' });
      stem = `${meanStem(s, d)} From these data, the ${C}% confidence interval for the mean ${s.measure} of ${s.pop} is [${fixed(L, 2)}, ${fixed(U, 2)}] ${s.unit}.`;
      base = `The interval is $\\bar y\\pm t^*\\dfrac{s}{\\sqrt n}=${num(d.ybar, 2)}\\pm ${fixed(d.ts, 3)}\\times\\dfrac{${num(d.sd, 2)}}{\\sqrt{${d.n}}}=${num(d.ybar, 2)}\\pm ${num(d.me, 3)}$ ($t^*$ from Table T with $df=${d.df}${d.row !== d.df ? `\\to ${d.row}` : ''}$).`;
      extra.push(
        { text: `${C}% of the ${s.ind} in the sample had a ${s.measure} between ${I}.`, correct: false, why: 'the interval is about the population mean, not about individual values in the sample.' },
        { text: `${C}% of ${s.pop} have a ${s.measure} between ${I}.`, correct: false, why: 'the interval is about the mean, not about individual values; individual values vary much more than the mean does.' },
        rng.chance(0.5)
          ? { text: `The critical value comes from a $t$-distribution with ${d.df} degrees of freedom, because $\\sigma$ is estimated by $s$.`, correct: true, why: `$\\sigma$ is unknown, so the $t$-distribution with $n-1=${d.df}$ degrees of freedom is used.` }
          : { text: `The critical value comes from a $t$-distribution with ${d.n} degrees of freedom, because $\\sigma$ is estimated by $s$.`, correct: false, why: `the degrees of freedom are $n-1=${d.df}$, not $n$.` },
        { text: 'This interval is only valid if the Success/Failure condition holds (at least 10 successes and 10 failures).', correct: false, why: 'the Success/Failure condition belongs to proportions; for a mean we check randomization, independence and the Nearly Normal condition (or a large $n$).' },
      );
    } else {
      const s = rng.pick(PSCN);
      const { n, x } = propCounts(rng, s);
      const ph = x / n;
      const se = Math.sqrt((ph * (1 - ph)) / n);
      dp = 3;
      [L, U] = [round(ph - zStar(conf) * se, 3), round(ph + zStar(conf) * se, 3)];
      crit = (c) => zStar(c);
      PAR = `the proportion of ${s.pop} that ${s.yes}`;
      I = `${fixed(L, 3)} and ${fixed(U, 3)}`;
      Object.assign(w, { param: 'population proportion', stat: 'sample proportion', who: s.who, n: String(n), spread: 'sample proportion' });
      stem = `${s.intro(n)} Of them, ${x} ${s.yes}. The resulting ${C}% confidence interval for the proportion of ${s.pop} that ${s.yes} is [${fixed(L, 3)}, ${fixed(U, 3)}].`;
      base = `The interval is $\\hat p\\pm z^*\\sqrt{\\dfrac{\\hat p(1-\\hat p)}{n}}$ with $\\hat p=${x}/${n}=${num(ph, 3)}$ and $z^*=${fixed(zStar(conf), 3)}$.`;
      extra.push(
        { text: `Between ${num(100 * L, 1)}% and ${num(100 * U, 1)}% of the ${n} ${s.who} in the sample ${s.yes}.`, correct: false, why: `the sample proportion is known exactly (${x} of ${n}); the interval is about the population proportion.` },
        { text: `${C}% of ${s.pop} ${s.yes}.`, correct: false, why: 'the confidence level is not a proportion in the population; it is the success rate of the method.' },
        rng.chance(0.5)
          ? { text: `The Success/Failure condition holds: the sample has ${x} successes and ${n - x} failures, both at least 10.`, correct: true, why: `there are ${x} successes and ${n - x} failures, both at least 10.` }
          : { text: `The critical value comes from a $t$-distribution with ${n - 1} degrees of freedom.`, correct: false, why: 'for a proportion the critical value comes from the Normal model ($z^*$), not from a $t$-distribution.' },
      );
    }
    const me = (U - L) / 2;
    const interp: St[] = [
      { text: `We can be ${C}% confident that ${PAR} lies between ${I}.`, correct: true, why: 'a confidence interval is a statement about the population parameter.' },
      { text: `If this sampling procedure were repeated many times, about ${C}% of the resulting intervals would contain ${PAR}.`, correct: true, why: `this is what "${C}% confidence" means: the method captures the parameter in ${C}% of all samples.` },
      { text: `There is a ${C}% probability that the ${w.stat} of this study lies between ${I}.`, correct: false, why: `the ${w.stat} is known: it is the centre of the interval, so it certainly lies inside it.` },
      { text: `${C}% of all possible samples of ${w.n} ${w.who} would have a ${w.stat} between ${I}.`, correct: false, why: "the sampling distribution is centred at the unknown parameter, not at this sample's estimate; the interval is not a statement about other samples." },
      { text: `We can be ${C}% confident that the ${w.stat} of a new random sample of ${w.n} ${w.who} will lie between ${I}.`, correct: false, why: 'confidence is about the population parameter, not about the outcome of another sample.' },
      ...extra.slice(0, 2),
    ];
    const lower: TableLevel = conf === 0.99 ? 0.95 : conf === 0.95 ? 0.9 : 0.8;
    const higher: TableLevel | null = conf === 0.9 ? 0.95 : conf === 0.95 ? 0.99 : null;
    const eg = (l: TableLevel | null) => (l ? ` (for example to ${pc(l)}%)` : '');
    let mcqStem: string;
    let pool: St[];
    if (type === 'single-choice' && rng.chance(0.35)) {
      mcqStem = 'The researchers find this interval too wide. How could they obtain a narrower interval?';
      pool = [
        { text: `Take a larger random sample and keep the ${C}% confidence level; intervals made this way still capture the ${w.param} in ${C}% of samples.`, correct: true, why: 'a larger $n$ gives a smaller standard error, so a smaller margin of error at the same confidence level.' },
        { text: `Lower the confidence level${eg(lower)}; but then intervals made this way miss the ${w.param} more often.`, correct: true, why: `a lower level uses a smaller critical value (narrower interval), but the method then fails in ${100 - Number(pc(lower))}% instead of ${100 - Number(C)}% of samples.` },
        { text: `Raise the confidence level${eg(higher)}; this also makes it less likely that the interval misses the ${w.param}.`, correct: false, why: 'a higher level uses a larger critical value, so the interval becomes wider, not narrower.' },
        { text: `Lower the confidence level${eg(lower)}; this also makes it less likely that the interval misses the ${w.param}.`, correct: false, why: 'the interval does become narrower, but the method then misses the parameter more often, not less.' },
        { text: `Take a smaller random sample and keep the ${C}% confidence level.`, correct: false, why: 'a smaller $n$ gives a larger standard error and so a wider interval.' },
        { text: `Raise the confidence level${eg(higher)}; the interval becomes narrower, although it misses the ${w.param} more often.`, correct: false, why: 'a higher level gives a wider interval that misses the parameter less often.' },
      ];
    } else if (type === 'single-choice') {
      mcqStem = 'Which of the following statements is a correct interpretation of this interval?';
      pool = interp;
    } else {
      mcqStem = 'Which of the following statements are correct?';
      const o: TableLevel = conf === 0.99 ? rng.pick<TableLevel>([0.9, 0.95]) : conf === 0.9 ? rng.pick<TableLevel>([0.95, 0.99]) : rng.pick<TableLevel>([0.9, 0.99]);
      const wider = rng.chance(0.5);
      const k = Number(w.n) < 30 ? 4 : rng.pick([4, 9, 16]); // small n: t* changes too much for 'one third'
      const trueFrac = FRAC[Math.sqrt(k)];
      const fracOk = rng.chance(0.5);
      const width = U - L;
      const inside = rng.chance(0.5);
      const v = valueNear(rng, L, U, inside, dp === 2 ? [1, 2] : [2, 3]);
      const sayNot = rng.chance(0.5);
      const meOk = rng.chance(0.5);
      pool = [
        ...rng.sample(interp.filter((x) => x.correct), rng.int(1, 2)),
        ...rng.sample(interp.filter((x) => !x.correct), 3),
        ...extra.slice(2),
        {
          text: `A ${pc(o)}% confidence interval computed from the same data would be ${wider ? 'wider' : 'narrower'} than this interval.`,
          correct: o > conf === wider,
          why: `a ${o > conf ? 'higher' : 'lower'} confidence level uses a ${o > conf ? 'larger' : 'smaller'} critical value (${fixed(crit(o), 3)} instead of ${fixed(crit(conf), 3)}), so the interval becomes ${o > conf ? 'wider' : 'narrower'}.`,
        },
        rng.chance(0.5)
          ? { text: `Choosing a lower confidence level${eg(lower)} would give a narrower interval, but intervals made this way would miss the ${w.param} more often.`, correct: true, why: `the critical value becomes smaller, and the method fails in ${100 - Number(pc(lower))}% instead of ${100 - Number(C)}% of samples.` }
          : { text: `Choosing a lower confidence level${eg(lower)} would give a narrower interval, and intervals made this way would miss the ${w.param} less often.`, correct: false, why: `the interval is narrower, but the method then fails in ${100 - Number(pc(lower))}% instead of ${100 - Number(C)}% of samples: more often, not less.` },
        {
          text: `With a random sample ${k} times as large (and a similar ${w.spread}), the margin of error would be about ${fracOk ? trueFrac : FRAC[k]} as large.`,
          correct: fracOk,
          why: `the margin of error is proportional to $1/\\sqrt n$: a sample ${k} times as large gives a margin of error about $1/\\sqrt{${k}}$, i.e. ${trueFrac}, as large.`,
        },
        meOk
          ? { text: `The margin of error of this interval is ${num(me, dp + 1)}.`, correct: true, why: `the margin of error is half the width: $(${fixed(U, dp)}-${fixed(L, dp)})/2=${num(me, dp + 1)}$.` }
          : { text: `The margin of error of this interval is ${num(width, dp)}.`, correct: false, why: `${num(width, dp)} is the full width of the interval; the margin of error is half of it, ${num(me, dp + 1)}.` },
        {
          text: `${num(v, dp)} is ${sayNot ? 'not ' : ''}a plausible value for the ${w.param}.`,
          correct: inside !== sayNot,
          why: `${num(v, dp)} lies ${inside ? 'inside' : 'outside'} the interval, so it is ${inside ? '' : 'not '}a plausible value.`,
        },
      ];
    }
    const head = `${stem}\n${mcqStem}`;
    const meaning = `\nA ${C}% confidence interval is a statement about the population parameter (${PAR}). The ${C}% is the success rate of the method: in the long run, ${C}% of the intervals made this way contain the parameter. It says nothing about individual values, about the estimate from this sample (that is the centre of the interval) or about other samples.`;
    if (type === 'multi-select') {
      const m = buildMulti(rng, rng.shuffle(pool), optionCount, 1);
      return { type, stem: head, instruction: INSTRUCTION.multi, options: m.options, correctAnswer: m.correctAnswer, explanation: base + meaning + reasonsNote(m.reasons) };
    }
    const right = rng.pick(pool.filter((s) => s.correct));
    const mcq = buildMcq(rng, { text: right.text }, rng.shuffle(pool.filter((s) => !s.correct)).map((s) => ({ text: s.text, why: s.why })), { count: optionCount });
    return choice(head, mcq, `${base}${meaning}\nThe correct statement: ${right.text} Indeed, ${right.why}`);
  },
};

export const TEMPLATES: Template[] = [tInterval, proportion, sampleSize, interpretation];
