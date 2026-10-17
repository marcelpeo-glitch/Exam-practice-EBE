// Templates for the topic "Describing distributions" (QM1 past exams: which histogram has the largest standard
// deviation / order by spread, match histograms with boxplots, z-scores and IQR from a table of summary statistics,
// the class that contains the median or a quartile, what boxplots do and do not tell). Every figure is drawn from the
// generated data with _dist.ts (inline SVG), and every key is computed from that data in code; the tests read the
// numbers back from the SVG / table / stem and recompute the key independently (describing-distributions.test.ts).
import { INSTRUCTION, buildMatching, buildMcq, buildMulti, fixed, mistakesNote, num, numericField, type Choice } from '../build';
import type { Rng } from '../rng';
import { fiveNumber, sd, sum } from '../stats';
import type { Template } from '../types';
import { boxplotSvg, cap, classText, figure, histogramSvg, panelsSvg, type Box } from './_dist';

const TOPIC = 'Describing distributions' as const;
const expand = (values: readonly number[], counts: readonly number[]) => counts.flatMap((c, i) => Array<number>(c).fill(values[i]));

/** Boxplot of raw data with the 1.5 × IQR rule (whiskers end at the most extreme values inside the fences). */
export function boxOf(name: string, data: readonly number[]): Box {
  const f = fiveNumber(data);
  const iqr = f.q3 - f.q1;
  const inside = data.filter((x) => x >= f.q1 - 1.5 * iqr && x <= f.q3 + 1.5 * iqr);
  const outliers = [...new Set(data.filter((x) => !inside.includes(x)))];
  return { name, min: Math.min(...inside), q1: f.q1, med: f.median, q3: f.q3, max: Math.max(...inside), outliers };
}

const reasonsNote = (rs: { id: string; correct: boolean; why: string }[]) =>
  '\n\n**Option by option**\n' + rs.map((r) => `- **${r.id}** ${r.correct ? '(correct)' : '(wrong)'}: ${r.why}`).join('\n');

// =====================================================================================================================
// 1. Spread in histograms; matching histograms with boxplots
// =====================================================================================================================

const WORD: Record<number, string> = { 3: 'Three', 4: 'Four' };
const SPREAD_STORIES = [
  { story: (k: number, n: number) => `${WORD[k]} groups of ${n} customers each rated a new product on a scale from 1 to 5.`, x: 'Rating' },
  { story: (k: number, n: number) => `${WORD[k]} juries of ${n} judges each gave the same dance performance a score from 1 to 5.`, x: 'Score' },
  { story: (k: number, n: number) => `In ${WORD[k].toLowerCase()} classes of ${n} pupils, every pupil took a five-question quiz and got between 1 and 5 answers right.`, x: 'Correct answers' },
];
const MATCH_STORIES = [
  { story: 'Three groups of students rated their stress level during the exam week on a scale from 1 to 9.', x: 'Stress level', axis: 'Stress level (1–9)' },
  { story: 'Visitors of three cinemas gave the same film a score from 1 to 9.', x: 'Score', axis: 'Score (1–9)' },
  { story: 'Three tutorial groups took a quiz with 9 questions; every student had between 1 and 9 answers right.', x: 'Correct answers', axis: 'Correct answers' },
];
const MATCH_SHAPES: Record<string, number[]> = {
  'right-skewed': [5, 8, 7, 5, 3, 2, 1, 1, 1],
  'left-skewed': [1, 1, 1, 2, 3, 5, 7, 8, 5],
  'symmetric and mound-shaped': [0, 1, 3, 6, 9, 6, 3, 1, 0],
  'roughly uniform': [3, 3, 4, 4, 4, 4, 4, 3, 3],
};
const LETTERS = ['a', 'b', 'c'];
const ssd = (c: number[]) => 4 * c[0] + c[1] + c[3] + 4 * c[4];

/** k symmetric count vectors on 1..5 (mean 3, all with the same n, all reaching 1 and 5) with clearly different spreads. */
function symmetricSets(rng: Rng, k: number) {
  for (;;) {
    const n = rng.pick([20, 24, 30, 36, 40]);
    const cands: number[][] = [];
    for (let p2 = 1; 2 * p2 <= n; p2++) for (let p1 = 0; 2 * p2 + 2 * p1 <= n; p1++) cands.push([p2, p1, n - 2 * p2 - 2 * p1, p1, p2]);
    const sets: number[][] = [];
    for (const c of rng.shuffle(cands)) {
      if (sets.every((p) => Math.max(ssd(p), ssd(c)) / Math.min(ssd(p), ssd(c)) >= 1.35)) sets.push(c);
      if (sets.length === k) return { n, sets };
    }
  }
}

