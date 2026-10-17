// Templates for the topic "Hypothesis tests" (QM1 past exams: H0/HA about the population parameter, which test fits
// (one-proportion z or one-sample t, one- or two-sided), which expression is the z statistic of a proportion test,
// the value of t, "which gives the P-value" (P(t > ...) with df = n − 1, doubled when two-sided), P-value intervals
// from Table Z, and what a P-value means). Also: P-value bounds from the columns of Table T, the critical value t*,
// the decision at α with the conclusion in context, and the duality of a two-sided test and a confidence interval.
// Every key is computed in code (stats.ts: Table Z, Table T, tCdf); wrong options come from modelled mistakes.
// Independent checks: hypothesis-tests.test.ts.
import { buildMatching, buildMcq, buildMulti, fixed, INSTRUCTION, mistakesNote, num, numericField, type Choice, type Mcq } from '../build';
import type { Rng } from '../rng';
import { mean, normCdf, round, sd, tCdf, tStar, tTableDf, T_TABLE_LEVELS, zTable, type TableLevel } from '../stats';
import type { Generated, Template } from '../types';
import { acceptAround, clearZ } from './_normal';

const TOPIC = 'Hypothesis tests' as const;
export type Dir = '>' | '<' | '!=';
const OP: Record<Dir, string> = { '>': '>', '<': '<', '!=': '\\ne ' };
const WORD: Record<Dir, string> = { '>': 'more than', '<': 'less than', '!=': 'different from' };
const flip = (d: Dir): Dir => (d === '>' ? '<' : d === '<' ? '>' : '!=');
const pct = (p: number) => `${num(100 * p, 2)}%`;
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const reasonsNote = (rs: { id: string; correct: boolean; why: string }[]) =>
  '\n\n**Statement by statement**\n' + rs.map((r) => `- **${r.id}** ${r.correct ? '(true)' : '(false)'}: ${r.why}`).join('\n');
const choice = (stem: string, mcq: Mcq, explanation: string): Generated => ({
  type: 'single-choice',
  stem,
  options: mcq.options,
  correctAnswer: mcq.correctAnswer,
  explanation: explanation + mistakesNote(mcq.distractors),
});

// ---------- scenarios ----------

export interface Scn {
  kind: 'prop' | 'mean';
  /** Context; the argument is the hypothesised value in words ("15%", "250 ml"). */
  intro: (v: string) => string;
  who: string;
  /** The parameter in words. */
  what: string;
  /** The actor at a second mention, when "A …" → "The …" does not read well. */
  again?: string;
  dirs: Dir[];
  v0s: number[];
  items: string;
  /** Proportions: what the counted items did. */
  act?: string;
  /** Means: unit, standard deviations, decimals of ȳ; raw data step and verb (optional). */
  unit?: string;
  sds?: number[];
  dp?: number;
  raw?: number;
  measure?: string;
}

export const PS: Scn[] = [
  { kind: 'prop', intro: (v) => `Last year, ${v} of the new subscribers of a streaming service cancelled within the first month. The service has since redesigned its welcome screens.`, who: 'The marketing team', what: 'the proportion of new subscribers who cancel within the first month', dirs: ['<', '<', '!='], v0s: [0.12, 0.15, 0.18, 0.2], items: 'new subscribers', act: 'cancelled within the first month' },
  { kind: 'prop', intro: (v) => `Two years ago, ${v} of the households in a Dutch city separated their plastic waste. The city has since run an information campaign.`, who: 'The city council', what: 'the proportion of households that separate their plastic waste', dirs: ['>', '>', '!='], v0s: [0.3, 0.35, 0.4, 0.45], items: 'households', act: 'separate their plastic waste' },
  { kind: 'prop', intro: (v) => `A board-game café uses a spinner with four equally large sectors, so a fair spinner stops on the red sector ${v} of the time.`, who: 'A regular player', what: 'the proportion of spins that stop on red', dirs: ['!=', '>'], v0s: [0.25], items: 'spins', act: 'stopped on red' },
  { kind: 'prop', intro: (v) => `A tulip grower states that ${v} of its bulbs produce a flower.`, who: 'A garden centre', what: 'the proportion of the bulbs that flower', dirs: ['<'], v0s: [0.85, 0.9], items: 'bulbs', act: 'flowered' },
  { kind: 'prop', intro: (v) => `Nationally, ${v} of first-year students switch to another programme after their first year.`, who: 'A faculty board', what: "the proportion of the faculty's first-year students who switch programme", dirs: ['!=', '<'], v0s: [0.2, 0.25, 0.3], items: 'first-year students of the faculty', act: 'switched programme' },
  { kind: 'prop', intro: (v) => `According to a trade magazine, ${v} of coffee drinkers prefer plant-based milk.`, who: 'The owner of a campus café', again: 'The café owner', what: 'the proportion of her customers who prefer plant-based milk', dirs: ['>', '!='], v0s: [0.2, 0.25, 0.3], items: 'customers', act: 'preferred plant-based milk' },
  { kind: 'prop', intro: (v) => `A courier company used to deliver ${v} of its parcels in the city centre too late. It now delivers them with electric cargo bikes.`, who: 'The operations manager', what: 'the proportion of parcels delivered too late', dirs: ['<'], v0s: [0.08, 0.1, 0.12], items: 'parcels', act: 'were delivered too late' },
];

export const MS: Scn[] = [
  { kind: 'mean', intro: (v) => `A coffee machine in a university building is set to pour ${v} per cup.`, who: 'The student union', what: 'the mean amount poured per cup', dirs: ['<', '!='], v0s: [200, 250], unit: 'ml', sds: [6, 8, 10, 12], dp: 1, raw: 1, measure: 'measures the contents of', items: 'cups' },
  { kind: 'mean', intro: (v) => `A food-delivery app promises a mean delivery time of ${v}.`, who: 'A consumer website', what: 'the mean delivery time', dirs: ['>'], v0s: [25, 30, 35], unit: 'minutes', sds: [6, 8, 9, 10], dp: 1, items: 'orders' },
  { kind: 'mean', intro: (v) => `Sleep experts advise young adults to sleep ${v} per night.`, who: 'A student association', what: 'the mean number of hours that students at the university sleep per night', dirs: ['<', '!='], v0s: [8], unit: 'hours', sds: [0.8, 1, 1.2, 1.5], dp: 2, items: 'students' },
  { kind: 'mean', intro: (v) => `Bags of crisps of a popular brand are labelled as containing ${v}.`, who: 'A food inspector', what: 'the mean weight of the bags', dirs: ['!=', '<'], v0s: [125, 150, 175], unit: 'g', sds: [3, 4, 5, 6], dp: 1, raw: 1, measure: 'weighs', items: 'bags' },
  { kind: 'mean', intro: (v) => `A study app is designed around daily study sessions of ${v}.`, who: 'The developer of the app', what: 'the mean daily study time of its users', dirs: ['>', '!='], v0s: [40, 45, 60], unit: 'minutes', sds: [12, 15, 18, 20], dp: 1, items: 'users' },
  { kind: 'mean', intro: (v) => `An e-scooter is advertised with a mean range of ${v} on a full battery.`, who: 'A test magazine', what: 'the mean range on a full battery', dirs: ['<'], v0s: [40, 45, 50], unit: 'km', sds: [3, 4, 5], dp: 1, raw: 0.5, measure: 'measures the range of', items: 'fully charged scooters' },
  { kind: 'mean', intro: (v) => `A chocolate factory produces bars with a target weight of ${v}.`, who: 'The quality manager', what: 'the mean weight of the bars', dirs: ['!='], v0s: [100, 200], unit: 'g', sds: [1.5, 2, 2.5, 3], dp: 2, raw: 0.5, measure: 'weighs', items: 'bars' },
  { kind: 'mean', intro: (v) => `A bakery sells sourdough loaves with a stated weight of ${v}.`, who: 'A customer panel', what: 'the mean weight of the loaves', dirs: ['<', '!='], v0s: [750, 800], unit: 'g', sds: [15, 20, 25], dp: 1, raw: 5, measure: 'weighs', items: 'loaves' },
];
const ALL = [...PS, ...MS];
/** The actor at a second mention ("A test magazine" → "The test magazine"). */
const again = (sc: Scn) => sc.again ?? sc.who.replace(/^A /, 'The ');

