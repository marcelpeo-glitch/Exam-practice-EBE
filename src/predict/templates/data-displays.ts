// Templates for the topic "Data & displays" (QM1 past exams: which variables are categorical, measurement scales,
// the right display for a data table, observational unit / variable / variable type, survey answer types). Conceptual
// keys come from labelled banks (VARIABLES, scenario types) that the test file labels a second time on its own; the
// display key follows from the structure of the generated table, which the test reads back; the two-way-table
// percentages are computed from the counts and re-counted record by record in data-displays.test.ts.
import type { TableData } from '../../types';
import { INSTRUCTION, buildMatching, buildMcq, buildMulti, fixed, mistakesNote, numericField, type Choice } from '../build';
import type { Rng } from '../rng';
import { sum } from '../stats';
import type { Template } from '../types';
import { cap } from './_dist';

const TOPIC = 'Data & displays' as const;
const ROMAN = ['I', 'II', 'III'];
const reasonsNote = (rs: { id: string; correct: boolean; why: string }[]) =>
  '\n\n**Option by option**\n' + rs.map((r) => `- **${r.id}** ${r.correct ? '(correct)' : '(wrong)'}: ${r.why}`).join('\n');

// =====================================================================================================================
// 1. Categorical or quantitative? Measurement scales.
// =====================================================================================================================

export type Scale = 'nominal' | 'ordinal' | 'interval' | 'ratio';
export interface VarItem {
  text: string;
  scale: Scale;
  /** Why the variable is easy to misclassify. */
  note?: string;
}

export const VARIABLES: readonly VarItem[] = [
  { text: 'the brand of smartphone a student owns', scale: 'nominal' },
  { text: 'the blood type of a blood donor (A, B, AB or O)', scale: 'nominal' },
  { text: 'the faculty in which a student is enrolled', scale: 'nominal' },
  { text: 'the postal code of a customer’s home address', scale: 'nominal', note: 'the digits only label an area: an average postal code makes no sense' },
  { text: 'the shirt number of a football player', scale: 'nominal', note: 'the number is only a name tag: number 10 is not "twice" number 5' },
  { text: 'the payment method used at a checkout (cash, debit card or credit card)', scale: 'nominal' },
  { text: 'the streaming service a household subscribes to', scale: 'nominal' },
  { text: 'the cup size of a coffee order (small, medium or large)', scale: 'ordinal' },
  { text: 'the star rating of a hotel (1 to 5 stars)', scale: 'ordinal', note: 'the stars are ordered labels: the step from 1 to 2 stars need not equal the step from 4 to 5 stars' },
  { text: 'the satisfaction of a customer (very unhappy, unhappy, neutral, happy, very happy)', scale: 'ordinal' },
  { text: 'the highest completed education of an employee (secondary school, bachelor, master, PhD)', scale: 'ordinal' },
  { text: 'the finishing position of a runner in a city marathon (1st, 2nd, 3rd, ...)', scale: 'ordinal', note: 'a rank only tells who was faster, not by how much' },
  { text: 'the age class of a museum visitor (0–12, 13–17, 18–64 or 65+ years)', scale: 'ordinal', note: 'age was recorded in classes, so only the order of the classes is known' },
  { text: 'the temperature in degrees Celsius at noon in Maastricht', scale: 'interval', note: '0 °C does not mean "no temperature"' },
  { text: 'the year in which a company was founded', scale: 'interval', note: 'year 0 is an arbitrary starting point of the calendar' },
  { text: 'the clock time (24-hour clock) at which a night train departs', scale: 'interval', note: 'midnight (00:00) does not mean "no time"' },
  { text: 'the monthly rent of a student room in euros', scale: 'ratio' },
  { text: 'the time in minutes a student needs to cycle to campus', scale: 'ratio' },
  { text: 'the number of siblings of a student', scale: 'ratio' },
  { text: 'the weight in kilograms of a parcel', scale: 'ratio' },
  { text: 'the number of cups of coffee a lecturer drinks per day', scale: 'ratio' },
  { text: 'the price of a concert ticket in euros', scale: 'ratio' },
];

const isCat = (s: Scale) => s === 'nominal' || s === 'ordinal';
const kindOf = (v: VarItem) => (isCat(v.scale) ? 'categorical' : 'quantitative');
const SCALE_REASON: Record<Scale, string> = {
  nominal: 'its values are categories without a natural order (nominal)',
  ordinal: 'its values are categories with a natural order (ordinal)',
  interval: 'it is a measured amount whose zero point is arbitrary, so differences are meaningful but ratios are not (interval)',
  ratio: 'it is a measured amount with a true zero, so differences and ratios are both meaningful (ratio)',
};
/** "categorical: its values are ... (ordinal); <note>" */
const reason = (v: VarItem) => `${kindOf(v)}: ${SCALE_REASON[v.scale]}${v.note ? `; ${v.note}` : ''}`;

function subsetLabel(mask: number): string {
  const ids = ROMAN.filter((_, i) => mask & (1 << i));
  if (!ids.length) return 'None of them';
  if (ids.length === 1) return `${ids[0]} only`;
  return ids.length === 2 ? `${ids[0]} and ${ids[1]}` : 'I, II and III';
}

function scaleWhy(v: VarItem, w: Scale | 'quantitative' | 'categorical'): string {
  const k = v.scale;
  if (w === 'quantitative') return `the values are ${k === 'ordinal' ? 'ordered ' : ''}categories (labels), not measured amounts${v.note ? `: ${v.note}` : ''}.`;
  if (w === 'categorical') return 'the variable is a measured amount, so it is quantitative, not categorical.';
  if (isCat(k) && !isCat(w)) return `treats the categories as measured amounts ${w === 'ratio' ? 'with a true zero' : 'with equal distances'}${v.note ? `, but ${v.note}` : ''}.`;
  if (!isCat(k) && isCat(w)) return 'treats a measured amount as a set of categories; the variable is quantitative.';
  if (k === 'nominal') return 'sees a natural order in the categories that is not there.';
  if (k === 'ordinal') return 'ignores the natural order of the categories.';
  if (k === 'interval') return `${v.note ?? 'the zero point is arbitrary'}, so ratios such as "twice as much" are meaningless: interval, not ratio.`;
  return 'overlooks the true zero: 0 means "none", so ratios such as "twice as much" are meaningful (ratio, not interval).';
}

