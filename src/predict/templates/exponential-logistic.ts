// Templates for the topic "Exponential & logistic growth" (QM1 past exams: GNP growing 15% a year — in which year has it
// tripled; lecture attendance falling exponentially from week 1 to week 7 — first week below a level; c/(1+e^{−3t}) or
// c/(2+e^{−3t}) with a given rate at t = 0; c₁ + c₂/(1+e^{−2t}) from its value and slope at 0; when does the yearly
// increase of 2000(1 − 2^{−t}) drop below 1; when has 2000 + 125·2^t doubled). Keys are computed in code from the
// model (logarithms, the derivative at 0); wrong options come from modelled mistakes (linear instead of exponential,
// forgotten chain-rule factor, wrong number of steps, ...). See exponential-logistic.test.ts for the independent checks.
import { buildMcq, INSTRUCTION, mistakesNote, num, numericField, type Choice } from '../build';
import type { GenContext, Generated, Template } from '../types';
import { choiceQuestion, coefTex, isNice, numericQuestion, rankedValueMcq, scaledFallback, valueMcq } from './_econ';

const ln = Math.log;
const frac1 = (x: number) => x - Math.floor(x);
/** "e^{-t}", "e^{-0.5t}", "e^{-3t}". */
const expNeg = (r: number) => `e^{-${r === 1 ? '' : num(r)}t}`;

// =====================================================================================================================
// 1. Constant percentage growth or decline: during which year is a factor reached?
// =====================================================================================================================

// Each context: the opening sentence and the quantity that changes (the subject of the question).
const GROW = [
  { text: (p: number, y: number) => `On 1 January ${y} a streaming platform had a certain number of subscribers. From then on, this number grows by ${p}% per year.`, noun: 'the number of subscribers' },
  { text: (p: number, y: number) => `The number of customers of a bicycle-courier company is expected to grow by ${p}% per year, starting from its level on 1 January ${y}.`, noun: 'the number of customers' },
  { text: (p: number, y: number) => `The number of public charging points for electric cars in a province grows by ${p}% per year, counted from 1 January ${y}.`, noun: 'the number of charging points' },
  { text: (p: number, y: number) => `The value of an investment fund grows by ${p}% per year, starting from its value on 1 January ${y}.`, noun: 'the value of the fund' },
];
const SHRINK = [
  { text: (p: number, y: number) => `A delivery van bought on 1 January ${y} loses value at a rate of ${p}% per year.`, noun: 'the value of the van' },
  { text: (p: number, y: number) => `Thanks to a recycling campaign that starts on 1 January ${y}, the amount of household waste in a town falls by ${p}% per year.`, noun: 'the amount of household waste' },
  { text: (p: number, y: number) => `The number of letters posted in a country decreases by ${p}% per year, measured from 1 January ${y}.`, noun: 'the number of letters posted' },
  { text: (p: number, y: number) => `A melting glacier loses ${p}% per year of its remaining ice volume, starting from its volume on 1 January ${y}.`, noun: 'the ice volume of the glacier' },
];

