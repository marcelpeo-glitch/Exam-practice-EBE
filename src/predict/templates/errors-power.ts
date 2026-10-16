// Templates for the topic "Errors & power" (QM1 past exams: which statement describes a Type I / Type II error in a
// context, the consequence of each error, which error could have been made after a given decision, which choice of α
// and n gives the greatest power, what increases when n increases (I/II/III), and the 2025 multi-select "how could
// they increase the power?"). The truth of every statement about power, β and α is decided by computing the power of
// the one-sided z-test before and after the change (stats.normCdf / normInv); the numeric power question uses the
// printed tables (z* from the ∞ row of Table T, probabilities from Table Z). Independent checks: errors-power.test.ts.
import { buildMcq, buildMulti, fixed, INSTRUCTION, mistakesNote, num, numericField, type Choice } from '../build';
import type { Rng } from '../rng';
import { normCdf, normInv, round, zStar, zTable, type TableLevel } from '../stats';
import type { Template } from '../types';
import { acceptAround } from './_normal';

const TOPIC = 'Errors & power' as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const reasonsNote = (rs: { id: string; correct: boolean; why: string }[]) =>
  '\n\n**Option by option**\n' + rs.map((r) => `- **${r.id}** ${r.correct ? '(correct)' : '(wrong)'}: ${r.why}`).join('\n');

// =====================================================================================================================
// 1. Type I / Type II errors in context
// =====================================================================================================================

/** A test in words: H0 / HA claims, short "truth" phrases and the action that follows each decision. */
export interface ErrScn {
  intro: string;
  h0: string;
  /** HA as a claim ("the drink shortens …"), and its negation (what is concluded when H0 is not rejected). */
  yes: string;
  no: string;
  yesShort: string;
  noShort: string;
  /** What happens after rejecting H0 / after not rejecting it (start with "The "). */
  actYes: string;
  actNo: string;
  sym?: [string, string];
}

export const ERROR_SCENARIOS: ErrScn[] = [
  {
    intro: 'A parcel company tries out new route-planning software on a random sample of delivery days. The software is expensive, so it will only be rolled out if the data show that it shortens the mean delivery time.',
    h0: 'the mean delivery time is the same with the new software as with the current planning',
    yes: 'the new software shortens the mean delivery time',
    no: 'the new software does not shorten the mean delivery time',
    yesShort: 'it does',
    noShort: 'it does not',
    actYes: 'The company rolls out the expensive new software',
    actNo: 'The company keeps its current route planning',
    sym: ['\\mu_{new}=\\mu_{old}', '\\mu_{new}<\\mu_{old}'],
  },
  {
    intro: 'A sports-drink brand would like to advertise that its new drink makes gamers react faster. A researcher randomly assigns gamers to the drink or to water and compares their reaction times.',
    h0: 'the drink does not change the mean reaction time',
    yes: 'the drink shortens the mean reaction time',
    no: 'the drink does not shorten the mean reaction time',
    yesShort: 'it does',
    noShort: 'it does not',
    actYes: 'The brand advertises that the drink makes gamers react faster',
    actNo: 'The brand leaves the faster-reaction claim out of its advertising',
  },
  {
    intro: 'A web shop shows a new page layout to a random half of its visitors. It will only switch to the new layout if the data show that a larger share of visitors then buys something.',
    h0: 'the share of visitors who buy something is the same with both layouts',
    yes: 'the new layout increases the share of visitors who buy something',
    no: 'the new layout does not increase the share of visitors who buy something',
    yesShort: 'it does',
    noShort: 'it does not',
    actYes: 'The web shop switches to the new layout',
    actNo: 'The web shop keeps its old layout',
    sym: ['p_{new}=p_{old}', 'p_{new}>p_{old}'],
  },
  {
    intro: 'A cooperative of tomato growers tries a more expensive organic fertiliser in randomly chosen greenhouses. The growers will only switch if the fertiliser turns out to raise the mean yield per plant.',
    h0: 'the mean yield per plant is the same with both fertilisers',
    yes: 'the organic fertiliser raises the mean yield per plant',
    no: 'the organic fertiliser does not raise the mean yield per plant',
    yesShort: 'it does',
    noShort: 'it does not',
    actYes: 'The growers pay for the more expensive organic fertiliser',
    actNo: 'The growers stay with their current fertiliser',
  },
  {
    intro: 'Every morning a brewery measures the content of a random sample of bottles from its bottling line. The bottles should contain 330 ml on average; if the data show that the mean content differs from 330 ml, the line is stopped for recalibration.',
    h0: 'the mean content is 330 ml',
    yes: 'the mean content differs from 330 ml',
    no: 'the mean content does not differ from 330 ml',
    yesShort: 'it does',
    noShort: 'it does not',
    actYes: 'The bottling line is stopped for recalibration',
    actNo: 'The bottling line keeps running without recalibration',
    sym: ['\\mu=330', '\\mu\\neq 330'],
  },
  {
    intro: 'A faculty runs a pilot in which randomly selected first-year students get weekly peer tutoring. The programme will only be offered to all students if it turns out to raise the mean exam grade.',
    h0: 'peer tutoring does not change the mean exam grade',
    yes: 'peer tutoring raises the mean exam grade',
    no: 'peer tutoring does not raise the mean exam grade',
    yesShort: 'it does',
    noShort: 'it does not',
    actYes: 'The faculty offers peer tutoring to all first-year students',
    actNo: 'The faculty ends the peer-tutoring pilot',
  },
  {
    intro: 'A start-up claims that with its white-noise app students sleep more than 7 hours per night on average. A student association tests the claim on a random sample of members who use the app.',
    h0: 'app users sleep 7 hours per night on average',
    yes: 'app users sleep more than 7 hours per night on average',
    no: 'app users do not sleep more than 7 hours per night on average',
    yesShort: 'they do',
    noShort: 'they do not',
    actYes: 'The student association recommends the app to its members',
    actNo: 'The student association does not recommend the app',
    sym: ['\\mu=7', '\\mu>7'],
  },
];