const spreadHistograms: Template = {
  id: 'describing-distributions.spread-histograms',
  topic: TOPIC,
  title: 'Histograms with equal n and mean: largest/smallest SD or order by spread; match histograms with boxplots',
  types: ['single-choice', 'matching'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const kind = type === 'matching' ? 'match' : rng.pick(['largest', 'smallest', 'order', 'match'] as const);
    if (kind === 'match') {
      const st = rng.pick(MATCH_STORIES);
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      let shapes: string[];
      let counts: number[][];
      let boxes: Box[];
      const dist = (a: Box, b: Box) => Math.abs(a.q1 - b.q1) + Math.abs(a.med - b.med) + Math.abs(a.q3 - b.q3);
      do {
        shapes = rng.sample(Object.keys(MATCH_SHAPES), 3);
        counts = shapes.map((s) => MATCH_SHAPES[s].map((c) => Math.max(0, c + rng.int(-1, 1))));
        boxes = counts.map((c, i) => boxOf(String(i), expand(values, c)));
      } while (dist(boxes[0], boxes[1]) < 2 || dist(boxes[0], boxes[2]) < 2 || dist(boxes[1], boxes[2]) < 2);
      const order = rng.shuffle([0, 1, 2]); // boxplot number p + 1 shows data set order[p]
      const boxNo = (h: number) => order.indexOf(h) + 1;
      const hist = panelsSvg(counts.map((c, i) => ({ name: `(${LETTERS[i]})`, counts: c })), values, st.x);
      const bp = boxplotSvg(order.map((h, p) => ({ ...boxes[h], name: `Boxplot ${p + 1}` })), { lo: 0, hi: 10, step: 1, label: st.axis });
      const images = [...figure(hist, `Histograms (a), (b) and (c) of ${st.x.toLowerCase()}`), ...figure(bp, 'Boxplots 1, 2 and 3 of the same data sets')];
      const summary = (h: number) => {
        const b = boxes[h];
        const n = sum(counts[h]);
        return `- Histogram (${LETTERS[h]}), ${shapes[h]}, $n=${n}$: min ${num(Math.min(...expand(values, counts[h])))}, $Q_1=${num(b.q1)}$, median $${num(b.med)}$, $Q_3=${num(b.q3)}$, max ${num(Math.max(...expand(values, counts[h])))}${b.outliers?.length ? ` (outlier${b.outliers.length > 1 ? 's' : ''} ${b.outliers.map((o) => num(o)).join(', ')})` : ''} → **boxplot ${boxNo(h)}**`;
      };
      const explanation =
        'Read the five-number summary off each histogram: count the bars to the middle observation for the median, and to the middle of the lower and upper halves for $Q_1$ and $Q_3$; then find the boxplot with that box and median line (a long whisker shows a long tail, i.e. skewness).\n' +
        [0, 1, 2].map(summary).join('\n');
      const stem = `${st.story} The same three data sets are shown as histograms (a), (b) and (c) and as boxplots 1, 2 and 3, in a different order.\n${type === 'matching' ? 'Match each histogram with its boxplot.' : 'Which boxplot belongs to which histogram?'}`;
      if (type === 'matching') {
        const m = buildMatching(rng, [0, 1, 2].map((h) => ({ prompt: `Histogram (${LETTERS[h]})`, answer: `Boxplot ${boxNo(h)}` })), []);
        return { type, stem, instruction: INSTRUCTION.matching, images, prompts: m.prompts, choices: m.choices, correctAnswer: m.correctAnswer, explanation };
      }
      const label = (q: number[]) => q.map((b, h) => `(${LETTERS[h]}) with boxplot ${b}`).join(', ');
      const key = [0, 1, 2].map(boxNo);
      const perms = [
        [1, 2, 3],
        [1, 3, 2],
        [2, 1, 3],
        [2, 3, 1],
        [3, 1, 2],
        [3, 2, 1],
      ].filter((q) => q.join() !== key.join());
      const ds: Choice[] = rng.shuffle(perms).map((q) => {
        const h = q.findIndex((b, i) => b !== key[i]);
        const wrong = boxes[order[q[h] - 1]];
        return { text: label(q), why: `histogram (${LETTERS[h]}) has median ${num(boxes[h].med)} and IQR ${num(boxes[h].q3 - boxes[h].q1)}, but boxplot ${q[h]} shows median ${num(wrong.med)} and IQR ${num(wrong.q3 - wrong.q1)}.` };
      });
      const mcq = buildMcq(rng, { text: label(key) }, ds, { count: optionCount });
      return { type, stem, images, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
    }

    const k = kind === 'order' ? 3 : 4;
    const { n, sets } = symmetricSets(rng, k);
    const names = 'ABCD'.slice(0, k).split('');
    const st = rng.pick(SPREAD_STORIES);
    const sds = sets.map((c) => sd(expand([1, 2, 3, 4, 5], c)));
    const img = figure(panelsSvg(sets.map((c, i) => ({ name: names[i], counts: c })), [1, 2, 3, 4, 5], st.x), `Histograms ${names.join(', ')} of ${st.x.toLowerCase()}`);
    const lines = sets
      .map((c, i) => `- ${names[i]}: counts ${c.join(', ')} → $\\sum (x-\\bar x)^2 = 4\\cdot${c[0]}+1\\cdot${c[1]}+0\\cdot${c[2]}+1\\cdot${c[3]}+4\\cdot${c[4]}=${ssd(c)}$, $s=\\sqrt{${ssd(c)}/${n - 1}}\\approx ${fixed(sds[i], 2)}$`)
      .join('\n');
    const base =
      `All data sets are symmetric around 3, so each mean is $\\bar x=3$. The standard deviation measures the typical distance from the mean: the more observations far from 3 (at 1 and 5), the larger it is. With $n=${n}$ in every set,\n` +
      `$$s=\\sqrt{\\dfrac{\\sum (x_i-\\bar x)^2}{n-1}}$$ and the deviations $-2,-1,0,1,2$ for the values 1 to 5:\n${lines}`;
    const stem0 = `${st.story(k, n)} The histograms below are drawn on the same scales, and every data set has mean 3.`;
    if (kind === 'order') {
      const asc = [0, 1, 2].sort((a, b) => sds[a] - sds[b]);
      const txt = (o: number[]) => o.map((i) => names[i]).join(' < ');
      const [x, y, z] = asc;
      const ds: Choice[] = [
        { text: txt([z, y, x]), why: 'orders from the largest to the smallest standard deviation.' },
        { text: txt([y, x, z]), why: `swaps ${names[x]} and ${names[y]}: ${names[y]} has more observations far from the mean.` },
        { text: txt([x, z, y]), why: `swaps ${names[y]} and ${names[z]}: ${names[z]} has more observations far from the mean.` },
        { text: txt([y, z, x]), why: `takes the most peaked histogram (${names[x]}) as the most spread out.` },
        { text: txt([z, x, y]), why: 'wrong order: compare the sums of squared deviations.' },
      ];
      const mcq = buildMcq(rng, { text: txt(asc) }, ds, { count: optionCount });
      return {
        type,
        stem: `${stem0}\nOrder the data sets from the smallest to the largest standard deviation.`,
        images: img,
        options: mcq.options,
        correctAnswer: mcq.correctAnswer,
        explanation: `${base}\nSo the order is **${txt(asc)}**.${mistakesNote(mcq.distractors)}`,
      };
    }
    const target = kind === 'largest' ? sds.indexOf(Math.max(...sds)) : sds.indexOf(Math.min(...sds));
    const others = names.map((_, i) => i).filter((i) => i !== target);
    const ds: Choice[] = others.map((i) => ({
      text: `Data set ${names[i]}`,
      value: i,
      why: `its sum of squared deviations is ${ssd(sets[i])}, ${kind === 'largest' ? 'smaller' : 'larger'} than ${ssd(sets[target])} for ${names[target]}.`,
    }));
    ds.push({ text: 'All data sets have the same standard deviation', value: 9, why: 'the same mean and the same number of observations say nothing about the spread around the mean.' });
    const mcq = buildMcq(rng, { text: `Data set ${names[target]}`, value: target }, ds, { count: optionCount, order: 'ascending' });
    return {
      type,
      stem: `${stem0}\nWhich data set has the ${kind} standard deviation?`,
      images: img,
      options: mcq.options,
      correctAnswer: mcq.correctAnswer,
      explanation: `${base}\nThe ${kind} standard deviation: **data set ${names[target]}**.${mistakesNote(mcq.distractors)}`,
    };
  },
};

// =====================================================================================================================
// 2. Summary statistics table: z-scores, value from a z-score, 1.5 × IQR fences
// =====================================================================================================================

const SUMMARY = [
  { col: 'CommuteTime', intro: 'employees of a logistics company were asked how long their commute to work takes (in minutes)', unit: 'minutes', mu: [20, 45], s: [6, 14], n: [150, 400], one: (x: string) => `One employee needs **${x}** minutes to get to work.`, noun: 'commute time', whose: 'an employee’s commute time', thisOne: 'this commute time' },
  { col: 'ScreenTime', intro: 'teenagers kept track of their weekly screen time (in hours)', unit: 'hours', mu: [15, 35], s: [4, 10], n: [120, 300], one: (x: string) => `One teenager reports **${x}** hours.`, noun: 'screen time', whose: 'a teenager’s screen time', thisOne: 'this screen time' },
  { col: 'EntryScore', intro: 'first-year students took a 60-point entry test', unit: 'points', mu: [28, 40], s: [6, 10], n: [400, 1200], top: 60, one: (x: string) => `One student scores **${x}** points.`, noun: 'test score', whose: 'a student’s test score', thisOne: 'this test score' },
  { col: 'Groceries', intro: 'student households reported their monthly grocery spending (in euros)', unit: 'euros', mu: [150, 300], s: [30, 70], n: [100, 250], one: (x: string) => `One household spends **${x}** euros.`, noun: 'grocery spending', whose: 'a household’s grocery spending', thisOne: 'this amount' },
  { col: 'PushUps', intro: 'army recruits did as many push-ups as they could in one minute', unit: 'push-ups', mu: [20, 40], s: [5, 12], n: [80, 200], one: (x: string) => `One recruit manages **${x}** push-ups.`, noun: 'number of push-ups', whose: 'a recruit’s number of push-ups', thisOne: 'this number of push-ups' },
];
const half = (x: number) => Math.round(x * 2) / 2;

const summaryTable: Template = {
  id: 'describing-distributions.summary-table',
  topic: TOPIC,
  title: 'Table of summary statistics: z-score of a value, value with a given z-score, or a 1.5 × IQR outlier fence',
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const c = rng.pick(SUMMARY);
    const n = rng.int(c.n[0], c.n[1]);
    const mu = rng.int(c.mu[0] * 100, c.mu[1] * 100) / 100;
    const s = rng.int(c.s[0] * 100, c.s[1] * 100) / 100;
    const med = half(mu + (s * rng.int(-25, 25)) / 100);
    const q1 = half(med - s * (rng.int(55, 80) / 100));
    const q3 = half(med + s * (rng.int(55, 85) / 100));
    const min = Math.max(0, Math.round(mu - s * (rng.int(190, 260) / 100)));
    const max = Math.min((c as { top?: number }).top ?? Infinity, Math.round(mu + s * (rng.int(220, 360) / 100)));
    const iqr = q3 - q1;
    const v2 = s * s;
    const se = s / Math.sqrt(n);
    const table = {
      header: ['Variable', 'n', 'Mean', 'Variance', 'Std. dev.', 'Std. err.', 'Median', 'Min', 'Max', 'Q1', 'Q3'],
      rows: [[c.col, String(n), fixed(mu, 2), fixed(v2, 2), fixed(s, 2), fixed(se, 4), num(med), num(min), num(max), num(q1), num(q3)]],
      caption: 'Summary statistics',
    };
    const kind = rng.pick(['z', 'fromZ', 'fence'] as const);
    const intro = `In a survey, ${n} ${c.intro}. The table shows summary statistics of the data.`;
    let ask: string;
    let key: number;
    let how: string;
    let ds: Choice[];
    const ch = (v: number, why: string): Choice => ({ text: num(v, 2), value: v, why });
    if (kind === 'z') {
      let x: number;
      do x = Math.round(mu + s * (rng.sign() * rng.int(25, 240)) / 100);
      while (Math.abs(x - mu) < 0.2 * s || x < min || x > max);
      key = (x - mu) / s;
      ask = `${c.one(String(x))} What is the z-score of ${c.thisOne}?`;
      how = `$$z=\\dfrac{x-\\bar x}{s}=\\dfrac{${x}-${fixed(mu, 2)}}{${fixed(s, 2)}}\\approx ${fixed(key, 2)}$$`;
      ds = [
        ch((x - med) / s, 'uses the median instead of the mean.'),
        ch((x - mu) / v2, 'divides by the variance instead of the standard deviation.'),
        ch((mu - x) / s, 'subtracts the wrong way round (mean − value), which flips the sign.'),
        ch((x - mu) / iqr, 'divides by the IQR instead of the standard deviation.'),
        ch((x - mu) / se, 'divides by the standard error $s/\\sqrt{n}$, which is for sample means, not for one observation.'),
      ];
    } else if (kind === 'fromZ') {
      const zs = [0.4, 0.5, 0.75, 0.8, 1.2, 1.25, 1.4, 1.5, 1.6, 1.75, 1.8, 2.2, 2.25].flatMap((v) => [v, -v]).filter((v) => mu + v * s > min + 0.5 && mu + v * s < max - 0.5);
      const z = rng.pick(zs);
      key = mu + z * s;
      ask = `The ${c.noun} of one respondent has a z-score of **${num(z, 2)}**. What is this ${c.noun} (in ${c.unit})?`;
      how = `From $z=\\dfrac{x-\\bar x}{s}$: $$x=\\bar x+z\\cdot s=${fixed(mu, 2)}+(${num(z, 2)})(${fixed(s, 2)})\\approx ${fixed(key, 2)}$$`;
      ds = [
        ch(mu - z * s, 'makes a sign error: subtracts $z\\cdot s$ instead of adding it.'),
        ch(med + z * s, 'starts from the median instead of the mean.'),
        ch(z * s, 'forgets to add the mean: $z\\cdot s$ is only the distance from the mean.'),
        ch(mu + z * v2, 'multiplies by the variance instead of the standard deviation.'),
        ch(mu + z / s, 'divides by $s$ instead of multiplying.'),
      ].filter((d) => d.value! >= 0); // a negative value is impossible here, so it would not tempt anyone
    } else {
      // a lower fence below zero (no low outliers possible) would be an odd thing to ask for, so ask for the upper one then
      const upper = rng.chance(0.6) || q1 - 1.5 * iqr < 0;
      key = upper ? q3 + 1.5 * iqr : q1 - 1.5 * iqr;
      ask = upper
        ? `Using the 1.5 × IQR rule, above which value is ${c.whose} flagged as an outlier (the upper fence)?`
        : `Using the 1.5 × IQR rule, below which value is ${c.whose} flagged as an outlier (the lower fence)?`;
      const q = upper ? q3 : q1;
      const sg = upper ? 1 : -1;
      how =
        `$IQR=Q_3-Q_1=${num(q3)}-${num(q1)}=${num(iqr)}$, so $1.5\\times IQR=${num(1.5 * iqr, 2)}$ and the ${upper ? 'upper' : 'lower'} fence is ` +
        `$$${upper ? 'Q_3+' : 'Q_1-'}1.5\\times IQR=${num(q)}${upper ? '+' : '-'}${num(1.5 * iqr, 2)}=${num(key, 2)}$$` +
        (upper ? `The maximum ${num(max)} is ${max > key ? 'above' : 'not above'} this fence, so it ${max > key ? 'is' : 'is not'} an outlier.` : `The minimum ${num(min)} is ${min < key ? 'below' : 'not below'} this fence, so it ${min < key ? 'is' : 'is not'} an outlier.`);
      ds = [
        ch(q + sg * iqr, 'uses 1 × IQR instead of 1.5 × IQR.'),
        ch(med + sg * 1.5 * iqr, 'starts from the median instead of the quartile.'),
        ch(mu + sg * 1.5 * s, 'uses the mean and the standard deviation instead of the quartiles and the IQR.'),
        ch(q + sg * 1.5 * (max - min), 'uses the range instead of the IQR.'),
        ch(q + sg * 3 * iqr, 'uses 3 × IQR (the rule for far outliers).'),
      ];
    }
    const stem = `${intro}\n${ask}`;
    if (type === 'numeric') {
      const f = numericField('x', undefined, key, 2);
      return { type, stem, instruction: INSTRUCTION.numeric(2), table, correctAnswer: f.answer, tolerance: f.tolerance, explanation: how };
    }
    const mcq = buildMcq(rng, ch(key, ''), ds, { count: optionCount, order: 'ascending', fallback: (i) => ch(key + (i % 2 ? 1 : -1) * (0.15 + 0.1 * i) * Math.max(1, Math.abs(key)), 'an arithmetic slip.') });
    return { type, stem, table, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: how + mistakesNote(mcq.distractors) };
  },
};