const percentageGrowth: Template = {
  id: 'exponential-logistic.percentage-growth',
  topic: 'Exponential & logistic growth',
  title: 'Growth or decline by p% per year: during which year (or after how many years) is a factor k reached?',
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const grow = rng.chance(0.5);
    let p: number, k: number, t: number;
    do {
      p = rng.pick(grow ? [3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20, 25] : [4, 5, 6, 8, 10, 12, 15, 20, 25, 30]);
      k = grow ? rng.pick([1.5, 2, 2.5, 3, 4]) : rng.pick([0.2, 0.25, 0.4, 0.5, 0.6]);
      t = ln(k) / ln(grow ? 1 + p / 100 : 1 - p / 100);
    } while (t < 2 || t > 30 || frac1(t) < 0.1 || frac1(t) > 0.9);
    const r = p / 100;
    const g = grow ? 1 + r : 1 - r;
    const Y0 = rng.int(2025, 2028);
    const n = Math.floor(t);
    const year = Y0 + n;
    const pct = num(k * 100);
    const ctx = rng.pick(grow ? GROW : SHRINK);
    const intro = ctx.text(p, Y0);
    const target = grow ? `${num(k)} times as large as on 1 January ${Y0}` : `below ${pct}% of its level on 1 January ${Y0}`;
    const explanation =
      `Each year the level is multiplied by $g=1${grow ? '+' : '-'}${num(r)}=${num(g)}$, so after $t$ years it equals $N_0\\cdot ${num(g)}^{t}$. ` +
      `Solve $${num(g)}^{t}=${num(k)}$: $$t=\\frac{\\ln(${num(k)})}{\\ln(${num(g)})}=\\frac{${num(ln(k), 4)}}{${num(ln(g), 4)}}\\approx ${num(t, 2)}$$` +
      `So the level is reached about ${num(t, 2)} years after 1 January ${Y0}. ` +
      `Check: after ${n} years the factor is $${num(g)}^{${n}}\\approx ${num(g ** n, 3)}$ and after ${n + 1} years $${num(g)}^{${n + 1}}\\approx ${num(g ** (n + 1), 3)}$, so it happens during **${year}**.`;
    if (type === 'numeric') {
      const q = grow ? `be ${num(k)} times as large as on that date` : `have dropped to ${pct}% of its level on that date`;
      return numericQuestion(`${intro} After how many years (counted from 1 January ${Y0}) will ${ctx.noun} ${q}?`, t, 2, explanation);
    }
    // the change is gradual (N0·g^t for every t ≥ 0, as in the course); with yearly steps the answer could be a year later
    const stem = `${intro} The change takes place gradually over each year. During which year will ${ctx.noun} for the first time be ${target}?`;
    const tLin = grow ? (k - 1) / r : (1 - k) / r;
    const mistakes = [
      { value: Y0 + Math.ceil(t), why: `rounds $t\\approx ${num(t, 2)}$ up to ${Math.ceil(t)} years; but ${num(t, 2)} years after 1 January ${Y0} still falls in ${year}.` },
      { value: Y0 + Math.floor(tLin), why: `treats the change as linear: ${p}% of the starting level ${grow ? 'added' : 'removed'} every year ($t=${num(tLin, 2)}$).` },
      { value: Y0 + Math.floor(Math.abs(ln(k)) / r), why: `divides $\\ln(${num(k)})$ by $${num(r)}$ instead of by $\\ln(${num(g)})$.` },
      { value: Y0 + Math.floor(Math.log10(k) / ln(g)), why: 'mixes $\\log_{10}$ (numerator) and $\\ln$ (denominator).' },
      ...(grow ? [] : [{ value: Y0 + Math.floor(ln(1 / k) / ln(1 + r)), why: `uses the factor $1+${num(r)}$ instead of $1-${num(r)}$.` }]),
    ];
    const near = (dir: -1 | 1, i: number) => (year + dir * (i + 1) >= Y0 ? year + dir * (i + 1) : null);
    const mcq = rankedValueMcq(rng, year, mistakes, optionCount, (v) => String(v), near, { epsilon: 0 });
    return choiceQuestion(stem, mcq, explanation);
  },
};

// =====================================================================================================================
// 2. Exponential change through two observations: first period below/above a level
// =====================================================================================================================

const DOWN = [
  { intro: 'A sports centre counts the participants of its Monday spinning class every week.', unit: 'week', item: 'participants' },
  { intro: 'The weekly number of streams of a newly released album is going down; the numbers below are in thousands.', unit: 'week', item: 'streams' },
  { intro: 'A pop-up shop counts its visitors every month.', unit: 'month', item: 'visitors' },
  { intro: 'A charity counts the donations it receives by post every month.', unit: 'month', item: 'donations' },
];
const UP = [
  { intro: 'A new board-game café counts its guests every week.', unit: 'week', item: 'guests' },
  { intro: 'A student podcast counts its listeners every month.', unit: 'month', item: 'listeners' },
  { intro: 'Volunteers count the bees visiting a community garden every week in spring.', unit: 'week', item: 'bees' },
  { intro: 'A start-up counts the orders placed in its web shop every month.', unit: 'month', item: 'orders' },
];

