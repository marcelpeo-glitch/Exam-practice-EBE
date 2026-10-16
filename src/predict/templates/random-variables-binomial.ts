// Templates for the topic "Random variables & binomial" (QM1 past exams: expected value of a discrete probability
// model given as a table, expected gain of a game of chance, mean and SD of sums / differences of independent random
// variables, binomial probabilities "at most / at least / exactly", and the Normal approximation to the binomial).
// Every answer is computed in code (exact sums, Table Z values via stats.ts); wrong options come from named student
// mistakes. See random-variables-binomial.test.ts for the independent checks.
import type { TableData } from '../../types';
import { INSTRUCTION, buildMcq, buildMulti, fixed, mistakesNote, num, numericField, type Choice } from '../build';
import type { Rng } from '../rng';
import { binomPmf, choose, normCdf, round, zTable } from '../stats';
import type { GenType, Generated, Template } from '../types';

const TOPIC = 'Random variables & binomial' as const;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const reasonsNote = (rs: { id: string; correct: boolean; why: string }[]) =>
  '\n\n**Statement by statement**\n' + rs.map((r) => `- **${r.id}** ${r.correct ? '(true)' : '(false)'}: ${r.why}`).join('\n');

interface Wrong {
  value: number;
  why: string;
}

/** A numeric answer as single-choice (options from modelled mistakes) or numeric. */
function valueQuestion(o: {
  type: GenType;
  rng: Rng;
  optionCount: number;
  stem: string;
  table?: TableData;
  key: number;
  dp: number;
  wrong: Wrong[];
  explanation: string;
  /** Allowed range for option values (default: probabilities strictly inside (0, 1)). */
  range?: [number, number];
  /** Minimum distance between a wrong option and the key, in units of the last decimal (default 2.5). */
  gap?: number;
  fmt?: (v: number) => string;
  acceptRange?: [number, number];
  numericStem?: string;
}): Generated {
  const { type, key, dp } = o;
  const table = o.table ? { table: o.table } : {};
  if (type === 'numeric') {
    const f = numericField('x', undefined, key, dp, o.acceptRange);
    return {
      type,
      stem: o.numericStem ?? o.stem,
      ...table,
      instruction: INSTRUCTION.numeric(dp),
      correctAnswer: f.answer,
      tolerance: f.tolerance,
      ...(f.acceptRange ? { acceptRange: f.acceptRange } : {}),
      explanation: o.explanation,
    };
  }
  const u = 10 ** -dp;
  const [lo, hi] = o.range ?? [2 * u, 1 - 2 * u];
  const fmt = o.fmt ?? ((v: number) => fixed(v, dp));
  const choice = (v: number, why?: string): Choice => ({ text: fmt(v), value: v, ...(why ? { why } : {}) });
  const usable = o.wrong.filter((w) => Number.isFinite(w.value) && w.value >= lo && w.value <= hi && Math.abs(w.value - key) > (o.gap ?? 2.5) * u);
  const spread = Math.max(Math.abs(key), 10 * u);
  const mcq = buildMcq(o.rng, choice(key), usable.map((w) => choice(w.value, w.why)), {
    count: o.optionCount,
    order: 'ascending',
    epsilon: 0.03,
    fallback: (i) => {
      const s = 0.12 * (1 + (i >> 1));
      let v = key + (i % 2 ? -1 : 1) * s * spread;
      if (o.range === undefined) v = i % 2 ? key * (1 - Math.min(0.9, s)) : key + (1 - key) * Math.min(0.9, s);
      return choice(v, 'an arithmetic slip somewhere along the way.');
    },
  });
  return { type, stem: o.stem, ...table, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: o.explanation + mistakesNote(mcq.distractors) };
}

// =====================================================================================================================
// 1. A discrete probability model in a table: E(X), SD(X), P(X ≥ k), statements
// =====================================================================================================================

interface DistScenario {
  label: string;
  intro: string;
  noun: string;
  start: number;
}

const DISTS: readonly DistScenario[] = [
  { label: 'Breakdowns per week', intro: 'The facility manager of a faculty building describes the number of breakdowns $X$ of the espresso machine in a week with the probability model below.', noun: 'breakdowns per week', start: 0 },
  { label: 'Goals per match', intro: 'For the first team of a local women’s football club, the number of goals $X$ scored in a match follows the probability model below.', noun: 'goals per match', start: 0 },
  { label: 'Pets in the household', intro: 'In a residential area, the number of pets $X$ in a randomly chosen household has the probability model below.', noun: 'pets per household', start: 0 },
  { label: 'Items sent back', intro: 'For a randomly chosen order at an online clothing store, the number of items $X$ that the customer sends back has the probability model below.', noun: 'items sent back per order', start: 0 },
  { label: 'Cancelled trains', intro: 'On a regional railway line, the number of cancelled trains $X$ on a randomly chosen day follows the probability model below.', noun: 'cancelled trains per day', start: 0 },
  { label: 'Working days until delivery', intro: 'A web shop models the number of working days $X$ between ordering and delivery with the probability model below.', noun: 'working days until delivery', start: 1 },
  { label: 'Scoops per order', intro: 'At an ice-cream parlour, the number of scoops $X$ in a randomly chosen order has the probability model below.', noun: 'scoops per order', start: 1 },
  { label: 'Customers waiting', intro: 'At a bike-rental desk, the number of customers $X$ already waiting when the desk opens follows the probability model below.', noun: 'waiting customers', start: 0 },
];

type Op = '\\ge' | '\\le' | '>' | '<';
const OP_WORD: Record<Op, string> = { '\\ge': 'at least', '\\le': 'at most', '>': 'more than', '<': 'fewer than' };
const holds = (x: number, op: Op, k: number) => (op === '\\ge' ? x >= k : op === '\\le' ? x <= k : op === '>' ? x > k : x < k);

/** Integer percentages (each ≥ 3) summing to 100. */
function percents(rng: Rng, k: number): number[] {
  for (;;) {
    const w = Array.from({ length: k }, () => rng.int(1, 9));
    const tot = sum(w);
    const p = w.map((x) => Math.max(3, Math.round((100 * x) / tot)));
    const big = p.indexOf(Math.max(...p));
    p[big] += 100 - sum(p);
    if (p.every((x) => x >= 3)) return p;
  }
}