type Cell = 'I' | 'II' | 'power' | 'ok';
/** [rejects H0, H0 is true] for each decision/reality combination. */
const CELL: Record<Cell, [boolean, boolean]> = { I: [true, true], II: [false, false], power: [true, false], ok: [false, true] };
const CELL_WHY: Record<Cell, string> = {
  I: 'this is a Type I error: $H_0$ is true but is rejected.',
  II: 'this is a Type II error: $H_A$ is true but $H_0$ is not rejected.',
  power: 'this is a correct decision ($H_0$ is false and is rejected); its probability is the power $1-\\beta$.',
  ok: 'this is a correct decision ($H_0$ is true and is not rejected).',
};

const identifyError: Template = {
  id: 'errors-power.identify-error',
  topic: TOPIC,
  title: 'Type I / Type II error (or power) in context, consequence of an error, which error is possible after a decision',
  types: ['single-choice'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const s = rng.pick(ERROR_SCENARIOS);
    const kind = rng.pick(['type', 'type', 'consequence', 'possible'] as const);
    const dec = (rej: boolean, h0: boolean) => `concluding that ${rej ? s.yes : s.no}, when in fact ${h0 ? s.noShort : s.yesShort}`;
    const act = (rej: boolean, h0: boolean) => `${rej ? s.actYes : s.actNo}; in reality, ${h0 ? s.no : s.yes}.`;
    const hyp = s.sym ? `$H_0: ${s.sym[0]}$ (${s.h0}) against $H_A: ${s.sym[1]}$ (${s.yes})` : `$H_0$: ${s.h0}, against $H_A$: ${s.yes}`;
    const base =
      `**Hypotheses.** $H_0$: ${s.h0}; $H_A$: ${s.yes}.\n` +
      `- **Type I error** = rejecting a true $H_0$: ${dec(true, true)}. Its probability is $\\alpha$. Consequence: ${lc(act(true, true))}\n` +
      `- **Type II error** = not rejecting a false $H_0$: ${dec(false, false)}. Its probability is $\\beta$. Consequence: ${lc(act(false, false))}\n` +
      `- **Power** $=1-\\beta$ = the probability of rejecting $H_0$ when $H_A$ is true: ${dec(true, false)}.\n` +
      'Note that these errors are not calculation mistakes: even with every step done correctly, an unlucky random sample can lead to a wrong conclusion.';
    const calcWhy = 'a calculation mistake is not a Type I or Type II error; those are wrong conclusions caused by chance (an unlucky sample).';

    if (kind === 'possible') {
      const a = rng.pick([0.05, 0.05, 0.01, 0.1]);
      const rej = rng.chance(0.5);
      const p = rej ? round((a * rng.int(1, 9)) / 10, 3) : round(a * (1 + rng.int(2, 12) / 4), 3);
      const name = (r: boolean) => (r ? 'I' : 'II');
      const lab = (r: boolean, d: boolean) => `A Type ${name(r)} error: ${dec(d, d)}.`;
      const key: Choice = { text: lab(rej, rej) };
      const ds: Choice[] = [
        { text: lab(!rej, !rej), why: `a Type ${name(!rej)} error needs the opposite decision, but $H_0$ was ${rej ? '' : 'not '}rejected here.` },
        { text: lab(!rej, rej), why: `this situation is the one that could have happened, but it is a Type ${name(rej)} error, not a Type ${name(!rej)} error.` },
        { text: lab(rej, !rej), why: `this describes a Type ${name(!rej)} error, which is impossible after ${rej ? 'rejecting' : 'not rejecting'} $H_0$.` },
        { text: `No error is possible, because the P-value is ${rej ? 'smaller' : 'larger'} than $\\alpha$.`, why: 'a P-value never proves a hypothesis: whatever is decided, the decision can be wrong.' },
      ];
      const mcq = buildMcq(rng, key, ds, { count: optionCount, fallback: () => ({ text: 'Both a Type I and a Type II error.', why: 'each decision can lead to only one kind of error.' }) });
      const stem =
        `${s.intro}\nThe hypotheses are ${hyp}. The test at significance level $\\alpha=${a}$ gives a P-value of ${p}, so ${lc(rej ? s.actYes : s.actNo)}.\n` +
        'Which error could have been made, and what would it mean here?';
      const explanation =
        `${base}\n\nHere $P=${p}$ is ${rej ? 'smaller' : 'larger'} than $\\alpha=${a}$, so $H_0$ is ${rej ? '' : 'not '}rejected. ` +
        (rej ? 'After rejecting $H_0$ the only possible error is a **Type I error**: $H_0$ might be true after all' : 'After not rejecting $H_0$ the only possible error is a **Type II error**: $H_A$ might be true after all') +
        ` (${dec(rej, rej)}).` +
        mistakesNote(mcq.distractors);
      return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation };
    }

    const target = kind === 'consequence' ? rng.pick(['I', 'II'] as const) : rng.pick(['I', 'II', 'I', 'II', 'power'] as const);
    const make = kind === 'consequence' ? (c: Cell) => act(...CELL[c]) : (c: Cell) => `${cap(dec(...CELL[c]))}.`;
    const others = (['I', 'II', 'power', 'ok'] as Cell[]).filter((c) => c !== target);
    const ds: Choice[] = [
      ...rng.shuffle(others).map((c) => ({ text: make(c), why: CELL_WHY[c] })),
      kind === 'consequence'
        ? { text: 'The researchers calculate a wrong P-value, so their advice is not valid.', why: calcWhy }
        : { text: 'Making a mistake when calculating the test statistic, so that the P-value is wrong.', why: calcWhy },
    ];
    const mcq = buildMcq(rng, { text: make(target) }, ds, {
      count: optionCount,
      fallback: () => ({ text: kind === 'consequence' ? 'The sample turns out not to be random, so nothing can be concluded.' : 'Using a sample that is not random.', why: 'a biased sample is a problem of study design, not a Type I or Type II error.' }),
    });
    const what = target === 'power' ? 'the event whose probability is the power of the test' : `a Type ${target} error`;
    const stem = `${s.intro}\nThe hypotheses are ${hyp}.\n${kind === 'consequence' ? `Which of the following is a possible consequence of a Type ${target} error?` : `Which of the following describes ${what}?`}`;
    const explanation = `${base}\n\nSo the answer is: ${make(target)}` + mistakesNote(mcq.distractors);
    return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation };
  },
};