const twoObservations: Template = {
  id: 'exponential-logistic.two-observations',
  topic: 'Exponential & logistic growth',
  title: 'Exponential decrease/increase from period 1 to period w: first period below/above a level',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const up = rng.chance(0.5);
    const c = rng.pick(up ? UP : DOWN);
    let w: number, N1: number, Nw: number, X: number, s: number;
    for (;;) {
      w = rng.int(5, 10);
      if (up) {
        N1 = rng.pick([20, 25, 30, 40, 50, 60, 80, 120]);
        Nw = N1 * rng.pick([2, 3, 4, 5, 6, 8, 10]);
      } else {
        N1 = rng.pick([600, 720, 800, 900, 960, 1200, 1500, 2000]);
        Nw = N1 / rng.pick([2, 3, 4, 5, 8, 10]);
        if (!Number.isInteger(Nw)) continue;
      }
      const lo = Math.min(N1, Nw);
      const hi = Math.max(N1, Nw);
      const steps = [10, 20, 25, 50, 100].filter((v) => (hi - lo) / v >= 4 && (hi - lo) / v <= 40);
      if (!steps.length) continue;
      const st = rng.pick(steps);
      const lnG = ln(Nw / N1) / (w - 1);
      const cands: [number, number][] = [];
      for (let x = Math.ceil((lo + 1) / st) * st; x < hi; x += st) {
        const sx = ln(x / N1) / lnG;
        if (frac1(sx) >= 0.15 && frac1(sx) <= 0.85 && Math.floor(sx) + 2 <= w) cands.push([x, sx]);
      }
      if (!cands.length) continue;
      // first pick the answer (so that early and late periods are equally likely), then a level that leads to it
      const nPick = rng.pick([...new Set(cands.map(([, sx]) => Math.floor(sx) + 2))]);
      [X, s] = rng.pick(cands.filter(([, sx]) => Math.floor(sx) + 2 === nPick));
      break;
    }
    const g = (Nw / N1) ** (1 / (w - 1));
    const n = Math.floor(s) + 2;
    const N = (k: number) => N1 * g ** (k - 1);
    const rel = up ? 'above' : 'below';
    const Unit = c.unit[0].toUpperCase() + c.unit.slice(1);
    const stem =
      `${c.intro} The table shows the number of ${c.item} in ${c.unit} 1 and in ${c.unit} ${w}. ` +
      `Assume that this number ${up ? 'increases' : 'decreases'} exponentially from ${c.unit} to ${c.unit}. ` +
      `In which ${c.unit} is the number of ${c.item} for the first time ${rel} ${X}?`;
    const table = { header: [Unit, `Number of ${c.item}`], rows: [['1', String(N1)], [String(w), String(Nw)]] };
    const explanation =
      `Model: $N(n)=${N1}\\cdot g^{\\,n-1}$, where $n$ is the ${c.unit} number (${c.unit} 1 is the start). ` +
      `From ${c.unit} 1 to ${c.unit} ${w} there are ${w - 1} steps: $$g^{${w - 1}}=\\frac{${Nw}}{${N1}}\\;\\Rightarrow\\; g=\\left(\\frac{${Nw}}{${N1}}\\right)^{1/${w - 1}}\\approx ${num(g, 4)}$$` +
      `Solve $${N1}\\cdot ${num(g, 4)}^{\\,n-1}${up ? '>' : '<'}${X}$ by taking logarithms${up ? '' : ' (dividing by $\\ln(g)<0$ turns the inequality around)'}: ` +
      `$$n-1>\\frac{\\ln\\left(\\frac{${X}}{${N1}}\\right)}{\\ln(${num(g, 4)})}\\approx ${num(s, 2)}$$` +
      `So $n>${num(s + 1, 2)}$: the first such ${c.unit} is ${c.unit} **${n}**. Check: $N(${n - 1})\\approx ${num(N(n - 1), 1)}$ and $N(${n})\\approx ${num(N(n), 1)}$.`;
    if (type === 'numeric') return { ...numericQuestion(stem, n, 0, explanation), table };
    const step = (Nw - N1) / (w - 1);
    const sLin = (X - N1) / step;
    const gW = (Nw / N1) ** (1 / w);
    const mistakes: { value: number; why: string }[] = [
      { value: Math.floor(sLin) + 2, why: `assumes a linear change of $${num(step, 2)}$ per ${c.unit}.` },
      { value: Math.floor(ln(X / N1) / ln(gW)) + 2, why: `uses ${w} steps instead of ${w - 1} between ${c.unit} 1 and ${c.unit} ${w}.` },
      { value: Math.floor(s) + 1, why: `uses $N(n)=${N1}\\cdot g^{n}$, as if ${c.unit} 1 were already one step after the start.` },
      { value: Math.round(s) + 1, why: `rounds $n-1>${num(s, 2)}$ to the nearest whole number instead of taking the next whole ${c.unit}.` },
    ];
    const fmt = (v: number) => `${c.unit} ${v}`;
    // fallback: the other periods 2 … w + 1, nearest to the key first
    const options = mistakes.filter((m) => m.value >= 2); // period 1 is the starting level itself
    const near = Array.from({ length: w }, (_, i) => i + 2).filter((v) => v !== n).sort((a, b) => Math.abs(a - n) - Math.abs(b - n) || a - b);
    const fallback = (i: number) => ({ text: fmt(near[i % near.length]), value: near[i % near.length] });
    const mcq = valueMcq(rng, n, options, optionCount, fmt, { fallback, epsilon: 0 });
    return { ...choiceQuestion(stem, mcq, explanation), table };
  },
};

