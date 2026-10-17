// Independent checks for the "Sampling & study design" templates. Every key is re-derived from the PRINTED question
// with rules written here, not from the generator's labels:
// - Sampling plans are classified from their wording (random draw from the whole list / every k-th name / a sample
//   from every group / everyone in a few random groups / a sample within a few random groups / the first n to arrive /
//   people who decide themselves); counts in the plans are checked (c < G, G as stated in the stem).
// - Systematic samples are drawn by brute force from the list 1..N (searching the interval that gives exactly n names);
//   proportional allocations are found by searching the integer n_h with n_h / N_h = n / N.
// - Survey problems are classified by features of the description (self-selection, a response rate read back from the
//   numbers and below 50%, a restricted list, a leading question or a personal interviewer, a complete list + anonymous
//   answers); exactly one rule must fire. Survey terms are recognised from the numbers N > F > n and the words "share"/"%".
// - Study anatomy: experiment vs observational study from how groups are formed; roles from our own labels of every
//   printed variable; numbers of treatments/units by enumerating all factor-level combinations read from the stem.
// - Design statements are judged from design flags parsed from the stem with rules of our own.
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { TEMPLATES } from './sampling-study-design';

const SEEDS = 250;
const P = 'sampling-study-design.';
const gen = (id: string, seed: number, type: GenType) => TEMPLATES.find((t) => t.id === P + id)!.generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });
const optText = (g: Generated, id: string) => g.options!.find((o) => o.id === id)!.text!;
const choiceText = (g: Generated, id: string) => g.choices!.find((c) => c.id === id)!.text!;
const ints = (s: string) => [...s.matchAll(/\d+/g)].map((m) => Number(m[0]));

// ---------- 1. sampling methods ----------

const NAME: Record<string, string> = {
  srs: 'Simple random sampling', stratified: 'Stratified sampling', cluster: 'Cluster sampling', multistage: 'Multi-stage sampling',
  systematic: 'Systematic sampling', convenience: 'Convenience sampling', voluntary: 'Voluntary response sampling',
};
const SHORTNAME: Record<string, string> = { srs: 'simple random', stratified: 'stratified', cluster: 'cluster', multistage: 'multi-stage', systematic: 'systematic', convenience: 'convenience', voluntary: 'voluntary response' };

function classifyPlan(t: string, G?: number): string {
  const hits: string[] = [];
  if (/random number generator|computer lottery/.test(t)) hits.push('srs');
  if (/every \d+th name on the list/.test(t)) hits.push('systematic');
  if (/first divided by .*drawn at random from each of these/.test(t) || /^From every one of the \d+/.test(t)) hits.push('stratified');
  const grp = /^(\d+) of the (\d+) .* are chosen at random(, and all|; next, \d+ .* within each)/.exec(t);
  if (grp) {
    expect(Number(grp[1])).toBeLessThan(Number(grp[2])); // only some groups are chosen
    if (G !== undefined) expect(Number(grp[2])).toBe(G);
    hits.push(grp[3].startsWith(', and all') ? 'cluster' : 'multistage');
  }
  const every = /^From every one of the (\d+)/.exec(t);
  if (every && G !== undefined) expect(Number(every[1])).toBe(G);
  if (/the first \d+ (?!names)/.test(t)) hits.push('convenience');
  if (/decides to (fill it in|respond)/.test(t)) hits.push('voluntary');
  expect(hits, t).toHaveLength(1);
  return hits[0];
}
const spreadG = (stem: string) => {
  const m = /spread over (\d+)/.exec(stem);
  return m ? Number(m[1]) : undefined;
};

