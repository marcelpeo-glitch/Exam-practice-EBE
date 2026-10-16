// Templates for the topic "Sampling distributions" (QM1 past exams: the standard error of the mean s/√n, the
// probability that a sample mean exceeds a value by the Central Limit Theorem (σ/√n and Table Z), and which histogram
// shows the sampling distribution of the mean of samples of size n from a non-Normal population). Also: the sampling
// distribution of a sample proportion, how the standard error changes with n, and statements about the CLT. Every key
// is computed in code (Table Z via stats.zTable; the exact distribution of the sample mean by convolution); wrong
// options come from modelled mistakes. Independent checks: sampling-distributions.test.ts.
import { buildMcq, buildMulti, INSTRUCTION, mistakesNote, num, numericField, type Choice } from '../build';
import type { Rng } from '../rng';
import { round, zTable } from '../stats';
import type { Generated, Template } from '../types';
import { acceptAround, clearZ, exactP, histDistance, histPanelsSvg, normalBars, p4, phiTex, probMcq, tableP, zStep, type Bar, type Ev } from './_normal';

const TOPIC = 'Sampling distributions' as const;

/** Numeric single-field question. */
function numeric(stem: string, key: number, dp: number, explanation: string, acceptRange?: [number, number], images?: Generated['images']): Generated {
  const f = numericField('x', undefined, key, dp, acceptRange);
  return { type: 'numeric', stem, ...(images ? { images } : {}), instruction: INSTRUCTION.numeric(dp), correctAnswer: f.answer, tolerance: f.tolerance, ...(f.acceptRange ? { acceptRange: f.acceptRange } : {}), explanation };
}

const choice = (stem: string, mcq: ReturnType<typeof buildMcq>, explanation: string, images?: Generated['images']): Generated => ({
  type: 'single-choice',
  stem,
  ...(images ? { images } : {}),
  options: mcq.options,
  correctAnswer: mcq.correctAnswer,
  explanation: explanation + mistakesNote(mcq.distractors),
});

/** A population of individual values (means and totals). */
interface MScn {
  pop: string;
  unit: string;
  item: string;
  items: string;
  mus: number[];
  sds: number[];
  /** Shape of the population: 'Normal' or a skewed shape (then only n ≥ 36 is used). */
  shape: string;
  /** Optional total: "{intro} ... total weight of the n {items} is more than L {unit}". */
  total?: { intro: (n: number, L: number) => string; step: number };
}

const MSCN: MScn[] = [
  { pop: 'the amount customers of a supermarket chain spend per visit', unit: 'euros', item: 'customer', items: 'customers', mus: [32, 36, 40, 45], sds: [14, 15, 16, 18, 20], shape: 'right-skewed' },
  { pop: 'the time students need to finish a weekly online quiz', unit: 'minutes', item: 'student', items: 'students', mus: [24, 28, 30, 35], sds: [6, 8, 9, 10], shape: 'right-skewed' },
  { pop: 'the number of steps employees of a large firm take on a working day', unit: 'steps', item: 'employee', items: 'employees', mus: [6000, 7000, 7500, 8000], sds: [1800, 2000, 2400], shape: 'right-skewed' },
  { pop: 'the waiting time at the helpdesk of an internet provider', unit: 'minutes', item: 'caller', items: 'callers', mus: [6, 8, 10, 12], sds: [5, 6, 8], shape: 'strongly right-skewed' },
  { pop: 'the monthly phone bill of students', unit: 'euros', item: 'student', items: 'students', mus: [22, 25, 28], sds: [8, 9, 10, 12], shape: 'right-skewed' },
  { pop: 'the battery life of a model of wireless earbuds', unit: 'hours', item: 'pair of earbuds', items: 'pairs of earbuds', mus: [5.5, 6, 6.5, 7], sds: [0.6, 0.8, 1, 1.2], shape: 'Normal' },
  {
    pop: 'the weight of adult passengers of a ferry company',
    unit: 'kg',
    item: 'passenger',
    items: 'passengers',
    mus: [75, 78, 80, 82],
    sds: [12, 14, 15, 16],
    shape: 'Normal',
    total: { intro: (n, L) => `The lift on the ferry takes $n=${n}$ passengers at a time and is designed for a total load of at most ${L} kg.`, step: 10 },
  },
  {
    pop: 'the weight of apples from an orchard',
    unit: 'g',
    item: 'apple',
    items: 'apples',
    mus: [150, 160, 170, 180],
    sds: [16, 18, 20, 24],
    shape: 'Normal',
    total: { intro: (n, L) => `The apples are sold in boxes of $n=${n}$ randomly chosen apples. A box is labelled "premium" when the apples in it weigh more than ${L} g in total.`, step: 50 },
  },
];

