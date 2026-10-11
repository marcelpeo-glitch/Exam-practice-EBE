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
      // Scientific notation uses an uppercase E (the ×10ˣ key); a lowercase e is Euler's number.
      const m = /^(\d+\.?\d*|\.\d+)(E[-+]?\d+)?/.exec(s.slice(i));
      if (!m) throw new Error('Syntax error');
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
      if (s[i] === '.') throw new Error('Syntax error'); // e.g. 1.2.3
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
    if (c === 'E') throw new Error('Syntax error'); // ×10ˣ without a number in front of it
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
        const nv = t.v === '+' ? v + r : v - r;
        // Only snap rounding noise of a few ulps; genuine small differences (1E14+1−1E14 = 1) stay.
        v = Math.abs(nv) < 4 * Number.EPSILON * Math.max(Math.abs(v), Math.abs(r)) ? 0 : nv;
      } else return v;
    }
  }
  // term := implicit (('*'|'/'|implicit-before-number-or-bracket) implicit)*
  function parseTerm(): number {
    let v = parseImplicit();
    for (;;) {
      const t = peek();
      if (t?.t === 'op' && (t.v === '*' || t.v === '/')) {
        p++;
        const r = parseImplicit();
        if (t.v === '/' && r === 0) throw new Error('Math error');
        v = t.v === '*' ? v * r : v / r;
      } else if (startsPrimary(t)) {
        v = v * parseImplicit();
      } else return v;
    }
  }
  // implicit := unary (unary starting with a constant or function)*
  // Like a Casio, multiplication with an omitted sign before π, e, Ans or a function binds tighter
  // than × and ÷, so 1÷2π = 1/(2π) and 1÷2sin(30) = 1.
  function parseImplicit(): number {
    let v = parseUnary();
    while (peek()?.t === 'const' || peek()?.t === 'fn') v = v * parseUnary();
    return v;
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
        case 'cos':
        case 'tan':
          return trig(t.v as 'sin' | 'cos' | 'tan', arg);
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
  // Exact values at multiples of 90° and no floating-point noise such as cos(90°) = 6.1E−17;
  // tan(90°) is a Math error, like on a Casio.
  function trig(fn: 'sin' | 'cos' | 'tan', arg: number): number {
    if (angle === 'deg' && Number.isFinite(arg) && arg % 90 === 0) {
      const k = (((arg / 90) % 4) + 4) % 4;
      if (fn === 'sin') return [0, 1, 0, -1][k];
      if (fn === 'cos') return [1, 0, -1, 0][k];
      if (k % 2 === 1) throw new Error('Math error');
      return 0;
    }
    const x = toRad(arg);
    const snap = (y: number) => (Math.abs(x) >= 1 && Math.abs(y) < 1e-15 * Math.abs(x) ? 0 : y);
    const sin = snap(Math.sin(x));
    const cos = snap(Math.cos(x));
    if (fn === 'sin') return sin;
    if (fn === 'cos') return cos;
    if (cos === 0) throw new Error('Math error');
    return sin === 0 ? 0 : Math.tan(x);
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