describe('sampling-study-design.sampling-method', () => {
  it('single-choice: the key names the method of the printed plan(s), no distractor does', () => {
    const seen = { one: 0, four: 0 };
    const methods = new Set<string>();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('sampling-method', seed, 'single-choice');
      const lines = g.stem.split('\n');
      const roman = lines.filter((l) => /^\((I|II|III|IV)\) /.test(l));
      let want: string;
      if (roman.length) {
        seen.four++;
        expect(roman).toHaveLength(4);
        const G = spreadG(g.stem);
        const ms = roman.map((l) => classifyPlan(l.replace(/^\(\w+\) /, ''), G));
        ms.forEach((m) => methods.add(m));
        expect(new Set(ms).size).toBe(4);
        want = ms.map((m, i) => `${['I', 'II', 'III', 'IV'][i]}: ${SHORTNAME[m]}`).join(', ');
      } else {
        seen.one++;
        expect(lines).toHaveLength(3);
        const m = classifyPlan(lines[1]);
        methods.add(m);
        want = NAME[m];
      }
      for (const o of g.options!) expect(o.text === want, `seed ${seed}: ${o.text} vs ${want}`).toBe(o.id === g.correctAnswer);
    }
    expect(seen.one).toBeGreaterThan(80);
    expect(seen.four).toBeGreaterThan(50);
    expect(methods.size).toBe(7);
  });

  it('matching: every plan is keyed to the method our rules find; extra methods stay unused', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('sampling-method', seed, 'matching');
      const G = spreadG(g.stem);
      const key = g.correctAnswer as Record<string, string>;
      for (const p of g.prompts!) expect(choiceText(g, key[p.id]), `seed ${seed}: ${p.text}`).toBe(NAME[classifyPlan(p.text, G)]);
      expect(new Set(Object.values(key)).size).toBe(g.prompts!.length);
      expect(g.choices!.length).toBeGreaterThan(g.prompts!.length);
    }
  });

  it('numeric: systematic samples drawn by brute force, proportional allocations found by search', () => {
    let sys = 0;
    let strat = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('sampling-method', seed, 'numeric');
      expect(g.tolerance).toBe(0);
      const sm = /contains (\d+) .*numbered from 1 to (\d+)\. A systematic sample of (\d+) .*starting point is number (\d+)\.\nWhat is the number of the (last|(\d+)(?:st|nd|rd|th)) /s.exec(g.stem);
      if (sm) {
        sys++;
        const [N, n, r] = [Number(sm[2]), Number(sm[3]), Number(sm[4])];
        expect(Number(sm[1])).toBe(N);
        // the interval: the step k with start r ≤ k that picks exactly n numbers from 1..N
        const ks = [];
        for (let k = r; k <= N; k++) {
          let cnt = 0;
          for (let x = r; x <= N; x += k) cnt++;
          if (cnt === n && N - (r + (n - 1) * k) < k && r <= k) ks.push(k);
        }
        expect(ks, `seed ${seed}`).toHaveLength(1);
        const picked: number[] = [];
        for (let x = r; x <= N; x += ks[0]) picked.push(x);
        const j = sm[5] === 'last' ? n : Number(sm[6]);
        expect(g.correctAnswer, `seed ${seed}`).toBe(picked[j - 1]);
        continue;
      }
      strat++;
      const head = /contains (\d+) [^:]+: (.+?)\. A stratified sample of (\d+) .*\nHow many (.+) are in the sample\?/s.exec(g.stem)!;
      expect(head, g.stem).not.toBeNull();
      const N = Number(head[1]);
      const n = Number(head[3]);
      const parts = head[2].split(/, | and /).map((x) => /^(\d+) (.+)$/.exec(x)!);
      expect(parts.reduce((s, x) => s + Number(x[1]), 0)).toBe(N);
      const alloc = parts.map((x) => {
        const Nh = Number(x[1]);
        const hits = [];
        for (let k = 0; k <= n; k++) if (k * N === n * Nh) hits.push(k);
        expect(hits, `seed ${seed}: stratum ${x[2]}`).toHaveLength(1);
        return { name: x[2], k: hits[0] };
      });
      expect(alloc.reduce((s, a) => s + a.k, 0)).toBe(n);
      expect(new Set(alloc.map((a) => a.k)).size).toBe(alloc.length);
      expect(g.correctAnswer, `seed ${seed}`).toBe(alloc.find((a) => a.name === head[4])!.k);
    }
    expect(sys).toBeGreaterThan(80);
    expect(strat).toBeGreaterThan(80);
  });
});

// ---------- 2. survey bias and survey terms ----------