type DistKind = 'mean' | 'sd' | 'prob';

const distributionTable: Template = {
  id: 'random-variables-binomial.distribution-table',
  topic: TOPIC,
  title: 'Discrete probability model in a table (possibly one probability missing): E(X), SD(X), P(X ≥ k), statements',
  types: ['single-choice', 'numeric', 'multi-select'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const sc = rng.pick(DISTS);
    const k = rng.int(4, 5);
    const xs = Array.from({ length: k }, (_, i) => sc.start + i);
    const pc = percents(rng, k);
    const ps = pc.map((x) => x / 100);
    const miss = rng.chance(0.35) ? rng.int(0, k - 1) : -1;
    const table: TableData = { header: [sc.label, ...xs.map(String)], rows: [['Probability', ...ps.map((p, i) => (i === miss ? '?' : fixed(p, 2)))]] };
    const mu = sum(xs.map((x, i) => x * pc[i])) / 100;
    const ex2 = sum(xs.map((x, i) => x * x * pc[i])) / 100;
    const vr = ex2 - mu * mu;
    const sd = Math.sqrt(vr);
    const P = (op: Op, kk: number, p = ps) => sum(xs.map((x, i) => (holds(x, op, kk) ? p[i] : 0)));
    const ps0 = ps.map((p, i) => (i === miss ? 0 : p)); // the "missing = 0" mistake
    const mu0 = sum(xs.map((x, i) => x * ps0[i]));
    const missText = miss >= 0 ? `The probabilities must add up to 1, so the missing one is $P(X=${xs[miss]})=1-(${ps.filter((_, i) => i !== miss).map((p) => fixed(p, 2)).join('+')})=${fixed(ps[miss], 2)}$.\n` : '';
    const terms = xs.map((x, i) => `${x}\\cdot ${fixed(ps[i], 2)}`).join('+');
    const meanText = `$$E(X)=\\sum x\\,P(x)=${terms}=${num(mu, 4)}$$`;
    const varText =
      `$$\\text{Var}(X)=\\sum (x-\\mu)^2P(x)=${xs.map((x, i) => `(${x}-${num(mu, 4)})^2\\cdot ${fixed(ps[i], 2)}`).join('+')}\\approx ${num(vr, 4)}$$` +
      `$$\\text{SD}(X)=\\sqrt{${num(vr, 4)}}\\approx ${fixed(sd, 2)}$$`;
    const intro = `${sc.intro}${miss >= 0 ? ' One probability is missing from the table.' : ''}`;
    const mode = xs[pc.indexOf(Math.max(...pc))];
    const uniqueMode = pc.filter((x) => x === Math.max(...pc)).length === 1;

    if (type === 'multi-select') {
      const kGe = rng.int(xs[1], xs[k - 2]);
      const kLt = rng.int(xs[1], xs[k - 2]);
      type Slot = (want: boolean) => { text: string; correct: boolean; why: string } | null;
      const numSlot = (lhs: string, value: number, wrongValue: number, wrongWhy: string, how: string): Slot => (want) => {
        if (want) return { text: `$${lhs}=${fixed(value, 2)}$`, correct: true, why: how };
        if (Math.abs(wrongValue - value) < 0.02) return null;
        return { text: `$${lhs}=${fixed(wrongValue, 2)}$`, correct: false, why: `${wrongWhy} ${how}` };
      };
      const slots: Slot[] = [
        numSlot('E(X)', mu, sum(xs) / k, 'that is the plain average of the values, not weighted by the probabilities.', `$E(X)=${terms}=${num(mu, 4)}$.`),
        numSlot('\\text{SD}(X)', sd, vr, 'that is the variance; the SD is its square root.', `$\\text{Var}(X)\\approx ${num(vr, 4)}$, so $\\text{SD}(X)\\approx ${num(sd, 4)}$.`),
        numSlot('\\text{Var}(X)', vr, ex2, 'that is $E(X^2)$; subtract $\\mu^2$ to get the variance.', `$\\text{Var}(X)=E(X^2)-\\mu^2=${num(ex2, 4)}-${num(mu, 4)}^2\\approx ${num(vr, 4)}$.`),
        numSlot(`P(X\\ge ${kGe})`, P('\\ge', kGe), P('>', kGe), `that is $P(X>${kGe})$: it leaves out $X=${kGe}$.`, `$P(X\\ge ${kGe})=${num(P('\\ge', kGe), 4)}$.`),
        numSlot(`P(X<${kLt})`, P('<', kLt), P('\\le', kLt), `that is $P(X\\le ${kLt})$: it includes $X=${kLt}$.`, `$P(X<${kLt})=${num(P('<', kLt), 4)}$.`),
        (want) => {
          if (want && !uniqueMode) return null;
          const other = xs.filter((x) => x !== mode);
          const m = want ? mode : rng.pick(other);
          return { text: `The most likely value of $X$ is $${m}$.`, correct: want, why: `The largest probability, $${fixed(Math.max(...ps), 2)}$, belongs to $X=${mode}$.` };
        },
      ];
      if (miss >= 0)
        slots.push((want) => ({
          text: `The missing probability in the table is ${fixed(want ? ps[miss] : 1 - ps[miss] === ps[miss] ? ps[miss] + 0.1 : 1 - ps[miss], 2)}.`,
          correct: want,
          why: missText.trim(),
        }));
      const pool: { text: string; correct: boolean; why: string }[] = [];
      let falses = 0;
      for (const s of rng.shuffle(slots)) {
        const wantFalse = falses < optionCount - 1;
        const st = s(!wantFalse) ?? s(wantFalse);
        if (!st) continue;
        if (!st.correct) falses++;
        pool.push(st);
      }
      const m = buildMulti(rng, pool, optionCount, 1);
      const base = `${missText}For a discrete random variable, ${meanText}${varText}`;
      return { type, stem: `${intro}\n\nWhich of the following statements are true?`, table, instruction: INSTRUCTION.multi, options: m.options, correctAnswer: m.correctAnswer, explanation: base + reasonsNote(m.reasons) };
    }

    const kind = rng.pick<DistKind>(['mean', 'mean', 'sd', 'prob', 'prob']);
    let q: string;
    let key: number;
    let explanation: string;
    let wrong: Wrong[];
    const missWrong = (v: number, why = 'treats the missing probability as 0.') => (miss >= 0 ? [{ value: v, why }] : []);
    if (kind === 'mean') {
      q = rng.pick([`What is the expected number of ${sc.noun}, $E(X)$?`, `Based on this model, what is the mean number of ${sc.noun}, $E(X)$?`]);
      key = mu;
      explanation = `${missText}The expected value weights every value by its probability: ${meanText}`;
      const cum = xs.find((_, i) => sum(ps.slice(0, i + 1)) >= 0.5)!;
      wrong = [
        { value: sum(xs) / k, why: 'averages the values without weighting them by their probabilities.' },
        ...missWrong(mu0),
        { value: mode, why: 'takes the most likely value instead of the mean.' },
        { value: mu / k, why: `divides the weighted sum by the number of values (${k}) as well.` },
        { value: ex2, why: 'computes $E(X^2)$ instead of $E(X)$.' },
        { value: cum, why: 'gives the median of the distribution, not the mean.' },
      ];
    } else if (kind === 'sd') {
      q = `What is the standard deviation $\\text{SD}(X)$ of the number of ${sc.noun}?`;
      key = sd;
      explanation = `${missText}First the mean: ${meanText}Then the variance and its square root: ${varText}`;
      const xbar = sum(xs) / k;
      wrong = [
        { value: vr, why: 'stops at the variance and forgets the square root.' },
        { value: Math.sqrt(ex2), why: 'takes $\\sqrt{E(X^2)}$ and forgets to subtract $\\mu^2$.' },
        { value: Math.sqrt(sum(xs.map((x) => (x - xbar) ** 2)) / k), why: 'computes the spread of the values themselves, ignoring the probabilities.' },
        { value: sum(xs.map((x, i) => Math.abs(x - mu) * ps[i])), why: 'averages the absolute deviations $|x-\\mu|$ instead of squaring them.' },
        ...missWrong(Math.sqrt(Math.max(0, sum(xs.map((x, i) => x * x * ps0[i])) - mu0 * mu0))),
      ];
    } else {
      const op = rng.pick<Op>(['\\ge', '\\le', '>', '<']);
      const kk = op === '\\ge' || op === '>' ? rng.int(xs[1], xs[k - 2]) : rng.int(xs[1], xs[k - 2]);
      key = P(op, kk);
      q = `What is the probability that $X$ is ${OP_WORD[op]} ${kk}, i.e. $P(X${op === '>' || op === '<' ? op : `${op} `}${kk})$?`;
      const which = xs.filter((x) => holds(x, op, kk));
      explanation = `${missText}Add the probabilities of the values that are ${OP_WORD[op]} ${kk}, i.e. $X\\in\\{${which.join(',')}\\}$: $$P(X${op === '>' || op === '<' ? op : `${op} `}${kk})=${which.map((x) => fixed(ps[xs.indexOf(x)], 2)).join('+')}=${fixed(key, 2)}$$`;
      const swap: Record<Op, Op> = { '\\ge': '>', '>': '\\ge', '\\le': '<', '<': '\\le' };
      wrong = [
        { value: P(swap[op], kk), why: `${op === '\\ge' || op === '\\le' ? 'leaves out' : 'includes'} the boundary value $X=${kk}$.` },
        { value: 1 - key, why: 'computes the complement: the probability of the other values.' },
        { value: ps[xs.indexOf(kk)], why: `gives only $P(X=${kk})$.` },
        ...missWrong(P(op, kk, ps0)),
        { value: 1 - P(swap[op], kk), why: 'takes the complement of the wrong event.' },
      ];
    }
    return valueQuestion({ type, rng, optionCount, stem: `${intro}\n\n${q}`, table, key, dp: 2, wrong, explanation, range: kind === 'prob' ? undefined : [0.01, 1000] });
  },
};