// =====================================================================================================================
// 3. Logistic-type models: the constant(s) from the value and the rate of change at t = 0
// =====================================================================================================================

const LOGI = [
  { intro: 'The cumulative sales $f(t)$ (in thousands of units) of a new e-reader, $t$ months after its launch, are modelled by', rate: 'sales increase by', unit: 'thousand units per month' },
  { intro: 'The number of users $f(t)$ (in thousands) of a language-learning app, $t$ years after its release, follows', rate: 'the number of users grows by', unit: 'thousand per year' },
  { intro: 'The share $f(t)$ (in %) of households that own a heat pump, $t$ years from now, is modelled by', rate: 'this share increases by', unit: 'percentage points per year' },
  { intro: 'The cumulative number of downloads $f(t)$ (in millions) of a mobile game, $t$ weeks after its release, is described by', rate: 'downloads grow by', unit: 'million per week' },
];

function logisticOne({ rng, type, optionCount }: GenContext): Generated {
  const ctx = rng.pick(LOGI);
  let k: number, m: number, r: number, c: number, B: number;
  do {
    k = rng.int(1, 3);
    m = rng.pick([1, 1, 1, 2, 3]);
    r = rng.pick([1, 2, 3, 4, 0.5]);
    c = rng.int(2, 60);
    B = (c * r * m) / (k + m) ** 2;
  } while (!isNice(B, 2) || B < 0.25 || B === c);
  const S = (k + m) ** 2;
  const den = `${k}+${coefTex(m)}${expNeg(r)}`;
  const rm = r * m;
  const stem =
    `${ctx.intro} $$f(t)=\\dfrac{c}{${den}}$$ where $c$ is a positive constant. ` +
    `At $t=0$ ${ctx.rate} ${num(B)} ${ctx.unit}, that is, $f'(0)=${num(B)}$. What is the value of $c$?`;
  const explanation =
    `Write $f(t)=c\\left(${den}\\right)^{-1}$. Chain rule (the derivative of $${coefTex(m)}${expNeg(r)}$ is $-${coefTex(rm)}${expNeg(r)}$): ` +
    `$$f'(t)=-c\\left(${den}\\right)^{-2}\\cdot\\left(-${coefTex(rm)}${expNeg(r)}\\right)=\\frac{${coefTex(rm)}c\\,${expNeg(r)}}{\\left(${den}\\right)^{2}}$$` +
    `At $t=0$, $e^{0}=1$: $$f'(0)=\\frac{${coefTex(rm)}c}{(${k}+${m})^2}=\\frac{${coefTex(rm)}c}{${S}}=${num(B)}\\;\\Rightarrow\\; c=\\frac{${num(B)}\\cdot ${S}}{${num(rm)}}=${num(c)}$$`;
  if (type === 'numeric') return numericQuestion(stem, c, 2, explanation);
  const mistakes = [
    ...(r !== 1 ? [{ value: (B * S) / m, why: `forgets the chain-rule factor $${num(r)}$ from the exponent.` }] : []),
    { value: (B * (k + m)) / rm, why: 'forgets to square the denominator.' },
    { value: B * (k + m), why: `uses $f(0)=${num(B)}$ instead of $f'(0)=${num(B)}$.` },
    ...(m !== 1 ? [{ value: (B * S) / r, why: `forgets the factor $${m}$ in front of the exponential.` }] : []),
    { value: (B * (k * k + m * m)) / rm, why: `squares the sum term by term: $${k}^2+${m}^2$ instead of $(${k}+${m})^2$.` },
  ];
  const mcq = valueMcq(rng, c, mistakes, optionCount, (v) => `$${num(v, 2)}$`, { positive: true });
  return choiceQuestion(stem, mcq, explanation);
}