const BIAS_TEXT: Record<string, string> = {
  undercoverage: 'Undercoverage', nonresponse: 'Nonresponse bias', response: 'Response bias', voluntary: 'Voluntary response bias', none: 'No bias: only sampling variability',
};
function classifySurvey(t: string): string {
  const hits: string[] = [];
  if (/viewers send a text|readers click an answer|customers scan the code/.test(t)) hits.push('voluntary');
  const nr = /(?:sample of|to|,) (\d+) (?:households|nurses|customers)\b.*Only (\d+) (?:households|of them|customers) \((\d+)%\)/s.exec(t);
  if (nr) {
    const [n, r, p] = [Number(nr[1]), Number(nr[2]), Number(nr[3])];
    expect(Math.abs((100 * r) / n - p)).toBeLessThan(0.5); // the printed percentage matches the counts
    if (p < 50) hits.push('nonresponse');
  }
  if (/register of parking-permit holders|landline telephone directory|list of students who logged in|register of dwarves who own a mine/.test(t)) hits.push('undercoverage');
  if (/own tutor|own dentist|asks each of them in person|face to face|"Given the/.test(t)) hits.push('response');
  if (/complete (customer list|student register)/.test(t) && /anonymous/.test(t) && /(All|all) (selected|of them)/.test(t)) hits.push('none');
  expect(hits, t).toHaveLength(1);
  return hits[0];
}

describe('sampling-study-design.survey-bias', () => {
  it('single-choice: the key is the problem our rules find in the description', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('survey-bias', seed, 'single-choice');
      const k = classifySurvey(g.stem.split('\n')[0]);
      kinds.add(k);
      for (const o of g.options!) expect(o.text === BIAS_TEXT[k], `seed ${seed}: ${o.text}`).toBe(o.id === g.correctAnswer);
    }
    expect(kinds.size).toBe(5);
  });

  it('matching: bias per survey, or population / frame / sample / parameter / statistic from the numbers', () => {
    let terms = 0;
    let bias = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('survey-bias', seed, 'matching');
      const key = g.correctAnswer as Record<string, string>;
      if (/Match each description with the correct term/.test(g.stem)) {
        terms++;
        const story = g.stem.split('\n')[0];
        const nums = ints(story.replace(/\d+%/g, ''));
        const N = Math.max(...nums);
        const F = Math.max(...nums.filter((x) => x < N));
        const n = Math.max(...nums.filter((x) => x < F));
        expect(N > F && F > n && n > 0).toBe(true);
        for (const p of g.prompts!) {
          const pn = ints(p.text)[0];
          const want = /%/.test(p.text) ? 'Statistic' : /share of all/.test(p.text) ? 'Parameter' : pn === N ? 'Population' : pn === F ? 'Sampling frame' : pn === n ? 'Sample' : '?';
          if (want === 'Parameter') expect(pn).toBe(N);
          expect(choiceText(g, key[p.id]), `seed ${seed}: ${p.text}`).toBe(want);
        }
      } else {
        bias++;
        for (const p of g.prompts!) expect(choiceText(g, key[p.id]), `seed ${seed}: ${p.text}`).toBe(BIAS_TEXT[classifySurvey(p.text)]);
      }
    }
    expect(terms).toBeGreaterThan(50);
    expect(bias).toBeGreaterThan(100);
  });
});

// ---------- 3. study anatomy ----------

