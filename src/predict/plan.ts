// From blueprint to exam plan: how many questions per section, which topics, which question types, in what order.
import type { Blueprint, BlueprintTopic } from './blueprint';
import type { Rng } from './rng';
import { GEN_TYPES, type Difficulty, type GenType, type Section } from './types';

export interface Slot {
  section: Section;
  topic: string;
  type: GenType;
  difficulty: Difficulty;
}

export interface TopicAllocation {
  topic: string;
  section: Section;
  /** Expected number of questions from the blueprint weight (before rounding). */
  expected: number;
  /** Questions in this exam. */
  count: number;
  mandatory: boolean;
}

export interface ExamPlan {
  slots: Slot[];
  /** Questions per section. */
  split: Record<Section, number>;
  /** Share of each section in the past exams (recency-weighted). */
  ratio: Record<Section, number>;
  topics: TopicAllocation[];
  /** Type counts per section. */
  types: Record<Section, Partial<Record<GenType, number>>>;
}

/** Largest-remainder rounding of non-negative targets to integers summing to n. */
export function apportion(targets: number[], n: number): number[] {
  const total = targets.reduce((a, b) => a + b, 0) || 1;
  const exact = targets.map((t) => (t / total) * n);
  const out = exact.map(Math.floor);
  const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; out.reduce((a, b) => a + b, 0) < n; k++) out[order[k % order.length][1]]++;
  return out;
}

/**
 * Topics for one section. Every topic that was in every past exam gets at least one question; the rest of the
 * section follows the recency-weighted frequencies: the whole part of each topic's expected count is fixed, the
 * remaining questions are drawn at random in proportion to what is left over (so repeated predictions vary a little
 * but follow the weights on average).
 */
export function allocateTopics(topics: BlueprintTopic[], n: number, rng: Rng): TopicAllocation[] {
  const total = topics.reduce((s, t) => s + t.weight, 0) || 1;
  const alloc = topics.map((t) => {
    const expected = (t.weight / total) * n;
    return { topic: t.topic, section: t.section, expected, count: t.inEveryExam ? Math.max(1, Math.floor(expected)) : Math.floor(expected), mandatory: t.inEveryExam };
  });
  let used = alloc.reduce((s, a) => s + a.count, 0);
  // Too many mandatory topics for the section: take back from topics that got more than they are owed.
  while (used > n) {
    const victim = [...alloc].filter((a) => a.count > (a.mandatory ? 1 : 0)).sort((a, b) => b.count - b.expected - (a.count - a.expected))[0];
    if (!victim) break;
    victim.count--;
    used--;
  }
  while (used < n) {
    const rest = alloc.map((a) => Math.max(0, a.expected - a.count) + 1e-6);
    const sum = rest.reduce((a, b) => a + b, 0);
    let r = rng.next() * sum;
    let i = 0;
    while (i < rest.length - 1 && r >= rest[i]) r -= rest[i++];
    alloc[i].count++;
    used++;
  }
  return alloc;
}

/**
 * Build the plan. `supports(topic, type)` says whether a question of that type can be generated for the topic;
 * types the generator cannot make for any planned topic fall back to single-choice.
 */
export function planExam(bp: Blueprint, total: number, rng: Rng, supports: (topic: string, type: GenType) => boolean): ExamPlan {
  const sections = bp.sectionOrder;
  const counts = apportion(
    sections.map((s) => bp.sections[s].share),
    total,
  );
  const split = Object.fromEntries(sections.map((s, i) => [s, counts[i]])) as Record<Section, number>;
  const ratio = Object.fromEntries(sections.map((s) => [s, bp.sections[s].share])) as Record<Section, number>;

  const slots: Slot[] = [];
  const topicsOut: TopicAllocation[] = [];
  const typesOut = {} as ExamPlan['types'];
  for (const sec of sections) {
    const n = split[sec];
    const topics = bp.topics.filter((t) => t.section === sec && supports(t.topic, 'single-choice'));
    if (!topics.length) throw new Error(`No question templates for any ${sec} topic`);
    const alloc = allocateTopics(topics, n, rng);
    topicsOut.push(...alloc);

    // One slot per question, ordered as the topics usually appear in the past exams.
    const secSlots: (Slot & { pos: number })[] = [];
    for (const a of alloc) {
      const t = topics.find((x) => x.topic === a.topic)!;
      for (let k = 0; k < a.count; k++) {
        const d = Math.round(t.meanDifficulty + (rng.next() - 0.5));
        secSlots.push({ section: sec, topic: a.topic, type: 'single-choice', difficulty: Math.min(3, Math.max(1, d)) as Difficulty, pos: t.meanPosition });
      }
    }
    secSlots.sort((a, b) => a.pos - b.pos || a.topic.localeCompare(b.topic));

    // Question types: the section's recency-weighted type mix, given to the topics that used each type most.
    const mix = bp.sections[sec].typeMix;
    const typeList = GEN_TYPES.filter((ty) => (mix[ty] ?? 0) > 0);
    const want = apportion(
      typeList.map((ty) => mix[ty] ?? 0),
      n,
    );
    const typeCount: Partial<Record<GenType, number>> = { 'single-choice': n };
    // Rarest types first, so they get the topics that suit them best.
    const order = typeList.map((ty, i) => ({ ty, k: want[i] })).filter((x) => x.ty !== 'single-choice').sort((a, b) => a.k - b.k);
    for (const { ty, k } of order) {
      const candidates = secSlots
        .filter((s) => s.type === 'single-choice' && supports(s.topic, ty))
        .map((s) => ({ s, score: (topics.find((t) => t.topic === s.topic)!.typeMix[ty] ?? 0) + rng.next() * 0.05 }))
        .sort((a, b) => b.score - a.score);
      const used = new Set<string>();
      let given = 0;
      // Spread a type over different topics before giving a topic a second one.
      for (const pass of [0, 1]) {
        for (const c of candidates) {
          if (given >= k) break;
          if (c.s.type !== 'single-choice' || (pass === 0 && used.has(c.s.topic))) continue;
          c.s.type = ty;
          used.add(c.s.topic);
          given++;
        }
      }
      typeCount[ty] = given;
      typeCount['single-choice']! -= given;
    }
    typesOut[sec] = typeCount;
    slots.push(...secSlots.map(({ pos: _pos, ...s }) => s));
  }
  return { slots, split, ratio, topics: topicsOut, types: typesOut };
}
