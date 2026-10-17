// Templates for the topic "Probability" (QM1 past exams: conditional probabilities and (in)dependence read from a
// contingency table, disjoint vs independent events, tree diagrams with the law of total probability and Bayes' rule,
// the complement rule for "at least one" with independent trials, and the general addition rule for overlapping
// events given in percentages). Every probability is computed in code from the generated counts or percentages; wrong
// options come from named student mistakes. See probability.test.ts for the independent checks.
import type { TableData } from '../../types';
import { INSTRUCTION, buildMcq, buildMulti, fixed, mistakesNote, num, numericField, type Choice } from '../build';
import type { Rng } from '../rng';
import type { GenType, Generated, Template } from '../types';

const TOPIC = 'Probability' as const;
const tx = (s: string) => `\\text{${s}}`;
const P = (a: string, b?: string) => `P(${tx(a)}${b ? ` \\mid ${tx(b)}` : ''})`;
const Pand = (a: string, b: string) => `P(${tx(a)}\\text{ and }${tx(b)})`;
const Por = (a: string, b: string) => `P(${tx(a)}\\text{ or }${tx(b)})`;
const reasonsNote = (rs: { id: string; correct: boolean; why: string }[]) =>
  '\n\n**Statement by statement**\n' + rs.map((r) => `- **${r.id}** ${r.correct ? '(true)' : '(false)'}: ${r.why}`).join('\n');

interface Wrong {
  value: number;
  why: string;
}

/** A probability as a single-choice question (options from modelled mistakes, ascending) or a numeric question. */
function probQuestion(o: { type: GenType; rng: Rng; optionCount: number; stem: string; table?: TableData; key: number; dp: number; wrong: Wrong[]; explanation: string }): Generated {
  const { type, stem, key, dp } = o;
  const table = o.table ? { table: o.table } : {};
  if (type === 'numeric') {
    const f = numericField('p', undefined, key, dp);
    return { type, stem, ...table, instruction: INSTRUCTION.numeric(dp), correctAnswer: f.answer, tolerance: f.tolerance, explanation: o.explanation };
  }
  const u = 10 ** -dp;
  const choice = (v: number, why?: string): Choice => ({ text: fixed(v, dp), value: v, ...(why ? { why } : {}) });
  const usable = o.wrong.filter((w) => Number.isFinite(w.value) && w.value >= 2 * u && w.value <= 1 - 2 * u && Math.abs(w.value - key) > 2.5 * u);
  const mcq = buildMcq(o.rng, choice(key), usable.map((w) => choice(w.value, w.why)), {
    count: o.optionCount,
    order: 'ascending',
    epsilon: 0.03,
    fallback: (i) => {
      const s = Math.min(0.9, 0.12 * (1 + (i >> 1)));
      return choice(i % 2 ? key * (1 - s) : key + (1 - key) * s, 'an arithmetic slip somewhere along the way.');
    },
  });
  return { type, stem, ...table, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: o.explanation + mistakesNote(mcq.distractors) };
}

// =====================================================================================================================
// Contingency tables (templates 1 and 2)
// =====================================================================================================================

export interface TwoWay {
  intro: (n: number) => string;
  unit: string;
  units: string;
  rowVar: string;
  rows: readonly string[];
  colVar: string;
  cols: readonly string[];
}

const TWO_WAY: readonly TwoWay[] = [
  {
    intro: (n) => `The organisers of a music festival asked ${n} visitors how they travelled to the festival site and which kind of ticket they had.`,
    unit: 'visitor', units: 'visitors', rowVar: 'Way of travelling', rows: ['train traveller', 'cyclist', 'car driver'], colVar: 'ticket type', cols: ['day ticket', 'weekend pass'],
  },
  {
    intro: (n) => `The university library logged ${n} bookings of study spaces, recording the faculty of the student and the kind of space that was booked.`,
    unit: 'booking', units: 'bookings', rowVar: 'Faculty', rows: ['SBE student', 'FASoS student', 'FHML student'], colVar: 'kind of space', cols: ['silent desk', 'group room'],
  },
  {
    intro: (n) => `A web shop for sports gear checked ${n} recent orders: the product category and whether the customer sent the order back.`,
    unit: 'order', units: 'orders', rowVar: 'Product category', rows: ['running shoes', 'sports clothing', 'accessories'], colVar: 'what happened to the order', cols: ['sent back', 'kept'],
  },
  {
    intro: (n) => `An animal shelter recorded for ${n} dogs their age group and whether they found a new home within one month.`,
    unit: 'dog', units: 'dogs', rowVar: 'Age group', rows: ['puppy', 'adult dog', 'senior dog'], colVar: 'adoption', cols: ['adopted within a month', 'still waiting after a month'],
  },
  {
    intro: (n) => `A board-game café noted for ${n} games played last month which kind of game it was and how many players took part.`,
    unit: 'game', units: 'games', rowVar: 'Kind of game', rows: ['strategy game', 'party game', 'cooperative game'], colVar: 'group size', cols: ['two players', 'three or more players'],
  },
  {
    intro: (n) => `An escape-room company kept track of ${n} teams: the size of the team and whether the team got out before the clock ran out.`,
    unit: 'team', units: 'teams', rowVar: 'Team size', rows: ['pair', 'small team', 'large team'], colVar: 'result', cols: ['escaped', 'did not escape'],
  },
  {
    intro: (n) => `A university cafeteria registered ${n} drink purchases by the kind of drink and the way of paying.`,
    unit: 'purchase', units: 'purchases', rowVar: 'Drink', rows: ['coffee', 'tea', 'smoothie'], colVar: 'payment method', cols: ['bank card', 'phone', 'cash'],
  },
  {
    intro: (n) => `A bike repair shop classified ${n} repair jobs by the type of repair and the type of customer.`,
    unit: 'repair job', units: 'repair jobs', rowVar: 'Type of repair', rows: ['flat tyre', 'brakes', 'gears'], colVar: 'customer', cols: ['student', 'non-student'],
  },
  {
    intro: (n) => `An employer surveyed ${n} employees about their way of working and the department they work in.`,
    unit: 'employee', units: 'employees', rowVar: 'Way of working', rows: ['fully remote', 'hybrid', 'fully on site'], colVar: 'department', cols: ['finance', 'marketing', 'logistics'],
  },
];