const v0Text = (sc: Scn, v0: number) => (sc.kind === 'prop' ? pct(v0) : `${num(v0, 2)} ${sc.unit}`);
const claimOf = (rng: Rng, sc: Scn, d: Dir, v0: number) =>
  d === '!='
    ? `${sc.who} wants to find out whether ${sc.what} differs from ${v0Text(sc, v0)}.`
    : `${sc.who} ${rng.pick(['suspects', 'believes', 'expects'])} that ${sc.what} is ${WORD[d]} ${v0Text(sc, v0)}.`;
const sideWhy = (d: Dir) =>
  d === '!=' ? 'two-sided: the question is whether the value differs, in either direction' : `one-sided: the claim is that the value is ${WORD[d]} the hypothesised value`;
const hypTex = (par: string, v: string, d: Dir) => `$H_0:${par}=${v}$ against $H_A:${par}${OP[d]}${v}$`;

// ---------- data ----------

const N_PROP = [100, 125, 200, 250, 400, 500, 625, 1000];
/** Sample sizes whose df = n − 1 is a row of Table T. */
const N_MEAN = [9, 12, 16, 20, 25, 26, 30, 36, 41, 51, 61];

interface PD {
  p0: number;
  n: number;
  x: number;
  ph: number;
  sd0: number;
  z: number;
}
function propData(rng: Rng, sc: Scn, dir: Dir, ok: (z: number) => boolean = () => true): PD {
  for (let i = 0; i < 1000; i++) {
    const p0 = rng.pick(sc.v0s);
    const n = rng.pick(N_PROP.filter((m) => m * p0 >= 10 && m * (1 - p0) >= 10));
    const sd0 = Math.sqrt((p0 * (1 - p0)) / n);
    const sign = dir === '>' ? 1 : dir === '<' ? -1 : rng.sign();
    const x = Math.round(n * (p0 + sign * rng.step(0.7, 3.2, 0.01) * sd0));
    if (x <= 0 || x >= n) continue;
    const z = (x / n - p0) / sd0;
    if (Math.abs(z) < 0.6 || Math.abs(z) > 3.4 || !clearZ(z) || !ok(z)) continue;
    return { p0, n, x, ph: x / n, sd0, z };
  }
  throw new Error('hypothesis-tests: no suitable proportion data');
}

interface MD {
  v0: number;
  n: number;
  ybar: number;
  s: number;
  t: number;
  data?: number[];
}
function meanData(rng: Rng, sc: Scn, dir: Dir, raw: boolean, ok: (t: number, df: number) => boolean = () => true): MD {
  for (let i = 0; i < 2000; i++) {
    const v0 = rng.pick(sc.v0s);
    const sign = dir === '>' ? 1 : dir === '<' ? -1 : rng.sign();
    let n: number;
    let ybar: number;
    let s: number;
    let data: number[] | undefined;
    if (raw) {
      n = rng.int(6, 8);
      const shift = sign * rng.int(1, 3);
      data = Array.from({ length: n }, () => round(v0 + sc.raw! * (shift + rng.int(-4, 4)), 2));
      ybar = mean(data);
      s = sd(data);
      if (!(s > 0)) continue;
    } else {
      n = rng.pick(N_MEAN);
      s = rng.pick(sc.sds!);
      ybar = round(v0 + (sign * rng.step(0.8, 3.4, 0.01) * s) / Math.sqrt(n), sc.dp!);
    }
    const t = (ybar - v0) / (s / Math.sqrt(n));
    if (Math.abs(t) < 0.7 || Math.abs(t) > 3.8 || Math.sign(t) !== sign || !clearZ(t) || !ok(t, n - 1)) continue;
    return { v0, n, ybar, s, t, data };
  }
  throw new Error('hypothesis-tests: no suitable sample');
}

/** P-value of a z statistic: Table Z (z to 2 decimals, 4 decimals) or exact. */
export function zPval(z: number, d: Dir, table = true): number {
  const F = table ? zTable : normCdf;
  const zz = table ? round(z, 2) : z;
  const p = d === '>' ? 1 - F(zz) : d === '<' ? F(zz) : 2 * F(-Math.abs(zz));
  return table ? round(p, 4) : p;
}
function zPvalTex(z: number, d: Dir): string {
  const z2 = round(z, 2);
  const a = Math.abs(z2);
  if (d === '>') return `P(Z>${fixed(z2, 2)})=1-${fixed(zTable(z2), 4)}=${fixed(zPval(z, d), 4)}`;
  if (d === '<') return `P(Z<${fixed(z2, 2)})=${fixed(zTable(z2), 4)}`;
  return `2\\cdot P(Z>${fixed(a, 2)})=2\\cdot P(Z<${fixed(-a, 2)})=2\\times ${fixed(zTable(-a), 4)}=${fixed(zPval(z, d), 4)}`;
}
export const tPval = (t: number, df: number, d: Dir) => (d === '>' ? 1 - tCdf(t, df) : d === '<' ? tCdf(t, df) : 2 * (1 - tCdf(Math.abs(t), df)));
/** Critical values of the Table T row for df (columns 80%, 90%, 95%, 98%, 99%). */
const crits = (df: number) => T_TABLE_LEVELS.map((l) => tStar(l, df));
const TAILS = [0.1, 0.05, 0.025, 0.01, 0.005];

/** Index of the interval that contains p, for ascending edges: 0 = below the first edge, edges.length = above the last. */
const binOf = (p: number, edges: number[]) => edges.filter((e) => p > e).length;
const binText = (b: number, edges: number[]) =>
  b === 0 ? `$P<${edges[0]}$` : b === edges.length ? `$P>${edges[edges.length - 1]}$` : `$${edges[b - 1]}<P<${edges[b]}$`;