const popSentence = (rng: Rng, s: MScn, mu: number, sd: number) => {
  const shape = s.shape === 'Normal' ? 'The distribution is Normal.' : `The distribution is ${s.shape}.`;
  return rng.pick([
    `In a large population, ${s.pop} has mean $\\mu=${num(mu, 2)}$ ${s.unit} and standard deviation $\\sigma=${num(sd, 2)}$ ${s.unit}. ${shape}`,
    `Suppose that ${s.pop} has mean $\\mu=${num(mu, 2)}$ ${s.unit} and standard deviation $\\sigma=${num(sd, 2)}$ ${s.unit}. ${shape}`,
  ]);
};

/** A grid step for cut-off values, given the standard deviation of the sampling distribution. */
const gridFor = (sd: number) => (sd >= 50 ? 10 : sd >= 5 ? 1 : sd >= 0.5 ? 0.1 : 0.01);

/** A value centre + zΣ on a grid with zmin ≤ |z| ≤ zmax, the given sign, and an unambiguous 2-decimal z. */
function cutAt(rng: Rng, centre: number, sd: number, step: number, sign: number, zmin: number, zmax: number): number {
  for (let i = 0; i < 300; i++) {
    const x = round(centre + sign * Math.round((rng.step(zmin, zmax, 0.01) * sd) / step) * step, 6);
    const z = (x - centre) / sd;
    if (Math.abs(z) >= zmin - 1e-9 && Math.abs(z) <= zmax + 1e-9 && clearZ(z)) return x;
  }
  throw new Error('sampling-distributions: no suitable cut-off');
}

/** Distractors for a probability of an event under N(centre, sd) at cut-offs a (and b): wrong tail, wrong SD, ... */
function probMistakes(e: Ev, at: (sd: number) => Ev, wrongSds: [number, string][]): [number, string][] {
  const F = zTable;
  const ds = wrongSds.map(([sdv, why]): [number, string] => [tableP(at(sdv)), why]);
  if (e.kind !== 'between') {
    const left = F(e.z);
    ds.push([e.kind === 'below' ? 1 - left : left, 'uses the wrong tail (complement rule applied the wrong way).']);
    ds.push([Math.abs(left - 0.5), 'takes the area between the mean and the cut-off, as if Table Z gave the area from $0$ to $z$.']);
  } else {
    ds.push([F(e.zb), 'forgets to subtract the area below the lower bound.']);
    ds.push([1 - tableP(e), 'gives the area outside the interval.']);
  }
  return ds;
}

// =====================================================================================================================
// 1. Standard error / standard deviation of a statistic, and how it changes with n
// =====================================================================================================================

interface PScn {
  intro: (p: string) => string;
  who: string;
  act: string;
  ps: number[];
}
const PSCN: PScn[] = [
  { intro: (p) => `Of all customers of an online fashion shop, ${p} return at least one item.`, who: 'customers', act: 'return at least one item', ps: [0.2, 0.24, 0.28, 0.3, 0.35] },
  { intro: (p) => `At a large university, ${p} of the students live with their parents.`, who: 'students', act: 'live with their parents', ps: [0.3, 0.35, 0.4, 0.45, 0.55] },
  { intro: (p) => `Of all passengers who book a flight with a budget airline, ${p} do not show up.`, who: 'passengers', act: 'do not show up', ps: [0.06, 0.08, 0.1, 0.12] },
  { intro: (p) => `In a large city, ${p} of the households own a cargo bike.`, who: 'households', act: 'own a cargo bike', ps: [0.1, 0.12, 0.15, 0.18, 0.22] },
  { intro: (p) => `Of all visitors of a news website, ${p} click on at least one advertisement.`, who: 'visitors', act: 'click on an advertisement', ps: [0.08, 0.12, 0.15, 0.2] },
  { intro: (p) => `In a large country, ${p} of the adults are left-handed.`, who: 'adults', act: 'are left-handed', ps: [0.1, 0.12, 0.14] },
];
const pctText = (p: number) => `${num(100 * p, 2)}%`;
const SQUARES = [16, 25, 36, 49, 64, 81, 100, 144];