// =====================================================================================================================
// 2. Expected gain of a game of chance (dice or coins)
// =====================================================================================================================

interface Device {
  text: string;
  outcomes: number[][];
  conds: readonly { text: string; f: (o: number[]) => boolean }[];
}

const DICE: number[][] = [];
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) DICE.push([a, b]);
const COINS: number[][] = [];
for (let m = 0; m < 8; m++) COINS.push([m & 1, (m >> 1) & 1, (m >> 2) & 1]);

const DEVICES: readonly Device[] = [
  {
    text: 'Two fair dice are rolled.',
    outcomes: DICE,
    conds: [
      { text: 'both dice show a six', f: ([a, b]) => a === 6 && b === 6 },
      { text: 'the two dice show the same number', f: ([a, b]) => a === b },
      { text: 'the sum of the two dice is 7', f: ([a, b]) => a + b === 7 },
      { text: 'the sum of the two dice is at least 10', f: ([a, b]) => a + b >= 10 },
      { text: 'the sum of the two dice is 2 or 12', f: ([a, b]) => a + b === 2 || a + b === 12 },
      { text: 'at least one die shows a six', f: ([a, b]) => a === 6 || b === 6 },
      { text: 'the sum of the two dice is 11', f: ([a, b]) => a + b === 11 },
      { text: 'both dice show an even number', f: ([a, b]) => a % 2 === 0 && b % 2 === 0 },
    ],
  },
  {
    text: 'Three fair coins are tossed.',
    outcomes: COINS,
    conds: [
      { text: 'all three coins show heads', f: (o) => sum(o) === 3 },
      { text: 'exactly two coins show heads', f: (o) => sum(o) === 2 },
      { text: 'no coin shows heads', f: (o) => sum(o) === 0 },
      { text: 'all three coins show the same side', f: (o) => sum(o) === 0 || sum(o) === 3 },
    ],
  },
];

const STORIES = [
  'At the open day of a student association, visitors can play a game of chance.',
  'A charity stand at a Christmas market runs a small game.',
  'A board-game café challenges its guests with a quick game of luck.',
  'At a village fair, one of the stands offers the following game.',
];

const euro = (x: number) => `€${Number.isInteger(x) ? x : x.toFixed(2)}`;
const gainText = (v: number) => (v >= 0 ? `The player gains about €${fixed(v, 2)} per game.` : `The player loses about €${fixed(-v, 2)} per game.`);