const variableTypes: Template = {
  id: 'data-displays.variable-types',
  topic: TOPIC,
  title: 'Categorical or quantitative (I/II/III combinations or a list), or the measurement scale of one variable',
  types: ['single-choice', 'multi-select'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const want = rng.pick(['categorical', 'quantitative'] as const);
    if (type === 'multi-select') {
      const pool = rng.shuffle([...rng.sample(VARIABLES.filter((v) => isCat(v.scale)), 4), ...rng.sample(VARIABLES.filter((v) => !isCat(v.scale)), 4)]);
      const st = pool.map((v) => ({ text: cap(v.text), correct: kindOf(v) === want, why: `${cap(v.text)} is ${reason(v)}.` }));
      const m = buildMulti(rng, st, optionCount, 1);
      const stem = `${rng.pick(['A researcher builds a dataset on student life and consumer behaviour.', 'An analyst at a market research agency lists some of the variables in a new dataset.', 'For a course project, students record a number of variables.'])} Which of the following variables are **${want}**?`;
      return {
        type,
        stem,
        instruction: INSTRUCTION.multi,
        options: m.options,
        correctAnswer: m.correctAnswer,
        explanation: `A variable is **categorical** when its values are categories (labels, possibly ordered) and **quantitative** when its values are measured amounts with units, for which averages and differences make sense. Numbers alone do not make a variable quantitative.${reasonsNote(m.reasons)}`,
      };
    }
    if (rng.chance(0.5)) {
      // I / II / III combinations
      const traps = VARIABLES.filter((v) => v.note);
      let items: VarItem[];
      let mask: number;
      do {
        items = rng.shuffle([rng.pick(traps), ...rng.sample(VARIABLES, 2)]);
        mask = items.reduce((m, v, i) => (kindOf(v) === want ? m | (1 << i) : m), 0);
      } while (new Set(items.map((v) => v.text)).size < 3 || mask === 0);
      const flipWhy = (i: number) =>
        `${(mask >> i) & 1 ? 'leaves out' : 'includes'} ${ROMAN[i]}, but ${ROMAN[i]} is ${reason(items[i])}.`;
      const one: Choice[] = [0, 1, 2].map((i) => ({ text: subsetLabel(mask ^ (1 << i)), why: flipWhy(i) }));
      const two: Choice[] = [
        [0, 1],
        [0, 2],
        [1, 2],
      ].map(([i, j]) => ({ text: subsetLabel(mask ^ (1 << i) ^ (1 << j)), why: `misclassifies both ${ROMAN[i]} and ${ROMAN[j]}.` }));
      const mcq = buildMcq(rng, { text: subsetLabel(mask) }, [...rng.shuffle(one), ...rng.shuffle(two)], {
        count: optionCount,
        fallback: (i) => ({ text: subsetLabel(i % 8), why: 'misclassifies several of the variables.' }),
      });
      const intro = rng.pick([
        'A market research agency stores the following information for every record in its database:',
        'For a project on daily life in Maastricht, students collected data on these variables:',
        'A data analyst describes three of the columns in a new spreadsheet:',
      ]);
      const stem = `${intro}\n${items.map((v, i) => `${ROMAN[i]}. ${cap(v.text)}`).join('\n')}\nWhich of these variables is/are **${want}**?`;
      const lines = items.map((v, i) => `- **${ROMAN[i]}.** ${cap(v.text)} is ${reason(v)}.`).join('\n');
      return {
        type,
        stem,
        options: mcq.options,
        correctAnswer: mcq.correctAnswer,
        explanation: `Classify each variable (categorical = categories/labels, quantitative = measured amounts):\n${lines}\nSo the ${want} variable(s): **${subsetLabel(mask)}**.${mistakesNote(mcq.distractors)}`,
      };
    }
    // measurement scale of one variable
    const v = rng.chance(0.6) ? rng.pick(VARIABLES.filter((x) => x.note)) : rng.pick(VARIABLES);
    const names: (Scale | 'quantitative' | 'categorical')[] = ['nominal', 'ordinal', 'interval', 'ratio', isCat(v.scale) ? 'quantitative' : 'categorical'];
    const ch = names.map((s, i) => ({ text: cap(s), value: i, why: s === v.scale ? undefined : scaleWhy(v, s) }));
    const correct = ch.find((c) => c.text === cap(v.scale))!;
    const mcq = buildMcq(rng, correct, ch.filter((c) => c !== correct), { count: optionCount, order: 'ascending' });
    const stem = rng.pick([
      `A dataset contains the variable **${v.text}**. On which measurement scale is this variable measured?`,
      `Consider the variable **${v.text}**. What is its level of measurement?`,
    ]);
    return {
      type,
      stem,
      options: mcq.options,
      correctAnswer: mcq.correctAnswer,
      explanation:
        'Levels of measurement: **nominal** (categories without order), **ordinal** (ordered categories), **interval** (measured amounts with an arbitrary zero: differences are meaningful) and **ratio** (measured amounts with a true zero: ratios are meaningful too).\n' +
        `${cap(v.text)} is ${reason(v)}. So the scale is **${v.scale}**.${mistakesNote(mcq.distractors)}`,
    };
  },
};

// =====================================================================================================================
// 2. Which display fits the data?
// =====================================================================================================================