// =====================================================================================================================
// Numeric scenarios: one-sided test of a mean with known σ (power computed in code)
// =====================================================================================================================

export interface NumScn {
  intro: string;
  who: string;
  measure: string;
  unit: string;
  units: string;
  mu0: number;
  dir: 1 | -1;
  sigmas: number[];
  step: number;
}

export const NUM_SCENARIOS: NumScn[] = [
  { intro: 'A consumer organisation suspects that 330 ml cans of a soft drink contain less than 330 ml on average.', who: 'the consumer organisation', measure: 'the content of a can', unit: 'ml', units: 'cans', mu0: 330, dir: -1, sigmas: [4, 5, 6, 8], step: 0.5 },
  { intro: 'A bakery chain hopes that its new sourdough loaves weigh more than 800 grams on average.', who: 'the bakery chain', measure: 'the weight of a loaf', unit: 'g', units: 'loaves', mu0: 800, dir: 1, sigmas: [12, 15, 20, 24], step: 1 },
  { intro: 'A phone maker claims that its new battery lasts longer than 18 hours on average.', who: 'a technology magazine', measure: 'the battery life', unit: 'hours', units: 'phones', mu0: 18, dir: 1, sigmas: [1.5, 2, 2.4, 3], step: 0.1 },
  { intro: 'A climbing gym introduced a loyalty card and hopes that members now visit more than 6 times per month on average.', who: 'the gym', measure: 'the number of visits per month', unit: 'visits', units: 'members', mu0: 6, dir: 1, sigmas: [2, 2.5, 3], step: 0.1 },
  { intro: 'A pizzeria promises a mean delivery time of 30 minutes, but a student association suspects that deliveries take longer on average.', who: 'the student association', measure: 'the delivery time', unit: 'minutes', units: 'deliveries', mu0: 30, dir: 1, sigmas: [5, 6, 8], step: 0.5 },
  { intro: 'A ferry operator hopes that a new boarding procedure brings the mean boarding time below 25 minutes.', who: 'the ferry operator', measure: 'the boarding time', unit: 'minutes', units: 'sailings', mu0: 25, dir: -1, sigmas: [3, 4, 5], step: 0.25 },
  { intro: 'After changing its recipe, a student society that sells cookies hopes that its regulars now rate the cookies higher than 7 out of 10 on average.', who: 'the society', measure: 'the rating', unit: 'points', units: 'regulars', mu0: 7, dir: 1, sigmas: [1.2, 1.5, 2], step: 0.05 },
];

