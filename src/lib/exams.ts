import type { Exam } from '../types';
import { loadAttempts, loadPredictedExams, loadSession, savePredictedExams } from './storage';
import { validateExam } from './validate';

// Every JSON file in /data/exams is an exam. Images live next to them (paths in the JSON are
// relative to /data/exams). Example/demo exams in /data/examples only show up with ?demo=1.
const examModules = import.meta.glob('/data/exams/*.json', { eager: true, import: 'default' }) as Record<string, Exam>;
const demoModules = import.meta.glob('/data/examples/*.json', { eager: true, import: 'default' }) as Record<string, Exam>;
const imageUrls = import.meta.glob('/data/exams/**/*.{png,jpg,jpeg,gif,svg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export function resolveImage(src: string): string {
  return imageUrls[`/data/exams/${src.replace(/^\.?\//, '')}`] ?? src;
}

const imageExists = (src: string) => /^https?:\/\//.test(src) || `/data/exams/${src.replace(/^\.?\//, '')}` in imageUrls;

export interface LoadedExams {
  exams: Exam[];
  problems: { file: string; errors: string[] }[];
}

function showDemo(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('demo');
  } catch {
    return false;
  }
}

function sortKey(e: Exam) {
  return `${e.courseCode}|${e.academicYear}|${e.examType}|${e.title}`;
}

let cached: LoadedExams | null = null;

export function loadExams(): LoadedExams {
  if (cached) return cached;
  const problems: LoadedExams['problems'] = [];
  const exams: Exam[] = [];
  const add = (mods: Record<string, Exam>, demo: boolean) => {
    for (const [file, exam] of Object.entries(mods)) {
      const errors = validateExam(exam, imageExists);
      if (exams.some((e) => e.id === exam.id)) errors.push(`duplicate exam id "${exam.id}"`);
      if (errors.length) {
        problems.push({ file: file.replace(/^\//, ''), errors });
        if (errors.some((e) => e.startsWith('missing') || e.includes('duplicate exam id'))) continue;
      }
      exams.push({ ...exam, isDemo: demo });
    }
  };
  add(examModules, false);
  if (showDemo()) add(demoModules, true);
  exams.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  cached = { exams, problems };
  return cached;
}

export const isPredictedId = (id: string) => id.startsWith('predicted-');

export function getExam(id: string): Exam | undefined {
  if (isPredictedId(id)) return loadPredictedExams().find((e) => e.id === id);
  return loadExams().exams.find((e) => e.id === id);
}

/** Keep every predicted exam that an attempt or the exam in progress refers to, plus the newest unused ones. */
const KEEP_UNUSED_PREDICTED = 10;
export function addPredictedExam(exam: Exam) {
  const referenced = new Set([...loadAttempts().map((a) => a.examId), loadSession()?.examId]);
  let unused = 0;
  const list = [exam, ...loadPredictedExams().filter((e) => e.id !== exam.id)].filter((e) => referenced.has(e.id) || e === exam || ++unused <= KEEP_UNUSED_PREDICTED);
  savePredictedExams(list);
}

export const courseShortName = (courseName: string) => (courseName === 'Quantitative Methods 1' ? 'QM1' : courseName);

/** English label stored with attempts. The screens show predicted exams with a translated label instead. */
export function examLabel(e: Exam): string {
  if (e.prediction) return `${courseShortName(e.courseName)} – Predicted exam`;
  return `${courseShortName(e.courseName)} ${e.academicYear} – ${e.title}`;
}

export function keyKind(e: Exam): 'Official' | 'AI-solved' | 'Mixed' | 'Generated' {
  if (e.prediction) return 'Generated';
  const ai = e.questions.filter((q) => q.answerSource === 'ai').length;
  if (ai === 0) return 'Official';
  if (ai === e.questions.length) return 'AI-solved';
  return 'Mixed';
}