/** Options for "which interval contains P": the key, then mistake intervals, then the nearest other intervals. */
function binMcq(rng: Rng, key: number, mistakes: [number, string][], edges: number[], count: number, generic: string): Mcq {
  const kb = binOf(key, edges);
  const seen = new Set([kb]);
  const ds: Choice[] = [];
  for (const [p, why] of mistakes) {
    const b = binOf(p, edges);
    if (!seen.has(b)) ds.push({ text: binText(b, edges), value: b, why }), seen.add(b);
  }
  const rest = Array.from({ length: edges.length + 1 }, (_, b) => b).filter((b) => !seen.has(b)).sort((a, b) => Math.abs(a - kb) - Math.abs(b - kb));
  for (const b of rest) ds.push({ text: binText(b, edges), value: b, why: generic });
  return buildMcq(rng, { text: binText(kb, edges), value: kb }, ds, { count, order: 'ascending', epsilon: 1e-9 });
}
const conclusion = (rej: boolean, sc: Scn, d: Dir, v0: number) =>
  rej
    ? `we reject $H_0$: the data give convincing evidence that ${sc.what} is ${WORD[d]} ${v0Text(sc, v0)}.`
    : `we do not reject $H_0$: the data do not give convincing evidence that ${sc.what} is ${WORD[d]} ${v0Text(sc, v0)} (which does not prove that it equals ${v0Text(sc, v0)}).`;

// =====================================================================================================================
// 1. Setting up a test: hypotheses and the choice of test
// =====================================================================================================================

const TESTS = { pz: 'one-proportion $z$-test', mt: 'one-sample $t$-test for a mean', mz: 'one-sample $z$-test for a mean', pt: 'one-proportion $t$-test' } as const;
const testText = (k: keyof typeof TESTS, two: boolean) => `A ${two ? 'two-sided' : 'one-sided'} ${TESTS[k]}`;
const testLabel = (kind: Scn['kind'], d: Dir) =>
  kind === 'prop' ? `One-proportion $z$-test with $H_A:p${OP[d]}p_0$` : `One-sample $t$-test with $H_A:\\mu${OP[d]}\\mu_0$`;
const paramWhy = (sc: Scn) =>
  sc.kind === 'prop'
    ? `the response is a yes/no outcome for each of the ${sc.items} (a categorical variable), so the parameter is a proportion $p$`
    : `the variable is quantitative (in ${sc.unit}), so the parameter is a mean $\\mu$; $\\sigma$ is unknown and estimated by $s$, so the test statistic has a $t$-distribution`;

function setupMatching(rng: Rng): Generated {
  let picks: { sc: Scn; d: Dir; v0: number }[] = [];
  while (picks.length < 4) {
    picks = [];
    for (const sc of rng.shuffle(ALL)) {
      const d = rng.shuffle(sc.dirs).find((x) => !picks.some((p) => p.sc.kind === sc.kind && p.d === x));
      if (d && picks.length < 4) picks.push({ sc, d, v0: rng.pick(sc.v0s) });
    }
  }
  const pairs = picks.map((p) => ({ prompt: `${p.sc.intro(v0Text(p.sc, p.v0))} ${claimOf(rng, p.sc, p.d, p.v0)}`, answer: testLabel(p.sc.kind, p.d) }));
  const extra = [...(['prop', 'mean'] as const).flatMap((k) => (['>', '<', '!='] as Dir[]).map((d) => testLabel(k, d))), 'One-sample $z$-test with $H_A:\\mu\\ne \\mu_0$'];
  const m = buildMatching(rng, pairs, extra);
  const explanation =
    `Two questions decide the test: is the parameter a proportion (categorical yes/no data: one-proportion $z$-test) or a mean (quantitative data, $\\sigma$ unknown: one-sample $t$-test)? And does the claim have a direction (one-sided $H_A$ with $>$ or $<$) or not (two-sided, $\\ne$)?\n` +
    picks.map((p, i) => `- **${i + 1}.** ${testLabel(p.sc.kind, p.d)}: ${paramWhy(p.sc)}; the test is ${sideWhy(p.d)}.`).join('\n') +
    `\nA $z$-test for a mean would need the population standard deviation $\\sigma$, which is never given here.`;
  return {
    type: 'matching',
    stem: 'Match each research question with the most suitable test and alternative hypothesis ($p_0$ and $\\mu_0$ stand for the hypothesised value in that question).',
    instruction: INSTRUCTION.matching,
    prompts: m.prompts,
    choices: m.choices,
    correctAnswer: m.correctAnswer,
    explanation,
  };
}

const setup: Template = {
  id: 'hypothesis-tests.setup',
  topic: TOPIC,
  title: 'Set up a test: H0/HA about the population parameter (one- or two-sided), or which test fits (one-proportion z, one-sample t)',
  types: ['single-choice', 'matching'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    if (type === 'matching') return setupMatching(rng);
    const sc = rng.pick(ALL);
    const dir = rng.pick(sc.dirs);
    const prop = sc.kind === 'prop';
    const pd = prop ? propData(rng, sc, dir) : undefined;
    const md = prop ? undefined : meanData(rng, sc, dir, false);
    const v0 = pd ? pd.p0 : md!.v0;
    const n = pd ? pd.n : md!.n;
    const head = `${sc.intro(v0Text(sc, v0))} ${claimOf(rng, sc, dir, v0)}`;
    const two = dir === '!=';
    if (rng.chance(0.5)) {
      const par = prop ? 'p' : '\\mu';
      const V = num(v0, 2);
      const H = (p: string, h0: string, ha: string, v: string) => `$H_0:${p}${h0}${v}$ and $H_A:${p}${ha}${v}$`;
      const [o1, o2]: Dir[] = two ? ['>', '<'] : [flip(dir), '!='];
      const data = pd
        ? `In a random sample of ${n} ${sc.items}, ${pd.x} ${sc.act}.`
        : `A random sample of $n=${n}$ ${sc.items} gives a sample mean of $\\bar y=${num(md!.ybar, 2)}$ ${sc.unit} and a standard deviation of $s=${num(md!.s, 2)}$ ${sc.unit}.`;
      const oneWhy = 'makes the test one-sided, but the question gives no direction.';
      const mcq = buildMcq(
        rng,
        { text: H(par, '=', OP[dir], V) },
        [
          { text: H(par, OP[dir], '=', V), why: 'swaps the hypotheses: the equality (status quo) belongs in $H_0$, the claim to be shown in $H_A$.' },
          { text: H(prop ? '\\hat p' : '\\bar y', '=', OP[dir], V), why: 'writes the hypotheses about the sample statistic; hypotheses are always about the population parameter.' },
          { text: H(par, '=', OP[o1], V), why: two ? oneWhy : 'uses the wrong direction for $H_A$.' },
          { text: H(par, '=', OP[o2], V), why: two ? oneWhy : `ignores the direction: the claim (${WORD[dir]}) makes the test one-sided.` },
          { text: H(par, '=', OP[dir], prop ? num(pd!.ph, 4) : num(md!.ybar, 2)), why: 'uses the sample result as the hypothesised value; that value comes from the claim, not from the data.' },
          { text: H(prop ? '\\mu' : 'p', '=', OP[dir], V), why: `uses the wrong parameter: here it is a ${prop ? 'proportion $p$' : 'mean $\\mu$'}.` },
        ],
        { count: optionCount },
      );
      const explanation =
        `Hypotheses are statements about the **population** parameter, here ${prop ? `the proportion $p$ (${sc.what})` : `the mean $\\mu$ (${sc.what})`}, never about the sample statistic. ` +
        `$H_0$ contains the equality with the hypothesised value ${v0Text(sc, v0)}; $H_A$ contains the claim, which is ${sideWhy(dir)}.\n` +
        `So: ${H(par, '=', OP[dir], V)}. The sample result is only used later, to compute the test statistic.`;
      return choice(`${head}\n${data}\nWhat are the appropriate null and alternative hypotheses?`, mcq, explanation);
    }
    const k = prop ? 'pz' : 'mt';
    const other = prop ? 'mt' : 'pz';
    const odd = prop ? 'pt' : 'mz';
    const sideMiss = two ? 'the question asks whether the value differs, without a direction, so the test is two-sided.' : `the claim has a direction (${WORD[dir]}), so the test is one-sided.`;
    const oddWhy = prop
      ? 'a test for a proportion uses $z$: under $H_0$ the standard deviation $\\sqrt{p_0(1-p_0)/n}$ is known, so no $t$-distribution is involved.'
      : 'a $z$-test for a mean needs the population standard deviation $\\sigma$; it is unknown and estimated by $s$, so the statistic has a $t$-distribution.';
    const kindMiss = prop ? 'the data are yes/no outcomes, so the parameter is a proportion, not a mean.' : `the data are measurements in ${sc.unit}, so the parameter is a mean, not a proportion.`;
    const mcq = buildMcq(
      rng,
      { text: testText(k, two) },
      [
        { text: testText(k, !two), why: sideMiss },
        { text: testText(other, two), why: kindMiss },
        { text: testText(odd, two), why: oddWhy },
        { text: testText(other, !two), why: `${kindMiss} Also, ${sideMiss}` },
        { text: testText(odd, !two), why: `${oddWhy} Also, ${sideMiss}` },
      ],
      { count: optionCount },
    );
    const explanation =
      `The parameter: ${paramWhy(sc)}. So the test is a ${TESTS[k]}.\n` +
      `The alternative: ${sideWhy(dir)} ($H_A:${prop ? 'p' : '\\mu'}${OP[dir]}${num(v0, 2)}$).\nAnswer: ${lc(testText(k, two))}.`;
    return choice(`${head}\nThe data will come from a random sample of ${prop ? n : `$n=${n}$`} ${sc.items}. Which test is the most suitable here?`, mcq, explanation);
  },
};

