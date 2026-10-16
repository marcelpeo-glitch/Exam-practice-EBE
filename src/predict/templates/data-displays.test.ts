// Independent checks for the "Data & displays" templates.
// - Variable types: every variable in the bank is labelled a second time here (LABEL); the key is recomputed from the
//   printed stem (I/II/III lines, the bold variable) with these labels, and every option is decoded and judged.
// - Displays: the structure of the data (one categorical variable as parts of a whole or not, two categorical
//   variables, one quantitative variable, a quantitative variable by group, a time series, two quantitative
//   variables) is recognised from the printed table only, and a display list of our own says what fits.
// - Unit / variable / type: our own answer per scenario (recognised by a keyword in the story); questionnaire answer
//   types from the printed answer options (ordered answer scales listed here, blanks = quantitative).
// - Two-way tables: the table is expanded into individual records and the asked percentage is counted directly.
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { TEMPLATES, VARIABLES } from './data-displays';

const SEEDS = 250;
const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;
const gen = (id: string, seed: number, type: GenType) => byId(id).generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });
const optText = (g: Generated, id: string) => g.options!.find((o) => o.id === id)!.text!;

// ---------- 1. variable types ----------

const LABEL: Record<string, 'nominal' | 'ordinal' | 'interval' | 'ratio'> = {
  'the brand of smartphone a student owns': 'nominal',
  'the blood type of a blood donor (A, B, AB or O)': 'nominal',
  'the faculty in which a student is enrolled': 'nominal',
  'the postal code of a customer’s home address': 'nominal',
  'the shirt number of a football player': 'nominal',
  'the payment method used at a checkout (cash, debit card or credit card)': 'nominal',
  'the streaming service a household subscribes to': 'nominal',
  'the cup size of a coffee order (small, medium or large)': 'ordinal',
  'the star rating of a hotel (1 to 5 stars)': 'ordinal',
  'the satisfaction of a customer (very unhappy, unhappy, neutral, happy, very happy)': 'ordinal',
  'the highest completed education of an employee (secondary school, bachelor, master, PhD)': 'ordinal',
  'the finishing position of a runner in a city marathon (1st, 2nd, 3rd, ...)': 'ordinal',
  'the age class of a museum visitor (0–12, 13–17, 18–64 or 65+ years)': 'ordinal',
  'the temperature in degrees Celsius at noon in Maastricht': 'interval',
  'the year in which a company was founded': 'interval',
  'the clock time (24-hour clock) at which a night train departs': 'interval',
  'the monthly rent of a student room in euros': 'ratio',
  'the time in minutes a student needs to cycle to campus': 'ratio',
  'the number of siblings of a student': 'ratio',
  'the weight in kilograms of a parcel': 'ratio',
  'the number of cups of coffee a lecturer drinks per day': 'ratio',
  'the price of a concert ticket in euros': 'ratio',
};
const lower1 = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const kindOfText = (t: string) => {
  const sc = LABEL[lower1(t)];
  expect(sc, `unlabelled variable "${t}"`).toBeDefined();
  return sc === 'nominal' || sc === 'ordinal' ? 'categorical' : 'quantitative';
};
const ROMAN = ['I', 'II', 'III'];
function maskOf(label: string): number {
  if (label === 'None of them') return 0;
  if (label === 'I, II and III') return 7;
  const ids = label.replace(' only', '').split(' and ');
  return ids.reduce((m, r) => m | (1 << ROMAN.indexOf(r)), 0);
}