function logisticTwo({ rng, type, optionCount }: GenContext): Generated {
  const ctx = rng.pick(LOGI);
  const r = rng.int(1, 4);
  const c2 = 2 * rng.int(1, 15);
  const c1 = rng.int(1, 20);
  const A = c1 + c2 / 2;
  const B = (r * c2) / 4;
  const stem =
    `${ctx.intro} $$f(t)=c_1+\\dfrac{c_2}{1+${expNeg(r)}}$$ ` +
    `At $t=0$ the model gives $f(0)=${num(A)}$, and ${ctx.rate} ${num(B)} ${ctx.unit}, so $f'(0)=${num(B)}$. Determine $c_1$ and $c_2$.`;
  const explanation =
    `Value at $0$: $e^{0}=1$, so $f(0)=c_1+\\frac{c_2}{2}=${num(A)}$. ` +
    `Derivative (chain rule): $$f'(t)=\\frac{${coefTex(r)}c_2\\,${expNeg(r)}}{\\left(1+${expNeg(r)}\\right)^2},\\qquad f'(0)=\\frac{${coefTex(r)}c_2}{4}=${num(B)}$$` +
    `Hence $c_2=\\frac{4\\cdot ${num(B)}}{${r}}=${num(c2)}$ and $c_1=${num(A)}-\\frac{${num(c2)}}{2}=${num(c1)}$.`;
  if (type === 'numeric') {
    return {
      type,
      stem,
      instruction: INSTRUCTION.numericFields(2),
      fields: [numericField('c1', '$c_1$', c1, 2), numericField('c2', '$c_2$', c2, 2)],
      explanation,
    };
  }
  const pair = (x: number, y: number, why?: string): Choice => ({ text: `$c_1=${num(x, 2)}$ and $c_2=${num(y, 2)}$`, why });
  const distractors = [
    ...(r !== 1 ? [pair(A - 2 * B, 4 * B, `forgets the chain-rule factor $${r}$, so $c_2=4\\cdot ${num(B)}$.`)] : []),
    pair(A - B / r, (2 * B) / r, 'forgets to square the denominator: uses $f\'(0)=\\frac{' + coefTex(r) + 'c_2}{2}$.'),
    pair(A - c2, c2, 'uses $e^{0}=0$, so that $f(0)=c_1+c_2$.'),
    pair(c2, c1, 'mixes up $c_1$ and $c_2$.'),
    pair(A, c2, 'uses $f(0)=c_1$, forgetting the second term at $t=0$.'),
  ];
  const mcq = buildMcq(rng, pair(c1, c2), distractors, { count: optionCount, fallback: (i) => pair(c1 + i + 1, c2 - 2 * (i + 1), 'an arithmetic slip.') });
  return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
}

const logisticConstants: Template = {
  id: 'exponential-logistic.logistic-constants',
  topic: 'Exponential & logistic growth',
  title: "c in c/(k + m e^{−rt}) from f'(0), or c₁, c₂ in c₁ + c₂/(1 + e^{−rt}) from f(0) and f'(0)",
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate(ctx) {
    return ctx.rng.chance(0.6) ? logisticOne(ctx) : logisticTwo(ctx);
  },
};

// =====================================================================================================================
// 4. When is a level (or a rate) reached? Saturation A(1 − b^{−t}), shifted growth A + B·g^t, logistic M/(1 + ae^{−kt})
// =====================================================================================================================