const expectedGain: Template = {
  id: 'random-variables-binomial.expected-gain',
  topic: TOPIC,
  title: 'Expected net gain of a dice or coin game with a stake (E = Σ prize · P − cost)',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    for (;;) {
      const dev = rng.pick(DEVICES);
      const total = dev.outcomes.length;
      const cnt = (f: (o: number[]) => boolean) => dev.outcomes.filter(f).length;
      const conds = rng.chance(0.45) ? rng.sample(dev.conds, 2) : [rng.pick(dev.conds)];
      if (conds.length === 2 && dev.outcomes.some((o) => conds[0].f(o) && conds[1].f(o))) continue;
      conds.sort((a, b) => cnt(a.f) - cnt(b.f)); // rarer event, bigger prize
      const probs = conds.map((c) => cnt(c.f) / total);
      const big = rng.pick([5, 6, 8, 10, 12, 15, 18, 20, 24, 25, 30, 36, 40, 50].filter((w) => w * probs[0] >= 0.4 && w * probs[0] <= 6));
      if (big === undefined) continue;
      const prizes = conds.length === 2 ? [big, rng.pick([1, 2, 3, 4, 5].filter((w) => w < big))] : [big];
      const cost = rng.pick([1, 1.5, 2, 2.5, 3, 4, 5]);
      const gross = sum(prizes.map((w, i) => w * probs[i]));
      const net = gross - cost;
      if (Math.abs(net) < 0.1 || Math.abs(net) > 4) continue;
      const pWin = sum(probs);
      const rules = conds.map((c, i) => `if ${c.text}, the player wins ${euro(prizes[i])}`).join('; ');
      const intro = `${rng.pick(STORIES)} ${dev.text} ${rules.charAt(0).toUpperCase()}${rules.slice(1)}; otherwise the player wins nothing. Playing one game costs ${euro(cost)}, which is not returned.`;
      const stem = `${intro}\n\n${rng.pick(['What is the expected gain or loss per game for the player?', 'On average, how much does the player gain or lose per game?'])}`;
      const numericStem = `${intro}\n\nWhat is the player's expected net gain per game, in euros? Enter a loss as a negative number.`;
      const counting = conds
        .map((c, i) => `$P(\\text{${c.text}})=\\frac{${cnt(c.f)}}{${total}}$, so this prize contributes $${prizes[i]}\\cdot\\frac{${cnt(c.f)}}{${total}}\\approx ${num(prizes[i] * probs[i], 4)}$`)
        .join('; ');
      const explanation =
        `There are ${total} equally likely outcomes. ${counting}.\n` +
        `$$E(\\text{prize})=${prizes.map((w, i) => `${w}\\cdot\\frac{${cnt(conds[i].f)}}{${total}}`).join('+')}\\approx ${num(gross, 4)}$$` +
        `The stake of ${euro(cost)} is paid in every game, so $$E(\\text{net gain})=${num(gross, 4)}-${num(cost, 2)}\\approx ${fixed(net, 2)}$$` +
        `${net < 0 ? `On average the player **loses** about €${fixed(-net, 2)} per game.` : `On average the player **gains** about €${fixed(net, 2)} per game.`}`;
      const wrong: Wrong[] = [
        { value: gross, why: 'forgets to subtract the cost of playing.' },
        { value: -net, why: 'mixes up gain and loss (wrong sign).' },
        { value: gross - cost * (1 - pWin), why: 'only charges the stake when the player loses.' },
        { value: sum(prizes.map((w, i) => (w - cost) * probs[i])) - cost, why: 'subtracts the stake from the prize and then once more for every game.' },
        { value: -cost, why: 'ignores the prizes and expects to lose the whole stake.' },
      ];
      return valueQuestion({
        type, rng, optionCount, stem, numericStem, key: net, dp: 2, explanation,
        wrong: wrong.filter((w) => Math.abs(w.value) >= 0.01),
        range: [-100, 100], gap: 3, fmt: gainText,
      });
    }
  },
};

// =====================================================================================================================
// 3. Mean and SD of sums, differences and linear combinations of independent random variables
// =====================================================================================================================

interface Var {
  name: string;
  meaning: string;
  mean: number;
  sd: number;
}
interface Comb {
  intro: string;
  vars: Var[];
  /** Coefficients per variable (for copies: one variable, n copies). */
  coef: number[];
  c: number;
  copies?: number;
  target: string;
  formula: string;
  what: string;
  unit: string;
  kind: 'sum' | 'diff' | 'linear' | 'copies' | 'combo';
}

