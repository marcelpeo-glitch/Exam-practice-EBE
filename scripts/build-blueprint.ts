// Rebuild the stored blueprint(s) from the past exams in data/exams. Run after adding or changing an exam:
//   npm run blueprint
// One blueprint per course (courseCode); written to data/blueprints/<course>.json.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildBlueprint } from '../src/predict/blueprint';
import { blueprintFileName } from '../src/predict/courses';
import type { Exam } from '../src/types';

const root = join(import.meta.dirname ?? __dirname, '..');
const dir = join(root, 'data/exams');
const exams = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Exam);

const byCourse = new Map<string, Exam[]>();
for (const e of exams) byCourse.set(e.courseCode, [...(byCourse.get(e.courseCode) ?? []), e]);

mkdirSync(join(root, 'data/blueprints'), { recursive: true });
for (const [code, list] of byCourse) {
  const bp = buildBlueprint(list);
  const file = join(root, 'data/blueprints', blueprintFileName(code));
  writeFileSync(file, JSON.stringify(bp, null, 1) + '\n');
  const ratio = bp.sectionOrder.map((s) => `${s} ${(bp.sections[s].share * 100).toFixed(1)}%`).join(' / ');
  console.log(`${file}: ${list.length} exams, ${bp.questions.length} questions; ${ratio}`);
  console.log(`  always included: ${bp.topics.filter((t) => t.inEveryExam).map((t) => t.topic).join('; ')}`);
}