interface St {
  n: number;
  a: number;
  m: number;
  s: number;
  two: boolean;
}

/** P(reject H0) for the z-test when the true mean is mu (one-sided in the scenario's direction, or two-sided). */
export function pReject(sc: NumScn, st: St, mu: number): number {
  const d = (sc.dir * (mu - sc.mu0)) / (st.s / Math.sqrt(st.n));
  if (!st.two) return 1 - normCdf(normInv(1 - st.a) - d);
  const z = normInv(1 - st.a / 2);
  return 1 - normCdf(z - d) + normCdf(-z - d);
}
const powerOf = (sc: NumScn, st: St) => pReject(sc, st, st.m);
const sizeOf = (sc: NumScn, st: St) => pReject(sc, st, sc.mu0);
const opOf = (sc: NumScn) => (sc.dir > 0 ? '>' : '<');
const meanAt = (sc: NumScn, k: number) => round(sc.mu0 + sc.dir * k * sc.step, 4);

/** A base situation with power between 0.3 and 0.85 at α = 0.05 (true mean k ≥ 2 steps from μ0). */
function baseState(rng: Rng, sc: NumScn): St & { k: number } {
  for (;;) {
    const n = rng.pick([40, 50, 60, 80, 100, 120, 160, 200]);
    const s = rng.pick(sc.sigmas);
    const ks: number[] = [];
    for (let k = 2; k <= 400; k++) {
      const p = powerOf(sc, { n, s, a: 0.05, m: meanAt(sc, k), two: false });
      if (p >= 0.3 && p <= 0.85) ks.push(k);
    }
    if (ks.length) {
      const k = rng.pick(ks);
      return { n, s, a: 0.05, m: meanAt(sc, k), two: false, k };
    }
  }
}

type ChangeKind = 'nUp' | 'nDown' | 'aUp' | 'aDown' | 'mFar' | 'mNear' | 'sDown' | 'sUp' | 'two';
const REASON: Record<ChangeKind, string> = {
  nUp: 'a larger sample gives a smaller standard error $\\sigma/\\sqrt n$, so the sampling distributions under $H_0$ and under the true mean overlap less: more power, smaller $\\beta$; $P(\\text{Type I error})=\\alpha$ does not change.',
  nDown: 'a smaller sample gives a larger standard error $\\sigma/\\sqrt n$: less power, larger $\\beta$; $P(\\text{Type I error})=\\alpha$ does not change.',
  aUp: 'a larger $\\alpha$ makes the rejection region bigger: more power and a smaller $\\beta$, but a larger $P(\\text{Type I error})$.',
  aDown: 'a smaller $\\alpha$ makes it harder to reject $H_0$: fewer Type I errors, but less power and a larger $\\beta$.',
  mFar: 'a true mean further from $\\mu_0$ (a larger effect) is easier to detect: more power, smaller $\\beta$; $\\alpha$ does not change.',
  mNear: 'a true mean closer to $\\mu_0$ (a smaller effect) is harder to detect: less power, larger $\\beta$; $\\alpha$ does not change.',
  sDown: 'less variability gives a smaller standard error: more power, smaller $\\beta$; $\\alpha$ does not change.',
  sUp: 'more variability gives a larger standard error: less power, larger $\\beta$; $\\alpha$ does not change.',
  two: 'a two-sided test with the same $\\alpha$ puts only $\\alpha/2$ in the tail where the true mean lies: less power and a larger $\\beta$, while the total $P(\\text{Type I error})$ stays $\\alpha$.',
};

