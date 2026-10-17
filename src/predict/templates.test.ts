// Checks that apply to every template (see templates/*.test.ts for each topic's own correctness checks):
// structure, distinct options, a valid key, LaTeX that KaTeX can render, determinism, and no copying of past exams.
import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { parseRich } from '../lib/richParse';
import type { Exam } from '../types';
import { makeRng } from './rng';
import { COPY_THRESHOLD, maxOverlap } from './similarity';
import { GEN_TYPES, TOPICS, type GenType, type Generated, type Template } from './types';

const mods = import.meta.glob(['./templates/*.ts', '!./templates/*.test.ts'], { eager: true }) as Record<string, { TEMPLATES?: Template[] }>;
const templates = Object.values(mods).flatMap((m) => m.TEMPLATES ?? []);
const only = process.env.TEMPLATE_PREFIX;
const selected = only ? templates.filter((t) => t.id.startsWith(only)) : templates;
const SEEDS = Number(process.env.TEMPLATE_SEEDS ?? 150);

const pastStems = Object.values(import.meta.glob('/data/exams/*.json', { eager: true, import: 'default' }) as Record<string, Exam>).flatMap((e) =>
  e.questions.map((q) => q.stem),
);

function texts(g: Generated): string[] {
  return [
    g.stem,
    g.instruction ?? '',
    g.explanation,
    ...(g.options ?? []).map((o) => o.text ?? ''),
    ...(g.fields ?? []).map((f) => f.label ?? ''),
    ...(g.prompts ?? []).map((p) => p.text),
    ...(g.choices ?? []).map((c) => c.text ?? ''),
    ...(g.table ? [...(g.table.header ?? []), ...g.table.rows.flat(), g.table.caption ?? ''] : []),
  ];
}

function checkLatex(s: string) {
  for (const seg of parseRich(s)) if (seg.kind === 'math') katex.renderToString(seg.tex, { displayMode: seg.display, throwOnError: true, strict: false });
}

function checkStructure(g: Generated, type: GenType, optionCount: number) {
  expect(g.type).toBe(type);
  expect(g.stem.trim().length).toBeGreaterThan(20);
  expect(g.explanation.trim().length).toBeGreaterThan(40);
  if (type === 'single-choice' || type === 'multi-select') {
    const opts = g.options ?? [];
    expect(opts.length).toBe(optionCount);
    expect(opts.map((o) => o.id)).toEqual('ABCDEFGH'.slice(0, optionCount).split(''));
    const norm = opts.map((o) => (o.text ?? '').replace(/\s+/g, ''));
    expect(new Set(norm).size, `duplicate options: ${norm.join(' | ')}`).toBe(opts.length);
    if (type === 'single-choice') expect(opts.map((o) => o.id)).toContain(g.correctAnswer);
    else {
      const key = g.correctAnswer as string[];
      expect(Array.isArray(key) && key.length > 0).toBe(true);
      expect(key.length).toBeLessThan(opts.length);
      for (const k of key) expect(opts.map((o) => o.id)).toContain(k);
    }
  }
  if (type === 'numeric') {
    if (g.fields?.length) for (const f of g.fields) expect(Number.isFinite(f.answer), `field ${f.id}`).toBe(true);
    else expect(Number.isFinite(g.correctAnswer as number)).toBe(true);
  }
  if (type === 'matching') {
    const prompts = g.prompts ?? [];
    const choices = g.choices ?? [];
    expect(prompts.length).toBeGreaterThanOrEqual(2);
    expect(choices.length).toBeGreaterThanOrEqual(prompts.length);
    const key = g.correctAnswer as Record<string, string>;
    for (const p of prompts) expect(choices.map((c) => c.id)).toContain(key[p.id]);
  }
}

describe('template registry', () => {
  it('has unique ids, known topics and types', () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const topics = [...TOPICS.Mathematics, ...TOPICS.Statistics] as string[];
    for (const t of templates) {
      expect(topics, t.id).toContain(t.topic);
      expect(t.types.length, t.id).toBeGreaterThan(0);
      for (const ty of t.types) expect(GEN_TYPES, t.id).toContain(ty);
      expect([1, 2, 3], t.id).toContain(t.difficulty);
    }
  });
});

for (const t of selected) {
  describe(t.id, () => {
    for (const type of t.types) {
      it(`${type}: ${SEEDS} seeds give valid, renderable, original questions`, () => {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const optionCount = seed % 2 ? 5 : 4;
          let g: Generated;
          try {
            g = t.generate({ rng: makeRng(seed), type, optionCount });
          } catch (e) {
            throw new Error(`seed ${seed}: ${(e as Error).message}`);
          }
          try {
            checkStructure(g, type, optionCount);
            for (const s of texts(g)) checkLatex(s);
          } catch (e) {
            throw new Error(`seed ${seed}: ${(e as Error).message}\n${JSON.stringify(g, null, 1).slice(0, 1500)}`);
          }
          const copied = maxOverlap(g.stem, pastStems);
          expect(copied, `seed ${seed}: stem too close to a past exam question:\n${g.stem}`).toBeLessThan(COPY_THRESHOLD);
          if (seed <= 3) expect(t.generate({ rng: makeRng(seed), type, optionCount })).toEqual(g); // deterministic
        }
      });
    }
  });
}