export type Disp = 'pie' | 'bar' | 'seg' | 'hist' | 'box' | 'sbs' | 'line' | 'scatter';
export const DISPLAY_NAME: Record<Disp, string> = {
  pie: 'Pie chart',
  bar: 'Bar chart',
  seg: 'Segmented bar chart',
  hist: 'Histogram',
  box: 'Boxplot',
  sbs: 'Side-by-side boxplots',
  line: 'Line graph (time plot)',
  scatter: 'Scatterplot',
};
type Struct = 'whole' | 'multi' | 'two-cat' | 'one-quant' | 'groups' | 'time' | 'two-quant';
const OK: Record<Struct, Disp[]> = { whole: ['pie', 'bar'], multi: ['bar'], 'two-cat': ['seg'], 'one-quant': ['hist', 'box'], groups: ['sbs'], time: ['line'], 'two-quant': ['scatter'] };
/** Displays that are clearly wrong (ambiguous ones, e.g. a bar chart for a time series, never appear). */
const WRONG: Record<Struct, Disp[]> = {
  whole: ['seg', 'hist', 'box', 'line', 'scatter'],
  multi: ['pie', 'seg', 'hist', 'box', 'line', 'scatter'],
  'two-cat': ['pie', 'hist', 'box', 'line', 'scatter'],
  'one-quant': ['pie', 'bar', 'seg', 'line', 'scatter'],
  groups: ['pie', 'seg', 'line', 'scatter'],
  time: ['pie', 'seg', 'box', 'hist'],
  'two-quant': ['pie', 'bar', 'seg', 'hist', 'box'],
};

interface DispCase {
  struct: Struct;
  intro: string;
  goal: string;
  table: TableData;
  explain: string;
  pctSum?: number;
}