const COMBS: readonly ((rng: Rng) => Comb)[] = [
  (rng) => ({
    kind: 'sum', unit: 'g', target: 'T', formula: 'X + Y', coef: [1, 1], c: 0, what: 'The total weight of a packed set',
    intro: 'A pair of wireless earbuds is produced in one part of a factory and packed in a box (with charging case and manual) in another, independent part.',
    vars: [
      { name: 'X', meaning: 'weight of the earbuds (g)', mean: rng.int(45, 60), sd: rng.step(1, 3, 0.5) },
      { name: 'Y', meaning: 'weight of the box with contents (g)', mean: rng.int(180, 260), sd: rng.step(4, 9, 0.5) },
    ],
  }),
  (rng) => ({
    kind: 'sum', unit: 'minutes', target: 'T', formula: 'X + Y', coef: [1, 1], c: 0, what: 'Her total travel time',
    intro: 'A student cycles to the station and then takes the train to the university. The cycling time and the train ride are independent.',
    vars: [
      { name: 'X', meaning: 'cycling time (minutes)', mean: rng.int(10, 20), sd: rng.step(1.5, 4, 0.5) },
      { name: 'Y', meaning: 'train ride (minutes)', mean: rng.int(22, 40), sd: rng.step(2, 6, 0.5) },
    ],
  }),
  (rng) => ({
    kind: 'sum', unit: 'points', target: 'S', formula: 'M + O', coef: [1, 1], c: 0, what: 'The final score',
    intro: 'An exam consists of a multiple-choice part and an open part; assume the two scores are independent.',
    vars: [
      { name: 'M', meaning: 'score on the multiple-choice part', mean: rng.int(18, 30), sd: rng.step(2.5, 5, 0.5) },
      { name: 'O', meaning: 'score on the open part', mean: rng.int(12, 25), sd: rng.step(3, 6, 0.5) },
    ],
  }),
  (rng) => ({
    kind: 'diff', unit: 'minutes', target: 'D', formula: 'A - B', coef: [1, -1], c: 0, what: 'The difference in finishing times',
    intro: 'Two cyclists ride a time trial independently of each other.',
    vars: [
      { name: 'A', meaning: 'time of cyclist A (minutes)', mean: rng.int(31, 35), sd: rng.step(0.6, 1.4, 0.1) },
      { name: 'B', meaning: 'time of cyclist B (minutes)', mean: rng.int(29, 32), sd: rng.step(0.5, 1.2, 0.1) },
    ],
  }),
  (rng) => ({
    kind: 'diff', unit: 'euros', target: 'W', formula: 'R - C', coef: [1, -1], c: 0, what: 'The daily profit',
    intro: 'A food truck keeps track of its daily revenue and its daily costs; assume they are independent.',
    vars: [
      { name: 'R', meaning: 'daily revenue (euros)', mean: rng.step(900, 1400, 50), sd: rng.step(60, 150, 10) },
      { name: 'C', meaning: 'daily costs (euros)', mean: rng.step(400, 700, 50), sd: rng.step(30, 90, 10) },
    ],
  }),
  (rng) => {
    const fee = rng.step(35, 60, 5);
    const rate = rng.step(30, 55, 5);
    return {
      kind: 'linear', unit: 'euros', target: 'B', formula: `${fee} + ${rate}H`, coef: [rate], c: fee, what: 'The bill (in euros)',
      intro: `A plumber charges a call-out fee of €${fee} plus €${rate} per hour of work.`,
      vars: [{ name: 'H', meaning: 'duration of a job (hours)', mean: rng.step(1.2, 2.5, 0.1), sd: rng.step(0.3, 0.8, 0.1) }],
    };
  },
  (rng) => {
    const fee = rng.step(3, 5, 0.5);
    const rate = rng.step(1.8, 2.6, 0.1);
    return {
      kind: 'linear', unit: 'euros', target: 'F', formula: `${fee} + ${rate}K`, coef: [rate], c: fee, what: 'The fare (in euros)',
      intro: `A taxi company charges a starting fee of €${euro(fee).slice(1)} plus €${euro(rate).slice(1)} per kilometre.`,
      vars: [{ name: 'K', meaning: 'length of a ride (km)', mean: rng.int(6, 15), sd: rng.step(2, 5, 0.5) }],
    };
  },
  (rng) => {
    const n = rng.int(3, 6);
    return {
      kind: 'copies', unit: 'g', target: 'T', formula: Array.from({ length: n }, (_, i) => `X_${i + 1}`).join(' + '), coef: [1], c: 0, copies: n, what: `The total weight of a box of ${n} bags`,
      intro: `A roastery packs ${n} bags of coffee beans in a gift box. The weights of the bags are independent and each has the distribution of $X$.`,
      vars: [{ name: 'X', meaning: 'weight of one bag (g)', mean: rng.step(495, 505, 1), sd: rng.step(3, 8, 0.5) }],
    };
  },
  (rng) => {
    const n = rng.int(3, 5);
    return {
      kind: 'copies', unit: 'minutes', target: 'T', formula: Array.from({ length: n }, (_, i) => `X_${i + 1}`).join(' + '), coef: [1], c: 0, copies: n, what: `The total time for ${n} jobs`,
      intro: `A warehouse worker loads ${n} delivery vans one after another. The loading times are independent and each has the distribution of $X$.`,
      vars: [{ name: 'X', meaning: 'loading time of one van (minutes)', mean: rng.int(8, 15), sd: rng.step(1.5, 4, 0.5) }],
    };
  },
  (rng) => {
    const a = rng.int(6, 9);
    const b = rng.int(3, 5);
    return {
      kind: 'combo', unit: 'euros', target: 'R', formula: `${a}X + ${b}Y`, coef: [a, b], c: 0, what: 'The daily revenue (in euros)',
      intro: `A market stall sells jars of honey at €${a} and jars of jam at €${b}. The numbers sold per day are independent.`,
      vars: [
        { name: 'X', meaning: 'jars of honey sold per day', mean: rng.int(15, 40), sd: rng.step(3, 8, 0.5) },
        { name: 'Y', meaning: 'jars of jam sold per day', mean: rng.int(25, 50), sd: rng.step(4, 10, 0.5) },
      ],
    };
  },
];