// =====================================================================================================================
// 3. Histogram: the class that contains the median or a quartile; percentage below / at least a boundary
// =====================================================================================================================

const HIST = [
  { who: 'museum visitors', story: 'A museum timed how long visitors spent in its new exhibition.', x0: 0, w: 10, k: 8, unit: 'minutes', xl: 'Time in the exhibition (minutes)', below: (b: number) => `spent less than **${b}** minutes in the exhibition`, atLeast: (b: number) => `spent at least **${b}** minutes in the exhibition` },
  { who: 'commuters', story: 'Commuters who cycle to work reported how many kilometres they cycle per week.', x0: 0, w: 20, k: 7, unit: 'km', xl: 'Distance cycled per week (km)', below: (b: number) => `cycle less than **${b}** km per week`, atLeast: (b: number) => `cycle at least **${b}** km per week` },
  { who: 'textbooks', story: 'A student marketplace lists the prices of second-hand textbooks sold last month.', x0: 0, w: 5, k: 8, unit: 'euros', xl: 'Price (euros)', below: (b: number) => `were sold for less than **${b}** euros`, atLeast: (b: number) => `were sold for at least **${b}** euros` },
  { who: 'smartphone users', story: 'An app recorded the battery level at which smartphone users plug in their charger.', x0: 0, w: 10, k: 10, unit: '', xl: 'Battery level when charging starts (%)', below: (b: number) => `plug in their charger at a battery level below **${b}**%`, atLeast: (b: number) => `plug in their charger at a battery level of **${b}**% or more` },
  { who: 'carp', story: 'The organisers of a fishing contest measured the length of every carp that was caught.', x0: 30, w: 5, k: 8, unit: 'cm', xl: 'Length (cm)', below: (b: number) => `were shorter than **${b}** cm`, atLeast: (b: number) => `were at least **${b}** cm long` },
];
type QName = 'median' | 'q1' | 'q3';
const Q_P: Record<QName, number> = { q1: 0.25, median: 0.5, q3: 0.75 };
const Q_LABEL: Record<QName, string> = { median: 'the median', q1: 'the first quartile $Q_1$', q3: 'the third quartile $Q_3$' };

