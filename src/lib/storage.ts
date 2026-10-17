import type { Attempt, Exam, Session } from '../types';

// Everything is kept in localStorage under these keys.
export const KEY_ATTEMPTS = 'mtv:v1:attempts';
export const KEY_SESSION = 'mtv:v1:session';
export const KEY_PREDICTED = 'mtv:v1:predicted';

// If the browser refuses localStorage (site data blocked by a setting or a school policy), everything is
// kept in memory instead, so an exam can still be taken in this tab. storageBlocked() lets the screens warn
// that nothing survives a reload.
const mem = new Map<string, string>();
let blocked = false;
export const storageBlocked = () => blocked;
try {
  localStorage.setItem('mtv:probe', '1');
  localStorage.removeItem('mtv:probe');
} catch {
  blocked = true;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = mem.has(key) ? mem.get(key) : localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  const raw = value === null ? null : JSON.stringify(value);
  try {
    if (raw === null) localStorage.removeItem(key);
    else localStorage.setItem(key, raw);
    mem.delete(key);
  } catch (e) {
    blocked = true;
    if (raw === null) mem.delete(key);
    else mem.set(key, raw);
    console.warn('Could not save to localStorage; keeping it in memory for this tab', e);
  }
}

export const loadSession = (): Session | null => read<Session | null>(KEY_SESSION, null);
export const saveSession = (s: Session | null) => write(KEY_SESSION, s);

export const loadAttempts = (): Attempt[] => read<Attempt[]>(KEY_ATTEMPTS, []);
export const saveAttempts = (a: Attempt[]) => write(KEY_ATTEMPTS, a);

export function upsertAttempt(a: Attempt) {
  const all = loadAttempts();
  const i = all.findIndex((x) => x.id === a.id);
  if (i >= 0) all[i] = a;
  else all.push(a);
  saveAttempts(all);
}

// Generated predicted exams. Parsed once per change: the exam and results screens look them up on every render.
let predictedCache: { raw: string | null; exams: Exam[] } = { raw: null, exams: [] };
export function loadPredictedExams(): Exam[] {
  let raw: string | null;
  try {
    raw = mem.has(KEY_PREDICTED) ? mem.get(KEY_PREDICTED)! : localStorage.getItem(KEY_PREDICTED);
  } catch {
    raw = null;
  }
  if (raw !== predictedCache.raw) predictedCache = { raw, exams: read<Exam[]>(KEY_PREDICTED, []) };
  return predictedCache.exams;
}
export const savePredictedExams = (exams: Exam[]) => write(KEY_PREDICTED, exams);

export function clearAll() {
  write(KEY_ATTEMPTS, null);
  write(KEY_SESSION, null);
  write(KEY_PREDICTED, null);
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