describe('data-displays.variable-types', () => {
  it('the bank agrees with our own labels', () => {
    expect(VARIABLES.length).toBe(Object.keys(LABEL).length);
    for (const v of VARIABLES) expect(LABEL[v.text], v.text).toBe(v.scale);
  });
  it('single-choice: the key is recomputed from the printed variables', () => {
    let subset = 0;
    let scale = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('data-displays.variable-types', seed, 'single-choice');
      const items = [...g.stem.matchAll(/^(I|II|III)\. (.+)$/gm)];
      if (items.length) {
        subset++;
        expect(items.map((m) => m[1])).toEqual(ROMAN);
        const want = /\*\*(categorical|quantitative)\*\*/.exec(g.stem)![1];
        const key = items.reduce((m, it, i) => (kindOfText(it[2]) === want ? m | (1 << i) : m), 0);
        for (const o of g.options!) expect(maskOf(o.text!) === key, `seed ${seed} ${o.text}`).toBe(o.id === g.correctAnswer);
      } else {
        scale++;
        const v = /\*\*(.+?)\*\*/.exec(g.stem)![1];
        const sc = LABEL[v];
        expect(sc, v).toBeDefined();
        for (const o of g.options!) expect(o.text!.toLowerCase() === sc, `seed ${seed} ${o.text}`).toBe(o.id === g.correctAnswer);
      }
    }
    expect(subset).toBeGreaterThan(50);
    expect(scale).toBeGreaterThan(50);
  });
  it('multi-select: exactly the variables of the asked kind are keyed', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('data-displays.variable-types', seed, 'multi-select');
      const want = /\*\*(categorical|quantitative)\*\*/.exec(g.stem)![1];
      const keyed = g.options!.filter((o) => kindOfText(o.text!) === want).map((o) => o.id);
      expect(g.correctAnswer, `seed ${seed}`).toEqual(keyed);
    }
  });
});

// ---------- 2. displays ----------

type S = 'whole' | 'multi' | 'two-cat' | 'one-quant' | 'groups' | 'time' | 'two-quant';
const FITS: Record<S, string[]> = {
  whole: ['Pie chart', 'Bar chart'],
  multi: ['Bar chart'],
  'two-cat': ['Segmented bar chart'],
  'one-quant': ['Histogram', 'Boxplot'],
  groups: ['Side-by-side boxplots'],
  time: ['Line graph (time plot)'],
  'two-quant': ['Scatterplot'],
};
const ALL_DISPLAYS = ['Pie chart', 'Bar chart', 'Segmented bar chart', 'Histogram', 'Boxplot', 'Side-by-side boxplots', 'Line graph (time plot)', 'Scatterplot'];
const isNum = (s: string) => /^-?\d+(\.\d+)?%?$/.test(s.trim());

function structureOf(g: Generated): S {
  const t = g.table!;
  const cells = t.rows.flat();
  if (cells.some((c) => /^\d+(\.\d+)?(, \d+(\.\d+)?)+$/.test(c))) return 'groups';
  if (!t.header && cells.every(isNum)) return 'one-quant';
  const h = t.header!;
  const first = t.rows.map((r) => r[0]);
  expect(t.rows.every((r) => r.slice(1).every(isNum))).toBe(true);
  if (h.length === 2) {
    if (first.every((l) => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$|^\d{4}$|^Week \d+$/.test(l))) return 'time';
    if (h[1].includes('%')) {
      const total = t.rows.reduce((s, r) => s + parseFloat(r[1]), 0);
      return Math.abs(total - 100) < 0.5 ? 'whole' : 'multi';
    }
    return 'whole';
  }
  return first.every((l) => /\s\d+$/.test(l)) ? 'two-quant' : 'two-cat';
}

describe('data-displays.choose-display', () => {
  it('single-choice: the key fits the structure read from the table, no distractor does', () => {
    const seen = new Set<S>();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('data-displays.choose-display', seed, 'single-choice');
      const s = structureOf(g);
      seen.add(s);
      for (const o of g.options!) {
        expect(ALL_DISPLAYS).toContain(o.text);
        expect(FITS[s].includes(o.text!), `seed ${seed} ${s}: ${o.text}`).toBe(o.id === g.correctAnswer);
      }
    }
    expect(seen.size).toBe(7);
  });
  it('multi-select: exactly the fitting displays are keyed', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('data-displays.choose-display', seed, 'multi-select');
      const s = structureOf(g);
      expect(g.correctAnswer, `seed ${seed} ${s}`).toEqual(g.options!.filter((o) => FITS[s].includes(o.text!)).map((o) => o.id));
    }
  });
});

// ---------- 3. unit / variable / type, questionnaire ----------

const SCEN: [RegExp, string, string, string][] = [
  [/dragons/, 'A first-year dragon', 'Colour of the fire', 'Nominal'],
  [/penguins/, 'A penguin', 'Weight class', 'Ordinal'],
  [/coffee bar sells/, 'A coffee sold', 'Cup size', 'Ordinal'],
  [/ghosts/, 'A ghost', 'Room haunted', 'Nominal'],
  [/hamsters/, 'A hamster', 'Distance run in one night', 'Quantitative'],
  [/books they borrowed/, 'A young library member', 'Number of books borrowed', 'Quantitative'],
  [/cleaning robots/, 'A cleaning robot', 'Inspection grade', 'Ordinal'],
  [/bikes are parked/, 'A parked bike', 'Type of bike', 'Nominal'],
];
const ORDERED = ['Very bad|Bad|Okay|Good|Very good', 'Not at all|A little|Quite a lot|Very much'];
const UNORDERED = ['Cute|Silly|Scary|Boring', 'Funny|Exciting|Sad|Confusing', 'Spicy|Creamy|Fresh|Hearty'];