const sumOfVariables: Template = {
  id: 'random-variables-binomial.sum-of-variables',
  topic: TOPIC,
  title: 'Mean and SD of X + Y, X − Y, a + bX, X₁ + … + Xₙ or aX + bY for independent variables (variances add)',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const s = rng.pick(COMBS)(rng);
    const n = s.copies ?? 1;
    const mean = s.c + n * sum(s.vars.map((v, i) => s.coef[i] * v.mean));
    const vr = n * sum(s.vars.map((v, i) => s.coef[i] ** 2 * v.sd ** 2));
    const sd = Math.sqrt(vr);
    const table: TableData = { header: ['Variable', 'Description', 'Mean', 'Standard deviation'], rows: s.vars.map((v) => [v.name, v.meaning, num(v.mean, 2), num(v.sd, 2)]) };
    const T = s.target;
    const stem = `${s.intro} The table gives the mean and standard deviation of each random variable.\n\n${s.what} is $${T} = ${s.formula}$. ${type === 'numeric' ? `Calculate the mean and the standard deviation of $${T}$.` : `What are the mean and the standard deviation of $${T}$?`}`;
    const [X, Y] = s.vars;
    const sq = (x: number) => num(x * x, 4);
    let how: string;
    if (s.kind === 'sum' || s.kind === 'diff') {
      const op = s.kind === 'sum' ? '+' : '-';
      how =
        `Means ${s.kind === 'sum' ? 'add' : 'subtract'}: $E(${T})=E(${X.name})${op}E(${Y.name})=${num(X.mean, 2)}${op}${num(Y.mean, 2)}=${num(mean, 2)}$ ${s.unit}.\n` +
        `For independent variables the **variances add**${s.kind === 'diff' ? ' (also for a difference: subtracting does not cancel variability)' : ''}: ` +
        `$$\\text{Var}(${T})=\\text{Var}(${X.name})+\\text{Var}(${Y.name})=${num(X.sd, 2)}^2+${num(Y.sd, 2)}^2=${sq(X.sd)}+${sq(Y.sd)}=${num(vr, 4)}$$` +
        `$$\\text{SD}(${T})=\\sqrt{${num(vr, 4)}}\\approx ${fixed(sd, 2)}\\text{ ${s.unit}}$$`;
    } else if (s.kind === 'linear') {
      const b = s.coef[0];
      how =
        `For a linear transformation $a+bX$: $E(a+bX)=a+b\\,E(X)$ and $\\text{SD}(a+bX)=|b|\\,\\text{SD}(X)$; adding a constant shifts the distribution but does not change its spread.\n` +
        `$$E(${T})=${num(s.c, 2)}+${num(b, 2)}\\cdot ${num(X.mean, 2)}=${num(mean, 2)},\\qquad \\text{SD}(${T})=${num(b, 2)}\\cdot ${num(X.sd, 2)}=${fixed(sd, 2)}$$`;
    } else if (s.kind === 'copies') {
      how =
        `$${T}$ is a sum of ${n} **independent** copies of $X$ (not $${n}X$!). Means add: $E(${T})=${n}\\cdot ${num(X.mean, 2)}=${num(mean, 2)}$ ${s.unit}. ` +
        `Variances add: $$\\text{Var}(${T})=${n}\\cdot ${num(X.sd, 2)}^2=${num(vr, 4)},\\qquad \\text{SD}(${T})=\\sqrt{${num(vr, 4)}}=\\sqrt{${n}}\\cdot ${num(X.sd, 2)}\\approx ${fixed(sd, 2)}\\text{ ${s.unit}}$$`;
    } else {
      const [a, b] = s.coef;
      how =
        `$E(${T})=${a}\\cdot ${num(X.mean, 2)}+${b}\\cdot ${num(Y.mean, 2)}=${num(mean, 2)}$ ${s.unit}. For independent $X$ and $Y$: ` +
        `$$\\text{Var}(${T})=${a}^2\\,\\text{Var}(X)+${b}^2\\,\\text{Var}(Y)=${a * a}\\cdot ${sq(X.sd)}+${b * b}\\cdot ${sq(Y.sd)}=${num(vr, 4)}$$` +
        `$$\\text{SD}(${T})=\\sqrt{${num(vr, 4)}}\\approx ${fixed(sd, 2)}\\text{ ${s.unit}}$$`;
    }
    if (type === 'numeric')
      return {
        type, stem, table, instruction: INSTRUCTION.numericFields(2),
        fields: [numericField('mean', `Mean of $${T}$`, mean, 2), numericField('sd', `Standard deviation of $${T}$`, sd, 2)],
        explanation: how,
      };
    const pair = (m: number, d: number, why?: string): Choice & { m: number; d: number } => ({ text: `mean ${num(m, 2)} ${s.unit}, standard deviation ${fixed(d, 2)} ${s.unit}`, m, d, ...(why ? { why } : {}) });
    const absSd = n * sum(s.vars.map((v, i) => Math.abs(s.coef[i]) * v.sd));
    const ds: ReturnType<typeof pair>[] = [
      pair(mean, absSd, s.kind === 'copies' ? `multiplies the SD by ${n} instead of by $\\sqrt{${n}}$ (that would be $${n}X$, one bag counted ${n} times).` : 'adds the standard deviations instead of the variances.'),
      pair(mean, vr, 'forgets to take the square root of the variance.'),
    ];
    if (s.kind === 'diff') {
      ds.push(pair(mean, Math.sqrt(Math.abs(X.sd ** 2 - Y.sd ** 2)), 'subtracts the variances because the variables are subtracted.'));
      ds.push(pair(X.mean + Y.mean, sd, 'adds the means instead of subtracting them.'));
      ds.push(pair(X.mean + Y.mean, Math.abs(X.sd - Y.sd), 'adds the means and subtracts the standard deviations.'));
    } else if (s.kind === 'linear') {
      ds.push(pair(mean, s.c + sd, 'adds the constant to the standard deviation as well.'));
      ds.push(pair(mean, X.sd, 'thinks a linear transformation does not change the SD.'));
      ds.push(pair(s.coef[0] * X.mean, sd, 'forgets the constant in the mean.'));
    } else if (s.kind === 'copies') {
      ds.push(pair(mean, X.sd, 'uses the SD of a single item for the total.'));
      ds.push(pair(X.mean, sd, 'uses the mean of a single item for the total.'));
    } else if (s.kind === 'combo') {
      ds.push(pair(mean, Math.sqrt(sum(s.vars.map((v, i) => s.coef[i] * v.sd ** 2))), 'multiplies the variances by $a$ and $b$ instead of by $a^2$ and $b^2$.'));
      ds.push(pair(X.mean + Y.mean, Math.sqrt(X.sd ** 2 + Y.sd ** 2), 'forgets the prices.'));
    } else {
      ds.push(pair(mean, Math.sqrt(Math.abs(X.sd ** 2 - Y.sd ** 2)), 'subtracts the variances.'));
      ds.push(pair(mean / 2, Math.sqrt(X.sd ** 2 + Y.sd ** 2) / 2, 'averages the two variables instead of adding them.'));
    }
    const distinct = (d: { m: number; d: number }) => Math.abs(d.m - mean) > 0.01 * Math.max(1, Math.abs(mean)) || Math.abs(d.d - sd) > 0.03 * sd;
    const mcq = buildMcq(rng, pair(mean, sd), ds.filter(distinct), {
      count: optionCount,
      fallback: (i) => pair(mean, sd * (1 + 0.2 * (i + 1)), 'an arithmetic slip in the variance.'),
    });
    return { type, stem, table, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: how + mistakesNote(mcq.distractors) };
  },
};

// =====================================================================================================================
// 4. Binomial probabilities: exact (small n) and the Normal approximation (large n)
// =====================================================================================================================

interface BinScenario {
  /** Mentions n (digits) and the single percentage p. */
  intro: (n: number, p: string) => string;
  items: string;
  yes: string;
  no?: string;
  p: [number, number, number];
}

