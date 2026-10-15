// Courses that can generate a predicted exam: a stored blueprint plus question templates for its topics.
import type { Blueprint } from './blueprint';

const stored = import.meta.glob('/data/blueprints/*.json', { eager: true, import: 'default' }) as Record<string, Blueprint>;

/** "EBC1005/EBC1006/EBC1007" → "ebc1005-ebc1006-ebc1007.json" */
export const blueprintFileName = (courseCode: string) => `${courseCode.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;

export function blueprintFor(courseCode: string): Blueprint | undefined {
  return stored[`/data/blueprints/${blueprintFileName(courseCode)}`];
}

/** Fixed format of every predicted exam: 28 questions in 2 hours. */
export const PREDICTED_FORMAT = { questions: 28, durationMinutes: 120 } as const;