// =====================================================================================================================
// 2. One-proportion z-test
// =====================================================================================================================

const propZ: Template = {
  id: 'hypothesis-tests.proportion-z',
  topic: TOPIC,
  title: 'One-proportion z-test: which expression is z, P-value interval (Table Z), decision and conclusion at α, or z and P as numbers',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const sc = rng.pick(PS);
    const dir = rng.pick(sc.dirs);
    const variant = type === 'numeric' ? 'numeric' : rng.pick(['formula', 'pbin', 'conclusion'] as const);
    const alpha = rng.pick([0.05, 0.05, 0.01, 0.1]);
    const edges = optionCount === 5 ? [0.01, 0.025, 0.05, 0.1] : [0.01, 0.05, 0.1];
    const far = (p: number, cuts: number[], r: number) => cuts.every((c) => Math.abs(p / c - 1) > r);
    const d = propData(rng, sc, dir, (z) => {
      const ps = [zPval(z, dir), zPval(z, dir, false)];
      if (variant === 'pbin') return ps.every((p) => far(p, edges, 0.1));
      if (variant === 'conclusion') return ps.every((p) => far(p, [alpha], 0.15));
      return true;
    });
    const { p0, n, x, ph, sd0, z } = d;
    const P = zPval(z, dir);
    const Px = zPval(z, dir, false);
    const P0 = num(p0, 2);
    const head = `${sc.intro(pct(p0))} ${claimOf(rng, sc, dir, p0)}\nIn a random sample of ${n} ${sc.items}, ${x} ${sc.act}.`;
    const hyp = hypTex('p', P0, dir);
    const work =
      `**Hypotheses.** ${hyp}; the test is ${sideWhy(dir)}.\n` +
      `**Conditions.** Random sample; $np_0=${num(n * p0, 2)}\\ge 10$ and $n(1-p_0)=${num(n * (1 - p0), 2)}\\ge 10$.\n` +
      `**Test statistic.** $\\hat p=\\frac{${x}}{${n}}=${num(ph, 4)}$. Under $H_0$ the standard deviation of $\\hat p$ uses the null value $p_0$: ` +
      `$$SD(\\hat p)=\\sqrt{\\frac{p_0(1-p_0)}{n}}=\\sqrt{\\frac{${P0}\\cdot ${num(1 - p0, 2)}}{${n}}}=${num(sd0, 5)}$$` +
      `$$z=\\frac{\\hat p-p_0}{SD(\\hat p)}=\\frac{${num(ph, 4)}-${P0}}{${num(sd0, 5)}}=${num(z, 4)}\\approx ${fixed(z, 2)}$$` +
      `**P-value** (Table Z): $P=${zPvalTex(z, dir)}$. (Without rounding $z$: ${fixed(Px, 4)}.)`;
    if (variant === 'numeric') {
      // a student who first rounds SD(p̂) to 4 decimals can end 0.01 away in z (and so read another Table Z entry)
      const zAlt = (ph - p0) / round(sd0, 4);
      const altNote =
        round(zAlt, 2) !== round(z, 2)
          ? `\n(With $SD(\\hat p)$ rounded to ${fixed(sd0, 4)} first: $z\\approx ${fixed(zAlt, 2)}$ and $P=${fixed(zPval(zAlt, dir), 4)}$; these answers are accepted too.)`
          : '';
      return {
        type,
        stem: `${head}\n${again(sc)} tests ${hyp}. Compute the test statistic $z$ and the P-value (use Table Z).`,
        instruction: 'Instruction: fill in every box: $z$ with 2 decimals and the P-value with 4 decimals. To separate decimals, use a dot and not a comma (example: 0.51 instead of 0,51)!',
        fields: [numericField('z', 'Test statistic $z$', z, 2, acceptAround(2, z, zAlt)), numericField('p', 'P-value', P, 4, acceptAround(4, P, Px, zPval(zAlt, dir)))],
        explanation: `${work}${altNote}\nAt $\\alpha=0.05$, ${conclusion(P < 0.05, sc, dir, p0)}`,
      };
    }
    if (variant === 'formula') {
      const Q0 = num(1 - p0, 2);
      const Ph = num(ph, 4);
      const Qh = num(1 - ph, 4);
      const f = (a: string, b: string, c: string, e: string) => `$z=\\dfrac{${a}-${b}}{\\sqrt{\\dfrac{${c}\\cdot ${e}}{${n}}}}$`;
      const zh = (ph - p0) / Math.sqrt((ph * (1 - ph)) / n);
      const mcq = buildMcq(
        rng,
        { text: f(Ph, P0, P0, Q0), value: z },
        [
          { text: f(P0, Ph, P0, Q0), value: -z, why: 'subtracts the observed proportion from the hypothesised one (the wrong sign).' },
          { text: f(Ph, P0, Ph, Qh), value: zh, why: 'uses $\\hat p$ in the standard deviation; a test computes it under $H_0$, with $p_0$.' },
          { text: f(P0, Ph, Ph, Qh), value: -zh, why: 'reverses the numerator and uses $\\hat p$ in the standard deviation.' },
          { text: `$z=\\dfrac{${Ph}-${P0}}{\\dfrac{${P0}\\cdot ${Q0}}{${n}}}$`, value: (ph - p0) / ((p0 * (1 - p0)) / n), why: 'forgets the square root in the standard deviation.' },
          { text: `$z=\\dfrac{${x}-${num(n * p0, 2)}}{\\sqrt{${n}\\cdot ${Ph}\\cdot ${Qh}}}$`, value: zh, why: 'works with counts but uses $\\hat p$ instead of $p_0$ in the standard deviation.' },
        ],
        { count: optionCount, epsilon: 1e-6 },
      );
      return choice(`${head}\n${again(sc)} tests ${hyp}. Which expression gives the value of the test statistic?`, mcq, work);
    }
    if (variant === 'pbin') {
      const zh = (ph - p0) / Math.sqrt((ph * (1 - ph)) / n);
      const ms: [number, string][] = [
        dir === '!=' ? [P / 2, 'forgets to double the tail area for the two-sided alternative.'] : [Math.min(1, 2 * P), 'doubles the tail area although the alternative is one-sided.'],
        [zPval(zh, dir), 'uses $\\hat p$ instead of $p_0$ in the standard deviation.'],
        [dir === '!=' ? 1 - P / 2 : 1 - P, 'takes the area on the wrong side of $z$.'],
      ];
      const showHyp = rng.chance(0.5);
      const mcq = binMcq(rng, P, ms, edges, optionCount, `does not match $z\\approx${fixed(z, 2)}$: read the tail area from Table Z again.`);
      return choice(`${head}\n${showHyp ? `${again(sc)} tests ${hyp}. ` : 'Carry out the appropriate test. '}Which interval contains the P-value?`, mcq, work);
    }
    const rej = P < alpha;
    const V = pct(p0);
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const keyText = cap(conclusion(rej, sc, dir, p0)).replace(/ \(which does not prove.*\)\./, '.');
    const otherText = cap(conclusion(!rej, sc, dir, p0)).replace(/ \(which does not prove.*\)\./, '.');
    const flipWhy = rej
      ? `does not reject although $P=${fixed(P, 4)}<\\alpha=${alpha}$: $H_0$ is rejected when the P-value is smaller than $\\alpha$.`
      : dir === '!=' && P / 2 < alpha
        ? `forgets to double the tail area: $P/2=${fixed(P / 2, 4)}<\\alpha$, but the two-sided P-value is $${fixed(P, 4)}\\ge\\alpha$.`
        : `rejects although $P=${fixed(P, 4)}\\ge\\alpha=${alpha}$ (compares the P-value with $\\alpha$ the wrong way round).`;
    const mcq = buildMcq(
      rng,
      { text: keyText },
      [
        { text: otherText, why: flipWhy },
        { text: `We accept $H_0$: the data prove that ${sc.what} is ${V}.`, why: 'a test never proves $H_0$; at most the data give too little evidence against it.' },
        dir === '!='
          ? { text: `We reject $H_0$: the data give convincing evidence that ${sc.what} is ${V}.`, why: 'mixes up the hypotheses: rejecting $H_0$ is evidence against $p=p_0$.' }
          : { text: `We reject $H_0$: the data give convincing evidence that ${sc.what} is ${WORD[flip(dir)]} ${V}.`, why: 'concludes in the wrong direction.' },
        { text: `We reject $H_0$: the data prove that ${sc.what} is exactly ${pct(ph)}.`, why: 'the sample proportion is only an estimate; a test never proves the parameter equals it.' },
      ],
      { count: optionCount },
    );
    return choice(
      `${head}\n${again(sc)} tests ${hyp} at significance level $\\alpha=${alpha}$. Which conclusion is correct?`,
      mcq,
      `${work}\n**Decision.** ${rej ? `$P<\\alpha=${alpha}$` : `$P\\ge\\alpha=${alpha}$`}, so ${conclusion(rej, sc, dir, p0)}`,
    );
  },
};