export interface Counts {
  sc: TwoWay;
  n: number[][];
  r: number[];
  c: number[];
  N: number;
}

function counts(sc: TwoWay, n: number[][]): Counts {
  const r = n.map((row) => row.reduce((a, b) => a + b, 0));
  const c = sc.cols.map((_, j) => n.reduce((a, row) => a + row[j], 0));
  return { sc, n, r, c, N: r.reduce((a, b) => a + b, 0) };
}

function twoWayTable(t: Counts, totals: boolean): TableData {
  const { sc } = t;
  const header = [sc.rowVar, ...sc.cols, ...(totals ? ['Total'] : [])];
  const rows = sc.rows.map((lab, i) => [lab, ...t.n[i].map(String), ...(totals ? [String(t.r[i])] : [])]);
  if (totals) rows.push(['Total', ...t.c.map(String), String(t.N)]);
  return { header, rows, caption: `Columns: ${sc.colVar}` };
}

/** "a + b + c = s" for a row or column of the table (used when the table has no totals). */
const sumText = (xs: number[]) => `${xs.join(' + ')} = ${xs.reduce((a, b) => a + b, 0)}`;
const rowSum = (t: Counts, i: number) => sumText(t.n[i]);
const colSum = (t: Counts, j: number) => sumText(t.n.map((row) => row[j]));

// ---------------------------------------------------------------------------------------------------------------------
// 1. Conditional, joint and "or" probabilities from a contingency table
// ---------------------------------------------------------------------------------------------------------------------

type TableKind = 'cond' | 'condRev' | 'joint' | 'or';