const SMALL: readonly BinScenario[] = [
  { intro: (n, p) => `A gardening club hands out packets of ${n} basil seeds. Each seed germinates with probability ${p}, independently of the other seeds.`, items: 'seeds', yes: 'germinate', no: 'do **not** germinate', p: [60, 90, 5] },
  { intro: (n, p) => `A basketball player makes ${p} of her free throws. In tonight’s game she takes ${n} free throws; assume they are independent.`, items: 'free throws', yes: 'go in', no: 'do **not** go in', p: [55, 90, 5] },
  { intro: (n, p) => `A courier delivers ${p} of its parcels on the promised day. Consider ${n} parcels sent this week, independently of each other.`, items: 'parcels', yes: 'arrive on the promised day', no: 'do **not** arrive on the promised day', p: [75, 95, 5] },
  { intro: (n, p) => `On a night bus, ${p} of the passengers have a valid ticket. An inspector checks ${n} randomly chosen passengers.`, items: 'checked passengers', yes: 'have a valid ticket', no: 'do **not** have a valid ticket', p: [70, 95, 5] },
  { intro: (n, p) => `Each bulb in a bag of ${n} tulip bulbs flowers with probability ${p}, independently of the other bulbs.`, items: 'bulbs', yes: 'flower', no: 'do **not** flower', p: [70, 95, 5] },
  { intro: (n, p) => `A market researcher e-mails a short survey to ${n} randomly chosen customers. Each customer fills it in with probability ${p}, independently of the others.`, items: 'customers', yes: 'fill it in', no: 'do **not** fill it in', p: [10, 40, 5] },
  { intro: (n, p) => `In a large city, ${p} of the adults got a flu shot this autumn. A pharmacist randomly selects ${n} adults.`, items: 'adults', yes: 'got a flu shot', no: 'did **not** get a flu shot', p: [20, 60, 5] },
];

const LARGE: readonly BinScenario[] = [
  { intro: (n, p) => `A streaming service offers a comeback deal to ${n} randomly chosen former subscribers. Each of them accepts the deal with probability ${p}, independently of the others.`, items: 'former subscribers', yes: 'accept the deal', p: [10, 40, 5] },
  { intro: (n, p) => `An airline knows that ${p} of the passengers who book a seat on a long-haul flight are no-shows. A flight has ${n} bookings, and passengers turn up independently.`, items: 'booked passengers', yes: 'are no-shows', p: [6, 15, 1] },
  { intro: (n, p) => `A tree nursery plants ${n} acorns. Each acorn grows into a seedling with probability ${p}, independently of the others.`, items: 'acorns', yes: 'grow into a seedling', p: [40, 70, 5] },
  { intro: (n, p) => `An online shop e-mails a discount code to ${n} customers. Each customer uses the code with probability ${p}, independently of the others.`, items: 'customers', yes: 'use the code', p: [8, 30, 2] },
  { intro: (n, p) => `A batch contains ${n} microchips, each of which is defective with probability ${p}, independently of the others.`, items: 'microchips', yes: 'are defective', p: [5, 15, 1] },
];

type BinKind = 'eq' | 'atMost' | 'atLeast' | 'fewer' | 'more';
const BIN_WORD: Record<BinKind, string> = { eq: 'exactly', atMost: 'at most', atLeast: 'at least', fewer: 'fewer than', more: 'more than' };
const inEvent = (j: number, kind: BinKind, k: number) =>
  kind === 'eq' ? j === k : kind === 'atMost' ? j <= k : kind === 'atLeast' ? j >= k : kind === 'fewer' ? j < k : j > k;
const binSum = (n: number, p: number, f: (j: number) => boolean) => sum(Array.from({ length: n + 1 }, (_, j) => (f(j) ? binomPmf(j, n, p) : 0)));

function exactBinomial(rng: Rng, type: GenType, optionCount: number): Generated {
  for (;;) {
    const sc = rng.pick(SMALL);
    const n = rng.int(6, 14);
    const pp = rng.step(...sc.p);
    const twist = sc.no !== undefined && rng.chance(0.3);
    const p = twist ? 1 - pp / 100 : pp / 100;
    const kind = rng.pick<BinKind>(['eq', 'atMost', 'atLeast', 'atLeast', 'fewer', 'more']);
    const k = rng.int(2, n - 1);
    const js = Array.from({ length: n + 1 }, (_, j) => j).filter((j) => inEvent(j, kind, k));
    const comp = Array.from({ length: n + 1 }, (_, j) => j).filter((j) => !inEvent(j, kind, k));
    if (Math.min(js.length, comp.length) > 3 || js.length === 0) continue;
    const key = binSum(n, p, (j) => inEvent(j, kind, k));
    if (key < 0.02 || key > 0.98) continue;
    const q = 1 - p;
    const pT = num(p, 2);
    const qT = num(q, 2);
    const stem = `${sc.intro(n, `${pp}%`)}\n\nWhat is the probability that **${BIN_WORD[kind]} ${k}** of the ${n} ${sc.items} ${twist ? sc.no : sc.yes}?${rng.chance(0.4) ? ' (Think about which probability model applies.)' : ''}`;
    const term = (j: number) => `\\binom{${n}}{${j}}${pT}^{${j}}\\,${qT}^{${n - j}}`;
    const direct = js.length <= comp.length;
    const list = direct ? js : comp;
    const parts = list.map((j) => `P(X=${j})=${term(j)}\\approx ${num(binomPmf(j, n, p), 4)}`).join(',\\quad ');
    const plain = (twist ? sc.no! : sc.yes).replace(/\*\*/g, '');
    const explanation =
      `Let $X$ = the number of the ${n} ${sc.items} that ${plain}. There is a fixed number of independent trials with two outcomes and the same probability each time, so $X\\sim\\text{Bin}(n=${n},\\,p=${pT})$` +
      `${twist ? ` (careful: the question is about the ${sc.items} that ${plain}, so $p=1-${num(pp / 100, 2)}=${pT}$)` : ''}, with $P(X=j)=\\binom{n}{j}p^j(1-p)^{n-j}$.\n` +
      `$$${parts}$$` +
      (direct
        ? `Adding ${list.length > 1 ? 'these' : 'this'}: $P(\\text{${BIN_WORD[kind]} ${k}})\\approx ${fixed(key, 3)}$.`
        : `These are the outcomes **not** in the event, so use the complement: $P(\\text{${BIN_WORD[kind]} ${k}})=1-(${list.map((j) => num(binomPmf(j, n, p), 4)).join('+')})\\approx ${fixed(key, 3)}$.`);
    const swapKind: Record<BinKind, BinKind> = { eq: 'atMost', atMost: 'fewer', fewer: 'atMost', atLeast: 'more', more: 'atLeast' };
    const wrong: Wrong[] = [
      { value: binomPmf(k, n, p), why: `only computes $P(X=${k})$.` },
      { value: binSum(n, p, (j) => inEvent(j, swapKind[kind], k)), why: kind === 'eq' ? `computes $P(X\\le ${k})$ instead of $P(X=${k})$.` : `${kind === 'atMost' || kind === 'atLeast' ? 'leaves out' : 'includes'} the boundary value $X=${k}$.` },
      { value: 1 - key, why: 'computes the complement of the event that was asked.' },
      { value: binSum(n, q, (j) => inEvent(j, kind, k)), why: twist ? 'forgets the "not": uses the probability of the other outcome.' : 'swaps $p$ and $1-p$.' },
      { value: sum(js.map((j) => p ** j * q ** (n - j))), why: 'forgets the binomial coefficient $\\binom{n}{j}$.' },
      { value: sum(js.map((j) => choose(n, j) * p ** j)), why: 'forgets the factor $(1-p)^{n-j}$.' },
    ];
    return valueQuestion({ type, rng, optionCount, stem, key, dp: 3, wrong, explanation });
  }
}