// =====================================================================================================================
// 3. One-sample t-test for a mean
// =====================================================================================================================

interface PE {
  f: number;
  dist: 't' | 'z';
  tail: '>' | '<';
  c: number;
  df: number;
}
const peText = (e: PE) => `$${e.f === 1 ? '' : num(e.f, 1)}P(${e.dist}${e.tail}${fixed(e.c, 2)})$${e.dist === 't' ? ` with $df=${e.df}$` : ''}`;
const peValue = (e: PE) => {
  const F = e.dist === 't' ? (v: number) => tCdf(v, e.df) : normCdf;
  return e.f * (e.tail === '>' ? 1 - F(e.c) : F(e.c));
};
const levelFor = (alpha: number, two: boolean) => round(two ? 1 - alpha : 1 - 2 * alpha, 2) as TableLevel;

const meanT: Template = {
  id: 'hypothesis-tests.mean-t',
  topic: TOPIC,
  title: 'One-sample t-test: value of t, which expression gives the P-value, P-value bounds from Table T, or t and the critical value t*',
  types: ['single-choice', 'numeric'],
  difficulty: 3,
  generate({ rng, type, optionCount }) {
    const sc = rng.pick(MS);
    const dir = rng.pick(sc.dirs);
    const two = dir === '!=';
    const variant = type === 'numeric' ? 'numeric' : rng.pick(['pexpr', 'tvalue', 'pbounds'] as const);
    const raw = !!sc.raw && variant !== 'pbounds' && rng.chance(0.35);
    const alpha = rng.pick([0.05, 0.05, 0.01, 0.1]);
    const tcrit = (df: number) => tStar(levelFor(alpha, two), df);
    const d = meanData(rng, sc, dir, raw, (t, df) => {
      if (variant === 'pbounds') return crits(df).every((c) => Math.abs(Math.abs(t) - c) > 0.04);
      if (variant === 'numeric') return Math.abs(Math.abs(t) - tcrit(df)) > 0.05;
      return true;
    });
    const { v0, n, ybar, s, t } = d;
    const df = n - 1;
    const tr = round(t, 2);
    const V = num(v0, 2);
    const se = s / Math.sqrt(n);
    const hyp = hypTex('\\mu', V, dir);
    const head =
      `${sc.intro(v0Text(sc, v0))} ${claimOf(rng, sc, dir, v0)}\n` +
      (d.data
        ? `${again(sc)} ${sc.measure} $n=${n}$ randomly chosen ${sc.items}. The results (in ${sc.unit}) are:\n${d.data.map((v) => num(v, 2)).join(', ')}`
        : `In a random sample of $n=${n}$ ${sc.items}, the sample mean is $\\bar y=${num(ybar, 2)}$ ${sc.unit} and the sample standard deviation is $s=${num(s, 2)}$ ${sc.unit}.`) +
      (n < 30 ? '\nAssume that the population distribution is approximately Normal.' : '');
    const P = tPval(t, df, dir);
    const pTex = two ? `2\\cdot P(t_{${df}}>${fixed(Math.abs(tr), 2)})` : `P(t_{${df}}${dir}${fixed(tr, 2)})`;
    const work =
      `**Hypotheses.** ${hyp}; the test is ${sideWhy(dir)}.\n` +
      (d.data
        ? `**Sample statistics.** $\\bar y=\\frac{${num(d.data.reduce((a, b) => a + b, 0), 2)}}{${n}}=${num(ybar, 4)}$ and $s=\\sqrt{\\frac{\\sum(y-\\bar y)^2}{n-1}}=${num(s, 4)}$.\n`
        : '') +
      `**Test statistic.** $\\sigma$ is unknown, so we use a one-sample $t$-test with $df=n-1=${df}$: ` +
      `$$t=\\frac{\\bar y-\\mu_0}{s/\\sqrt n}=\\frac{${num(ybar, 4)}-${V}}{${num(s, 4)}/\\sqrt{${n}}}=\\frac{${num(ybar - v0, 4)}}{${num(se, 4)}}=${num(t, 4)}\\approx ${fixed(tr, 2)}$$` +
      `**P-value.** $P=${pTex}$${two ? ' (both tails count)' : ` (the tail in the direction of $H_A$)`}.`;
    if (variant === 'pexpr' || variant === 'tvalue') {
      const stem = `${head}\n${again(sc)} tests ${hyp} at significance level $\\alpha=${alpha}$. ${variant === 'pexpr' ? 'Which expression gives the P-value of this test?' : 'What is the value of the test statistic?'}`;
      if (variant === 'tvalue') {
        const raw2: [number, string][] = [
          [(ybar - v0) / s, 'divides by $s$ instead of by the standard error $s/\\sqrt n$.'],
          [(ybar - v0) / (s / n), 'divides $s$ by $n$ instead of by $\\sqrt n$.'],
          [-t, 'subtracts the sample mean from the hypothesised mean (wrong sign).'],
          [(ybar - v0) / (s / Math.sqrt(n - 1)), 'divides $s$ by $\\sqrt{n-1}$ instead of by $\\sqrt n$.'],
          [(ybar - v0) / ((s * s) / Math.sqrt(n)), 'uses the variance $s^2$ instead of the standard deviation $s$.'],
        ];
        const farFrom = (v: number) => Math.abs(v - tr) >= Math.max(0.05, 0.03 * Math.abs(tr));
        const ds = raw2.filter(([v]) => farFrom(round(v, 2))).map(([v, why]): Choice => ({ text: fixed(v, 2), value: round(v, 2), why }));
        const mcq = buildMcq(rng, { text: fixed(tr, 2), value: tr }, ds, {
          count: optionCount,
          order: 'ascending',
          epsilon: 1e-6,
          fallback: (i) => {
            const v = round(tr * (1 + (i % 2 ? -1 : 1) * 0.35 * (1 + Math.floor(i / 2))), 2);
            return { text: fixed(v, 2), value: farFrom(v) ? v : NaN, why: 'a calculation error.' };
          },
        });
        return choice(stem, mcq, work);
      }
      const key: PE = two ? { f: 2, dist: 't', tail: '>', c: Math.abs(tr), df } : { f: 1, dist: 't', tail: dir as '>' | '<', c: tr, df };
      const sidedWhy = two ? 'forgets to double the tail area for the two-sided alternative.' : 'doubles the tail area although the alternative is one-sided.';
      const cands: [PE, string][] = [
        [{ ...key, df: n }, 'uses $df=n$ instead of $df=n-1$.'],
        [{ ...key, f: two ? 1 : 2 }, sidedWhy],
        [{ ...key, dist: 'z' }, 'uses the standard Normal model, but with $\\sigma$ estimated by $s$ the statistic has a $t$-distribution.'],
        two ? [{ ...key, f: 0.5 }, 'halves the tail area instead of doubling it.'] : [{ ...key, tail: key.tail === '>' ? '<' : '>' }, 'takes the area on the wrong side of the observed $t$.'],
        [{ ...key, f: two ? 1 : 2, df: n }, `${sidedWhy} It also uses $df=n$.`],
        [{ ...key, dist: 'z', f: two ? 1 : 2 }, `uses $z$ instead of $t$, and ${sidedWhy}`],
      ];
      const mcq = buildMcq(
        rng,
        { text: peText(key), value: peValue(key) },
        cands.map(([e, why]) => ({ text: peText(e), value: peValue(e), why })),
        { count: optionCount, epsilon: 1e-7 },
      );
      return choice(stem, mcq, `${work} The answer is ${peText(key)}.`);
    }
    if (variant === 'numeric') {
      const lvl = levelFor(alpha, two);
      const ts = tcrit(df);
      const rej = two ? Math.abs(t) > ts : dir === '>' ? t > ts : t < -ts;
      // raw data: a student who rounds ȳ and s to 2 (or 3) decimals before computing t may end a little away
      const tAlt = [2, 3].map((k) => (round(ybar, k) - v0) / (round(s, k) / Math.sqrt(n)));
      const tRange = d.data ? acceptAround(2, t, ...tAlt) : undefined;
      const altNote =
        tRange && round(tAlt[0], 2) !== tr
          ? `\n(With $\\bar y$ and $s$ rounded to 2 decimals first, $t\\approx ${fixed(tAlt[0], 2)}$; answers from ${fixed(Math.ceil(tRange[0] * 100 - 1e-9) / 100, 2)} to ${fixed(Math.floor(tRange[1] * 100 + 1e-9) / 100, 2)} are accepted.)`
          : '';
      return {
        type,
        stem: `${head}\n${again(sc)} tests ${hyp} at significance level $\\alpha=${alpha}$. Give the test statistic $t$ and the critical value $t^*$ from Table T (as a positive number).`,
        instruction: 'Instruction: fill in every box: $t$ with 2 decimals and $t^*$ with 3 decimals. To separate decimals, use a dot and not a comma (example: 0.51 instead of 0,51)!',
        fields: [numericField('t', 'Test statistic $t$', t, 2, tRange), numericField('tstar', 'Critical value $t^*$', ts, 3)],
        explanation:
          work +
          altNote +
          `\n**Critical value.** ${two ? `Two-sided, $\\alpha=${alpha}$: ${alpha / 2} in each tail` : `One-sided, $\\alpha=${alpha}$ in one tail`}, so the column for ${Math.round(lvl * 100)}% confidence; row $df=${df}$: $t^*=${fixed(ts, 3)}$.\n` +
          `**Decision.** ${two ? `$|t|=${fixed(Math.abs(tr), 2)}$ ${rej ? '>' : '<'} ${fixed(ts, 3)}` : `$t=${fixed(tr, 2)}$ ${rej ? 'lies' : 'does not lie'} beyond $${dir === '>' ? '' : '-'}${fixed(ts, 3)}$`}, so ${conclusion(rej, sc, dir, v0)}`,
      };
    }
    // pbounds: bracket the P-value between the columns of Table T
    const edges = TAILS.map((a) => round(two ? 2 * a : a, 3)).reverse();
    const cr = crits(df);
    const k = cr.filter((c) => Math.abs(t) > c).length;
    const ms: [number, string][] = [
      [two ? P / 2 : Math.min(1, 2 * P), two ? 'uses the one-sided tail areas of Table T for a two-sided test.' : 'doubles the tail areas although the test is one-sided.'],
      [two ? 2 * (1 - normCdf(Math.abs(t))) : dir === '>' ? 1 - normCdf(t) : normCdf(t), 'uses the standard Normal model (the $\\infty$ row) instead of $df=n-1$.'],
      [two ? 1 - P / 2 : 1 - P, 'takes the area on the wrong side of $t$.'],
    ];
    // Table T gives 5 edges (6 intervals); the options use optionCount − 1 consecutive edges, so that they cover every
    // possible P-value without gaps (as in the past exams). Prefer the window that keeps most mistakes apart from the key,
    // then one in which the key is the exact bracket between two adjacent columns of Table T.
    const windows = Array.from({ length: edges.length - optionCount + 2 }, (_, i) => edges.slice(i, i + optionCount - 1));
    const exact = binText(binOf(P, edges), edges);
    const score = (w: number[]) => 2 * new Set([P, ...ms.map(([p]) => p)].map((p) => binOf(p, w))).size + (binText(binOf(P, w), w) === exact ? 1 : 0);
    const best = Math.max(...windows.map(score));
    const win = rng.pick(windows.filter((w) => score(w) === best));
    const mcq = binMcq(rng, P, ms, win, optionCount, `would need $|t|$ in another place between the critical values of the row $df=${df}$.`);
    const showHyp = rng.chance(0.5);
    const cols = cr.map((c, i) => `${fixed(c, 3)} (${two ? 'two' : 'one'}-sided ${round(two ? 2 * TAILS[i] : TAILS[i], 3)})`).join(', ');
    const where =
      k === 0
        ? `is smaller than ${fixed(cr[0], 3)}, so $P>${edges[4]}$`
        : k === 5
          ? `is larger than ${fixed(cr[4], 3)}, so $P<${edges[0]}$`
          : `lies between ${fixed(cr[k - 1], 3)} and ${fixed(cr[k], 3)}, so $${edges[4 - k]}<P<${edges[5 - k]}$`;
    const keyText = binText(binOf(P, win), win);
    return choice(
      `${head}\n${showHyp ? `${again(sc)} tests ${hyp}. ` : 'Carry out the appropriate test. '}Using Table T, which interval contains the P-value?`,
      mcq,
      `${work}\n**Table T**, row $df=${tTableDf(df)}$: ${cols}. $|t|=${fixed(Math.abs(tr), 2)}$ ${where}${keyText !== exact ? `, which lies in the option ${keyText}` : ''}.`,
    );
  },
};