/** Positions (1-based, in the sorted data) that define the median / course-book quartile, with a description. */
function positions(n: number, q: QName): { pos: number[]; text: string } {
  const mid = (m: number, off: number) => (m % 2 ? [off + (m + 1) / 2] : [off + m / 2, off + m / 2 + 1]);
  const say = (p: number[]) => (p.length === 1 ? `observation number ${p[0]}` : `the average of observations ${p[0]} and ${p[1]}`);
  const h = Math.floor(n / 2);
  if (q === 'median') {
    const p = mid(n, 0);
    return { pos: p, text: `$n=${n}$, so the median is ${say(p)} (in increasing order).` };
  }
  const p = mid(h, q === 'q1' ? 0 : n - h);
  return { pos: p, text: `$n=${n}$; ${q === 'q1' ? '$Q_1$ is the median of the lower' : '$Q_3$ is the median of the upper'} ${h} observations, i.e. ${say(p)} (in increasing order).` };
}
const classOfPos = (cum: number[], p: number) => cum.findIndex((c) => c >= p);

const histogramCenter: Template = {
  id: 'describing-distributions.histogram-center',
  topic: TOPIC,
  title: 'Histogram: the class containing the median, Q1 or Q3, or the percentage below / at least a class boundary',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const c = rng.pick(HIST);
    const edges = Array.from({ length: c.k + 1 }, (_, i) => c.x0 + i * c.w);
    const q = rng.pick<QName>(['median', 'median', 'q1', 'q3']);
    let counts: number[];
    let cum: number[];
    let n: number;
    let target = -1;
    for (;;) {
      // the peak is never the last class (nor the first one when the axis does not start at a natural zero), so the
      // histogram never ends abruptly at its tallest bar
      const peak = rng.int(c.x0 === 0 ? 0 : 1, c.k - 2);
      const sL = rng.int(6, 30) / 10;
      const sR = rng.int(6, 30) / 10;
      const H = rng.int(8, 16);
      counts = edges.slice(0, -1).map((_, i) => Math.round(H * Math.exp(-0.5 * ((i - peak) / (i < peak ? sL : sR)) ** 2)) + rng.int(0, 2));
      n = sum(counts);
      cum = counts.map((_, i) => sum(counts.slice(0, i + 1)));
      if (n < 25 || n > 90) continue;
      const cls = positions(n, q).pos.map((p) => classOfPos(cum, p));
      const i = cls[0];
      const below = i > 0 ? cum[i - 1] : 0;
      if (cls.every((x) => x === i) && below < Q_P[q] * n && cum[i] > Q_P[q] * n) {
        target = i;
        break;
      }
    }
    const pctMode = rng.chance(0.4);
    const heights = pctMode ? counts.map((x) => Math.round((1000 * x) / n) / 10) : counts;
    const img = figure(
      histogramSvg({ edges, heights, labels: pctMode ? heights.map((h) => `${fixed(h, 1)}%`) : counts.map(String), xLabel: c.xl, yLabel: pctMode ? `Percentage of ${c.who}` : `Number of ${c.who}` }),
      `${pctMode ? 'Relative frequency histogram' : 'Histogram'} of ${c.xl.toLowerCase()}`,
    );
    const cumText = edges.slice(1).map((e, i) => `below ${num(e)}: ${cum[i]}`).join('; ');
    const intro = `${c.story} The ${pctMode ? 'relative frequency ' : ''}histogram below shows the data of ${n} ${c.who}.`;
    const ct = (i: number) => classText(edges[i], edges[i + 1], c.unit);

    if (type === 'numeric') {
      let t: number;
      do t = rng.int(1, c.k - 1);
      while (cum[t - 1] < 0.1 * n || cum[t - 1] > 0.9 * n);
      const atLeast = rng.chance(0.5);
      const cnt = atLeast ? n - cum[t - 1] : cum[t - 1];
      const key = (100 * cnt) / n;
      const shown = sum((atLeast ? heights.slice(t) : heights.slice(0, t)).map(Number));
      const range: [number, number] | undefined = pctMode ? [Math.min(key, shown) - 0.05, Math.max(key, shown) + 0.05] : undefined;
      const f = numericField('x', undefined, key, 1, range);
      const bars = atLeast ? counts.slice(t) : counts.slice(0, t);
      return {
        type,
        stem: `${intro}\nWhat percentage of the ${c.who} ${atLeast ? c.atLeast(edges[t]) : c.below(edges[t])}?`,
        instruction: INSTRUCTION.numeric(1),
        images: img,
        correctAnswer: f.answer,
        tolerance: f.tolerance,
        ...(f.acceptRange ? { acceptRange: f.acceptRange } : {}),
        suffix: '%',
        explanation:
          (pctMode ? `The bars show percentages of $n=${n}$; as counts they are ${counts.join(', ')}.\n` : '') +
          `Add the bars ${atLeast ? `from ${num(edges[t])} upwards` : `below ${num(edges[t])}`}: ${bars.join(' + ')} = ${cnt} of the ${n} ${c.who}, so $$\\dfrac{${cnt}}{${n}}\\times 100\\%\\approx ${fixed(key, 1)}\\%$$` +
          (pctMode ? `(Adding the printed percentages gives ${fixed(shown, 1)}%, which is also accepted.)` : ''),
      };
    }

    const others = (['median', 'q1', 'q3'] as QName[]).filter((x) => x !== q);
    const otherCls = (x: QName) => classOfPos(cum, positions(n, x).pos[0]);
    const mode = counts.indexOf(Math.max(...counts));
    const ds: Choice[] = [
      { text: ct(mode), value: mode, why: 'takes the class with the tallest bar (the mode), not the middle of the ordered data.' },
      ...others.map((x) => ({ text: ct(otherCls(x)), value: otherCls(x), why: `that class contains ${Q_LABEL[x]}, not ${Q_LABEL[q]}.` })),
      { text: ct(Math.floor((c.k - 1) / 2)), value: Math.floor((c.k - 1) / 2), why: 'takes the class in the middle of the horizontal axis instead of the middle of the observations.' },
      ...[target - 1, target + 1].filter((i) => i >= 0 && i < c.k).map((i) => ({ text: ct(i), value: i, why: 'miscounts the cumulative frequencies by one class.' })),
    ];
    const mcq = buildMcq(rng, { text: ct(target), value: target }, ds, {
      count: optionCount,
      order: 'ascending',
      fallback: (i) => {
        const j = (target + 2 + i) % c.k;
        return { text: ct(j), value: j, why: 'misreads the histogram.' };
      },
    });
    const pq = positions(n, q);
    return {
      type,
      stem: `${intro}\nIn which class is ${Q_LABEL[q]} of these data located?`,
      images: img,
      options: mcq.options,
      correctAnswer: mcq.correctAnswer,
      explanation:
        (pctMode ? `The bars show percentages of $n=${n}$; as counts they are ${counts.join(', ')}.\n` : '') +
        `${pq.text} Cumulative counts: ${cumText}.\n` +
        `The cumulative count first reaches ${pq.pos[pq.pos.length - 1]} in the class **${ct(target)}** (${target > 0 ? cum[target - 1] : 0} observations lie below it, ${cum[target]} up to its end). ` +
        `Equivalently, ${Q_P[q] * 100}% of ${n} is ${num(Q_P[q] * n, 2)}, which falls in the same class.${mistakesNote(mcq.distractors)}`,
    };
  },
};