const tableProbability: Template = {
  id: 'probability.table-conditional',
  topic: TOPIC,
  title: 'Contingency table: conditional probability P(A | B), joint P(A and B) or P(A or B)',
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const sc = rng.pick(TWO_WAY);
    const t = counts(sc, sc.rows.map(() => sc.cols.map(() => rng.int(4, 75))));
    const totals = rng.chance(0.6);
    const table = twoWayTable(t, totals);
    const i = rng.int(0, sc.rows.length - 1);
    const j = rng.int(0, sc.cols.length - 1);
    const A = sc.rows[i];
    const B = sc.cols[j];
    const nAB = t.n[i][j];
    const rA = t.r[i];
    const cB = t.c[j];
    const N = t.N;
    const kind = rng.pick<TableKind>(['cond', 'cond', 'condRev', 'joint', 'or', 'or']);
    const rowTot = totals ? `the row total of '${A}' is ${rA}` : `the row '${A}' adds up to $${rowSum(t, i)}$`;
    const colTot = totals ? `the column total of '${B}' is ${cB}` : `the column '${B}' adds up to $${colSum(t, j)}$`;
    const grand = totals ? `There are ${N} ${sc.units} in total.` : `Adding all cells gives ${N} ${sc.units} in total.`;
    const intro = `${sc.intro(N)} The results are shown in the table below.\n\n`;
    let stem: string;
    let key: number;
    let explanation: string;
    let wrong: Wrong[];
    if (kind === 'cond' || kind === 'condRev') {
      const [T, G, gT, tT, gTot] = kind === 'cond' ? [A, B, cB, rA, colTot] : [B, A, rA, cB, rowTot];
      key = nAB / gT;
      stem =
        intro +
        rng.pick([
          `One ${sc.unit} is picked at random from the table. Given that the event '${G}' has occurred, what is the probability of the event '${T}'?`,
          `Consider one randomly selected ${sc.unit} from the table. What is the probability of '${T}', given '${G}'?`,
          `Among the ${sc.units} in the table in the category '${G}', what proportion is in the category '${T}'?`,
        ]);
      explanation =
        `Conditioning on '${G}' means we only look at the ${sc.units} that are '${G}': ${gTot}. ` +
        `Of these, ${nAB} are also '${T}'. So $$${P(T, G)}=\\frac{${Pand(T, G)}}{${P(G)}}=\\frac{${nAB}}{${gT}}\\approx ${fixed(key, 3)}$$`;
      wrong = [
        { value: nAB / tT, why: `divides by the total of '${T}' instead of '${G}': that is $${P(G, T)}$, the condition the wrong way round.` },
        { value: nAB / N, why: `divides by the grand total: that is the joint probability $${Pand(T, G)}$.` },
        { value: tT / N, why: `ignores the condition and gives $${P(T)}$.` },
        { value: nAB / (gT - nAB), why: `divides by the other '${G}' ${sc.units} instead of by all of them.` },
        { value: gT / N, why: `gives $${P(G)}$, the probability of the condition itself.` },
      ];
    } else if (kind === 'joint') {
      key = nAB / N;
      stem =
        intro +
        rng.pick([
          `What is the probability that a randomly picked ${sc.unit} belongs to both '${A}' and '${B}'?`,
          `One ${sc.unit} is selected at random from the table. What is the probability that both '${A}' and '${B}' apply to this ${sc.unit}?`,
        ]);
      explanation = `${grand} The cell where '${A}' and '${B}' meet contains ${nAB} ${sc.units}, so $$${Pand(A, B)}=\\frac{${nAB}}{${N}}\\approx ${fixed(key, 3)}$$`;
      wrong = [
        { value: (rA / N) * (cB / N), why: `multiplies $${P(A)}\\cdot ${P(B)}$, which is only allowed for independent events.` },
        { value: nAB / rA, why: `divides by the row total: that is $${P(B, A)}$.` },
        { value: nAB / cB, why: `divides by the column total: that is $${P(A, B)}$.` },
        { value: (rA + cB - nAB) / N, why: `computes $${Por(A, B)}$ instead of "and".` },
      ];
    } else {
      key = (rA + cB - nAB) / N;
      stem =
        intro +
        rng.pick([
          `What is the probability that a randomly picked ${sc.unit} belongs to '${A}' or '${B}' (or to both)?`,
          `One ${sc.unit} is selected at random from the table. What is the probability that '${A}' or '${B}' (or both) applies to this ${sc.unit}?`,
        ]);
      explanation =
        `Use the general addition rule: ${rowTot}, ${colTot}, and ${nAB} ${sc.units} are both, which would otherwise be counted twice. ${grand}\n` +
        `$$${Por(A, B)}=${P(A)}+${P(B)}-${Pand(A, B)}=\\frac{${rA}+${cB}-${nAB}}{${N}}=\\frac{${rA + cB - nAB}}{${N}}\\approx ${fixed(key, 3)}$$`;
      wrong = [
        { value: (rA + cB) / N, why: `adds $${P(A)}$ and $${P(B)}$ without subtracting the overlap, so the ${nAB} ${sc.units} in both are counted twice.` },
        { value: nAB / N, why: `computes $${Pand(A, B)}$ instead of "or".` },
        { value: (rA + cB - 2 * nAB) / N, why: `subtracts the overlap twice: that is the probability of exactly one of the two.` },
        { value: rA / N + cB / N - (rA / N) * (cB / N), why: `subtracts $${P(A)}\\cdot ${P(B)}$, as if the events were independent.` },
      ];
    }
    return probQuestion({ type, rng, optionCount, stem, table, key, dp: 3, wrong, explanation });
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// 2. Disjoint and/or independent? (statements about a contingency table)
// ---------------------------------------------------------------------------------------------------------------------

type Mode = 'independent' | 'disjoint' | 'dependent';

/** A table with a target cell (i, j) whose events are exactly independent, disjoint, or clearly dependent. */
function modeTable(rng: Rng, sc: TwoWay, mode: Mode, i: number, j: number, j2: number): Counts {
  for (;;) {
    let n: number[][];
    if (mode === 'independent') {
      const m = sc.rows.map(() => rng.int(2, 12));
      const w = sc.cols.map(() => rng.int(1, 8));
      const s = rng.int(1, 3);
      n = m.map((mi) => w.map((wj) => s * mi * wj));
    } else {
      n = sc.rows.map(() => sc.cols.map(() => rng.int(4, 70)));
      if (mode === 'disjoint') n[i][j] = 0;
    }
    const t = counts(sc, n);
    if (mode === 'independent') return t;
    // a clear difference between the proportions of A within B and within B2 (used in a statement)
    if (Math.abs(t.n[i][j] / t.c[j] - t.n[i][j2] / t.c[j2]) < 0.03) continue;
    if (mode === 'disjoint') return t;
    const pA = t.r[i] / t.N;
    const pAB = t.n[i][j] / t.c[j];
    if (Math.abs(pAB - pA) >= 0.04 && Math.abs(pAB / pA - 1) >= 0.1) return t;
  }
}

const COMBOS = [
  { text: 'Disjoint and independent', d: true, i: true },
  { text: 'Disjoint but not independent', d: true, i: false },
  { text: 'Not disjoint but independent', d: false, i: true },
  { text: 'Not disjoint and not independent', d: false, i: false },
] as const;
const COMPLEMENTARY = 'Complementary: exactly one of the two events occurs for every unit';

const tableIndependence: Template = {
  id: 'probability.disjoint-independent',
  topic: TOPIC,
  title: 'Contingency table: are two events disjoint and/or independent? (compare P(A | B) with P(A))',
  types: ['single-choice', 'multi-select'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const sc = rng.pick(TWO_WAY);
    const i = rng.int(0, sc.rows.length - 1);
    const j = rng.int(0, sc.cols.length - 1);
    const j2 = (j + 1 + rng.int(0, sc.cols.length - 2)) % sc.cols.length;
    const mode = rng.pick<Mode>(['independent', 'independent', 'disjoint', 'dependent', 'dependent', 'dependent']);
    const t = modeTable(rng, sc, mode, i, j, j2);
    const totals = rng.chance(0.6);
    const table = twoWayTable(t, totals);
    const A = sc.rows[i];
    const B = sc.cols[j];
    const nAB = t.n[i][j];
    const rA = t.r[i];
    const cB = t.c[j];
    const N = t.N;
    const disjoint = nAB === 0;
    const independent = nAB * N === rA * cB;
    const pA = rA / N;
    const pAgB = nAB / cB;
    const intro = `${sc.intro(N)} The results are in the table below.\n\n`;
    const base =
      `Write $A$ = '${A}' and $B$ = '${B}' for one ${sc.unit} picked at random (${N} ${sc.units} in total).\n` +
      `- **Disjoint?** The cell '${A}' and '${B}' contains ${nAB} ${sc.units}, so $P(A\\text{ and }B)=\\frac{${nAB}}{${N}}${disjoint ? '=0' : '\\neq 0'}$: the events are ${disjoint ? '' : '**not** '}disjoint${disjoint ? '' : ' (they can happen together)'}.\n` +
      `- **Independent?** Compare $P(A)=\\frac{${rA}}{${N}}\\approx ${fixed(pA, 3)}$ with $P(A\\mid B)=\\frac{${nAB}}{${cB}}\\approx ${fixed(pAgB, 3)}$. ` +
      (independent
        ? `They are equal (exactly: $${nAB}\\cdot ${N}=${rA}\\cdot ${cB}=${rA * cB}$), so knowing $B$ does not change the probability of $A$: the events are **independent**.`
        : `They differ, so knowing $B$ changes the probability of $A$: the events are **not independent**.`) +
      (disjoint ? ` (Disjoint events with positive probabilities are always dependent: if one happens, the other cannot.)` : '');

    if (type === 'single-choice') {
      const correct = COMBOS.find((c) => c.d === disjoint && c.i === independent)!;
      const why = (c: (typeof COMBOS)[number]) =>
        c.d !== disjoint
          ? `the events are ${disjoint ? '' : 'not '}disjoint: the cell count is ${nAB}.`
          : `the events are ${independent ? '' : 'not '}independent: $P(A\\mid B)${independent ? '=' : '\\neq '}P(A)$.`;
      const wrong: Choice[] = COMBOS.filter((c) => c !== correct).map((c) => ({ text: c.text, why: why(c) }));
      if (optionCount > 4) wrong.push({ text: COMPLEMENTARY, why: `complementary events are disjoint and together cover everything; here ${disjoint ? `${N - rA - cB} ${sc.units} are neither` : `${nAB} ${sc.units} are both`}.` });
      const stem =
        intro +
        rng.pick([
          `One ${sc.unit} is picked at random from the table. Consider the events '${A}' and '${B}'. These two events are...`,
          `Pick one ${sc.unit} at random and consider the events '${A}' and '${B}'. Which description of these two events is correct?`,
        ]);
      const mcq = buildMcq(rng, { text: correct.text }, wrong, { count: optionCount });
      return { type, stem, table, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: base + mistakesNote(mcq.distractors) };
    }

    // multi-select: one statement per slot, each made true or false on purpose (truth computed from the counts)
    const B2 = sc.cols[j2];
    const pAgB2 = t.n[i][j2] / t.c[j2];
    const pBgA = nAB / rA;
    const pAnd = nAB / N;
    const pOr = (rA + cB - nAB) / N;
    type Slot = (want: boolean) => { text: string; correct: boolean; why: string } | null;
    const numSlot = (lhs: string, value: number, wrongValue: number, wrongWhy: string): Slot => (want) => {
      if (want) return { text: `$${lhs}=${fixed(value, 2)}$`, correct: true, why: `$${lhs}\\approx ${fixed(value, 4)}$.` };
      if (Math.abs(wrongValue - value) < 0.015) return null;
      return { text: `$${lhs}=${fixed(wrongValue, 2)}$`, correct: false, why: `${wrongWhy} The correct value is $${fixed(value, 4)}$.` };
    };
    const slots: Slot[] = [
      (want) => {
        const says = want === disjoint;
        return { text: `'${A}' and '${B}' are ${says ? '' : 'not '}disjoint.`, correct: want, why: `${nAB} ${sc.units} are both '${A}' and '${B}', so the events are ${disjoint ? '' : 'not '}disjoint.` };
      },
      (want) => {
        const says = want === independent;
        return {
          text: `'${A}' and '${B}' are ${says ? '' : 'not '}independent.`,
          correct: want,
          why: `$P(A\\mid B)\\approx ${fixed(pAgB, 3)}$ ${independent ? 'equals' : 'differs from'} $P(A)\\approx ${fixed(pA, 3)}$.`,
        };
      },
      numSlot(P(A, B), pAgB, pBgA, `this is $${P(B, A)}=\\frac{${nAB}}{${rA}}$, the condition the wrong way round.`),
      numSlot(Pand(A, B), pAnd, pA * (cB / N), `this is $P(A)\\cdot P(B)$, which equals $P(A\\text{ and }B)$ only for independent events.`),
      numSlot(Por(A, B), pOr, (rA + cB) / N, `this is $P(A)+P(B)$ without subtracting $P(A\\text{ and }B)$.`),
      numSlot(P(A), pA, pAgB, `this is $${P(A, B)}$, not the overall proportion.`),
      numSlot(P(B), cB / N, pBgA, `this is $${P(B, A)}$, not the overall proportion.`),
      (want) => {
        const d2 = t.n[i][j2] === 0;
        const says = want === d2;
        return { text: `'${A}' and '${B2}' are ${says ? '' : 'not '}disjoint.`, correct: want, why: `${t.n[i][j2]} ${sc.units} are both '${A}' and '${B2}'.` };
      },
      (want) => {
        const d = pAgB - pAgB2;
        if (d !== 0 && Math.abs(d) < 0.02) return null;
        const truth = d > 0 ? 'higher' : d < 0 ? 'lower' : 'the same';
        const options = ['higher', 'lower', 'the same'];
        const word = want ? truth : rng.pick(options.filter((o) => o !== truth));
        const fmt = (w: string) => (w === 'the same' ? `is the same among '${B}' ${sc.units} as among '${B2}' ${sc.units}` : `is ${w} among '${B}' ${sc.units} than among '${B2}' ${sc.units}`);
        return {
          text: `The proportion of '${A}' ${fmt(word)}.`,
          correct: want,
          why: `Among '${B}' it is $\\frac{${nAB}}{${cB}}\\approx ${fixed(pAgB, 3)}$, among '${B2}' it is $\\frac{${t.n[i][j2]}}{${t.c[j2]}}\\approx ${fixed(pAgB2, 3)}$.`,
        };
      },
    ];
    const order = rng.shuffle(slots);
    const pool: { text: string; correct: boolean; why: string }[] = [];
    let falses = 0;
    for (const s of order) {
      const wantFalse = falses < optionCount - 1;
      const st = s(!wantFalse) ?? s(wantFalse);
      if (!st) continue;
      if (!st.correct) falses++;
      pool.push(st);
    }
    if (!pool.some((s) => s.correct)) pool.push(slots[0](true)!);
    const m = buildMulti(rng, pool, optionCount, 1);
    const stem =
      intro +
      `One ${sc.unit} is picked at random from the table. Consider the events '${A}' and '${B}'. Which of the following statements are true?`;
    return { type, stem, table, instruction: INSTRUCTION.multi, options: m.options, correctAnswer: m.correctAnswer, explanation: base + reasonsNote(m.reasons) };
  },
};

// =====================================================================================================================
// 3. Tree diagrams: law of total probability and Bayes' rule
// =====================================================================================================================

export interface TreeScenario {
  unit: string;
  /** Must mention the three percentages in this order: P(A), P(B | A), P(B | not A). */
  intro: (p: string, h: string, f: string) => string;
  A: string;
  B: string;
  notB: string;
  /** Ranges in percent: [min, max, step]. */
  p: [number, number, number];
  h: [number, number, number];
  f: [number, number, number];
}

export const TREE_SCENARIOS: readonly TreeScenario[] = [
  {
    unit: 'e-mail',
    intro: (p, h, f) => `About ${p} of the e-mails arriving in the inbox of a student association are spam. The spam filter moves ${h} of the spam e-mails to the junk folder, but it also moves ${f} of the genuine e-mails there by mistake.`,
    A: 'is spam', B: 'ends up in the junk folder', notB: 'stays in the normal inbox',
    p: [10, 40, 5], h: [85, 98, 1], f: [1, 8, 1],
  },
  {
    unit: 'checked bag',
    intro: (p, h, f) => `At a regional airport, ${p} of the checked bags contain an item that is not allowed in the hold. The scanner raises an alarm for ${h} of the bags with such an item and for ${f} of the bags without one.`,
    A: 'contains a forbidden item', B: 'sets off the scanner alarm', notB: 'does not set off the scanner alarm',
    p: [2, 10, 1], h: [80, 95, 1], f: [3, 12, 1],
  },
  {
    unit: 'croissant',
    intro: (p, h, f) => `A bakery chain buys its croissants from two suppliers. Supplier North delivers ${p} of all croissants and supplier South delivers the rest. Of the croissants from North ${h} arrive damaged, against ${f} of those from South.`,
    A: 'comes from supplier North', B: 'arrives damaged', notB: 'arrives undamaged',
    p: [30, 75, 5], h: [2, 9, 0.5], f: [1, 8, 0.5],
  },
  {
    unit: 'winter morning',
    intro: (p, h, f) => `On ${p} of the winter mornings in a Dutch city it snows. On a snowy morning the first train to the university is late with probability ${h}; on the other winter mornings this probability is ${f}.`,
    A: 'is a snowy one', B: 'has a late first train', notB: 'has a first train that runs on time',
    p: [10, 35, 5], h: [40, 80, 5], f: [5, 20, 1],
  },
  {
    unit: 'tested customer',
    intro: (p, h, f) => `A pharmacy offers a quick finger-prick test for iron deficiency. About ${p} of the customers who take the test are iron deficient. The test is positive for ${h} of the iron-deficient customers and for ${f} of the other customers.`,
    A: 'is iron deficient', B: 'tests positive', notB: 'tests negative',
    p: [5, 25, 1], h: [80, 96, 1], f: [4, 15, 1],
  },
  {
    unit: 'student',
    intro: (p, h, f) => `In a statistics course, ${p} of the students attended at least half of the voluntary tutorials. Of these students ${h} passed the exam; of the other students ${f} passed.`,
    A: 'attended at least half of the tutorials', B: 'passed the exam', notB: 'failed the exam',
    p: [30, 70, 5], h: [65, 90, 1], f: [30, 60, 1],
  },
  {
    unit: 'card payment',
    intro: (p, h, f) => `A bank estimates that ${p} of the online card payments it handles are fraudulent. Its fraud check blocks ${h} of the fraudulent payments and ${f} of the legitimate ones.`,
    A: 'is fraudulent', B: 'is blocked', notB: 'goes through',
    p: [1, 5, 0.5], h: [85, 97, 1], f: [1, 4, 0.5],
  },
];

type TreeKind = 'total' | 'bayes' | 'bayesNot';

const treeBayes: Template = {
  id: 'probability.tree-bayes',
  topic: TOPIC,
  title: 'Tree diagram: total probability P(B) = P(A)P(B|A) + P(Aᶜ)P(B|Aᶜ), or Bayes P(A | B) / P(A | not B)',
  types: ['single-choice', 'numeric'],
  difficulty: 3,
  generate({ rng, type, optionCount }) {
    const sc = rng.pick(TREE_SCENARIOS);
    let pp: number, hp: number, fp: number;
    do {
      pp = rng.step(...sc.p);
      hp = rng.step(...sc.h);
      fp = rng.step(...sc.f);
    } while (hp === fp);
    const [p, h, f] = [pp / 100, hp / 100, fp / 100];
    const kind = rng.pick<TreeKind>(['total', 'bayes', 'bayes', 'bayesNot']);
    const pB = p * h + (1 - p) * f;
    const AB = p * h;
    const AnB = p * (1 - h);
    const tip = rng.chance(0.5) ? ' (Tip: draw a tree diagram.)' : '';
    const intro = sc.intro(`${num(pp, 1)}%`, `${num(hp, 1)}%`, `${num(fp, 1)}%`);
    const tree =
      `Let $A$ = "${sc.A}" and $B$ = "${sc.B}" for a randomly selected ${sc.unit}. The tree has first branches $P(A)=${num(p, 4)}$ and $P(A^c)=${num(1 - p, 4)}$, ` +
      `then the conditional probabilities $P(B\\mid A)=${num(h, 4)}$ and $P(B\\mid A^c)=${num(f, 4)}$.\n` +
      `$$P(A\\text{ and }B)=${num(p, 4)}\\cdot ${num(h, 4)}=${num(AB, 6)},\\qquad P(A^c\\text{ and }B)=${num(1 - p, 4)}\\cdot ${num(f, 4)}=${num((1 - p) * f, 6)}$$` +
      `By the law of total probability $$P(B)=${num(AB, 6)}+${num((1 - p) * f, 6)}=${num(pB, 6)}$$`;
    let stem: string;
    let key: number;
    let explanation: string;
    let wrong: Wrong[];
    if (kind === 'total') {
      key = pB;
      stem = `${intro}\n\nWhat is the probability that a randomly selected ${sc.unit} ${sc.B}?${tip}`;
      explanation = `${tree}\nSo the probability is $${fixed(key, 4)}$.`;
      wrong = [
        { value: AB, why: 'only follows the branch through $A$ and forgets the branch through $A^c$.' },
        { value: (h + f) / 2, why: 'averages the two conditional probabilities without weighting them by $P(A)$ and $P(A^c)$.' },
        { value: AB + f, why: 'forgets to multiply the second branch by $P(A^c)$.' },
        { value: AB + (1 - p) * (1 - f), why: 'uses $P(B^c\\mid A^c)$ on the second branch.' },
        { value: h, why: 'takes $P(B\\mid A)$ as if it were $P(B)$.' },
        { value: 1 - pB, why: 'computes $P(B^c)$, the complement.' },
      ];
    } else if (kind === 'bayes') {
      key = AB / pB;
      stem = `${intro}\n\nSuppose a randomly selected ${sc.unit} ${sc.B}. What is the probability that this ${sc.unit} ${sc.A}?${tip}`;
      explanation = `${tree}\nBayes' rule: $$P(A\\mid B)=\\frac{P(A\\text{ and }B)}{P(B)}=\\frac{${num(AB, 6)}}{${num(pB, 6)}}\\approx ${fixed(key, 4)}$$`;
      wrong = [
        { value: h, why: 'confuses $P(A\\mid B)$ with $P(B\\mid A)$.' },
        { value: AB, why: 'stops at the joint probability $P(A\\text{ and }B)$ and does not divide by $P(B)$.' },
        { value: AB / (h + f), why: 'divides by $P(B\\mid A)+P(B\\mid A^c)$ instead of by $P(B)$.' },
        { value: ((1 - p) * f) / pB, why: 'computes $P(A^c\\mid B)$, the other branch.' },
        { value: p, why: 'gives the prior $P(A)$ and ignores the information about $B$.' },
        { value: AB / (1 - pB), why: 'divides by $P(B^c)$ instead of $P(B)$.' },
      ];
    } else {
      key = AnB / (1 - pB);
      stem = `${intro}\n\nSuppose a randomly selected ${sc.unit} ${sc.notB}. What is the probability that this ${sc.unit} ${sc.A}?${tip}`;
      explanation =
        `${tree}\nThe ${sc.unit} ${sc.notB}, so we condition on $B^c$: $P(B^c)=1-${num(pB, 6)}=${num(1 - pB, 6)}$ and $P(A\\text{ and }B^c)=${num(p, 4)}\\cdot ${num(1 - h, 4)}=${num(AnB, 6)}$.\n` +
        `$$P(A\\mid B^c)=\\frac{P(A\\text{ and }B^c)}{P(B^c)}=\\frac{${num(AnB, 6)}}{${num(1 - pB, 6)}}\\approx ${fixed(key, 4)}$$`;
      wrong = [
        { value: 1 - h, why: 'confuses $P(A\\mid B^c)$ with $P(B^c\\mid A)$.' },
        { value: AnB, why: 'stops at the joint probability $P(A\\text{ and }B^c)$.' },
        { value: AnB / pB, why: 'divides by $P(B)$ instead of $P(B^c)$.' },
        { value: 1 - AB / pB, why: 'takes $1-P(A\\mid B)$, which is $P(A^c\\mid B)$.' },
        { value: p, why: 'gives the prior $P(A)$ and ignores the information about $B$.' },
        { value: AB / pB, why: 'computes $P(A\\mid B)$ instead of $P(A\\mid B^c)$.' },
      ];
    }
    return probQuestion({ type, rng, optionCount, stem, key, dp: 4, wrong, explanation });
  },
};

// =====================================================================================================================
// 4. Probability rules: complement for "at least one" (independent trials) and the addition rule (overlapping events)
// =====================================================================================================================

type Quant = 'atLeastOne' | 'none' | 'all';
const QUANT: Record<Quant, string> = { atLeastOne: '**at least one**', none: '**none**', all: '**all**' };

export interface RepeatScenario {
  /** Mentions n (as digits) and the single percentage p. */
  intro: (n: number, p: string) => string;
  item: string;
  items: string;
  sing: string;
  pl: string;
  /** The opposite of `sing` ("is not contaminated"). */
  notSing: string;
  p: [number, number, number];
  n: [number, number];
  asks: readonly Quant[];
}

const REPEAT: readonly RepeatScenario[] = [
  {
    intro: (n, p) => `To save time, a water lab mixes the samples of ${n} wells into one pooled sample, which tests positive as soon as one of the wells is contaminated. Each well is contaminated with probability ${p}, independently of the other wells.`,
    item: 'well', items: 'wells', sing: 'is contaminated', pl: 'are contaminated', notSing: 'is not contaminated', p: [2, 15, 1], n: [4, 10], asks: ['atLeastOne', 'none'],
  },
  {
    intro: (n, p) => `A floor of an office building has ${n} smoke detectors. In a fire, each detector fails to go off with probability ${p}, independently of the others.`,
    item: 'detector', items: 'detectors', sing: 'fails to go off', pl: 'fail to go off', notSing: 'goes off', p: [5, 30, 5], n: [2, 5], asks: ['atLeastOne', 'none', 'all'],
  },
  {
    intro: (n, p) => `During a training session a football player takes ${n} penalty kicks. She scores each kick with probability ${p}, independently of the other kicks.`,
    item: 'kick', items: 'kicks', sing: 'is scored', pl: 'are scored', notSing: 'is missed', p: [70, 90, 5], n: [3, 8], asks: ['all', 'none', 'atLeastOne'],
  },
  {
    intro: (n, p) => `A travel blogger books ${n} flights this year. Each flight is delayed by more than an hour with probability ${p}, independently of the other flights.`,
    item: 'flight', items: 'flights', sing: 'is delayed by more than an hour', pl: 'are delayed by more than an hour', notSing: 'is not delayed by more than an hour', p: [4, 20, 1], n: [4, 12], asks: ['atLeastOne', 'none'],
  },
  {
    intro: (n, p) => `A shop sells packs of ${n} LED bulbs. Each bulb is defective with probability ${p}, independently of the other bulbs in the pack.`,
    item: 'bulb', items: 'bulbs', sing: 'is defective', pl: 'are defective', notSing: 'is not defective', p: [1, 8, 1], n: [4, 12], asks: ['atLeastOne', 'none'],
  },
  {
    intro: (n, p) => `A student sets ${n} alarm clocks on the morning of an exam, all working independently. Each one rings with probability ${p}.`,
    item: 'alarm clock', items: 'alarm clocks', sing: 'rings', pl: 'ring', notSing: 'does not ring', p: [80, 95, 5], n: [2, 4], asks: ['atLeastOne', 'all', 'none'],
  },
];

export interface VennScenario {
  /** Mentions P(A), P(B) and P(A and B) in this order. */
  intro: (a: string, b: string, ab: string) => string;
  unit: string;
  A: string;
  baseA: string;
  B: string;
  baseB: string;
}

export const VENN_SCENARIOS: readonly VennScenario[] = [
  {
    intro: (a, b, ab) => `Of the members of a sports centre, ${a} use the sauna, ${b} use the swimming pool, and ${ab} use both.`,
    unit: 'member', A: 'uses the sauna', baseA: 'use the sauna', B: 'uses the swimming pool', baseB: 'use the swimming pool',
  },
  {
    intro: (a, b, ab) => `At a supermarket, ${a} of the customers buy fresh bread, ${b} buy cheese, and ${ab} buy both.`,
    unit: 'customer', A: 'buys fresh bread', baseA: 'buy fresh bread', B: 'buys cheese', baseB: 'buy cheese',
  },
  {
    intro: (a, b, ab) => `Among the students in a large lecture hall, ${a} have a music streaming subscription, ${b} have a video streaming subscription, and ${ab} have both.`,
    unit: 'student', A: 'has a music streaming subscription', baseA: 'have a music streaming subscription', B: 'has a video streaming subscription', baseB: 'have a video streaming subscription',
  },
  {
    intro: (a, b, ab) => `In a survey of the employees of a Maastricht company, ${a} own a bike, ${b} own a car, and ${ab} own both.`,
    unit: 'employee', A: 'owns a bike', baseA: 'own a bike', B: 'owns a car', baseB: 'own a car',
  },
  {
    intro: (a, b, ab) => `Of the guests of a city hotel, ${a} book breakfast, ${b} book a late check-out, and ${ab} book both.`,
    unit: 'guest', A: 'books breakfast', baseA: 'book breakfast', B: 'books a late check-out', baseB: 'book a late check-out',
  },
];

type VennKind = 'or' | 'neither' | 'onlyA' | 'condNotB' | 'condB';

function repeatQuestion(rng: Rng, type: GenType, optionCount: number): Generated {
  const sc = rng.pick(REPEAT);
  let n: number, pp: number, q: Quant, key: number;
  do {
    n = rng.int(...sc.n);
    pp = rng.step(...sc.p);
    q = rng.pick(sc.asks);
    const p = pp / 100;
    key = q === 'atLeastOne' ? 1 - (1 - p) ** n : q === 'none' ? (1 - p) ** n : p ** n;
  } while (key < 0.01 || key > 0.99);
  const p = pp / 100;
  const dp = key < 0.1 ? 4 : 3;
  const verb = q === 'all' ? sc.pl : sc.sing;
  const subject =
    n === 2 && q === 'all' ? `**both** ${sc.items}` : n === 2 && q === 'none' ? `**neither** of the 2 ${sc.items}` : q === 'all' ? `${QUANT.all} ${n} ${sc.items}` : `${QUANT[q]} of the ${n} ${sc.items}`;
  const stem = `${sc.intro(n, `${num(pp, 1)}%`)}\n\nWhat is the probability that ${subject} ${verb}?`;
  const none = (1 - p) ** n;
  const all = p ** n;
  const one = n * p * (1 - p) ** (n - 1);
  const pT = num(p, 4);
  const qT = num(1 - p, 4);
  let explanation: string;
  let wrong: Wrong[];
  if (q === 'atLeastOne') {
    explanation =
      `"At least one" is the complement of "none". Because the ${sc.items} are independent, the probability that none of them ${sc.sing} is $(1-${pT})^{${n}}=${qT}^{${n}}\\approx ${num(none, 5)}$ (multiplication rule). ` +
      `So $$P(\\text{at least one})=1-P(\\text{none})=1-${qT}^{${n}}\\approx ${fixed(key, dp)}$$`;
    wrong = [
      { value: none, why: 'computes the probability of none and forgets to take the complement.' },
      { value: n * p, why: `adds the probability ${n} times; this ignores the overlap (it could even exceed 1).` },
      { value: one, why: 'computes the probability of exactly one.' },
      { value: all, why: `computes the probability that all ${n} happen.` },
      { value: 1 - all, why: 'takes the complement of "all" instead of the complement of "none".' },
      { value: p, why: `gives the probability for a single one of the ${sc.items}.` },
    ];
  } else if (q === 'none') {
    explanation = `The probability that one ${sc.item} ${sc.notSing} is $1-${pT}=${qT}$. The ${sc.items} are independent, so multiply: $$P(\\text{none})=${qT}^{${n}}\\approx ${fixed(key, dp)}$$`;
    wrong = [
      { value: 1 - none, why: 'computes "at least one" instead of "none".' },
      { value: 1 - n * p, why: `subtracts $${n}\\cdot ${pT}$ from 1, which ignores the overlap between the events.` },
      { value: all, why: `uses $${pT}^{${n}}$: the probability that all of them ${sc.pl}.` },
      { value: 1 - all, why: 'computes the complement of "all".' },
      { value: (1 - p) ** (n - 1), why: `uses the exponent ${n - 1} instead of ${n}.` },
      { value: 1 - p, why: `gives the probability for a single one of the ${sc.items}.` },
    ];
  } else {
    explanation = `The ${sc.items} are independent, so the multiplication rule gives $$P(\\text{${n === 2 ? 'both' : `all ${n}`}})=${pT}^{${n}}\\approx ${fixed(key, dp)}$$`;
    wrong = [
      { value: 1 - (1 - p) ** n, why: 'computes "at least one" instead of "all".' },
      { value: none, why: `uses $(1-${pT})^{${n}}$: the probability that none of them ${sc.sing}.` },
      { value: 1 - all, why: 'computes the complement: "not all".' },
      { value: p, why: `gives the probability for a single one of the ${sc.items}.` },
      { value: p ** (n - 1), why: `uses the exponent ${n - 1} instead of ${n}.` },
    ];
  }
  return probQuestion({ type, rng, optionCount, stem, key, dp, wrong, explanation });
}

function vennQuestion(rng: Rng, type: GenType, optionCount: number): Generated {
  const sc = rng.pick(VENN_SCENARIOS);
  let a: number, b: number, ab: number;
  do {
    a = rng.int(20, 70);
    b = rng.int(15, 60);
    ab = rng.int(4, Math.min(a, b) - 4);
  } while (a + b - ab > 94 || a === b || ab * 100 === a * b);
  const [pa, pb, pab] = [a / 100, b / 100, ab / 100];
  const kind = rng.pick<VennKind>(['or', 'neither', 'onlyA', 'condNotB', 'condNotB', 'condB']);
  const u = sc.unit;
  const intro = sc.intro(`${a}%`, `${b}%`, `${ab}%`);
  const setup = `Let $A$ = "${sc.A}" and $B$ = "${sc.B}": $P(A)=${num(pa)}$, $P(B)=${num(pb)}$ and $P(A\\text{ and }B)=${num(pab)}$. (A Venn diagram or a two-way table of percentages helps.)\n`;
  const pOr = pa + pb - pab;
  let q: string;
  let key: number;
  let how: string;
  let wrong: Wrong[];
  if (kind === 'or') {
    q = `What is the probability that a randomly chosen ${u} ${sc.A} **or** ${sc.B} (or both)?`;
    key = pOr;
    how = `General addition rule: $$P(A\\text{ or }B)=P(A)+P(B)-P(A\\text{ and }B)=${num(pa)}+${num(pb)}-${num(pab)}=${fixed(key, 2)}$$`;
    wrong = [
      { value: pa + pb, why: 'adds $P(A)$ and $P(B)$ without subtracting the overlap.' },
      { value: pa + pb - 2 * pab, why: 'subtracts the overlap twice: that is "exactly one of the two".' },
      { value: pa + pb - pa * pb, why: 'subtracts $P(A)\\cdot P(B)$, which assumes independence.' },
      { value: 1 - pab, why: 'takes the complement of "both".' },
      { value: pab, why: 'computes "both" instead of "or".' },
    ];
  } else if (kind === 'neither') {
    q = `What is the probability that a randomly chosen ${u} does **neither**, that is, does not ${sc.baseA} and does not ${sc.baseB}?`;
    key = 1 - pOr;
    how = `"Neither" is the complement of "$A$ or $B$": $$P(\\text{neither})=1-\\big(P(A)+P(B)-P(A\\text{ and }B)\\big)=1-(${num(pa)}+${num(pb)}-${num(pab)})=${fixed(key, 2)}$$`;
    wrong = [
      { value: 1 - pa - pb, why: 'forgets to add back the overlap, so the members of both groups are removed twice.' },
      { value: (1 - pa) * (1 - pb), why: 'multiplies $P(A^c)\\cdot P(B^c)$, which assumes independence.' },
      { value: 1 - pab, why: 'takes the complement of "both" instead of the complement of "or".' },
      { value: pOr, why: 'computes "$A$ or $B$" and forgets the complement.' },
      { value: 1 - pa, why: `gives $P(A^c)$: it only excludes those who ${sc.baseA}.` },
      { value: 1 - pb, why: `gives $P(B^c)$: it only excludes those who ${sc.baseB}.` },
    ];
  } else if (kind === 'onlyA') {
    q = `What is the probability that a randomly chosen ${u} ${sc.A} but does **not** ${sc.baseB}?`;
    key = pa - pab;
    how = `The group $A$ consists of those who also ${sc.baseB} and those who do not: $$P(A\\text{ and }B^c)=P(A)-P(A\\text{ and }B)=${num(pa)}-${num(pab)}=${fixed(key, 2)}$$`;
    wrong = [
      { value: pa, why: `gives $P(A)$ and forgets to remove those who also ${sc.baseB}.` },
      { value: pa * (1 - pb), why: 'multiplies $P(A)\\cdot P(B^c)$, which assumes independence.' },
      { value: pa + pb - 2 * pab, why: 'computes "exactly one of the two".' },
      { value: 1 - pb, why: `gives $P(B^c)$: everyone who does not ${sc.baseB}.` },
      { value: (pa - pab) / pa, why: 'divides by $P(A)$: that is the conditional probability $P(B^c\\mid A)$.' },
    ];
  } else if (kind === 'condNotB') {
    q = `A randomly chosen ${u} ${sc.A}. What is the probability that this ${u} does **not** ${sc.baseB}?`;
    key = (pa - pab) / pa;
    how = `We condition on $A$: $$P(B^c\\mid A)=\\frac{P(A\\text{ and }B^c)}{P(A)}=\\frac{P(A)-P(A\\text{ and }B)}{P(A)}=\\frac{${num(pa)}-${num(pab)}}{${num(pa)}}=\\frac{${num(pa - pab)}}{${num(pa)}}\\approx ${fixed(key, 3)}$$`;
    wrong = [
      { value: pa - pab, why: 'stops at $P(A\\text{ and }B^c)$ and forgets to divide by $P(A)$.' },
      { value: 1 - pb, why: 'ignores the condition and gives $P(B^c)$.' },
      { value: (pa - pab) / (1 - pb), why: 'divides by $P(B^c)$: that is $P(A\\mid B^c)$.' },
      { value: pab / pa, why: `computes $P(B\\mid A)$ and forgets the "not".` },
      { value: 1 - pab, why: 'takes the complement of "both".' },
    ];
  } else {
    q = `A randomly chosen ${u} ${sc.B}. What is the probability that this ${u} also ${sc.A}?`;
    key = pab / pb;
    how = `We condition on $B$: $$P(A\\mid B)=\\frac{P(A\\text{ and }B)}{P(B)}=\\frac{${num(pab)}}{${num(pb)}}\\approx ${fixed(key, 3)}$$`;
    wrong = [
      { value: pab / pa, why: 'divides by $P(A)$: that is $P(B\\mid A)$, the condition the wrong way round.' },
      { value: pab, why: 'gives the joint probability $P(A\\text{ and }B)$ without dividing by $P(B)$.' },
      { value: pa, why: 'ignores the condition and gives $P(A)$.' },
      { value: pab / pOr, why: 'divides by $P(A\\text{ or }B)$ instead of $P(B)$.' },
      { value: pa * pb, why: 'multiplies $P(A)\\cdot P(B)$, as if the events were independent.' },
    ];
  }
  const dp = kind === 'condNotB' || kind === 'condB' ? 3 : 2;
  return probQuestion({ type, rng, optionCount, stem: `${intro}\n\n${q}`, key, dp, wrong, explanation: setup + how });
}

const rules: Template = {
  id: 'probability.rules',
  topic: TOPIC,
  title: 'Complement rule for "at least one" with independent trials; addition rule and P(not B | A) from percentages',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    return rng.chance(0.5) ? repeatQuestion(rng, type, optionCount) : vennQuestion(rng, type, optionCount);
  },
};

export const TEMPLATES: Template[] = [tableProbability, tableIndependence, treeBayes, rules];
