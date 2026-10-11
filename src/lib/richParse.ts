// Tiny parser for question text: $inline$ and $$display$$ LaTeX, **bold**, *italic*, and newlines.
// A literal dollar sign is written as \$ (outside math it becomes "$"; inside math KaTeX renders \$).

export type Segment =
  | { kind: 'text'; text: string; bold?: boolean; italic?: boolean }
  | { kind: 'math'; tex: string; display: boolean }
  | { kind: 'br' };

function findClosing(s: string, from: number, delim: string): number {
  for (let i = from; i < s.length; i++) {
    if (s[i] === '\\') {
      i++; // skip escaped char (e.g. \$)
      continue;
    }
    if (s.startsWith(delim, i)) return i;
  }
  return -1;
}

function pushText(out: Segment[], text: string) {
  if (!text) return;
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (i > 0) out.push({ kind: 'br' });
    // **bold** and *italic*
    const re = /\*\*(.+?)\*\*|\*(\S(?:[^*]*?\S)?)\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      if (m.index > last) out.push({ kind: 'text', text: line.slice(last, m.index) });
      if (m[1] !== undefined) out.push({ kind: 'text', text: m[1], bold: true });
      else out.push({ kind: 'text', text: m[2], italic: true });
      last = m.index + m[0].length;
    }
    if (last < line.length) out.push({ kind: 'text', text: line.slice(last) });
  });
}

export function parseRich(input: string): Segment[] {
  const out: Segment[] = [];
  let buf = '';
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === '\\' && input[i + 1] === '$') {
      buf += '$';
      i += 2;
      continue;
    }
    if (ch === '$') {
      const display = input[i + 1] === '$';
      const delim = display ? '$$' : '$';
      const start = i + delim.length;
      const end = findClosing(input, start, delim);
      if (end === -1) {
        buf += input.slice(i);
        break;
      }
      pushText(out, buf);
      buf = '';
      out.push({ kind: 'math', tex: input.slice(start, end).trim(), display });
      i = end + delim.length;
      // swallow a single newline right after display math (the block already breaks the line)
      if (display && input[i] === '\n') i++;
      continue;
    }
    buf += ch;
    i++;
  }
  pushText(out, buf);
  return out;
}

/** All LaTeX snippets in a text (used by the data validator). */
export function mathSnippets(input: string): { tex: string; display: boolean }[] {
  return parseRich(input).flatMap((s) => (s.kind === 'math' ? [{ tex: s.tex, display: s.display }] : []));
}