// =====================================================================================================================
// 4. What side-by-side boxplots show (and what they do not show)
// =====================================================================================================================

/** `plural`: the group names are plural nouns ("Nurses have ..."), otherwise singular ("Self-checkout has ..."). */
const BOX_CTX = [
  { intro: 'A supermarket timed how long customers waited at three types of checkout.', what: 'waiting time', unit: 'minutes', groups: ['Self-checkout', 'Staffed till', 'Express lane'], plural: false, hi: 24, step: 2 },
  { intro: 'Three tutorial groups took the same statistics quiz.', what: 'quiz score', unit: 'points', groups: ['Monday group', 'Wednesday group', 'Friday group'], plural: false, hi: 100, step: 10 },
  { intro: 'A web shop compared the delivery times of three parcel services.', what: 'delivery time', unit: 'hours', groups: ['SpeedyBox', 'ParcelPal', 'QuickDrop'], plural: false, hi: 72, step: 6 },
  { intro: 'Researchers asked trolls living in three habitats to rate their happiness.', what: 'happiness score', unit: 'points', groups: ['Bridge trolls', 'Cave trolls', 'Forest trolls'], plural: true, hi: 50, step: 5 },
  { intro: 'A health study recorded the daily number of steps of people in three occupations.', what: 'daily steps', unit: 'thousand steps', groups: ['Students', 'Office workers', 'Nurses'], plural: true, hi: 20, step: 2 },
];