const LEARN = [
  { intro: 'A new nature reserve keeps a list of the bird species seen there. After $t$ years the list contains', note: 'New species are added quickly at first and more slowly later.', item: 'new species', per: 'year' },
  { intro: 'An online dictionary of a regional dialect is written by volunteers. After $t$ years it contains', note: 'The dictionary grows fast at first, but fewer and fewer words are left to add.', item: 'new entries', per: 'year' },
  { intro: 'A trainee sommelier learns to recognise wines. After $t$ months of training she can recognise', note: 'She learns fast at first and more slowly later.', item: 'new wines', per: 'month' },
];
const SHIFT = [
  { intro: 'The number of followers of a new cooking channel, $t$ months from now, is modelled by', per: 'month' },
  { intro: 'In a laboratory dish, the number of algae cells (in thousands), $t$ days from now, is described by', per: 'day' },
  { intro: 'The number of shared e-scooters in a city, $t$ years from now, is expected to follow', per: 'year' },
];
const SHARE = [
  { intro: 'The number of households in a town that have a heat pump, $t$ years from now, is modelled by', per: 'year' },
  { intro: 'A rumour spreads over a festival campsite. The number of campers who have heard it after $t$ hours is', per: 'hour' },
  { intro: 'The number of shops in a city that accept a new payment app, $t$ months after its launch, is', per: 'month' },
];