function change(sc: NumScn, st: St & { k: number }, kind: ChangeKind): { kind: ChangeKind; text: string; st: St } {
  const a2 = kind === 'aUp' ? (st.a === 0.01 ? 0.05 : 0.1) : st.a === 0.1 ? 0.05 : 0.01;
  const m2 = meanAt(sc, kind === 'mFar' ? st.k + Math.ceil(st.k / 2) : Math.floor(st.k / 2));
  const s2 = kind === 'sDown' ? st.s / 2 : st.s * 2;
  const n2 = kind === 'nUp' ? st.n * 2 : st.n / 2;
  const T: Record<ChangeKind, [string, Partial<St>]> = {
    nUp: [`Using a sample of $n=${n2}$ ${sc.units} instead of $n=${st.n}$.`, { n: n2 }],
    nDown: [`Using a sample of $n=${n2}$ ${sc.units} instead of $n=${st.n}$.`, { n: n2 }],
    aUp: [`Using a significance level of $\\alpha=${a2}$ instead of $\\alpha=${st.a}$.`, { a: a2 }],
    aDown: [`Using a significance level of $\\alpha=${a2}$ instead of $\\alpha=${st.a}$.`, { a: a2 }],
    mFar: [`If the true mean were $\\mu=${num(m2, 4)}$ instead of $\\mu=${num(st.m, 4)}$.`, { m: m2 }],
    mNear: [`If the true mean were $\\mu=${num(m2, 4)}$ instead of $\\mu=${num(st.m, 4)}$.`, { m: m2 }],
    sDown: [`If ${sc.measure} varied less, with $\\sigma=${num(s2, 3)}$ instead of $\\sigma=${num(st.s, 3)}$.`, { s: s2 }],
    sUp: [`If ${sc.measure} varied more, with $\\sigma=${num(s2, 3)}$ instead of $\\sigma=${num(st.s, 3)}$.`, { s: s2 }],
    two: [`Testing against the two-sided alternative $H_A:\\mu\\neq ${sc.mu0}$ (with the same $\\alpha$).`, { two: true }],
  };
  return { kind, text: T[kind][0], st: { n: st.n, a: st.a, m: st.m, s: st.s, two: st.two, ...T[kind][1] } };
}

const baseStem = (sc: NumScn, st: St) =>
  `${sc.intro} To check this, ${sc.who} tests $H_0:\\mu=${sc.mu0}$ against $H_A:\\mu${opOf(sc)}${sc.mu0}$ at significance level $\\alpha=${st.a}$, using a random sample of $n=${st.n}$ ${sc.units}. ` +
  `The standard deviation of ${sc.measure} is $\\sigma=${num(st.s, 3)}$ ${sc.unit}. Suppose that in reality $\\mu=${num(st.m, 4)}$ ${sc.unit}.`;

const RULES =
  'Power $=1-\\beta=P(\\text{reject }H_0\\mid H_A\\text{ true})$. It grows when $n$ grows, when $\\alpha$ grows, when the true mean lies further from $\\mu_0$ (larger effect) and when $\\sigma$ is smaller; ' +
  'a two-sided test (same $\\alpha$) has less power against a true mean in the hypothesised direction. $P(\\text{Type I error})=\\alpha$ is chosen by the researcher and only changes when $\\alpha$ changes.';

type Ask = 'power+' | 'beta-' | 'beta+' | 'typeI+';
const ASK_TEXT: Record<Ask, string> = { 'power+': 'increase the power of the test', 'beta-': 'decrease the probability of a Type II error', 'beta+': 'increase the probability of a Type II error', 'typeI+': 'increase the probability of a Type I error' };