interface GroupU {
  lo: number;
  q1: number;
  med: number;
  q3: number;
  hi: number;
  out: number[];
}

function groupUnits(rng: Rng, U: number): GroupU {
  const w = rng.int(2, 7);
  const q1 = rng.int(2, U - w - 3);
  const q3 = q1 + w;
  const out: number[] = [];
  const fenceU = q3 + 1.5 * w;
  if (rng.chance(0.35) && Math.floor(fenceU) + 1 <= U) out.push(rng.int(Math.floor(fenceU) + 1, U));
  // the lowest value stays above 0 (a delivery time or a step count of 0 would be absurd)
  return { lo: q1 - rng.int(1, Math.min(Math.floor(1.5 * w), q1 - 1)), q1, med: q1 + rng.int(1, w - 1), q3, hi: q3 + rng.int(1, Math.min(Math.floor(1.5 * w), U - q3 - 1)), out };
}
/**
 * What the data behind a boxplot can still do (many observations): the plot fixes the quartiles and the extremes, not
 * where the values lie inside each quarter. Pushing every quarter to its low / high end gives the smallest / largest
 * possible mean; piling the middle half onto the median gives the smallest SD, piling every quarter onto its outer end
 * the largest; a quarter of the values can sit on the lowest / highest value, so that can be the mode.
 */