type Role = 'treatment' | 'response' | 'block' | 'unit' | 'explanatory' | 'confounder';
const ROLE_TEXT: Record<Role | 'experiment' | 'observational', string> = {
  experiment: 'an experiment', observational: 'an observational study', treatment: 'a treatment factor', response: 'the response variable',
  block: 'a blocking factor', unit: 'an experimental unit', explanatory: 'the explanatory variable', confounder: 'a possible confounding variable',
};
// our own labels of every variable that can be printed
const LABEL: Record<string, Role> = {
  'The fertiliser': 'treatment', 'The weight of the tomatoes per plant': 'response', 'The greenhouse': 'block', 'A tomato plant': 'unit',
  'The sleeping potion': 'treatment', 'The time until falling asleep': 'response', 'The species (dwarf or elf)': 'block', 'A test subject': 'unit',
  'The preparation method': 'treatment', 'The exam score': 'response', 'The year of study': 'block', 'A student': 'unit',
  'The rising time': 'treatment', 'The tasting score of the crust': 'response', 'The type of oven': 'block', 'A batch of dough': 'unit',
  'The music played in the barn': 'treatment', 'The daily milk yield': 'response', 'The breed of the cow': 'block', 'A cow': 'unit',
  'Taking group classes or not': 'explanatory', 'The number of gym visits per month': 'response', 'The amount of free time of a member': 'confounder',
  'Sitting in the front rows or not': 'explanatory', 'The course grade': 'response', 'The motivation of a student': 'confounder',
  'Drinking the herbal tea or not': 'explanatory', 'The number of colds caught during the winter': 'response', 'The age of a villager': 'confounder',
};
// treatment; unit; response per experiment, recognised by a word in the story
const TRIPLE: [RegExp, string][] = [
  [/tomato/, 'a particular fertiliser; a tomato plant; the weight of the tomatoes per plant'],
  [/sleeping potions/, 'a particular sleeping potion; a test subject; the time until falling asleep'],
  [/preparing for a statistics exam/, 'a particular preparation method; a student; the exam score'],
  [/rising times/, 'a particular rising time; a batch of dough; the tasting score of the crust'],
  [/milk/, 'a particular type of music; a cow; the daily milk yield'],
];
const isExperiment = (story: string) => {
  const assigned = /assigns? .*at random|are assigned at random/.test(story);
  const self = /decided themselves|decide themselves|pick their own/.test(story);
  expect(assigned !== self, story).toBe(true);
  return assigned;
};

describe('sampling-study-design.study-anatomy', () => {
  it('matching: study type from how the groups are formed, roles from our own labels', () => {
    let exp = 0;
    let obs = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('study-anatomy', seed, 'matching');
      const key = g.correctAnswer as Record<string, string>;
      const e = isExperiment(g.stem.split('\n')[0]);
      if (e) exp++;
      else obs++;
      for (const p of g.prompts!) {
        const subject = p.text.replace(/ is …$/, '');
        const want = subject === 'This study' ? ROLE_TEXT[e ? 'experiment' : 'observational'] : ROLE_TEXT[LABEL[subject]];
        expect(LABEL[subject] !== undefined || subject === 'This study', `unlabelled: ${subject}`).toBe(true);
        expect(choiceText(g, key[p.id]), `seed ${seed}: ${p.text}`).toBe(want);
      }
      // an observational study offers no treatment factor; an experiment no confounder/explanatory choice (no two right answers)
      const texts = g.choices!.map((c) => c.text);
      if (e) expect(texts.some((t) => /confounding|explanatory/.test(t!))).toBe(false);
      else expect(texts).not.toContain(ROLE_TEXT.treatment);
    }
    expect(exp).toBeGreaterThan(120);
    expect(obs).toBeGreaterThan(40);
  });

  it('single-choice: exactly the option with our (treatment; unit; response) is keyed', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('study-anatomy', seed, 'single-choice');
      const story = g.stem.split('\n')[0];
      expect(isExperiment(story)).toBe(true);
      const hit = TRIPLE.filter(([re]) => re.test(story));
      expect(hit, story).toHaveLength(1);
      for (const o of g.options!) expect(o.text === hit[0][1], `seed ${seed}: ${o.text}`).toBe(o.id === g.correctAnswer);
    }
  });

  it('numeric: treatments and units counted by enumerating all level combinations', () => {
    const asked = { treat: 0, units: 0, blocks: 0 };
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('study-anatomy', seed, 'numeric');
      const lists = [...g.stem.matchAll(/\(([^)]+)\)/g)].map((m) => m[1].split(/, | and /));
      expect(lists).toHaveLength(2);
      const combos: string[][] = [];
      for (const a of lists[0]) for (const b of lists[1]) combos.push([a, b]);
      // adding the numbers of levels (a typical slip) must not give the right number of treatments
      expect(combos.length, `seed ${seed}: ${g.stem}`).not.toBe(lists[0].length + lists[1].length);
      const r = Number(/each on (\d+) /.exec(g.stem)![1]);
      const bm = /in each of (\d+) /.exec(g.stem);
      const k = bm ? Number(bm[1]) : 1;
      let units = 0;
      for (let b = 0; b < k; b++) for (const _c of combos) for (let i = 0; i < r; i++) units++;
      const want = /How many treatments/.test(g.stem) ? combos.length : units;
      if (/How many treatments/.test(g.stem)) asked.treat++;
      else asked.units++;
      if (k > 1) asked.blocks++;
      expect(g.correctAnswer, `seed ${seed}`).toBe(want);
      expect(g.tolerance).toBe(0);
    }
    expect(Math.min(asked.treat, asked.units, asked.blocks)).toBeGreaterThan(40);
  });
});