const standardError: Template = {
  id: 'sampling-distributions.standard-error',
  topic: TOPIC,
  title: 'Standard error of the mean s/√n, SD of a sample proportion √(p(1−p)/n), or how the standard error changes with n',
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const kind = rng.pick(['mean', 'mean', 'prop', 'resize'] as const);
    let stem: string;
    let key: number;
    let dp: number;
    let how: string;
    let ds: [number, string][];
    if (kind === 'mean') {
      const s = rng.pick(MSCN);
      const n = rng.pick(SQUARES);
      const sd0 = rng.pick(s.sds);
      const sv = round(sd0 * (1 + rng.int(-12, 12) / 100), sd0 >= 50 ? 0 : sd0 >= 5 ? 1 : 2);
      const ybar = round(rng.pick(s.mus) + sd0 * rng.int(-30, 30) / 100, sd0 >= 50 ? 0 : sd0 >= 5 ? 1 : 2);
      key = sv / Math.sqrt(n);
      dp = key < 1 ? 3 : 2;
      stem =
        `A researcher studies ${s.pop}. A random sample of $n=${n}$ ${s.items} gives a sample mean of $\\bar y=${num(ybar, 2)}$ ${s.unit} ` +
        `with a sample standard deviation of $s=${num(sv, 2)}$ ${s.unit}.\nWhat is the standard error of the sample mean?`;
      how = `The standard error of the mean estimates the standard deviation of the sampling distribution of $\\bar y$: $$SE(\\bar y)=\\frac{s}{\\sqrt n}=\\frac{${num(sv, 2)}}{\\sqrt{${n}}}=\\frac{${num(sv, 2)}}{${Math.sqrt(n)}}=${num(key, 4)}\\text{ ${s.unit}}$$ The sample mean $\\bar y$ itself is not needed.`;
      ds = [
        [sv / n, 'divides by $n$ instead of by $\\sqrt n$.'],
        [sv, 'gives the standard deviation of the individual values, $s$.'],
        [(sv * sv) / n, 'computes $s^2/n$, the variance of $\\bar y$ (forgets the square root).'],
        [Math.sqrt(sv / n), 'takes the square root of $s/n$.'],
        [ybar / Math.sqrt(n), 'divides the sample mean instead of the standard deviation by $\\sqrt n$.'],
      ];
    } else if (kind === 'prop') {
      const s = rng.pick(PSCN);
      const p = rng.pick(s.ps);
      const n = rng.pick([100, 150, 200, 250, 300, 400, 500, 600, 800].filter((m) => m * p >= 10 && m * (1 - p) >= 10));
      key = Math.sqrt((p * (1 - p)) / n);
      dp = 4;
      stem = `${s.intro(pctText(p))} Consider random samples of $n=${n}$ ${s.who} and the proportion $\\hat p$ of them that ${s.act}.\nWhat is the standard deviation of the sampling distribution of $\\hat p$?`;
      how = `For random samples, $\\hat p$ has mean $p=${num(p, 2)}$ and standard deviation $$SD(\\hat p)=\\sqrt{\\frac{p(1-p)}{n}}=\\sqrt{\\frac{${num(p, 2)}\\times ${num(1 - p, 2)}}{${n}}}=\\sqrt{${num((p * (1 - p)) / n, 7)}}=${p4(key)}$$`;
      ds = [
        [(p * (1 - p)) / n, 'forgets the square root (gives the variance of $\\hat p$).'],
        [Math.sqrt(p / n), 'uses $\\sqrt{p/n}$ (forgets the factor $1-p$).'],
        [Math.sqrt(p * (1 - p)) / n, 'divides by $n$ instead of by $\\sqrt n$.'],
        [Math.sqrt(p * (1 - p)), 'forgets to divide by $n$ (the standard deviation for a single person).'],
        [Math.sqrt(n * p * (1 - p)), 'gives $\\sqrt{np(1-p)}$, the standard deviation of the number of successes.'],
      ];
    } else {
      const s = rng.pick(MSCN);
      const c = rng.pick([2, 2, 3, 4, 1.5]);
      const n1 = c === 1.5 ? rng.pick([20, 40, 60, 80, 100]) : rng.pick([20, 25, 30, 40, 50, 60, 80, 100]);
      const n2 = c * c * n1;
      const k = rng.int(3, 20);
      const se2 = round(k * (s.sds[0] >= 50 ? 10 : 0.1), 2);
      const se1 = round(c * se2, 2);
      const head = `In a pilot study of ${s.pop}, a random sample of $n=${n1}$ ${s.items} gave a standard error of the mean of ${num(se1, 2)} ${s.unit}.`;
      if (rng.chance(0.5)) {
        key = se2;
        dp = 2;
        stem = `${head} The main study will use a random sample of $n=${n2}$ ${s.items} from the same population.\nWhat standard error of the mean do you expect for the main study?`;
        how = `$SE=\\frac{s}{\\sqrt n}$, so the standard error is proportional to $\\frac{1}{\\sqrt n}$: $$SE_2=SE_1\\sqrt{\\frac{n_1}{n_2}}=${num(se1, 2)}\\times\\sqrt{\\frac{${n1}}{${n2}}}=${num(se1, 2)}\\times ${num(1 / c, 4)}=${num(se2, 2)}\\text{ ${s.unit}}$$ A sample ${num(c * c, 2)} times as large gives a standard error ${num(c, 2)} times as small.`;
        ds = [
          [(se1 * n1) / n2, 'assumes the standard error is proportional to $1/n$ instead of $1/\\sqrt n$.'],
          [se1 * c, 'lets the standard error grow with the sample size.'],
          [se1, 'thinks the standard error does not depend on the sample size.'],
        ];
      } else {
        key = n2;
        dp = 0;
        stem = `${head}\nHow large must a random sample from the same population be to get a standard error of ${num(se2, 2)} ${s.unit}?`;
        how = `$SE=\\frac{s}{\\sqrt n}$, so $\\sqrt n$ must become $\\frac{${num(se1, 2)}}{${num(se2, 2)}}=${num(c, 2)}$ times as large, i.e. $n$ must become $${num(c, 2)}^2=${num(c * c, 2)}$ times as large: $$n_2=n_1\\left(\\frac{SE_1}{SE_2}\\right)^2=${n1}\\times ${num(c * c, 2)}=${n2}$$`;
        ds = [
          [n1 * c, 'assumes the standard error is proportional to $1/n$, so multiplies $n$ by the factor itself.'],
          [n1 * Math.sqrt(c), 'multiplies $n$ by the square root of the factor.'],
          [n2 - n1, 'gives the number of extra observations instead of the total sample size.'],
          [n1 * c * c * c, 'raises the factor to the third power.'],
        ];
      }
    }
    if (type === 'numeric') return numeric(stem, key, dp, how);
    const mk = (v: number, why?: string): Choice => ({ text: num(v, dp), value: round(v, dp), ...(why ? { why } : {}) });
    const mcq = buildMcq(
      rng,
      mk(key),
      ds.filter(([v]) => v > 0 && Math.abs(v - key) > 0.08 * key).map(([v, why]) => mk(v, why)),
      { count: optionCount, order: 'ascending', epsilon: 0.08, fallback: (i) => mk(key * (1 + (i % 2 ? -1 : 1) * 0.25 * (Math.floor(i / 2) + 1)), 'an arithmetic slip.') },
    );
    return choice(stem, mcq, how);
  },
};