function whyWrong(d: Disp, c: DispCase): string {
  const s = c.struct;
  switch (d) {
    case 'pie':
      if (s === 'multi') return `a pie chart needs parts of one whole, but these percentages add up to ${fixed(c.pctSum!, 1)}% because respondents could pick several answers.`;
      if (s === 'two-cat') return 'one pie chart shows a single categorical variable; here there are two.';
      return 'a pie chart shows how a whole is divided over categories; these data are values of a quantitative variable.';
    case 'bar':
      return s === 'two-quant' ? 'a bar chart shows one count per category; it cannot show how two quantitative variables are related.' : 'a bar chart shows counts or percentages of categories, but these data are values of a quantitative variable.';
    case 'seg':
      return s === 'whole' || s === 'multi' ? 'a segmented bar chart needs a second categorical variable to split the bars, and there is only one.' : 'a segmented bar chart compares two categorical variables; these data are quantitative.';
    case 'hist':
      if (s === 'time') return 'a histogram throws away the time order, so it cannot show the development over time.';
      if (s === 'two-quant') return 'a histogram shows one variable at a time, not the relationship between two variables.';
      return `a histogram needs a quantitative variable; these data are ${s === 'multi' ? 'percentages' : 'counts'} per category of a categorical variable.`;
    case 'box':
      if (s === 'time') return 'a boxplot summarises the values but hides the time order.';
      if (s === 'two-quant') return 'a boxplot summarises one variable at a time; it cannot show the relationship between two.';
      return `a boxplot summarises a quantitative variable; these data are ${s === 'multi' ? 'percentages' : 'counts'} per category of a categorical variable.`;
    case 'line':
      return 'a line graph (time plot) is for values measured at successive moments in time; there is no time order here.';
    case 'scatter':
      return s === 'groups' ? 'a scatterplot needs two quantitative variables, but the grouping variable is categorical.' : 'a scatterplot needs two quantitative variables measured on the same cases.';
    default:
      return 'does not fit these data.';
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dispCase(rng: Rng, struct: Struct): DispCase {
  switch (struct) {
    case 'whole': {
      const c = rng.pick([
        { intro: (n: number) => `A food truck at a summer festival records the main dish of each of its ${n} orders on Saturday.`, head: ['Main dish', 'Number of orders'], cats: ['Falafel wrap', 'Burger', 'Noodle box', 'Vegan bowl', 'Loaded fries'], goal: 'show how the orders are divided over the dishes', v: 'main dish' },
        { intro: (n: number) => `The ${n} students in a lecture hall are asked how they travelled to campus today.`, head: ['Mode of transport', 'Number of students'], cats: ['Bike', 'Bus', 'Train', 'Car', 'On foot'], goal: 'show how the students are divided over the modes of transport', v: 'mode of transport' },
        { intro: (n: number) => `A laptop shop registers the operating system of each of the ${n} laptops it sold in March.`, head: ['Operating system', 'Laptops sold'], cats: ['Windows', 'macOS', 'ChromeOS', 'Linux'], goal: 'show the share of each operating system in the sales', v: 'operating system' },
      ]);
      const cats = c.cats.slice(0, rng.int(4, c.cats.length));
      const counts = cats.map(() => rng.int(6, 60));
      const n = sum(counts);
      return {
        struct,
        intro: c.intro(n),
        goal: c.goal,
        table: { header: c.head, rows: cats.map((k, i) => [k, String(counts[i])]) },
        explain: `There is one categorical variable (${c.v}), and each of the ${n} cases falls in exactly one category: the counts are parts of one whole (they add up to ${n}). Both a **bar chart** and a **pie chart** fit.`,
      };
    }
    case 'multi': {
      const c = rng.pick([
        { intro: (n: number) => `In a survey, ${n} students were asked which apps they open at least once a day; they could tick as many apps as they liked.`, head: ['App', '% of students'], cats: ['WhatsApp', 'Instagram', 'TikTok', 'Snapchat', 'LinkedIn'], goal: 'compare how popular the apps are' },
        { intro: (n: number) => `A pet-food company asked ${n} households which pets they keep (several answers were possible).`, head: ['Pet', '% of households'], cats: ['Cat', 'Dog', 'Fish', 'Rabbit', 'Bird'], goal: 'compare how common the different pets are' },
        { intro: (n: number) => `A music festival asked ${n} visitors which extras they paid for; visitors could mention several extras.`, head: ['Extra', '% of visitors'], cats: ['Drink tokens', 'Food', 'Merchandise', 'Locker', 'Camping upgrade'], goal: 'compare how often each extra was bought' },
      ]);
      // the categories are listed from most to least common, so the percentages are sorted to match
      let p: number[];
      do p = c.cats.map(() => rng.int(80, 850) / 10).sort((x, y) => y - x);
      while (sum(p) < 130 || new Set(p).size < p.length);
      return {
        struct,
        intro: c.intro(rng.pick([200, 250, 400, 500, 800])),
        goal: c.goal,
        table: { header: c.head, rows: c.cats.map((k, i) => [k, `${fixed(p[i], 1)}%`]) },
        pctSum: sum(p),
        explain: `There is one categorical variable, but every respondent could choose several categories: the percentages add up to ${fixed(sum(p), 1)}%, not 100%. They are not parts of one whole, so a pie chart is wrong; a **bar chart** with one bar per category shows the percentages correctly.`,
      };
    }
    case 'two-cat': {
      const c = rng.pick([
        { intro: (n: number) => `A gym asked ${n} members about their favourite type of workout. The table splits the answers by age group.`, rv: 'Favourite workout', rows: ['Weights', 'Cardio', 'Group classes'], cols: ['Under 30', '30 or older'], goal: 'compare the favourite workouts of the two age groups' },
        { intro: (n: number) => `A bookshop recorded the genre and the format of the ${n} books it sold last week.`, rv: 'Genre', rows: ['Crime', 'Fantasy', 'Non-fiction'], cols: ['Paperback', 'E-book', 'Audiobook'], goal: 'compare the genres sold in the three formats' },
        { intro: (n: number) => `For ${n} students, a university survey records their faculty and whether they live with their parents or rent a room.`, rv: 'Faculty', rows: ['Business & Economics', 'Law', 'Health'], cols: ['With parents', 'Rents a room'], goal: 'compare the housing situation of students across the faculties' },
      ]);
      const counts = c.rows.map(() => c.cols.map(() => rng.int(5, 90)));
      const n = sum(counts.flat());
      return {
        struct,
        intro: c.intro(n),
        goal: c.goal,
        table: { header: [c.rv, ...c.cols], rows: c.rows.map((r, i) => [r, ...counts[i].map(String)]) },
        explain: `Every case has two categorical variables (${c.rv.toLowerCase()} and the column variable). To compare the distribution of one within the categories of the other, use a **segmented (stacked) bar chart** of the conditional percentages.`,
      };
    }
    case 'one-quant': {
      const c = rng.pick([
        { intro: (n: number) => `A bakery timed how long ${n} customers waited before being served.`, cap: 'Waiting time (minutes)', lo: 5, hi: 120, goal: 'display the distribution of the waiting times' },
        { intro: (n: number) => `${n} students reported how much mobile data they used last month.`, cap: 'Mobile data used (GB)', lo: 5, hi: 250, goal: 'display the distribution of the data use' },
        { intro: (n: number) => `A cycling club recorded the length of ${n} Sunday rides.`, cap: 'Ride length (km)', lo: 250, hi: 1200, goal: 'display the distribution of the ride lengths' },
      ]);
      const vals = Array.from({ length: 20 }, () => rng.int(c.lo, c.hi) / 10);
      return {
        struct,
        intro: c.intro(20),
        goal: c.goal,
        table: { rows: [0, 1, 2, 3].map((r) => vals.slice(5 * r, 5 * r + 5).map((x) => fixed(x, 1))), caption: `${c.cap}, 20 observations` },
        explain: 'The data are 20 values of one quantitative variable. Its distribution is shown by a **histogram** (shape, centre, spread) or summarised by a **boxplot**.',
      };
    }
    case 'groups': {
      const c = rng.pick([
        { intro: 'A consumer magazine measured the battery life of six e-scooters of each of three brands.', head: ['Brand', 'Battery life (hours)'], g: ['VoltRide', 'Zoomr', 'E-Go'], lo: 40, hi: 140, dp: 1, goal: 'compare the battery lives of the three brands' },
        { intro: 'Three pizza places each delivered six test orders to the same address.', head: ['Pizza place', 'Delivery time (minutes)'], g: ['Pizza Nonna', 'Slice Express', 'Il Forno'], lo: 18, hi: 55, dp: 0, goal: 'compare the delivery times of the three pizza places' },
        { intro: 'A tutor recorded the scores (out of 50) of six students in each of her three tutorial groups on a practice test.', head: ['Tutorial group', 'Score'], g: ['Group 1', 'Group 2', 'Group 3'], lo: 15, hi: 50, dp: 0, goal: 'compare the scores of the three tutorial groups' },
      ]);
      const val = () => (c.dp ? rng.int(c.lo, c.hi) / 10 : rng.int(c.lo, c.hi));
      return {
        struct,
        intro: c.intro,
        goal: c.goal,
        table: { header: c.head, rows: c.g.map((g) => [g, Array.from({ length: 6 }, () => fixed(val(), c.dp)).join(', ')]) },
        explain: `A quantitative variable (${c.head[1].toLowerCase()}) is compared across the categories of a categorical variable (${c.head[0].toLowerCase()}): put **side-by-side boxplots** on one common axis.`,
      };
    }
    case 'time': {
      const c = rng.pick([
        { intro: 'A natural history museum counted its visitors in every month of last year.', head: ['Month', 'Visitors'], labels: MONTHS, lo: 2000, hi: 9000, goal: 'show how the number of visitors developed during the year' },
        { intro: 'A bike shop reports how many bikes it sold in each of the last ten years.', head: ['Year', 'Bikes sold'], labels: Array.from({ length: 10 }, (_, i) => String(2015 + i)), lo: 300, hi: 900, goal: 'show how the sales developed over the years' },
        { intro: 'An ice-cream parlour lists its revenue for each week of the summer.', head: ['Week', 'Revenue (€)'], labels: Array.from({ length: 10 }, (_, i) => `Week ${23 + i}`), lo: 1500, hi: 6000, goal: 'show how the weekly revenue developed during the summer' },
      ]);
      return {
        struct,
        intro: c.intro,
        goal: c.goal,
        table: { header: c.head, rows: c.labels.map((l) => [l, String(rng.int(c.lo, c.hi))]) },
        explain: 'The values were measured at successive moments in time (one quantitative variable plus a time order). A **line graph (time plot)** with time on the horizontal axis shows the development.',
      };
    }
    default: {
      const c = rng.pick([
        { intro: 'For ten shops in a shopping street, the floor area and the weekly revenue are recorded.', head: ['Shop', 'Floor area (m²)', 'Weekly revenue (€1000)'], id: 'Shop', a: [60, 400], b: [8, 60], goal: 'show the relationship between floor area and weekly revenue' },
        { intro: 'For ten students, the hours spent studying for an exam and the exam grade were recorded.', head: ['Student', 'Hours studied', 'Grade (1–10)'], id: 'Student', a: [2, 40], b: [2, 10], goal: 'show the relationship between study time and grade' },
        { intro: 'For ten used cars on a website, the age and the asking price are recorded.', head: ['Car', 'Age (years)', 'Price (€1000)'], id: 'Car', a: [1, 15], b: [3, 35], goal: 'show the relationship between the age and the price of a car' },
      ]);
      return {
        struct: 'two-quant',
        intro: c.intro,
        goal: c.goal,
        table: { header: c.head, rows: Array.from({ length: 10 }, (_, i) => [`${c.id} ${i + 1}`, String(rng.int(c.a[0], c.a[1])), String(rng.int(c.b[0], c.b[1]))]) },
        explain: 'Two quantitative variables are measured on the same cases. A **scatterplot** (one point per case) shows their relationship.',
      };
    }
  }
}

const chooseDisplay: Template = {
  id: 'data-displays.choose-display',
  topic: TOPIC,
  title: 'Which display fits a data table (pie/bar/segmented bar chart, histogram, boxplots, time plot, scatterplot)',
  types: ['single-choice', 'multi-select'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const struct = rng.pick<Struct>(['whole', 'multi', 'multi', 'two-cat', 'one-quant', 'groups', 'time', 'two-quant']);
    const c = dispCase(rng, struct);
    if (type === 'multi-select') {
      const st = [
        ...OK[struct].map((d) => ({ text: DISPLAY_NAME[d], correct: true, why: 'fits these data.' })),
        ...WRONG[struct].map((d) => ({ text: DISPLAY_NAME[d], correct: false, why: whyWrong(d, c) })),
      ];
      const m = buildMulti(rng, st, optionCount, 1);
      return {
        type,
        stem: `${c.intro} The data are shown in the table.\nWhich of the following displays are appropriate to ${c.goal}?`,
        instruction: INSTRUCTION.multi,
        table: c.table,
        options: m.options,
        correctAnswer: m.correctAnswer,
        explanation: c.explain + reasonsNote(m.reasons),
      };
    }
    const key = rng.pick(OK[struct]);
    const mcq = buildMcq(
      rng,
      { text: DISPLAY_NAME[key] },
      rng.shuffle(WRONG[struct]).map((d) => ({ text: DISPLAY_NAME[d], why: whyWrong(d, c) })),
      { count: optionCount },
    );
    return {
      type,
      stem: `${c.intro} The data are shown in the table.\nWhich of the following displays is appropriate to ${c.goal}?`,
      table: c.table,
      options: mcq.options,
      correctAnswer: mcq.correctAnswer,
      explanation: `${c.explain} The answer is **${DISPLAY_NAME[key]}**.${mistakesNote(mcq.distractors)}`,
    };
  },
};

// =====================================================================================================================
// 3. Observational unit, variable and variable type (matching); answer types in a questionnaire (single choice)
// =====================================================================================================================

type VType = 'Nominal' | 'Ordinal' | 'Quantitative';
interface UnitScenario {
  story: (rng: Rng) => { text: string; values: string[] };
  unit: string;
  variable: string;
  type: VType;
  other: string;
  why: string;
}

const three = (rng: Rng) => [rng.int(8, 30), rng.int(8, 30), rng.int(8, 30)];
const UNIT_SCENARIOS: UnitScenario[] = [
  {
    story: (rng) => {
      const [a, b, c] = three(rng);
      return { text: `At the Academy of Flame, all ${a + b + c} first-year dragons take a fire-breathing test: ${a} of them breathe blue fire, ${b} breathe green fire and ${c} breathe purple fire.`, values: ['Blue fire', 'Green fire'] };
    },
    unit: 'A first-year dragon',
    variable: 'Colour of the fire',
    type: 'Nominal',
    other: 'The Academy of Flame',
    why: 'Blue, green and purple fire have no natural order, so the variable is categorical and nominal.',
  },
  {
    story: (rng) => {
      const [a, b, c] = three(rng);
      return { text: `A zoo vet examines all ${a + b + c} penguins of the colony and classifies each penguin as underweight (${a}), healthy weight (${b}) or overweight (${c}).`, values: ['Underweight', 'Overweight'] };
    },
    unit: 'A penguin',
    variable: 'Weight class',
    type: 'Ordinal',
    other: 'The zoo vet',
    why: 'The classes have a natural order (underweight < healthy weight < overweight), so the variable is categorical and ordinal.',
  },
  {
    story: (rng) => {
      const [a, b, c] = three(rng);
      return { text: `On Monday morning a campus coffee bar sells ${a + b + c} coffees: ${a} small, ${b} medium and ${c} large.`, values: ['Small', 'Large'] };
    },
    unit: 'A coffee sold',
    variable: 'Cup size',
    type: 'Ordinal',
    other: 'The coffee bar',
    why: 'Small < medium < large is a natural order, so the variable is categorical and ordinal.',
  },
  {
    story: (rng) => {
      const [a, b, c] = three(rng);
      return { text: `A ghost hunter catalogues the ${a + b + c} ghosts of an old castle by the room they haunt: ${a} haunt the attic, ${b} the cellar and ${c} the great hall.`, values: ['Attic', 'Cellar'] };
    },
    unit: 'A ghost',
    variable: 'Room haunted',
    type: 'Nominal',
    other: 'The ghost hunter',
    why: 'Attic, cellar and great hall have no natural order, so the variable is categorical and nominal.',
  },
  {
    story: (rng) => {
      const n = rng.int(20, 45);
      const m = rng.int(30, 90) / 10;
      return { text: `A pet shop puts a counter on the running wheel of each of its ${n} hamsters and records how many kilometres each hamster runs in one night. On average, the hamsters ran ${m} km.`, values: [`${m} km`, 'The running wheel'] };
    },
    unit: 'A hamster',
    variable: 'Distance run in one night',
    type: 'Quantitative',
    other: 'The pet shop',
    why: 'The distance is a measured amount in kilometres (averaging it makes sense), so the variable is quantitative.',
  },
  {
    story: (rng) => {
      const n = rng.int(30, 80);
      const hi = rng.int(9, 16);
      return { text: `A library checks, for each of its ${n} youngest members, how many books they borrowed in March. The counts range from 0 to ${hi} books.`, values: ['March', `${hi} books`] };
    },
    unit: 'A young library member',
    variable: 'Number of books borrowed',
    type: 'Quantitative',
    other: 'The library',
    why: 'The number of books is a count (an amount; averaging makes sense), so the variable is quantitative.',
  },
  {
    story: (rng) => {
      const [a, b, c] = three(rng);
      return { text: `The ${a + b + c} cleaning robots of a factory are inspected, and each robot gets the grade poor (${a}), adequate (${b}) or excellent (${c}).`, values: ['Poor', 'Excellent'] };
    },
    unit: 'A cleaning robot',
    variable: 'Inspection grade',
    type: 'Ordinal',
    other: 'The inspector',
    why: 'Poor < adequate < excellent is a natural order, so the variable is categorical and ordinal.',
  },
  {
    story: (rng) => {
      const [a, b, c] = three(rng);
      return { text: `On a Tuesday, ${a + b + c} bikes are parked in front of the university library: ${a} city bikes, ${b} e-bikes and ${c} racing bikes.`, values: ['E-bike', 'City bike'] };
    },
    unit: 'A parked bike',
    variable: 'Type of bike',
    type: 'Nominal',
    other: 'The university library',
    why: 'City bike, e-bike and racing bike have no natural order, so the variable is categorical and nominal.',
  },
];

type AType = 'nominal' | 'ordinal' | 'quantitative';
const SURVEYS = [
  { intro: 'The city zoo is choosing a mascot for its new children’s area and asks young visitors to fill in a short questionnaire about two candidates.', items: ['Pip the Panda', 'Gus the Gorilla'], nominal: ['Cute', 'Silly', 'Scary', 'Boring'], bg: 'age' as const },
  { intro: 'A streaming service shows its subscribers a pop-up questionnaire about two new series.', items: ['the series *Ice Planet*', 'the series *The Last Bakery*'], nominal: ['Funny', 'Exciting', 'Sad', 'Confusing'], bg: 'hours' as const },
  { intro: 'The student restaurant tests two new lunch dishes and hands out a feedback card to diners.', items: ['the lentil curry', 'the mushroom lasagne'], nominal: ['Spicy', 'Creamy', 'Fresh', 'Hearty'], bg: 'visits' as const },
];
const ORDINAL_ANSWERS = [
  ['Very bad', 'Bad', 'Okay', 'Good', 'Very good'],
  ['Not at all', 'A little', 'Quite a lot', 'Very much'],
];
const BACKGROUND = {
  age: { q: 'How old are you?', classes: ['under 8 years', '8–11 years', '12–15 years', '16 years or older'], unit: 'years', noun: 'the age' },
  hours: { q: 'How many hours per week do you watch series?', classes: ['0–2 hours', '3–5 hours', '6–10 hours', 'more than 10 hours'], unit: 'hours', noun: 'the weekly viewing time' },
  visits: { q: 'How many times did you eat in the student restaurant last month?', classes: ['0–1 times', '2–5 times', '6–10 times', 'more than 10 times'], unit: 'times', noun: 'the number of visits' },
};
const an = (t: AType) => (t === 'ordinal' ? 'an ordinal' : `a ${t}`);
const box = (xs: string[]) => xs.map((x) => `☐ ${x}`).join('   ');

function surveyOption(op: AType, bg: AType, bgNoun: string): string {
  return `The opinions are ${op} variables, and ${bgNoun} has been measured as ${an(bg)} variable`;
}

const unitsVariables: Template = {
  id: 'data-displays.unit-variable-type',
  topic: TOPIC,
  title: 'Observational unit, variable and variable type of a small study (matching); variable types in a questionnaire',
  types: ['matching', 'single-choice'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    if (type === 'matching') {
      const s = rng.pick(UNIT_SCENARIOS);
      const st = s.story(rng);
      const pairs = [
        { prompt: 'Observational unit', answer: s.unit },
        { prompt: 'Variable', answer: s.variable },
        { prompt: 'Variable type', answer: s.type },
      ];
      const extra = [...st.values, s.other, ...(['Nominal', 'Ordinal', 'Quantitative'] as const).filter((t) => t !== s.type)];
      const m = buildMatching(rng, pairs, extra);
      return {
        type,
        stem: `${st.text}\nIdentify the **observational unit**, the **variable** and the **variable type**.`,
        instruction: INSTRUCTION.matching,
        prompts: m.prompts,
        choices: m.choices,
        correctAnswer: m.correctAnswer,
        explanation:
          `Each case in the data is one ${s.unit.replace(/^An? /, '').toLowerCase()}, so the **observational unit** is "${s.unit}". ` +
          `What is recorded for every case is the **variable** "${s.variable}"; ${st.values.map((v) => `"${v}"`).join(' and ')} are values of that variable (or other details of the story), not variables. ` +
          `"${s.other}" appears in the story, but it is not a case: the data have one entry per ${s.unit.replace(/^An? /, '').toLowerCase()}. ${s.why} So the **variable type** is ${s.type.toLowerCase()}.`,
      };
    }
    // single-choice: questionnaire with two opinion questions and one background question
    const sv = rng.pick(SURVEYS);
    const op: AType = rng.pick(['nominal', 'ordinal'] as const);
    const bgT: AType = rng.pick(['ordinal', 'quantitative'] as const);
    const bg = BACKGROUND[sv.bg];
    const answers = op === 'nominal' ? sv.nominal : rng.pick(ORDINAL_ANSWERS);
    const qText = (it: string) =>
      op === 'nominal' ? `Which word describes ${it} best? (tick 1 box)` : answers[0] === 'Very bad' ? `How would you rate ${it}? (tick 1 box)` : `How much do you like ${it}? (tick 1 box)`;
    const table: TableData = {
      header: ['Question', 'Answer options'],
      rows: [...sv.items.map((it) => [qText(it), box(answers)]), [bg.q, bgT === 'ordinal' ? box(bg.classes) : `____ ${bg.unit}`]],
    };
    const opWhy: Record<AType, string> = {
      nominal: `the answer options (${answers.join(', ')}) have no natural order, so the opinions are nominal`,
      ordinal: `the answer options run from "${answers[0]}" to "${answers[answers.length - 1]}": they have a natural order, so the opinions are ordinal`,
      quantitative: 'the answers are words (categories), not measured numbers',
    };
    const bgWhy = bgT === 'ordinal' ? `${bg.noun} itself is a number, but here it was asked in ordered classes, so only the class (an ordered category) is recorded: ordinal` : `the exact number of ${bg.unit} is filled in, so ${bg.noun} is quantitative`;
    const ds: Choice[] = [];
    for (const o of ['nominal', 'ordinal', 'quantitative'] as AType[])
      for (const b of ['nominal', 'ordinal', 'quantitative'] as AType[]) {
        if (o === op && b === bgT) continue;
        const parts = [o !== op ? opWhy[o === 'quantitative' ? 'quantitative' : op] : '', b !== bgT ? (bgT === 'ordinal' && b === 'nominal' ? 'the classes of the last question have a natural order' : bgWhy) : ''].filter(Boolean);
        ds.push({ text: surveyOption(o, b, bg.noun), why: `${cap(parts.join('; also, '))}.`, value: (o !== op ? 1 : 0) + (b !== bgT ? 1 : 0) });
      }
    const ordered = [...rng.shuffle(ds.filter((d) => d.value === 1)), ...rng.shuffle(ds.filter((d) => d.value === 2))].map((d) => ({ text: d.text, why: d.why }));
    const mcq = buildMcq(rng, { text: surveyOption(op, bgT, bg.noun) }, ordered, { count: optionCount });
    return {
      type,
      stem: `${sv.intro} The questionnaire is shown below.\nWhich description of the variables measured by these questions is correct?`,
      table,
      options: mcq.options,
      correctAnswer: mcq.correctAnswer,
      explanation:
        `Look at the answer options, not at the topic: ${opWhy[op]}. For the last question, ${bgWhy}.\n` +
        `So: **${surveyOption(op, bgT, bg.noun)}**.${mistakesNote(mcq.distractors)}`,
    };
  },
};

// =====================================================================================================================
// 4. Two-way tables: joint, marginal and conditional percentages
// =====================================================================================================================

interface TwoWay {
  units: string;
  /** Relative pronoun for the units ("the students who ...", "the orders that ..."). */
  who: 'who' | 'that';
  rv: string;
  rows: string[];
  cv: string;
  cols: string[];
  /** Plural predicates naming a row / column category in bold (the label in lower case), e.g. "prefer the **main stage**". */
  rp: (r: string) => string;
  cp: (c: string) => string;
  intro: (n: number) => string;
}
const lc = (s: string) => s.toLowerCase();
const plain = (s: string) => s.replace(/\*\*/g, '');
const TWO_WAY: TwoWay[] = [
  {
    units: 'coffee orders',
    who: 'that',
    rv: 'cup size',
    rows: ['Small', 'Medium', 'Large'],
    cv: 'time of day',
    cols: ['Morning', 'Afternoon', 'Evening'],
    rp: (r) => `were for a **${lc(r)}** cup`,
    cp: (c) => `were placed in the **${lc(c)}**`,
    intro: (n) => `A campus coffee bar recorded the cup size and the time of day of its last ${n} coffee orders.`,
  },
  {
    units: 'visitors',
    who: 'who',
    rv: 'ticket type',
    rows: ['Adult', 'Student', 'Child'],
    cv: 'day of visit',
    cols: ['Weekday', 'Weekend'],
    rp: (r) => `bought ${r === 'Adult' ? 'an' : 'a'} **${lc(r)}** ticket`,
    cp: (c) => (c === 'Weekday' ? 'came on a **weekday**' : 'came at the **weekend**'),
    intro: (n) => `A science museum classified its last ${n} visitors by ticket type and by the day of their visit.`,
  },
  {
    units: 'students',
    who: 'who',
    rv: 'transport',
    rows: ['Bike', 'Bus', 'Train', 'On foot'],
    cv: 'housing',
    cols: ['With their parents', 'In a rented room'],
    rp: (r) => (r === 'On foot' ? 'usually come to campus **on foot**' : `usually come to campus by **${lc(r)}**`),
    cp: (c) => `live **${lc(c)}**`,
    intro: (n) => `A survey among ${n} students asked how they usually travel to campus and where they live.`,
  },
  {
    units: 'festival-goers',
    who: 'who',
    rv: 'favourite stage',
    rows: ['Main stage', 'Techno tent', 'Indie stage'],
    cv: 'age group',
    cols: ['Under 25', '25 or older'],
    rp: (r) => `prefer the **${lc(r)}**`,
    cp: (c) => `are **${lc(c)}**`,
    intro: (n) => `At a music festival, ${n} visitors were asked for their favourite stage; their age group was recorded too.`,
  },
  {
    units: 'pets',
    who: 'that',
    rv: 'species',
    rows: ['Cats', 'Dogs', 'Rabbits'],
    cv: 'household',
    cols: ['Families', 'Singles', 'Couples'],
    rp: (r) => `were **${lc(r)}**`,
    cp: (c) => `were adopted by **${lc(c)}**`,
    intro: (n) => `An animal shelter recorded the species of each of the ${n} pets adopted last year and the type of household that adopted it.`,
  },
];

type CtKind = 'cond-col' | 'cond-row' | 'marginal' | 'joint';

const twoWayTable: Template = {
  id: 'data-displays.two-way-table',
  topic: TOPIC,
  title: 'Two-way table of counts: joint, marginal or conditional percentage (and the classic mix-ups)',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const c = rng.pick(TWO_WAY);
    const cnt = c.rows.map(() => c.cols.map(() => rng.int(6, 75)));
    const rowT = cnt.map((r) => sum(r));
    const colT = c.cols.map((_, j) => sum(cnt.map((r) => r[j])));
    const n = sum(rowT);
    const i = rng.int(0, c.rows.length - 1);
    const j = rng.int(0, c.cols.length - 1);
    const a = cnt[i][j];
    const R = c.rows[i];
    const C = c.cols[j];
    const rP = c.rp(R);
    const cP = c.cp(C);
    const the = (pred: string) => `the ${c.units} ${c.who} ${plain(pred)}`;
    const kind = rng.pick<CtKind>(['cond-col', 'cond-row', 'marginal', 'joint']);
    const P = (x: number, d: number) => (100 * x) / d;
    const pc = (x: number) => `${fixed(x, 1)}%`;
    const frac = (x: number, d: number) => `\\dfrac{${x}}{${d}}\\times 100\\%\\approx ${fixed(P(x, d), 1)}\\%`;
    let ask: string;
    let key: number;
    let how: string;
    let ds: Choice[];
    const ch = (v: number, why: string): Choice => ({ text: pc(v), value: v, why });
    if (kind === 'cond-col') {
      ask = `Among the ${c.units} ${c.who} ${cP}, what percentage ${rP}?`;
      key = P(a, colT[j]);
      how = `Condition on the column **${C}** (total ${colT[j]}) and take the cell ${R}/${C} (${a}): $$${frac(a, colT[j])}$$`;
      ds = [
        ch(P(a, n), `divides by the grand total ${n}: that is the joint percentage of all ${c.units} (${R} and ${C}).`),
        ch(P(a, rowT[i]), `divides by the row total ${rowT[i]} (${the(rP)}): the condition is the wrong way round.`),
        ch(P(rowT[i], n), `ignores the condition: that is the percentage of all ${c.units} ${c.who} ${plain(rP)}.`),
        ch(P(colT[j], n), `gives the percentage of all ${c.units} ${c.who} ${plain(cP)}: the size of the group itself.`),
        ch(P(a, colT[j] - a), `divides by the rest of the column (${colT[j] - a}) instead of the column total ${colT[j]}.`),
      ];
    } else if (kind === 'cond-row') {
      ask = `Among the ${c.units} ${c.who} ${rP}, what percentage ${cP}?`;
      key = P(a, rowT[i]);
      how = `Condition on the row **${R}** (total ${rowT[i]}) and take the cell ${R}/${C} (${a}): $$${frac(a, rowT[i])}$$`;
      ds = [
        ch(P(a, n), `divides by the grand total ${n}: that is the joint percentage of all ${c.units} (${R} and ${C}).`),
        ch(P(a, colT[j]), `divides by the column total ${colT[j]} (${the(cP)}): the condition is the wrong way round.`),
        ch(P(colT[j], n), `ignores the condition: that is the percentage of all ${c.units} ${c.who} ${plain(cP)}.`),
        ch(P(rowT[i], n), `gives the percentage of all ${c.units} ${c.who} ${plain(rP)}: the size of the group itself.`),
        ch(P(a, rowT[i] - a), `divides by the rest of the row (${rowT[i] - a}) instead of the row total ${rowT[i]}.`),
      ];
    } else if (kind === 'marginal') {
      ask = `What percentage of all ${n} ${c.units} ${rP}?`;
      key = P(rowT[i], n);
      how = `Add the row **${R}**: ${cnt[i].join(' + ')} = ${rowT[i]}. Divide by the grand total: $$${frac(rowT[i], n)}$$`;
      ds = [
        ch(P(a, colT[j]), `uses only the column ${C} (a conditional percentage).`),
        ch(P(a, n), `takes the single cell ${R}/${C} instead of the whole row.`),
        ch(P(rowT[i], n - rowT[i]), `divides by the other rows (${n - rowT[i]}) instead of the grand total.`),
        ...c.cols.map((_, jj) => ch(P(cnt[i][jj], colT[jj]), `uses only the column ${c.cols[jj]} (a conditional percentage).`)),
      ];
    } else {
      ask = `What percentage of all ${n} ${c.units} ${rP} and ${cP}?`;
      key = P(a, n);
      how = `"${R} and ${C}" is the single cell ${a}, out of all ${n}: $$${frac(a, n)}$$`;
      ds = [
        ch(P(a, colT[j]), `divides by the column total ${colT[j]} (a conditional percentage).`),
        ch(P(a, rowT[i]), `divides by the row total ${rowT[i]} (a conditional percentage).`),
        ch((100 * rowT[i] * colT[j]) / n ** 2, 'multiplies the two marginal percentages, which assumes the variables are independent.'),
        ch(P(rowT[i] + colT[j] - a, n), `adds the whole row and the whole column: that counts "${R} or ${C}" instead of "${R} and ${C}".`),
      ];
    }
    const table: TableData = { header: [`${cap(c.rv)} / ${c.cv}`, ...c.cols], rows: c.rows.map((r, ii) => [r, ...cnt[ii].map(String)]), caption: `Number of ${c.units}` };
    const totals = `Row totals: ${c.rows.map((r, ii) => `${r} ${rowT[ii]}`).join(', ')}. Column totals: ${c.cols.map((cc, jj) => `${cc} ${colT[jj]}`).join(', ')}. Grand total: ${n}.`;
    const stem = `${c.intro(n)} The counts are shown in the table.\n${ask}`;
    const explanation = `${totals}\n${how}`;
    if (type === 'numeric') {
      const f = numericField('x', undefined, key, 1);
      return { type, stem, instruction: INSTRUCTION.numeric(1), table, correctAnswer: f.answer, tolerance: f.tolerance, suffix: '%', explanation };
    }
    // a percentage above 100% gives itself away, so such "mistakes" are not offered
    const mcq = buildMcq(
      rng,
      { text: pc(key), value: key },
      ds.filter((d) => d.value! <= 100),
      {
        count: optionCount,
        order: 'ascending',
        fallback: (t) => {
          const ii = (i + 1 + t) % c.rows.length;
          const jj = (j + Math.floor(t / c.rows.length)) % c.cols.length;
          return ch(P(cnt[ii][jj], [colT[jj], rowT[ii], n][t % 3]), 'reads the wrong cell of the table.');
        },
      },
    );
    return { type, stem, table, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
  },
};

export const TEMPLATES: Template[] = [variableTypes, chooseDisplay, unitsVariables, twoWayTable];
