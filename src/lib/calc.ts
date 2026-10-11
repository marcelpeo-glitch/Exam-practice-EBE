// Safe expression evaluator for the built-in scientific calculator (no eval).
// Supports + - × ÷ * / ^ !, parentheses, implicit multiplication (2π, 3(4), 2sin(30)),
// scientific notation (1.2E3), constants π, e, Ans, and functions
// sin cos tan asin acos atan ln log sqrt √ exp abs.

export type AngleMode = 'deg' | 'rad';

type Tok =
  | { t: 'num'; v: number }
  | { t: 'op'; v: string }
  | { t: 'fn'; v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'const'; v: string };

const FUNCS = ['asin', 'acos', 'atan', 'sqrt', 'sin', 'cos', 'tan', 'log', 'exp', 'abs', 'ln'];

function tokenize(src: string): Tok[] {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(E[-+]?\d+)?/i.exec(s.slice(i));
      if (!m) throw new Error('Syntax error');
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if ('+-*/^!'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '(') {
      out.push({ t: 'lp' });
      i++;
      continue;
    }
    if (c === ')') {
      out.push({ t: 'rp' });
      i++;
      continue;
    }
    if (c === '√') {
      out.push({ t: 'fn', v: 'sqrt' });
      i++;
      continue;
    }
    if (c === 'π') {
      out.push({ t: 'const', v: 'pi' });
      i++;
      continue;
    }
    const rest = s.slice(i).toLowerCase();
    const fn = FUNCS.find((f) => rest.startsWith(f));
    if (fn) {
      out.push({ t: 'fn', v: fn });
      i += fn.length;
      continue;
    }
    if (rest.startsWith('ans')) {
      out.push({ t: 'const', v: 'ans' });
      i += 3;
      continue;
    }
    if (rest.startsWith('pi')) {
      out.push({ t: 'const', v: 'pi' });
      i += 2;
      continue;
    }
    if (rest[0] === 'e') {
      out.push({ t: 'const', v: 'e' });
      i += 1;
      continue;
    }
    throw new Error('Syntax error');
  }
  return out;
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new Error('Math error');
  if (n > 170) return Infinity;
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}

export function evaluate(expr: string, opts: { ans?: number; angle?: AngleMode } = {}): number {
  const toks = tokenize(expr);
  const angle = opts.angle ?? 'deg';
  const toRad = (x: number) => (angle === 'deg' ? (x * Math.PI) / 180 : x);
  const fromRad = (x: number) => (angle === 'deg' ? (x * 180) / Math.PI : x);
  let p = 0;
  const peek = () => toks[p];
  const startsPrimary = (t: Tok | undefined) => !!t && (t.t === 'num' || t.t === 'lp' || t.t === 'fn' || t.t === 'const');

  // expr := term (('+'|'-') term)*
  function parseExpr(): number {
    let v = parseTerm();
    for (;;) {
      const t = peek();
      if (t?.t === 'op' && (t.v === '+' || t.v === '-')) {
        p++;
        const r = parseTerm();
        v = t.v === '+' ? v + r : v - r;
      } else return v;
    }
  }
  // term := unary (('*'|'/'|implicit) unary)*
  function parseTerm(): number {
    let v = parseUnary();
    for (;;) {
      const t = peek();
      if (t?.t === 'op' && (t.v === '*' || t.v === '/')) {
        p++;
        const r = parseUnary();
        if (t.v === '/' && r === 0) throw new Error('Math error');
        v = t.v === '*' ? v * r : v / r;
      } else if (startsPrimary(t)) {
        v = v * parseUnary();
      } else return v;
    }
  }
  // unary := ('-'|'+') unary | power
  function parseUnary(): number {
    const t = peek();
    if (t?.t === 'op' && (t.v === '-' || t.v === '+')) {
      p++;
      const v = parseUnary();
      return t.v === '-' ? -v : v;
    }
    return parsePower();
  }
  // power := postfix ('^' unary)?   (right-associative)
  function parsePower(): number {
    const base = parsePostfix();
    const t = peek();
    if (t?.t === 'op' && t.v === '^') {
      p++;
      return Math.pow(base, parseUnary());
    }
    return base;
  }
  function parsePostfix(): number {
    let v = parsePrimary();
    while (peek()?.t === 'op' && (peek() as { v: string }).v === '!') {
      p++;
      v = factorial(v);
    }
    return v;
  }
  function parsePrimary(): number {
    const t = toks[p++];
    if (!t) throw new Error('Syntax error');
    if (t.t === 'num') return t.v;
    if (t.t === 'const') return t.v === 'pi' ? Math.PI : t.v === 'e' ? Math.E : opts.ans ?? 0;
    if (t.t === 'lp') {
      const v = parseExpr();
      if (peek()?.t === 'rp') p++; // tolerate a missing closing bracket at the end, like a Casio
      else if (p < toks.length) throw new Error('Syntax error');
      return v;
    }
    if (t.t === 'fn') {
      const arg = parseUnaryForFn();
      switch (t.v) {
        case 'sin':
          return Math.sin(toRad(arg));
        case 'cos':
          return Math.cos(toRad(arg));
        case 'tan':
          return Math.tan(toRad(arg));
        case 'asin':
          return fromRad(Math.asin(arg));
        case 'acos':
          return fromRad(Math.acos(arg));
        case 'atan':
          return fromRad(Math.atan(arg));
        case 'ln':
          if (arg <= 0) throw new Error('Math error');
          return Math.log(arg);
        case 'log':
          if (arg <= 0) throw new Error('Math error');
          return Math.log10(arg);
        case 'sqrt':
          if (arg < 0) throw new Error('Math error');
          return Math.sqrt(arg);
        case 'exp':
          return Math.exp(arg);
        case 'abs':
          return Math.abs(arg);
      }
    }
    throw new Error('Syntax error');
  }
  // Function argument: a bracketed expression or a single number/constant (sin30, √2), so that
  // sin(30)^2 means (sin 30)^2 like on a Casio.
  function parseUnaryForFn(): number {
    const t = peek();
    if (t?.t === 'op' && (t.v === '-' || t.v === '+')) {
      p++;
      const v = parseUnaryForFn();
      return t.v === '-' ? -v : v;
    }
    return parsePostfix();
  }

  if (toks.length === 0) throw new Error('Syntax error');
  const v = parseExpr();
  if (p !== toks.length) throw new Error('Syntax error');
  if (Number.isNaN(v)) throw new Error('Math error');
  return v;
}

export function formatResult(v: number): string {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : v < 0 ? '−∞' : 'Math error';
  if (v === 0) return '0';
  const abs = Math.abs(v);
  if (abs >= 1e10 || abs < 1e-9) {
    const [mant, exp] = v.toExponential(8).split('e');
    return `${String(Number(mant))}E${Number(exp)}`;
  }
  return String(Number(v.toPrecision(10)));
}