function normalApprox(rng: Rng, type: GenType, optionCount: number): Generated {
  for (;;) {
    const sc = rng.pick(LARGE);
    const n = rng.pick([80, 100, 120, 150, 200, 250, 300, 400, 500]);
    const pp = rng.step(...sc.p);
    const p = pp / 100;
    const q = 1 - p;
    const mu = n * p;
    const sigma = Math.sqrt(n * p * q);
    if (mu < 10 || n * q < 10) continue;
    const kind = rng.pick<'atLeast' | 'atMost'>(['atLeast', 'atLeast', 'atMost']);
    const k = Math.round(mu + rng.sign() * rng.step(0.4, 2, 0.1) * sigma);
    if (k <= 0 || k === Math.round(mu)) continue;
    const z = (k - mu) / sigma;
    const z2 = round(z, 2);
    const tail = (zz: number) => (kind === 'atLeast' ? 1 - normCdf(zz) : normCdf(zz));
    const tab = kind === 'atLeast' ? round(1 - zTable(z2), 4) : zTable(z2);
    const exactZ = tail(z);
    if (tab < 0.02 || tab > 0.98) continue;
    const tabOf = (zz: number) => (kind === 'atLeast' ? 1 - zTable(zz) : zTable(zz));
    const stem = `${sc.intro(n, `${pp}%`)}\n\nWhat is the (approximate) probability that **${BIN_WORD[kind]} ${k}** of the ${n} ${sc.items} ${sc.yes}? (Use a Normal model.)`;
    const sign = kind === 'atLeast' ? '\\ge' : '\\le';
    const explanation =
      `$X$ = the number of the ${n} ${sc.items} that ${sc.yes} is $\\text{Bin}(${n},\\,${num(p, 2)})$. Summing the binomial formula over so many values is not practical, but $np=${num(mu, 2)}\\ge 10$ and $nq=${num(n * q, 2)}\\ge 10$, so a Normal model is fine:\n` +
      `$$\\mu=np=${n}\\cdot ${num(p, 2)}=${num(mu, 2)},\\qquad \\sigma=\\sqrt{npq}=\\sqrt{${n}\\cdot ${num(p, 2)}\\cdot ${num(q, 2)}}=\\sqrt{${num(mu * q, 4)}}\\approx ${num(sigma, 3)}$$` +
      `$$z=\\frac{${k}-${num(mu, 2)}}{${num(sigma, 3)}}\\approx ${fixed(z2, 2)},\\qquad P(X${sign} ${k})\\approx P(Z${kind === 'atLeast' ? '>' : '<'}${fixed(z2, 2)})=${kind === 'atLeast' ? `1-${fixed(zTable(z2), 4)}=` : ''}${fixed(tab, 4)}$$` +
      `(Table Z with $z$ rounded to two decimals; with the unrounded $z$ the Normal model gives $${fixed(exactZ, 4)}$, which is accepted too. As in the course, no continuity correction is used.)`;
    const tol = 0.0006;
    const wrong: Wrong[] = [
      { value: 1 - tab, why: 'uses the wrong tail of the Normal curve.' },
      { value: tabOf(round((k - mu) / (n * p * q), 2)), why: 'divides by the variance $npq$ instead of its square root.' },
      { value: tabOf(round((k - mu) / Math.sqrt(n * p), 2)), why: 'uses $\\sqrt{np}$ as the standard deviation, forgetting the factor $q$.' },
      { value: tabOf(round((k - n * q) / sigma, 2)), why: 'uses $nq$ instead of $np$ as the mean.' },
      { value: tabOf(round((k - mu) / (sigma * Math.sqrt(n)), 2)), why: 'divides the standard deviation by $\\sqrt{n}$ once more, mixing it up with the SD of a sample proportion.' },
    ];
    return valueQuestion({
      type, rng, optionCount, stem, key: tab, dp: 3, wrong, explanation, gap: 6,
      acceptRange: [round(Math.min(tab, exactZ) - tol, 4), round(Math.max(tab, exactZ) + tol, 4)],
    });
  }
}

const binomial: Template = {
  id: 'random-variables-binomial.binomial',
  topic: TOPIC,
  title: 'Binomial model: P(X = k), "at most / at least / fewer than / more than k" exactly (small n) or with the Normal model (large n)',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    return rng.chance(0.68) ? exactBinomial(rng, type, optionCount) : normalApprox(rng, type, optionCount);
  },
};

export const TEMPLATES: Template[] = [distributionTable, expectedGain, sumOfVariables, binomial];