function reach(x: GroupU) {
  const top = Math.max(x.hi, ...x.out);
  const sdOf = (v: number[], w: number[]) => {
    const m = sum(v.map((a, i) => a * w[i]));
    return Math.sqrt(sum(v.map((a, i) => w[i] * (a - m) ** 2)));
  };
  return {
    minMean: (x.lo + x.q1 + x.med + x.q3) / 4,
    maxMean: (x.q1 + x.med + x.q3 + top) / 4,
    minSd: sdOf([x.q1, x.med, x.q3], [0.25, 0.5, 0.25]),
    maxSd: sdOf([x.lo, x.q1, x.q3, top], [0.25, 0.25, 0.25, 0.25]),
    minMode: x.lo,
    maxMode: top,
  };
}
/** True when another group can (clearly) beat group i on the mean, the mode or the SD, so a claim about it is uncertain. */
const beatable = (gs: GroupU[], i: number, what: 'mean' | 'mode' | 'sd') =>
  gs.some((y, j) => {
    if (j === i) return false;
    const a = reach(gs[i]);
    const b = reach(y);
    return what === 'mean' ? b.maxMean >= a.minMean + 1 : what === 'mode' ? b.maxMode >= a.minMode + 1 : b.maxSd >= 1.1 * a.minSd;
  });

const argmaxUnique = (xs: number[]) => {
  const m = Math.max(...xs);
  return xs.filter((x) => x === m).length === 1 ? xs.indexOf(m) : -1;
};

