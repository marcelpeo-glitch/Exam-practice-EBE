// Validates every exam file: schema, images on disk, and that every LaTeX snippet renders in KaTeX.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import katex from 'katex';
import type { Exam } from '../types';
import { validateExam } from './validate';
import { mathSnippets } from './richParse';

const root = path.resolve(__dirname, '../..');
const files = [
  ...fs.readdirSync(path.join(root, 'data/exams')).filter((f) => f.endsWith('.json')).map((f) => path.join(root, 'data/exams', f)),
  ...fs.readdirSync(path.join(root, 'data/examples')).filter((f) => f.endsWith('.json')).map((f) => path.join(root, 'data/examples', f)),
];

function texts(exam: Exam): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const q of exam.questions) {
    const w = `q${q.number}`;
    const add = (where: string, t?: string) => t && out.push({ where: `${w} ${where}`, text: t });
    add('stem', q.stem);
    add('instruction', q.instruction);
    add('explanation', q.explanation);
    add('sourceNote', q.sourceNote);
    add('modelAnswer', q.modelAnswer);
    q.options?.forEach((o) => add(`option ${o.id}`, o.text));
    q.prompts?.forEach((p) => add(`prompt ${p.id}`, p.text));
    q.choices?.forEach((c) => add(`choice ${c.id}`, c.text));
    q.fields?.forEach((f) => add(`field ${f.id}`, f.label));
    q.table?.header?.forEach((h) => add('table', h));
    q.table?.rows.flat().forEach((c) => add('table', c));
  }
  return out;
}

describe.each(files.map((f) => [path.relative(root, f), f]))('%s', (_name, file) => {
  const exam = JSON.parse(fs.readFileSync(file, 'utf8')) as Exam;
  const base = path.join(root, 'data/exams');

  it('matches the schema and all images exist', () => {
    expect(validateExam(exam, (src) => fs.existsSync(path.join(base, src)))).toEqual([]);
  });

  it('numbers questions 1..n', () => {
    expect(exam.questions.map((q) => q.number)).toEqual(exam.questions.map((_, i) => i + 1));
  });

  it('renders every LaTeX snippet without errors', () => {
    const bad: string[] = [];
    for (const { where, text } of texts(exam)) {
      for (const { tex, display } of mathSnippets(text)) {
        if (/(^|[^\\])%/.test(tex)) bad.push(`${where}: unescaped % in ${tex}`);
        try {
          katex.renderToString(tex, { displayMode: display, throwOnError: true, strict: 'ignore' });
        } catch (e) {
          bad.push(`${where}: ${(e as Error).message}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