const powerChanges: Template = {
  id: 'errors-power.power-changes',
  topic: TOPIC,
  title: 'How power, β and α change with n, α, effect size, σ and a two-sided test (statements, I/II/III, best α–n combination)',
  types: ['multi-select', 'single-choice'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const sc = rng.pick(NUM_SCENARIOS);
    const st = baseState(rng, sc);
    const p0 = powerOf(sc, st);
    const kind = type === 'multi-select' ? 'statements' : rng.pick(['statements', 'roman', 'combos'] as const);
    const show = (x: number) => fixed(x, 3);

    if (kind === 'combos') {
      const alphas = rng.sample([0.01, 0.05, 0.1], 2).sort((x, y) => x - y);
      const n1 = rng.pick([15, 20, 25, 30, 40]);
      const ns = [n1, n1 * rng.pick([2, 3])];
      const ask = rng.pick(['most', 'least', 'betaLeast', 'betaMost'] as const);
      const wantMax = ask === 'most' || ask === 'betaLeast';
      const combos = alphas.flatMap((a) => ns.map((n) => ({ a, n, p: powerOf(sc, { ...st, a, n }) })));
      const best = combos.reduce((b, c) => ((wantMax ? c.p > b.p : c.p < b.p) ? c : b));
      if (combos.some((c) => c !== best && (wantMax ? c.a > best.a || c.n > best.n : c.a < best.a || c.n < best.n))) throw new Error('combos: no dominant option');
      const txt = (c: { a: number; n: number }) => `$\\alpha=${c.a}$ and $n=${c.n}$`;
      const ds: Choice[] = rng.shuffle(combos.filter((c) => c !== best)).map((c) => {
        const parts = [c.a !== best.a ? `a ${c.a < best.a ? 'smaller' : 'larger'} $\\alpha$` : '', c.n !== best.n ? `a ${c.n < best.n ? 'smaller' : 'larger'} $n$` : ''].filter(Boolean);
        return { text: txt(c), why: `${parts.join(' and ')} gives ${c.p < best.p ? 'less' : 'more'} power than ${txt(best)}.` };
      });
      ds.push({ text: `It cannot be determined without knowing the standard deviation of ${sc.measure}.`, why: 'the best option is best on both counts (α and n), so the comparison holds for every σ.' });
      const mcq = buildMcq(rng, { text: txt(best) }, ds, { count: optionCount });
      const goal = { most: 'the greatest power', least: 'the smallest power', betaLeast: 'the smallest probability of a Type II error', betaMost: 'the largest probability of a Type II error' }[ask];
      const stem =
        `${sc.intro} To check this, ${sc.who} will test $H_0:\\mu=${sc.mu0}$ against $H_A:\\mu${opOf(sc)}${sc.mu0}$. Suppose that in reality $\\mu=${num(st.m, 4)}$ ${sc.unit}.\n` +
        `Which choice of significance level and sample size gives ${goal}?`;
      const explanation =
        `${RULES}\nSo ${goal} goes with the ${wantMax ? 'largest' : 'smallest'} $\\alpha$ and the ${wantMax ? 'largest' : 'smallest'} $n$: **${txt(best)}**. This does not depend on $\\sigma$. ` +
        `(For example, with $\\sigma=${num(st.s, 3)}$ the powers are ${combos.map((c) => `${show(c.p)} for ${txt(c)}`).join('; ')}.)` +
        mistakesNote(mcq.distractors);
      return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation };
    }

    if (kind === 'roman') {
      const ch = change(sc, st, rng.pick(['nUp', 'nDown', 'aUp', 'aDown', 'mFar', 'sUp', 'sDown'] as const));
      const m1 = [sizeOf(sc, st), 1 - p0, p0];
      const m2 = [sizeOf(sc, ch.st), 1 - powerOf(sc, ch.st), powerOf(sc, ch.st)];
      const up = m1.map((v, i) => m2[i] - v > 1e-9);
      const R = ['I', 'II', 'III'];
      const NAMES = ['$P(\\text{Type I error})$', '$P(\\text{Type II error})$', 'the power'];
      const label = (set: boolean[]) => {
        const r = R.filter((_, i) => set[i]);
        return r.length === 0 ? 'None of them' : r.length === 1 ? `${r[0]} only` : r.length === 2 ? `${r[0]} and ${r[1]}` : 'I, II and III';
      };
      const move = (i: number) => `${NAMES[i]} ${m2[i] - m1[i] > 1e-9 ? 'increases' : m1[i] - m2[i] > 1e-9 ? 'decreases' : 'stays the same'} (${show(m1[i])} → ${show(m2[i])})`;
      const sets = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => [!!(b & 1), !!(b & 2), !!(b & 4)]).filter((x) => label(x) !== label(up));
      const dist = (x: boolean[]) => x.filter((v, i) => v !== up[i]).length;
      const ds: Choice[] = rng
        .shuffle(sets)
        .sort((x, y) => dist(x) - dist(y))
        .map((x) => ({ text: label(x), why: [0, 1, 2].filter((i) => x[i] !== up[i]).map((i) => `${R[i]}: ${move(i)}`).join('; ') + '.' }));
      const mcq = buildMcq(rng, { text: label(up) }, ds, { count: optionCount });
      const stem = `${baseStem(sc, st)}\nOne thing is changed: ${ch.text}\nWhich of the following increase(s) as a result?\nI. The probability of a Type I error\nII. The probability of a Type II error\nIII. The power of the test`;
      const explanation = `${RULES}\nHere ${REASON[ch.kind]}\nComputed for this test: ${[0, 1, 2].map(move).join('; ')}. So the answer is **${label(up)}**.` + mistakesNote(mcq.distractors);
      return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation };
    }

    // statements: one change per option, judged by recomputing the metric
    const ask: Ask = rng.pick(['power+', 'power+', 'beta-', 'beta+', 'typeI+']);
    const metric = (x: St) => (ask === 'typeI+' ? sizeOf(sc, x) : ask === 'power+' ? powerOf(sc, x) : 1 - powerOf(sc, x));
    const wantUp = ask !== 'beta-';
    const mName = ask === 'typeI+' ? '$P(\\text{Type I error})$' : ask === 'power+' ? 'power' : '$\\beta$';
    const kinds: ChangeKind[] = ['nUp', 'nDown', 'aUp', 'aDown', 'mFar', 'mNear', 'sDown', 'sUp', 'two'];
    const stmts = kinds.map((k) => {
      const ch = change(sc, st, k);
      const v0 = metric(st);
      const v1 = metric(ch.st);
      const correct = wantUp ? v1 - v0 > 1e-9 : v0 - v1 > 1e-9;
      return { text: ch.text, correct, why: `${REASON[k]} Here ${mName}: ${show(v0)} → ${show(v1)}.` };
    });
    const q = `Which of the following changes would ${ASK_TEXT[ask]}? (Each option is one change; everything else stays the same.)`;
    if (type === 'multi-select') {
      const m = buildMulti(rng, stmts, optionCount);
      return { type, stem: `${baseStem(sc, st)}\n${q}`, instruction: INSTRUCTION.multi, options: m.options, correctAnswer: m.correctAnswer, explanation: RULES + reasonsNote(m.reasons) };
    }
    const key = rng.pick(stmts.filter((x) => x.correct));
    const mcq = buildMcq(
      rng,
      { text: key.text },
      rng.shuffle(stmts.filter((x) => !x.correct)).map((x) => ({ text: x.text, why: x.why })),
      { count: optionCount },
    );
    const explanation = `${RULES}\n\nThe change that works: ${key.text} Why: ${key.why}` + mistakesNote(mcq.distractors);
    return { type, stem: `${baseStem(sc, st)}\nWhich ONE of the following changes would ${ASK_TEXT[ask]}? (Everything else stays the same.)`, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation };
  },
};