// =====================================================================================================================
// 2. Probability for a sample mean (or a total) with the CLT
// =====================================================================================================================

const meanProbability: Template = {
  id: 'sampling-distributions.mean-probability',
  topic: TOPIC,
  title: 'P(ȳ > a), P(ȳ < a), P(a < ȳ < b) or P(total > L) with the Central Limit Theorem: SD(ȳ) = σ/√n and Table Z',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const s = rng.pick(MSCN);
    const mu = rng.pick(s.mus);
    const sd = rng.pick(s.sds);
    const normal = s.shape === 'Normal';
    const kind = s.total && rng.chance(0.4) ? 'total' : rng.pick(['above', 'below', 'between'] as const);
    const n = kind === 'total' ? rng.pick([9, 16, 25]) : rng.pick(normal ? [4, 9, 16, 25, 36] : [36, 49, 64, 81, 100, 144]);
    const se = sd / Math.sqrt(n);
    const grid = gridFor(se);
    let a: number;
    let b = 0;
    let L = 0;
    if (kind === 'total') {
      const st = s.total!.step;
      for (;;) {
        L = Math.round((n * (mu + rng.step(0.3, 2.2, 0.01) * se)) / st) * st;
        const z = (L / n - mu) / se;
        if (z >= 0.3 && z <= 2.4 && clearZ(z)) break;
      }
      a = L / n;
    } else if (kind === 'between') {
      const d = cutAt(rng, mu, se, grid, 1, 0.4, 2.2) - mu;
      [a, b] = rng.chance(0.6) ? [mu - d, mu + d] : [cutAt(rng, mu, se, grid, -1, 0.3, 2.2), cutAt(rng, mu, se, grid, 1, 0.3, 2.2)];
      a = round(a, 6);
      b = round(b, 6);
    } else a = cutAt(rng, mu, se, grid, rng.sign(), 0.3, 2.4);
    const at = (sdv: number): Ev =>
      kind === 'between' ? { kind, za: (a - mu) / sdv, zb: (b - mu) / sdv } : { kind: kind === 'below' ? 'below' : 'above', z: (a - mu) / sdv };
    const e = at(se);
    const P = tableP(e);
    const Px = exactP(e);
    const u = s.unit;
    const event = kind === 'between' ? `between ${num(a, 4)} and ${num(b, 4)} ${u}` : `${kind === 'below' ? 'less' : 'more'} than ${num(a, 4)} ${u}`;
    const stem =
      popSentence(rng, s, mu, sd) +
      '\n' +
      (kind === 'total'
        ? `${s.total!.intro(n, L)} What is the probability that the total weight of the ${n} ${s.items} is more than ${L} ${u}?`
        : `A random sample of $n=${n}$ ${s.items} is drawn. What is the probability that the sample mean $\\bar y$ is ${event}?`);
    const why = normal
      ? 'The population is Normal, so $\\bar y$ is Normal for every sample size'
      : `By the Central Limit Theorem ($n=${n}$ is large), $\\bar y$ is approximately Normal even though the population is ${s.shape}`;
    let how =
      `${why}, with mean $\\mu=${num(mu, 2)}$ and standard deviation $$SD(\\bar y)=\\frac{\\sigma}{\\sqrt n}=\\frac{${num(sd, 2)}}{\\sqrt{${n}}}=${num(se, 4)}$$` +
      (kind === 'total' ? `The total is more than ${L} ${u} exactly when the mean weight is more than $\\frac{${L}}{${n}}=${num(a, 4)}$ ${u}.\n` : '');
    const M = num(mu, 2);
    const S = num(se, 4);
    if (e.kind === 'between')
      how += `$$${zStep('z_a', num(a, 4), M, S, e.za)}\\qquad ${zStep('z_b', num(b, 4), M, S, e.zb)}$$ Table Z: $${phiTex(e.zb)}$ and $${phiTex(e.za)}$, so $$P(${num(a, 4)}<\\bar y<${num(b, 4)})=${p4(zTable(e.zb))}-${p4(zTable(e.za))}=${p4(P)}$$`;
    else if (e.kind === 'below') how += `$$${zStep('z', num(a, 4), M, S, e.z)}$$ $$P(\\bar y<${num(a, 4)})=${phiTex(e.z)}$$`;
    else how += `$$${zStep('z', num(a, 4), M, S, e.z)}$$ Table Z: $${phiTex(e.z)}$; we need the right tail: $$P(\\bar y>${num(a, 4)})=1-${p4(zTable(e.z))}=${p4(P)}$$`;
    if (type === 'numeric') return numeric(stem, P, 4, how + `\n(Without rounding $z$: ${p4(Px)}; accepted too.)`, acceptAround(4, P, Px));
    const wrong: [number, string][] = [
      [sd, kind === 'total' ? 'uses $n\\sigma$ instead of $\\sqrt n\\,\\sigma$ as the standard deviation of the total (this is the probability for a single item).' : 'uses $\\sigma$ instead of $\\sigma/\\sqrt n$: the probability for one individual, not for the mean.'],
      [sd / n, 'divides $\\sigma$ by $n$ instead of by $\\sqrt n$.'],
    ];
    const extra: Choice[] = normal
      ? []
      : [{ text: 'This probability cannot be calculated without knowing the exact shape of the population distribution.', value: 9, why: `with $n=${n}$ the Central Limit Theorem makes $\\bar y$ approximately Normal, whatever the shape of the population.` }];
    const ds = probMistakes(e, at, wrong);
    const mcq = probMcq(rng, P, Px, ds, optionCount, extra);
    return choice(stem, mcq, how);
  },
};

