import type { Attempt, Session } from '../types';

// Everything is kept in localStorage under these keys.
const KEY_ATTEMPTS = 'mtv:v1:attempts';
const KEY_SESSION = 'mtv:v1:session';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Could not save to localStorage', e);
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

export function clearAll() {
  write(KEY_ATTEMPTS, null);
  write(KEY_SESSION, null);
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
