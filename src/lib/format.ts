// Locale-aware formatting. The UI gets these through useI18n().fmt, bound to the active language.

export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export interface Formatters {
  /** Plain number, at most `maxDigits` decimals (default 2). */
  num: (x: number, maxDigits?: number) => string;
  /** Points: at most two decimals. */
  points: (x: number) => string;
  /** Grade out of 10: always one decimal. */
  grade: (x: number) => string;
  /** Percentage given as 0–100. */
  percent: (x: number, digits?: number) => string;
  /** Date and time of day. */
  date: (iso: string) => string;
  /** Whole minutes, e.g. "120 minutes" (long) or "120 min" (short). */
  minutes: (n: number, style?: 'long' | 'short') => string;
  /** Elapsed time, e.g. "1 hr, 5 min" or "4 min, 12 sec". */
  duration: (totalSec: number) => string;
  /** "A or B or C" in the active language. */
  or: (items: string[]) => string;
}

export function makeFormatters(locale: string): Formatters {
  const cache = new Map<string, Intl.NumberFormat>();
  const nf = (opts: Intl.NumberFormatOptions) => {
    const k = JSON.stringify(opts);
    let f = cache.get(k);
    if (!f) {
      f = new Intl.NumberFormat(locale, opts);
      cache.set(k, f);
    }
    return f;
  };
  const unit = (n: number, u: 'hour' | 'minute' | 'second', display: 'long' | 'short') =>
    nf({ style: 'unit', unit: u, unitDisplay: display, maximumFractionDigits: 0 }).format(n);
  const list = (items: string[], type: 'unit' | 'disjunction') => {
    try {
      return new Intl.ListFormat(locale, { type, style: type === 'unit' ? 'short' : 'long' }).format(items);
    } catch {
      return items.join(type === 'unit' ? ' ' : ' / ');
    }
  };
  const dateFmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return {
    num: (x, maxDigits = 2) => nf({ maximumFractionDigits: maxDigits }).format(x),
    points: (x) => nf({ maximumFractionDigits: 2 }).format(Math.round(x * 100) / 100),
    grade: (x) => nf({ minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(x),
    percent: (x, digits = 0) => nf({ style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x / 100),
    date: (iso) => dateFmt.format(new Date(iso)),
    minutes: (n, style = 'long') => unit(n, 'minute', style),
    duration: (totalSec) => {
      const s = Math.max(0, Math.round(totalSec));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      if (h) return list([unit(h, 'hour', 'short'), unit(m, 'minute', 'short')], 'unit');
      if (m) return list([unit(m, 'minute', 'short'), unit(sec, 'second', 'short')], 'unit');
      return unit(sec, 'second', 'short');
    },
    or: (items) => (items.length < 2 ? items.join('') : list(items, 'disjunction')),
  };
}