const timeToLevel: Template = {
  id: 'exponential-logistic.time-to-level',
  topic: 'Exponential & logistic growth',
  title: "When does N'(t) of A(1 − b^{−t}) drop below L, when has A + B·g^t doubled, when does M/(1 + ae^{−kt}) reach q·M?",
  types: ['single-choice', 'numeric'],
  difficulty: 3,
  generate({ rng, type, optionCount }) {
    const kind = rng.pick(['learning', 'doubling', 'logistic'] as const);
    let stem: string, explanation: string, t: number, per: string;
    let mistakes: { value: number; why: string }[];
    if (kind === 'learning') {
      const c = rng.pick(LEARN);
      per = c.per;
      const base2 = rng.chance(0.5);
      let A: number, L: number, lam: number;
      do {
        A = rng.pick([800, 1200, 1500, 2000, 3000, 5000]);
        L = rng.pick([1, 2, 5, 10, 20, 50]);
        lam = base2 ? ln(2) : rng.pick([0.2, 0.25, 0.4, 0.5]);
        t = ln((A * lam) / L) / lam;
      } while (t < 2 || t > 30);
      const pw = base2 ? '2^{-t}' : `e^{-${num(lam)}t}`;
      const dN = base2 ? `${A}\\ln(2)\\cdot 2^{-t}` : `${num(A * lam)}e^{-${num(lam)}t}`;
      stem =
        `${c.intro} $$N(t)=${A}\\left(1-${pw}\\right)$$ ${c.note} ` +
        `After how many ${per}s does the number of ${c.item} per ${per}, $N'(t)$, drop below ${L}?`;
      explanation =
        `The number of ${c.item} per ${per} is the derivative: $N'(t)=${dN}$ (chain rule${base2 ? ': $\\frac{d}{dt}2^{-t}=-\\ln(2)\\,2^{-t}$' : ''}). ` +
        `Solve $N'(t)=${L}$: $$${base2 ? '2^{-t}' : `e^{-${num(lam)}t}`}=\\frac{${L}}{${num(A * lam, 4)}}\\;\\Rightarrow\\; t=\\frac{\\ln(${num((A * lam) / L, 4)})}{${base2 ? '\\ln(2)' : num(lam)}}\\approx ${num(t, 2)}$$` +
        `Since $N'(t)$ decreases, it is below ${L} from about $t=${num(t, 2)}$ ${per}s on.`;
      mistakes = [
        { value: ln(A / L) / lam, why: `forgets the factor $${base2 ? '\\ln(2)' : num(lam)}$ that differentiating the exponential gives.` },
        ...(base2 || lam !== 1 ? [{ value: ln((A * lam) / L), why: `forgets to divide by $${base2 ? '\\ln(2)' : num(lam)}$ at the end.` }] : []),
        { value: Math.log10((A * lam) / L) / lam, why: 'uses $\\log_{10}$ instead of $\\ln$.' },
        { value: ln(A / (L * lam)) / lam, why: `divides by $${base2 ? '\\ln(2)' : num(lam)}$ instead of multiplying: uses $N'(t)=\\frac{${A}}{${base2 ? '\\ln(2)' : num(lam)}}${base2 ? '2^{-t}' : `e^{-${num(lam)}t}`}$.` },
      ];
    } else if (kind === 'doubling') {
      const c = rng.pick(SHIFT);
      per = c.per;
      let A: number, B: number, g: number;
      do {
        A = 100 * rng.int(4, 30);
        B = rng.pick([25, 40, 50, 80, 100, 125, 200, 250]);
        g = rng.pick([2, 1.5, 3]);
        t = ln((A + 2 * B) / B) / ln(g);
      } while (t < 1.2 || t > 25 || A < 2 * B);
      const N0 = A + B;
      stem = `${c.intro} $$N(t)=${A}+${B}\\cdot ${num(g)}^{t}$$ After how many ${per}s has $N(t)$ doubled compared with now ($t=0$)?`;
      explanation =
        `Now: $N(0)=${A}+${B}=${N0}$, so we need $N(t)=${2 * N0}$: $$${B}\\cdot ${num(g)}^{t}=${2 * N0}-${A}=${2 * N0 - A}\\;\\Rightarrow\\; ${num(g)}^{t}=${num((2 * N0 - A) / B, 4)}$$` +
        `$$t=\\frac{\\ln(${num((2 * N0 - A) / B, 4)})}{\\ln(${num(g)})}\\approx ${num(t, 2)}$$`;
      mistakes = [
        { value: ln(2) / ln(g), why: `ignores the constant ${A}: this is the doubling time of $${num(g)}^{t}$ alone.` },
        { value: ln((2 * N0) / B) / ln(g), why: `forgets to subtract the constant ${A} from $2N(0)$.` },
        { value: ln(2 * N0 - A) / ln(g), why: `forgets to divide by ${B}.` },
        { value: Math.log10((2 * N0 - A) / B) / ln(g), why: 'mixes $\\log_{10}$ (numerator) and $\\ln$ (denominator).' },
      ];
    } else {
      const c = rng.pick(SHARE);
      per = c.per;
      let M: number, a: number, k: number, q: number;
      do {
        M = rng.pick([800, 2000, 5000, 12000]);
        a = rng.pick([9, 19, 24, 39, 49, 99]);
        k = rng.pick([0.3, 0.4, 0.5, 0.6, 0.8, 1.2]);
        q = rng.pick([0.5, 0.75, 0.8, 0.9]);
        t = ln((a * q) / (1 - q)) / k;
      } while (t < 1 || t > 40);
      const Q = num(q * 100);
      stem = `${c.intro} $$N(t)=\\dfrac{${M}}{1+${a}e^{-${num(k)}t}}$$ In the long run $N(t)$ approaches ${M}. After how many ${per}s does $N(t)$ reach ${Q}% of this level?`;
      explanation =
        `Solve $N(t)=${num(q)}\\cdot ${M}$: $$1+${a}e^{-${num(k)}t}=\\frac{1}{${num(q)}}\\;\\Rightarrow\\; ${a}e^{-${num(k)}t}=\\frac{1}{${num(q)}}-1=${num(1 / q - 1, 4)}$$` +
        `$$e^{-${num(k)}t}=\\frac{${num(1 / q - 1, 4)}}{${a}}\\;\\Rightarrow\\; t=\\frac{\\ln\\left(${a}/${num(1 / q - 1, 4)}\\right)}{${num(k)}}\\approx ${num(t, 2)}$$`;
      mistakes = [
        { value: ln((a * q) / (1 - q)), why: `forgets to divide by $${num(k)}$.` },
        { value: ln(q / (1 - q)) / k, why: `ignores the constant ${a} in the denominator.` },
        { value: ln(a / (1 - q)) / k, why: `writes $\\frac{1}{${num(q)}}-1$ as $1-${num(q)}$.` },
        { value: ln(a / q) / k, why: `turns $1+${a}e^{-${num(k)}t}=\\frac{1}{${num(q)}}$ into $${a}e^{-${num(k)}t}=${num(q)}$.` },
        { value: ln((a * (1 - q)) / q) / k, why: 'turns the fraction inside the logarithm upside down.' },
      ];
    }
    if (type === 'numeric') return numericQuestion(stem, t, 2, explanation);
    const fmt = (v: number) => `${num(v, 2)} ${per}${num(v, 2) === '1' ? '' : 's'}`;
    const mcq = valueMcq(rng, t, mistakes, optionCount, fmt, { positive: true, fallback: scaledFallback(t, fmt, 0.2) });
    return choiceQuestion(stem, mcq, explanation);
  },
};

export const TEMPLATES: Template[] = [percentageGrowth, twoObservations, logisticConstants, timeToLevel];