// ---------- 4. design principles ----------

interface Flags { rs: boolean; ra: boolean; placebo: boolean; evalBlind: boolean; blocked: boolean }
function flagsOf(stem: string): Flags {
  const rs = /are drawn at random from a complete list/.test(stem);
  const vol = /sign up after seeing an advertisement/.test(stem);
  const ra = /A computer lottery puts half/.test(stem);
  const self = /decides for themselves/.test(stem);
  expect(rs !== vol && ra !== self, stem).toBe(true);
  return { rs, ra, placebo: /The control group gets (?!nothing)/.test(stem), evalBlind: /do not know who received/.test(stem), blocked: /this is done separately/.test(stem) };
}
function judge(s: string, f: Flags): boolean {
  if (/^This study is an experiment\.$/.test(s)) return f.ra;
  if (/^This study is an observational study\.$/.test(s)) return !f.ra;
  if (/would be evidence that .* causes this difference/.test(s)) return f.ra && f.placebo;
  if (/may be confounded with/.test(s)) return !f.ra;
  if (/^The study is double-blind\.$/.test(s)) return f.placebo && f.evalBlind && f.ra;
  if (/is used as a blocking variable/.test(s)) return f.blocked;
  if (/cannot tell whether they received the real/.test(s)) return f.placebo;
  if (/^Because .* at random, the results can be generalised/.test(s)) return false; // random assignment ≠ random sampling
  if (/^The results can be generalised to/.test(s)) return f.rs;
  if (/simply expecting to improve cannot be separated/.test(s)) return !f.placebo;
  if (/may differ in other ways from those who did not/.test(s)) return !f.ra;
  throw new Error(`unjudged statement: ${s}`);
}

describe('sampling-study-design.design-principles', () => {
  it('multi-select: exactly the statements that our rules judge true are keyed', () => {
    const seen = { ra: 0, self: 0, placebo: 0, blocked: 0, rs: 0 };
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('design-principles', seed, 'multi-select');
      const f = flagsOf(g.stem);
      if (f.ra) seen.ra++;
      else seen.self++;
      if (f.placebo) seen.placebo++;
      if (f.blocked) seen.blocked++;
      if (f.rs) seen.rs++;
      expect(g.correctAnswer, `seed ${seed}`).toEqual(g.options!.filter((o) => judge(o.text!, f)).map((o) => o.id));
    }
    expect(Math.min(...Object.values(seen))).toBeGreaterThan(30);
  });

  it('single-choice: the I/II/III combination is recomputed from our own judgements', () => {
    const ROMAN = ['I', 'II', 'III'];
    const maskOf = (label: string) =>
      label === 'None of them' ? 0 : label === 'I, II and III' ? 7 : label.replace(' only', '').split(' and ').reduce((m, r) => m | (1 << ROMAN.indexOf(r)), 0);
    const masks = new Set<number>();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('design-principles', seed, 'single-choice');
      const f = flagsOf(g.stem);
      const items = [...g.stem.matchAll(/^(I|II|III)\. (.+)$/gm)];
      expect(items.map((m) => m[1])).toEqual(ROMAN);
      const key = items.reduce((m, it, i) => (judge(it[2], f) ? m | (1 << i) : m), 0);
      masks.add(key);
      for (const o of g.options!) expect(maskOf(o.text!) === key, `seed ${seed}: ${o.text}`).toBe(o.id === g.correctAnswer);
    }
    expect(masks.size).toBe(8);
  });
});