// =====================================================================================================================
// 3. Computing the power (or β) of a one-sided z-test with Table Z
// =====================================================================================================================

/** z rounded to 2 decimals for Table Z, halves away from zero (robust to floating-point noise). */
const z2r = (z: number) => (Math.sign(z) * Math.round(Math.abs(z) * 100 + 1e-7)) / 100;

const LEVEL: Record<number, { one: TableLevel; two: TableLevel }> = { 0.1: { one: 0.8, two: 0.9 }, 0.05: { one: 0.9, two: 0.95 }, 0.01: { one: 0.98, two: 0.99 } };

const computePower: Template = {
  id: 'errors-power.compute-power',
  topic: TOPIC,
  title: 'Power or β of a one-sided z-test: cut-off for the sample mean and P(reject H0) at the true mean (Table Z)',
  types: ['numeric', 'single-choice'],
  difficulty: 3,
  generate({ rng, type, optionCount }) {
    const sc = rng.pick(NUM_SCENARIOS);
    let n = 0;
    let s = 0;
    let a = 0;
    let se = 0;
    let m = 0;
    for (;;) {
      n = rng.pick([16, 25, 36, 49, 64, 100]);
      s = rng.pick(sc.sigmas);
      a = rng.pick([0.05, 0.05, 0.01, 0.1]);
      se = s / Math.sqrt(n);
      if (Math.abs(se * 1000 - Math.round(se * 1000)) > 1e-6) continue;
      const ks: number[] = [];
      for (let k = 1; k <= 400; k++) {
        const p = powerOf(sc, { n, s, a, m: meanAt(sc, k), two: false });
        if (p >= 0.3 && p <= 0.95) ks.push(k);
      }
      if (!ks.length) continue;
      m = meanAt(sc, rng.pick(ks));
      break;
    }
    const zs = zStar(LEVEL[a].one);
    const op = opOf(sc);
    const cut = sc.mu0 + sc.dir * zs * se;
    /** Power read from Table Z for a cut-off and standard error. */
    const powerAt = (c: number, e: number) => (sc.dir > 0 ? round(1 - zTable(z2r((c - m) / e)), 4) : zTable(z2r((c - m) / e)));
    const askBeta = rng.chance(0.4);
    const val = (pw: number) => (askBeta ? round(1 - pw, 4) : pw);
    const pw = powerAt(cut, se);
    const key = val(pw);
    const zb = (cut - m) / se;
    const exact = powerOf(sc, { n, s, a, m, two: false });
    const routes = [pw, exact, powerAt(round(cut, 2), se), powerAt(cut - (zb - Math.floor(zb * 100) / 100) * se, se), powerAt(cut - (zb - Math.ceil(zb * 100) / 100) * se, se)];
    const what = askBeta ? 'probability of a Type II error' : 'power';
    const tail = sc.dir > 0 ? `P(Z>${fixed(z2r(zb), 2)})=1-${fixed(zTable(z2r(zb)), 4)}` : `P(Z<${fixed(z2r(zb), 2)})`;
    const stem =
      `${sc.intro} To check this, ${sc.who} will test $H_0:\\mu=${sc.mu0}$ against $H_A:\\mu${op}${sc.mu0}$ at significance level $\\alpha=${a}$, using a random sample of $n=${n}$ ${sc.units}. ` +
      `Assume that ${sc.measure} is Normally distributed with known standard deviation $\\sigma=${num(s, 3)}$ ${sc.unit}, so a $z$-test is used.\n` +
      `Suppose that in reality $\\mu=${num(m, 4)}$ ${sc.unit}. ` +
      (type === 'numeric' ? `Give the cut-off value $c$ for the sample mean ($H_0$ is rejected when $\\bar y${op}c$) and the ${what} of the test.` : `What is the ${what} of the test?`);
    const explanation =
      `1. Standard error: $SE=\\sigma/\\sqrt n=${num(s, 3)}/\\sqrt{${n}}=${num(se, 4)}$.\n` +
      `2. One-sided $\\alpha=${a}$: $z^*=${zs}$ (Table T, row $\\infty$, column ${Math.round(LEVEL[a].one * 100)}% confidence; this is the $z$ with ${sc.dir > 0 ? 'right' : 'left'}-tail area ${a} in Table Z).\n` +
      `3. Cut-off: $c=\\mu_0${sc.dir > 0 ? '+' : '-'}z^*\\cdot SE=${sc.mu0}${sc.dir > 0 ? '+' : '-'}${zs}\\times ${num(se, 4)}=${num(cut, 4)}$; $H_0$ is rejected when $\\bar y${op}${num(cut, 4)}$.\n` +
      `4. Power = $P(\\bar y${op}${num(cut, 4)}\\mid\\mu=${num(m, 4)})=P\\left(Z${op}\\dfrac{${num(cut, 4)}-${num(m, 4)}}{${num(se, 4)}}\\right)=${tail}=${fixed(pw, 4)}$ (Table Z).\n` +
      (askBeta ? `5. Probability of a Type II error: $\\beta=1-\\text{power}=1-${fixed(pw, 4)}=${fixed(key, 4)}$.\n` : '') +
      `So the ${what} is about ${fixed(key, 4)}: if the true mean is ${num(m, 4)}, the test ${askBeta ? 'fails to reject $H_0$' : 'rejects $H_0$'} in about ${Math.round(key * 100)}% of samples. (Exact value without table rounding: ${fixed(val(exact), 4)}; answers between these are accepted.)`;
    if (type === 'numeric') {
      return {
        type,
        stem,
        instruction: `Instruction: fill in every box: the cut-off with 2 decimals and the ${what} with 4 decimals. To separate decimals, use a dot and not a comma (example: 0.51 instead of 0,51)!`,
        fields: [
          numericField('c', 'Cut-off value $c$', cut, 2, acceptAround(2, cut, sc.mu0 + sc.dir * normInv(1 - a) * se)),
          numericField('p', askBeta ? 'Probability of a Type II error' : 'Power', key, 4, acceptAround(4, ...routes.map(val))),
        ],
        explanation,
      };
    }
    const z2 = zStar(LEVEL[a].two);
    const cands: Choice[] = [
      { value: round(1 - key, 4), why: askBeta ? 'gives the power instead of $\\beta=1-\\text{power}$.' : 'gives $\\beta=P(\\text{Type II error})$ instead of the power $1-\\beta$.' },
      { value: val(powerAt(sc.mu0 + sc.dir * z2 * se, se)), why: `uses the two-sided critical value $z^*=${z2}$ for a one-sided test.` },
      { value: val(powerAt(sc.mu0 + sc.dir * zs * s, s)), why: 'uses $\\sigma$ instead of the standard error $\\sigma/\\sqrt n$.' },
      { value: val(powerAt(sc.mu0, se)), why: `forgets the cut-off: computes the probability that $\\bar y$ lies beyond $\\mu_0=${sc.mu0}$.` },
      { value: val(powerAt(sc.mu0 - sc.dir * zs * se, se)), why: 'puts the cut-off on the wrong side of $\\mu_0$.' },
    ]
      .filter((c) => c.value > 0.002 && c.value < 0.998)
      .map((c) => ({ ...c, text: fixed(c.value, 4) }));
    const mcq = buildMcq(rng, { text: fixed(key, 4), value: key }, cands, {
      count: optionCount,
      order: 'ascending',
      epsilon: 0.02,
      fallback: (i) => {
        const v = round(key + (i % 2 ? -1 : 1) * 0.06 * (1 + Math.floor(i / 2)), 4);
        return { text: fixed(v, 4), value: v > 0.002 && v < 0.998 ? v : NaN, why: 'a guess: compute the cut-off first, then the probability at the true mean.' };
      },
    });
    return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
  },
};

export const TEMPLATES: Template[] = [identifyError, powerChanges, computePower];