// =====================================================================================================================
// 4. P-values: meaning, decisions at several α, and the link with confidence intervals
// =====================================================================================================================

const pvalueCi: Template = {
  id: 'hypothesis-tests.p-value-ci',
  topic: TOPIC,
  title: 'Meaning of a P-value in context, which μ0 a two-sided test rejects given a confidence interval, or statements about a reported P-value',
  types: ['single-choice', 'multi-select'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    if (type === 'single-choice' && rng.chance(0.5)) {
      const sc = rng.pick(PS);
      const dir = rng.pick(sc.dirs.filter((x) => x !== '!='));
      const { p0, n, x, ph, z } = propData(rng, sc, dir, (zz) => zPval(zz, dir) > 0.002 && zPval(zz, dir) < 0.3);
      const P = zPval(z, dir);
      const Pp = pct(P);
      const V = pct(p0);
      const Ph = pct(ph);
      const more = dir === '>' ? 'or more' : 'or less';
      const sample = `a random sample of ${n} ${sc.items} would give a sample proportion of ${Ph} ${more}`;
      const mcq = buildMcq(
        rng,
        { text: `If ${sc.what} is really ${V}, ${sample} with probability ${Pp}.` },
        [
          { text: `The probability that ${sc.what} is ${V} is ${Pp}.`, why: 'a P-value is not the probability that $H_0$ is true: it is computed assuming that $H_0$ is true.' },
          { text: `The probability that ${sc.what} is ${WORD[dir]} ${V} is ${Pp}.`, why: 'a P-value is not the probability that $H_A$ is true.' },
          { text: `The probability that ${sc.what} is ${WORD[dir]} ${V} is ${pct(round(1 - P, 4))}.`, why: '$1-P$ is not the probability that $H_A$ is true either.' },
          { text: `Given that the sample proportion is ${Ph}, the probability that ${sc.what} is still ${V} is ${Pp}.`, why: 'reverses the condition: the P-value is about the data given $H_0$, not about $H_0$ given the data.' },
          { text: `Whatever ${sc.what} is, ${sample} with probability ${Pp}.`, why: 'leaves out the condition: this probability depends on the true proportion, and the P-value assumes $p=p_0$.' },
        ],
        { count: optionCount },
      );
      const explanation =
        `The P-value is computed **assuming $H_0$ is true** ($p=${num(p0, 2)}$): it is the probability of a sample result at least as extreme as the one observed, in the direction of $H_A$. ` +
        `Here $z=\\frac{${num(ph, 4)}-${num(p0, 2)}}{\\sqrt{${num(p0, 2)}\\cdot ${num(1 - p0, 2)}/${n}}}\\approx ${fixed(z, 2)}$ and $P=${zPvalTex(z, dir)}$. ` +
        `So: if ${sc.what} is really ${V}, ${sample} with probability ${Pp}. It says nothing directly about the probability that $H_0$ or $H_A$ is true.`;
      return choice(
        `${sc.intro(V)} ${claimOf(rng, sc, dir, p0)} ${again(sc)} tests ${hypTex('p', num(p0, 2), dir)}.\nIn a random sample of ${n} ${sc.items}, ${x} ${sc.act} (a sample proportion of ${Ph}), which gives a P-value of ${fixed(P, 4)}.\nWhich statement correctly interprets this P-value?`,
        mcq,
        explanation,
      );
    }
    const sc = rng.pick(MS);
    const dp = sc.dp!;
    if (type === 'single-choice') {
      const n = rng.pick(N_MEAN);
      const s = rng.pick(sc.sds!);
      const v0 = rng.pick(sc.v0s);
      const ybar = round(v0 + (rng.sign() * rng.step(0, 2, 0.1) * s) / Math.sqrt(n), dp);
      const C = rng.pick([0.9, 0.95, 0.99] as TableLevel[]);
      const ts = tStar(C, n - 1);
      const me = (ts * s) / Math.sqrt(n);
      const L = round(ybar - me, dp);
      const U = round(ybar + me, dp);
      const w = U - L;
      const a = round(1 - C, 2);
      const reject = rng.chance(0.5);
      const at = (f: number) => round(L + f * w, dp);
      const inside = rng.shuffle([0.12, 0.3, 0.5, 0.7, 0.88]).map(at);
      const outside = rng.shuffle([-0.5, -0.25, -0.08, 1.08, 1.25, 1.5]).map(at);
      const insideWhy = (v: number) =>
        Math.abs(v - (L + U) / 2) < 10 ** -dp ? 'is the centre of the interval (the sample mean): the most plausible value, never rejected.' : `lies inside the interval: a plausible value for $\\mu$, so $H_0$ is not rejected.`;
      const opt = (v: number, why?: string): Choice => ({ text: `$\\mu_0=${fixed(v, dp)}$`, value: v, ...(why ? { why } : {}) });
      const mcq = reject
        ? buildMcq(rng, opt(outside[0]), inside.map((v) => opt(v, insideWhy(v))), { count: optionCount, order: 'ascending', epsilon: 1e-9 })
        : buildMcq(rng, opt(inside[0]), outside.map((v) => opt(v, `lies outside the interval, so the two-sided test at $\\alpha=${a}$ rejects it.`)), { count: optionCount, order: 'ascending', epsilon: 1e-9 });
      const keyV = reject ? outside[0] : inside[0];
      const explanation =
        `A two-sided test at significance level $\\alpha$ rejects $H_0:\\mu=\\mu_0$ exactly when $\\mu_0$ lies **outside** the $(1-\\alpha)\\cdot 100\\%$ confidence interval. ` +
        `Here $\\alpha=${a}$ matches the ${Math.round(C * 100)}% interval from ${fixed(L, dp)} to ${fixed(U, dp)} ${sc.unit}.\n` +
        `$\\mu_0=${fixed(keyV, dp)}$ is the only option ${reject ? 'outside' : 'inside'} the interval, so it is the only value for which $H_0$ is ${reject ? '' : 'not '}rejected.`;
      return choice(
        `${sc.intro(v0Text(sc, v0))} Based on a random sample of $n=${n}$ ${sc.items}, a ${Math.round(C * 100)}% confidence interval for ${sc.what} runs from ${fixed(L, dp)} to ${fixed(U, dp)} ${sc.unit}.\n` +
          `With the same data, a two-sided test of $H_0:\\mu=\\mu_0$ against $H_A:\\mu\\ne\\mu_0$ is carried out at $\\alpha=${a}$ for several values of $\\mu_0$. For which value is $H_0$ ${reject ? '' : '**not** '}rejected?`,
        mcq,
        explanation,
      );
    }
    // multi-select: statements about a reported two-sided P-value
    const C = rng.pick([0.9, 0.95, 0.99] as TableLevel[]);
    const ciOf = (C: TableLevel, md: { n: number; ybar: number; s: number }) => {
      const me = (tStar(C, md.n - 1) * md.s) / Math.sqrt(md.n);
      return [md.ybar - me, md.ybar + me];
    };
    const md = meanData(rng, sc, '!=', false, (t, df) => {
      const P = tPval(t, df, '!=');
      const levels = [0.9, 0.95, 0.99] as TableLevel[];
      return P > 0.002 && P < 0.5 && levels.every((c) => Math.abs(P / (1 - c) - 1) > 0.15 && (Math.abs(t) <= tStar(c, df)) === P >= 1 - c);
    });
    const { v0, n, ybar, s, t } = md;
    const P = round(tPval(t, n - 1, '!='), 4);
    const V = num(v0, 2);
    const sts: { text: string; correct: boolean; why: string }[] = [];
    for (const a of rng.sample([0.01, 0.05, 0.1], 2))
      sts.push({ text: `At significance level $\\alpha=${a}$, $H_0$ is rejected.`, correct: P < a, why: P < a ? `$P=${fixed(P, 4)}<${a}$.` : `$P=${fixed(P, 4)}\\ge ${a}$, so $H_0$ is not rejected.` });
    const [lo, hi] = ciOf(C, md);
    const inCi = lo <= v0 && v0 <= hi;
    sts.push({
      text: `The ${Math.round(C * 100)}% confidence interval for $\\mu$ based on these data contains ${V}.`,
      correct: inCi,
      why: `The interval is $${num(ybar, 2)}\\pm ${fixed(tStar(C, n - 1), 3)}\\cdot\\frac{${num(s, 2)}}{\\sqrt{${n}}}$, i.e. from ${num(lo, 3)} to ${num(hi, 3)}: it ${inCi ? 'contains' : 'does not contain'} ${V}, in line with $P${inCi ? '\\ge' : '<'}${round(1 - C, 2)}$.`,
    });
    const dr = rng.pick(['>', '<'] as const);
    const oneOk = (t > 0) === (dr === '>');
    sts.push({
      text: `With the one-sided alternative $H_A:\\mu${dr}${V}$, the P-value would be ${fixed(P / 2, 4)}.`,
      correct: oneOk,
      why: oneOk ? 'The sample mean lies on the side of this $H_A$, so the one-sided P-value is half the two-sided one.' : `The sample mean lies on the other side, so the one-sided P-value would be $1-P/2=${fixed(1 - P / 2, 4)}$.`,
    });
    sts.push(
      { text: `The probability that $H_0$ is true is ${fixed(P, 4)}.`, correct: false, why: 'The P-value is computed assuming $H_0$ is true; it is not the probability that $H_0$ is true.' },
      { text: `There is a ${pct(round(1 - P, 4))} probability that $\\mu\\ne ${V}$.`, correct: false, why: '$1-P$ is not the probability that $H_A$ is true.' },
      {
        text: `If $\\mu$ were really ${V} ${sc.unit}, a sample mean at least as far from ${V} as ${num(ybar, 2)} (in either direction) would occur in about ${pct(P)} of random samples of ${n} ${sc.items}.`,
        correct: true,
        why: 'This is exactly what the two-sided P-value measures.',
      },
      { text: `If $H_0$ is not rejected, this proves that $\\mu=${V}$.`, correct: false, why: 'Not rejecting $H_0$ only means the data are consistent with it; it never proves $H_0$.' },
      {
        text: `The P-value is the probability that the sample mean equals exactly ${num(ybar, 2)} if $H_0$ is true.`,
        correct: false,
        why: 'The P-value is the probability of a result **at least as extreme** as the observed one, not of exactly this value.',
      },
      { text: 'Testing at $\\alpha=0.01$ instead of $\\alpha=0.05$ would make it easier to reject $H_0$.', correct: false, why: 'A smaller $\\alpha$ demands stronger evidence ($P<0.01$), so rejecting becomes harder.' },
      { text: 'With the same $\\bar y$ and $s$ but a larger random sample, the P-value would be smaller.', correct: true, why: '$t=\\frac{\\bar y-\\mu_0}{s/\\sqrt n}$ grows with $\\sqrt n$, so the P-value decreases.' },
    );
    const m = buildMulti(rng, sts, optionCount);
    const explanation =
      `$t=\\frac{${num(ybar, 2)}-${V}}{${num(s, 2)}/\\sqrt{${n}}}=${fixed(t, 2)}$ with $df=${n - 1}$; the two-sided P-value is $P=${fixed(P, 4)}$. ` +
      `$H_0$ is rejected at level $\\alpha$ when $P<\\alpha$, and a two-sided test at level $\\alpha$ rejects exactly the values of $\\mu_0$ outside the $(1-\\alpha)$ confidence interval.`;
    return {
      type,
      stem:
        `${sc.intro(v0Text(sc, v0))} ${sc.who} tests ${hypTex('\\mu', V, '!=')} with a random sample of $n=${n}$ ${sc.items}: $\\bar y=${num(ybar, 2)}$ ${sc.unit} and $s=${num(s, 2)}$ ${sc.unit}. ` +
        `Statistical software reports $t=${fixed(t, 2)}$ and a two-sided P-value of ${fixed(P, 4)}.\nWhich of the following statements are correct?`,
      instruction: INSTRUCTION.multi,
      options: m.options,
      correctAnswer: m.correctAnswer,
      explanation: explanation + reasonsNote(m.reasons),
    };
  },
};

export const TEMPLATES: Template[] = [setup, propZ, meanT, pvalueCi];