// =====================================================================================================================
// 3. Sampling distribution of a sample proportion
// =====================================================================================================================

const proportion: Template = {
  id: 'sampling-distributions.proportion',
  topic: TOPIC,
  title: 'Probability that a sample proportion is above / below / between values: p̂ ≈ N(p, √(p(1−p)/n)) after checking the conditions',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const s = rng.pick(PSCN);
    const p = rng.pick(s.ps);
    const n = rng.pick([200, 250, 300, 400, 500, 600, 800, 1000].filter((m) => m * p >= 10 && m * (1 - p) >= 10));
    const sd = Math.sqrt((p * (1 - p)) / n);
    const kind = rng.pick(['above', 'below', 'between'] as const);
    const grid = sd >= 0.02 ? 0.01 : 0.005;
    let a: number;
    let b = 0;
    if (kind === 'between') {
      a = cutAt(rng, p, sd, grid, -1, 0.3, 2.2);
      b = cutAt(rng, p, sd, grid, 1, 0.3, 2.2);
    } else a = cutAt(rng, p, sd, grid, rng.sign(), 0.3, 2.4);
    const at = (sdv: number): Ev => (kind === 'between' ? { kind, za: (a - p) / sdv, zb: (b - p) / sdv } : { kind, z: (a - p) / sdv });
    const e = at(sd);
    const P = tableP(e);
    const Px = exactP(e);
    const event = kind === 'between' ? `between ${pctText(a)} and ${pctText(b)}` : `${kind === 'below' ? 'less' : 'more'} than ${pctText(a)}`;
    const stem = `${s.intro(pctText(p))} A random sample of $n=${n}$ ${s.who} is taken.\nWhat is the probability that the proportion of ${s.who} in the sample who ${s.act} is ${event}?`;
    const [Pp, S] = [num(p, 2), num(sd, 4)];
    let how =
      `Conditions: the sample is random, $n$ is less than 10% of the population, and $np=${num(n * p, 2)}\\ge 10$ and $n(1-p)=${num(n * (1 - p), 2)}\\ge 10$. ` +
      `So $\\hat p$ is approximately Normal with mean $p=${Pp}$ and standard deviation $$SD(\\hat p)=\\sqrt{\\frac{p(1-p)}{n}}=\\sqrt{\\frac{${Pp}\\times ${num(1 - p, 2)}}{${n}}}=${S}$$`;
    if (e.kind === 'between')
      how += `$$${zStep('z_a', num(a, 3), Pp, S, e.za)}\\qquad ${zStep('z_b', num(b, 3), Pp, S, e.zb)}$$ $$P(${num(a, 3)}<\\hat p<${num(b, 3)})=${p4(zTable(e.zb))}-${p4(zTable(e.za))}=${p4(P)}$$`;
    else if (e.kind === 'below') how += `$$${zStep('z', num(a, 3), Pp, S, e.z)}$$ $$P(\\hat p<${num(a, 3)})=${phiTex(e.z)}$$`;
    else how += `$$${zStep('z', num(a, 3), Pp, S, e.z)}$$ $$P(\\hat p>${num(a, 3)})=1-${p4(zTable(e.z))}=${p4(P)}$$`;
    if (type === 'numeric') return numeric(stem, P, 4, how + `\n(Without rounding $z$: ${p4(Px)}; accepted too.)`, acceptAround(4, P, Px));
    const ds = probMistakes(e, at, [
      [Math.sqrt(p * (1 - p)), 'forgets to divide by $n$: uses $\\sqrt{p(1-p)}$, the standard deviation for a single person.'],
      [Math.sqrt(p * (1 - p)) / n, 'divides by $n$ instead of by $\\sqrt n$.'],
      [Math.sqrt(p / n), 'uses $\\sqrt{p/n}$ (forgets the factor $1-p$).'],
      [(p * (1 - p)) / n, 'forgets the square root: uses the variance $p(1-p)/n$ as the standard deviation.'],
    ]);
    return choice(stem, probMcq(rng, P, Px, ds, optionCount), how);
  },
};