const boxplotStatements: Template = {
  id: 'describing-distributions.boxplots',
  topic: TOPIC,
  title: 'Side-by-side boxplots: which conclusions are certain (medians, IQR, range, quartiles) and which are not (mean, SD, mode)',
  types: ['single-choice', 'multi-select'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const c = rng.pick(BOX_CTX);
    const k = rng.chance(0.7) ? 3 : 2;
    const names = c.groups.slice(0, k);
    const g = c.step / 2;
    const U = c.hi / g;
    let gs: GroupU[];
    let top: number, topIqr: number, topRange: number;
    const rangeU = (x: GroupU) => Math.max(x.hi, ...x.out) - x.lo;
    do {
      gs = names.map(() => groupUnits(rng, U));
      top = argmaxUnique(gs.map((x) => x.med));
      topIqr = argmaxUnique(gs.map((x) => x.q3 - x.q1));
      topRange = argmaxUnique(gs.map(rangeU));
      // "the group with the highest median has the highest mean / mode" and "the longest box has the largest SD" must be
      // genuinely uncertain: when one group lies entirely above the others, its mean and mode are certainly the highest
    } while (top < 0 || topIqr < 0 || topRange < 0 || !beatable(gs, top, 'mean') || !beatable(gs, top, 'mode') || !beatable(gs, topIqr, 'sd'));
    const V = (u: number) => num(u * g, 2);
    const B = (i: number) => `**${names[i]}**`;
    const has = c.plural ? 'have' : 'has';
    const st: { text: string; correct: boolean; why: string }[] = [];
    names.forEach((_, i) => {
      st.push({ text: `${B(i)} ${has} the highest median.`, correct: i === top, why: i === top ? `its median line (${V(gs[i].med)}) is the highest.` : `${names[top]} ${has} the highest median (${V(gs[top].med)} against ${V(gs[i].med)}).` });
      st.push({ text: `${B(i)} ${has} the largest interquartile range.`, correct: i === topIqr, why: i === topIqr ? `its box is the longest (IQR ${V(gs[i].q3 - gs[i].q1)}).` : `${names[topIqr]} ${has} the longest box (IQR ${V(gs[topIqr].q3 - gs[topIqr].q1)} against ${V(gs[i].q3 - gs[i].q1)}).` });
      st.push({ text: `${B(i)} ${has} the largest range.`, correct: i === topRange, why: i === topRange ? `from its lowest to its highest value (outliers included) it covers ${V(rangeU(gs[i]))}.` : `${names[topRange]} ${has} the largest range (${V(rangeU(gs[topRange]))} against ${V(rangeU(gs[i]))}; outliers count too).` });
    });
    st.push({ text: `${B(top)} ${has} the highest mean.`, correct: false, why: 'a boxplot shows the median, not the mean; skewness and outliers can pull the mean away from the median, and the groups overlap.' });
    st.push({ text: `${B(topIqr)} ${has} the largest standard deviation.`, correct: false, why: 'the standard deviation is not shown; long whiskers or outliers in another group can give that group a larger standard deviation.' });
    st.push({ text: `${B(top)} ${has} the highest mode.`, correct: false, why: 'a boxplot does not show the mode, and the groups overlap: the most frequent value of another group can be higher.' });
    for (const i of rng.sample(names.map((_, j) => j), 2)) {
      const x = gs[i];
      const q = rng.pick(['iqr', 'quarter', 'half'] as const);
      if (q === 'iqr') {
        st.push({ text: `The interquartile range of ${B(i)} is about ${V(x.q3 - x.q1)} ${c.unit}.`, correct: true, why: `$Q_3-Q_1=${V(x.q3)}-${V(x.q1)}=${V(x.q3 - x.q1)}$.` });
        st.push({ text: `The interquartile range of ${B(i)} is about ${V(rangeU(x))} ${c.unit}.`, correct: false, why: 'that is the range (lowest to highest value), not the length of the box.' });
        // only when it differs from the IQR by at least one grid step, so "about" cannot cover both
        if (x.med - x.q1 >= 2) st.push({ text: `The interquartile range of ${B(i)} is about ${V(x.q3 - x.med)} ${c.unit}.`, correct: false, why: 'that is only the upper part of the box ($Q_3$ − median).' });
      } else if (q === 'quarter') {
        st.push({ text: `About a quarter of the values for ${B(i)} are larger than ${V(x.q3)} ${c.unit}.`, correct: true, why: `${V(x.q3)} is $Q_3$: about 25% of the values lie above it.` });
        st.push({ text: `About a quarter of the values for ${B(i)} are larger than ${V(x.med)} ${c.unit}.`, correct: false, why: `${V(x.med)} is the median: about half of the values lie above it.` });
        st.push({ text: `About a quarter of the values for ${B(i)} are larger than ${V(x.q1)} ${c.unit}.`, correct: false, why: `${V(x.q1)} is $Q_1$: about three quarters of the values lie above it.` });
      } else {
        st.push({ text: `Half of the values for ${B(i)} lie between ${V(x.q1)} and ${V(x.q3)} ${c.unit}.`, correct: true, why: 'the box runs from $Q_1$ to $Q_3$ and holds the middle 50% of the values.' });
        st.push({ text: `Half of the values for ${B(i)} lie between ${V(x.q1)} and ${V(x.hi)} ${c.unit}.`, correct: false, why: 'from $Q_1$ to the end of the upper whisker is about three quarters of the values.' });
      }
    }
    names.forEach((_, i) =>
      names.forEach((__, j) => {
        if (i === j) return;
        const mj = Math.max(gs[j].hi, ...gs[j].out);
        if (gs[i].med >= mj)
          st.push({ text: `At least half of the values for ${B(i)} are at least as high as the highest value for ${B(j)}.`, correct: true, why: `the median of ${names[i]} (${V(gs[i].med)}) is at or above the highest value of ${names[j]} (${V(mj)}).` });
        else if (mj - gs[i].med >= 2)
          st.push({ text: `At least half of the values for ${B(i)} are at least as high as the highest value for ${B(j)}.`, correct: false, why: `the median of ${names[i]} (${V(gs[i].med)}) is below the highest value of ${names[j]} (${V(mj)}), so this is not certain.` });
      }),
    );
    const boxes: Box[] = gs.map((x, i) => ({ name: names[i], min: x.lo * g, q1: x.q1 * g, med: x.med * g, q3: x.q3 * g, max: x.hi * g, outliers: x.out.map((o) => o * g) }));
    const images = figure(boxplotSvg(boxes, { lo: 0, hi: c.hi, step: c.step, label: `${cap(c.what)} (${c.unit})` }), `Side-by-side boxplots of ${c.what} for ${names.join(', ')}`);
    const summary = gs
      .map((x, i) => `- **${names[i]}**: lower whisker ${V(x.lo)}, $Q_1=${V(x.q1)}$, median ${V(x.med)}, $Q_3=${V(x.q3)}$, upper whisker ${V(x.hi)}${x.out.length ? `, outlier ${V(x.out[0])}` : ''}; IQR ${V(x.q3 - x.q1)}, range ${V(rangeU(x))}`)
      .join('\n');
    const base =
      `Read each boxplot (the grid lines are ${num(c.step)} ${c.unit} apart):\n${summary}\n` +
      'A boxplot shows the median, the quartiles (the box holds the middle 50%), the whiskers and outliers. It does **not** show the mean, the mode or the standard deviation, so statements about those can never be concluded with certainty.';
    const stem = `${c.intro} The boxplots below summarise the ${c.what} (in ${c.unit}) per group.\nWhich of the following conclusions can be drawn **with certainty** from the boxplots?`;
    if (type === 'multi-select') {
      const m = buildMulti(rng, rng.shuffle(st), optionCount, 1);
      return { type, stem, instruction: INSTRUCTION.multi, images, options: m.options, correctAnswer: m.correctAnswer, explanation: base + reasonsNote(m.reasons) };
    }
    const right = rng.pick(st.filter((s) => s.correct));
    const mcq = buildMcq(rng, { text: right.text }, rng.shuffle(st.filter((s) => !s.correct)).map((s) => ({ text: s.text, why: s.why })), { count: optionCount });
    return { type, stem, images, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: `${base}\nThe correct conclusion: ${right.text} Indeed, ${right.why}${mistakesNote(mcq.distractors)}` };
  },
};

export const TEMPLATES: Template[] = [spreadHistograms, summaryTable, histogramCenter, boxplotStatements];