describe('data-displays.unit-variable-type', () => {
  it('matching: unit, variable and type agree with our own answers', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('data-displays.unit-variable-type', seed, 'matching');
      const sc = SCEN.filter(([re]) => re.test(g.stem));
      expect(sc.length, g.stem).toBe(1);
      const [, unit, variable, vt] = sc[0];
      const key = g.correctAnswer as Record<string, string>;
      const text = (pid: string) => g.choices!.find((c) => c.id === key[pid])!.text;
      const pid = (label: string) => g.prompts!.find((p) => p.text === label)!.id;
      expect(text(pid('Observational unit'))).toBe(unit);
      expect(text(pid('Variable'))).toBe(variable);
      expect(text(pid('Variable type'))).toBe(vt);
      expect(new Set(g.choices!.map((c) => c.text)).size).toBe(g.choices!.length);
    }
  });
  it('single-choice: answer types are read from the printed questionnaire', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('data-displays.unit-variable-type', seed, 'single-choice');
      const rows = g.table!.rows;
      const ans = (r: number) => rows[r][1].split('☐').map((x) => x.trim()).filter(Boolean).join('|');
      expect(ans(0)).toBe(ans(1));
      const op = ORDERED.includes(ans(0)) ? 'ordinal' : UNORDERED.includes(ans(0)) ? 'nominal' : 'unknown';
      expect(op, ans(0)).not.toBe('unknown');
      const bg = rows[2][1].includes('____') ? 'quantitative' : rows[2][1].split('☐').filter((x) => x.trim()).length >= 3 ? 'ordinal' : 'unknown';
      expect(bg).not.toBe('unknown');
      for (const o of g.options!) {
        const m = /^The opinions are (\w+) variables, and .+ has been measured as an? (\w+) variable$/.exec(o.text!)!;
        expect(m, o.text).not.toBeNull();
        expect(m[1] === op && m[2] === bg, `seed ${seed} ${o.text}`).toBe(o.id === g.correctAnswer);
      }
    }
  });
});

// ---------- 4. two-way tables ----------

function asked(g: Generated): number {
  const t = g.table!;
  const cols = t.header!.slice(1);
  const records: { r: string; c: string }[] = [];
  for (const row of t.rows) row.slice(1).forEach((x, j) => {
    for (let k = 0; k < Number(x); k++) records.push({ r: row[0], c: cols[j] });
  });
  const n = /of all (\d+) /.exec(g.stem);
  if (n) expect(Number(n[1])).toBe(records.length);
  const bold = [...g.stem.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]);
  const has = (rec: { r: string; c: string }, label: string) => rec.r === label || rec.c === label;
  for (const b of bold) expect(records.some((rec) => has(rec, b)), b).toBe(true);
  const cond = /Among the/.test(g.stem) ? bold[0] : undefined;
  const events = cond ? bold.slice(1) : bold;
  const base = cond ? records.filter((rec) => has(rec, cond)) : records;
  return (100 * base.filter((rec) => events.every((e) => has(rec, e))).length) / base.length;
}

describe('data-displays.two-way-table', () => {
  it('numeric: the percentage equals a direct count of the records', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('data-displays.two-way-table', seed, 'numeric');
      expect(Math.abs((g.correctAnswer as number) - asked(g)), `seed ${seed}: ${g.stem}`).toBeLessThanOrEqual(0.05 + 1e-9);
    }
  });
  it('single-choice: only the key matches the counted percentage', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('data-displays.two-way-table', seed, 'single-choice');
      const v = asked(g);
      for (const o of g.options!) expect(Math.abs(parseFloat(o.text!) - v) <= 0.05 + 1e-9, `seed ${seed} ${o.text} vs ${v}`).toBe(o.id === g.correctAnswer);
      expect(optText(g, g.correctAnswer as string)).toMatch(/^\d+\.\d%$/);
    }
  });
});
