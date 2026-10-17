// "Never copy verbatim": a generated question must not share long runs of words/numbers with any past question.

/** Lower-case words and numbers; LaTeX commands and punctuation are dropped. */
export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/\\[a-z]+/g, ' ')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/(^|\s)\.+|\.+(\s|$)/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(toks: string[], k: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + k <= toks.length; i++) out.add(toks.slice(i, i + k).join(' '));
  return out;
}

/**
 * Share of the shorter text's k-word runs that also occur in the other text (0 = nothing in common,
 * 1 = one is contained in the other). Texts shorter than k words are compared as a whole.
 */
export function overlap(a: string, b: string, k = 5): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const kk = Math.min(k, ta.length, tb.length);
  const sa = shingles(ta, kk);
  const sb = shingles(tb, kk);
  let common = 0;
  for (const s of sa) if (sb.has(s)) common++;
  return common / Math.min(sa.size, sb.size);
}

/** Highest overlap of `text` with any of `others`. */
export function maxOverlap(text: string, others: readonly string[], k = 5): number {
  let m = 0;
  for (const o of others) m = Math.max(m, overlap(text, o, k));
  return m;
}

/** A generated stem counts as copied when at least this share of its 5-word runs appear in one past stem. */
export const COPY_THRESHOLD = 0.5;