// =====================================================================================================================
// 4. The Central Limit Theorem: which histogram is the sampling distribution of ȳ; statements
// =====================================================================================================================

interface Pop {
  shape: 'U-shaped' | 'right-skewed' | 'left-skewed';
  v0: number;
  story: string;
  x: string;
}
const POPS: Pop[] = [
  { shape: 'U-shaped', v0: 1, story: 'All visitors of a film festival rated a controversial film on a scale from 1 (awful) to 7 (brilliant).', x: 'Rating' },
  { shape: 'U-shaped', v0: 1, story: 'All members of a large sports club gave their opinion on a proposed new club logo, on a scale from 1 (hate it) to 7 (love it).', x: 'Opinion score' },
  { shape: 'right-skewed', v0: 0, story: 'For all employees of a large company, the number of cups of coffee they drink on a working day (0 to 6) was recorded.', x: 'Cups of coffee' },
  { shape: 'right-skewed', v0: 0, story: 'For all members of a public library, the number of books they borrowed last month (0 to 6) was recorded.', x: 'Books borrowed' },
  { shape: 'left-skewed', v0: 1, story: 'All guests of a popular hotel rated their stay on a scale from 1 (very poor) to 7 (excellent).', x: 'Rating' },
  { shape: 'left-skewed', v0: 0, story: 'All participants of a training answered an easy six-question quiz; the number of correct answers (0 to 6) was recorded.', x: 'Correct answers' },
];
const SHAPES: Record<Pop['shape'], number[][]> = {
  'U-shaped': [[24, 12, 7, 5, 8, 14, 30], [30, 13, 6, 4, 6, 12, 29], [27, 15, 6, 3, 7, 13, 29], [29, 14, 5, 3, 5, 15, 29]],
  'right-skewed': [[35, 25, 15, 10, 7, 5, 3], [30, 28, 17, 11, 7, 4, 3], [40, 22, 14, 10, 6, 5, 3], [33, 27, 18, 10, 6, 4, 2]],
  'left-skewed': [],
};
SHAPES['left-skewed'] = SHAPES['right-skewed'].map((w) => [...w].reverse());

/** Distribution of the sum of n draws (values 0..6 with probabilities w/100): convolution. */
export function sumDist(w: readonly number[], n: number): number[] {
  let d = [1];
  for (let k = 0; k < n; k++) {
    const nd = new Array(d.length + 6).fill(0);
    d.forEach((pd, i) => w.forEach((pw, j) => (nd[i + j] += (pd * pw) / 100)));
    d = nd;
  }
  return d;
}

/** Histogram bars of the mean of n draws: bins of m consecutive sums (m = 1 for n ≤ 3, else n/5: width 0.2). */
export function meanBars(w: readonly number[], n: number, v0: number): Bar[] {
  const d = sumDist(w, n);
  const m = n <= 3 ? 1 : n / 5;
  const bars: Bar[] = [];
  for (let k = 0; k * m < d.length; k++) {
    let h = 0;
    for (let j = k * m; j < Math.min(d.length, (k + 1) * m); j++) h += d[j];
    bars.push({ x0: v0 + (k * m - 0.5) / n, x1: v0 + (k * m + m - 0.5) / n, h: 100 * h });
  }
  return bars;
}

const clt: Template = {
  id: 'sampling-distributions.clt',
  topic: TOPIC,
  title: 'Central Limit Theorem: which histogram shows the sampling distribution of ȳ for samples of size n from a U-shaped or skewed population; statements about it',
  types: ['single-choice', 'multi-select'],
  difficulty: 3,
  generate({ rng, type, optionCount }) {
    // small samples (n = 2) only from a U-shaped population in the single-choice version, as in the past exam: for a
    // skewed population the means of two values are too close to Normal to tell apart reliably in a histogram
    const small = rng.chance(0.5);
    const pop = rng.pick(small && type === 'single-choice' ? POPS.filter((q) => q.shape === 'U-shaped') : POPS);
    const w = rng.pick(SHAPES[pop.shape]);
    const v0 = pop.v0;
    const vals = w.map((_, i) => v0 + i);
    const mu = vals.reduce((t, v, i) => t + (v * w[i]) / 100, 0);
    const sigma = Math.sqrt(vals.reduce((t, v, i) => t + ((v - mu) ** 2 * w[i]) / 100, 0));
    const n = small ? 2 : rng.pick([25, 30, 40, 50]);
    const axis = { lo: v0 - 0.6, hi: v0 + 6.6, ticks: vals };
    const popBars: Bar[] = vals.map((v, i) => ({ x0: v - 0.5, x1: v + 0.5, h: w[i] }));
    const popImg = { src: histPanelsSvg([{ title: 'Population', bars: popBars }], axis, 1, `${pop.x} (percentage of the population)`), alt: `Histogram of the population: ${pop.shape}` };
    const se = sigma / Math.sqrt(n);
    const desc = `mean $\\mu=${num(mu, 2)}$, standard deviation $\\sigma=${num(sigma, 2)}$`;
    const shapeText = pop.shape === 'U-shaped' ? 'U-shaped (most values at both ends)' : pop.shape;

    if (type === 'multi-select') {
      const n4 = 4 * n;
      const st = [
        { text: `The mean of the sampling distribution of $\\bar y$ is ${num(mu, 2)}.`, correct: true, why: `the sampling distribution of $\\bar y$ is centred at the population mean $\\mu=${num(mu, 2)}$.` },
        { text: `The standard deviation of the sampling distribution of $\\bar y$ is about ${num(se, 2)}.`, correct: true, why: `$SD(\\bar y)=\\sigma/\\sqrt n=${num(sigma, 2)}/\\sqrt{${n}}=${num(se, 2)}$.` },
        { text: `The standard deviation of the sampling distribution of $\\bar y$ is about ${num(sigma / n, 2)}.`, correct: false, why: `that is $\\sigma/n$; the correct value is $\\sigma/\\sqrt n=${num(se, 2)}$.` },
        { text: `The standard deviation of the sampling distribution of $\\bar y$ is about ${num(sigma, 2)}.`, correct: false, why: 'that is the spread of the individual values; means of samples vary less: $\\sigma/\\sqrt n$.' },
        { text: `With samples of size $n=${n4}$, the standard deviation of $\\bar y$ would be about ${num(se / 2, 2)}.`, correct: true, why: 'four times as many observations halve $\\sigma/\\sqrt n$.' },
        { text: `With samples of size $n=${n4}$, the standard deviation of $\\bar y$ would be about ${num(se / 4, 2)}.`, correct: false, why: `$\\sigma/\\sqrt{${n4}}=${num(se / 2, 2)}$: four times as many observations only halve the standard deviation.` },
        { text: 'Drawing larger samples makes the distribution of the individual values in the population closer to Normal.', correct: false, why: 'the population does not change; only the distribution of the sample means gets closer to Normal.' },
        small
          ? { text: `With samples this small, the sampling distribution of $\\bar y$ is not yet approximately Normal; it still shows features of the ${pop.shape} population.`, correct: true, why: `the CLT needs a large $n$; for $n=${n}$ the shape of the population still shows through.` }
          : { text: `The sampling distribution of $\\bar y$ is approximately Normal, although the population is ${pop.shape}.`, correct: true, why: `Central Limit Theorem: $n=${n}$ is large.` },
        small
          ? { text: 'The sampling distribution of $\\bar y$ is approximately Normal, because the Central Limit Theorem holds for every sample size.', correct: false, why: `the CLT is about large samples; with $n=${n}$ and a ${pop.shape} population the shape is not yet Normal.` }
          : { text: `The sampling distribution of $\\bar y$ is ${pop.shape}, just like the population.`, correct: false, why: `for $n=${n}$ the CLT makes it approximately Normal.` },
      ];
      const m = buildMulti(rng, st, optionCount, 1);
      const stem = `${pop.story} The histogram below shows the population distribution: ${desc}.\nConsider the sampling distribution of the sample mean $\\bar y$ for random samples of size $n=${n}$ from this population. Which statements are correct?`;
      const how =
        `The sampling distribution of $\\bar y$ has mean $\\mu=${num(mu, 2)}$ and standard deviation $\\sigma/\\sqrt n=${num(sigma, 2)}/\\sqrt{${n}}=${num(se, 2)}$. ` +
        (small ? `Its shape: $n=${n}$ is too small for the Central Limit Theorem, so the ${pop.shape} shape of the population still shows.` : `Its shape: by the Central Limit Theorem ($n=${n}$ is large) it is approximately Normal.`) +
        '\n\n**Option by option**\n' +
        m.reasons.map((r) => `- **${r.id}** ${r.correct ? '(correct)' : '(wrong)'}: ${r.why}`).join('\n');
      return { type, stem, images: [popImg], instruction: INSTRUCTION.multi, options: m.options, correctAnswer: m.correctAnswer, explanation: how };
    }

    const correct = meanBars(w, n, v0);
    const bins = correct.map(({ x0, x1 }) => ({ x0, x1 }));
    const mirror = (bars: Bar[]) => bars.map((r) => ({ x0: 2 * (v0 + 3) - r.x1, x1: 2 * (v0 + 3) - r.x0, h: r.h }));
    const skew = pop.shape !== 'U-shaped';
    type Cand = { bars: Bar[]; why: string };
    const cPop: Cand = { bars: popBars, why: 'has the shape and spread of the population itself: the sample means would vary just as much as the individual values.' };
    const cWide: Cand = { bars: normalBars(bins, mu, sigma), why: 'has the right centre, but the spread $\\sigma$ of the individual values instead of $\\sigma/\\sqrt n$.' };
    const cNarrow: Cand = { bars: normalBars(bins, mu, sigma / n), why: 'divides $\\sigma$ by $n$ instead of by $\\sqrt n$: far too little spread.' };
    const cMirror: Cand = { bars: mirror(correct), why: 'is skewed to the wrong side, with its centre in the wrong place.' };
    const pool: Cand[] = small
      ? [cPop, { bars: normalBars(bins, mu, se), why: `is Normal with the right centre and spread, but $n=${n}$ is far too small for the Central Limit Theorem with this ${pop.shape} population.` }, cNarrow, cWide, ...(skew ? [cMirror] : [])]
      : [cPop, cWide, cNarrow, { bars: meanBars(w, 2, v0), why: `shows the means of samples of size 2: far more spread (and population shape) than for $n=${n}$.` }, ...(skew ? [cMirror] : [])];
    const chosen = rng.shuffle(pool.filter((c) => histDistance(c.bars, correct, axis.lo, axis.hi) > 0.3)).slice(0, optionCount - 1);
    if (chosen.length < optionCount - 1) throw new Error('clt: not enough distinct histograms');
    const panels = rng.shuffle([{ bars: correct, why: '' }, ...chosen]);
    const letters = 'abcde';
    const cols = panels.length === 4 ? 2 : 3;
    const candImg = {
      src: histPanelsSvg(panels.map((c, i) => ({ title: `(${letters[i]})`, bars: c.bars })), axis, cols, `Sample mean (percentage of the samples)`),
      alt: 'Candidate histograms (a) to (e) for the distribution of the sample means',
    };
    const options = panels.map((_, i) => ({ id: 'ABCDE'[i], text: `Histogram (${letters[i]})` }));
    const ki = panels.findIndex((c) => c.bars === correct);
    const distractors = panels.map((c, i) => ({ id: 'ABCDE'[i], text: `Histogram (${letters[i]})`, why: c.why })).filter((_, i) => i !== ki);
    const shapeHow = small
      ? pop.shape === 'U-shaped'
        ? `With $n=${n}$ the population shape still shows: a sample can consist of two low values, two high values, or one of each, so the means pile up near both ends and in the middle, where the mixed samples (the most common kind) end up.`
        : `With $n=${n}$ the Central Limit Theorem has not done its work yet: the means are less spread and less skewed than the individual values, but the distribution is still clearly ${pop.shape}.`
      : `With $n=${n}$ the Central Limit Theorem applies: the distribution of $\\bar y$ is approximately Normal, even though the population is ${shapeText}.`;
    const how =
      `The sampling distribution of $\\bar y$ is centred at $\\mu=${num(mu, 2)}$ and has standard deviation $\\sigma/\\sqrt n=${num(sigma, 2)}/\\sqrt{${n}}=${num(se, 2)}$. ${shapeHow}\n` +
      `Only histogram (${letters[ki]}) has this centre, spread and shape.`;
    const stem =
      `${pop.story} The first histogram below shows the population distribution: ${desc}.\n` +
      `A researcher draws a very large number of random samples of size $n=${n}$ from this population and computes the mean $\\bar y$ of every sample. ` +
      'Which of the histograms (a) to ' +
      `(${letters[panels.length - 1]}) most likely shows the distribution of these sample means?`;
    return { type, stem, images: [popImg, candImg], options, correctAnswer: options[ki].id, explanation: how + mistakesNote(distractors) };
  },
};

export const TEMPLATES: Template[] = [standardError, meanProbability, proportion, clt];
