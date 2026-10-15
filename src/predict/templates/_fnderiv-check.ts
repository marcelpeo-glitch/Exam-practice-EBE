// Test support for the "Functions & domains", "Inverse functions" and "Derivatives" checks (no TEMPLATES export).
// An independent evaluator for the LaTeX that students see: it reads the printed formulas (stems and options) with
// plain JavaScript Math (no mathjs), so the tests check what is shown, not the expressions the templates used.

export type Env = Record<string, number>;
type Ev = (env: Env) => number;

type Tok = { k: 'num'; v: number } | { k: 'var'; v: string } | { k: 'op'; v: string } | { k: 'cmd'; v: string };

const SKIP = new Set(['left', 'right', 'displaystyle', 'quad', 'qquad', 'big', 'Big']);
const CMD: Record<string, Tok> = {
  frac: { k: 'cmd', v: 'frac' },
  dfrac: { k: 'cmd', v: 'frac' },
  tfrac: { k: 'cmd', v: 'frac' },
  sqrt: { k: 'cmd', v: 'sqrt' },
  ln: { k: 'cmd', v: 'ln' },
  cdot: { k: 'op', v: '*' },
  times: { k: 'op', v: '*' },
  infty: { k: 'num', v: Infinity },
  pi: { k: 'num', v: Math.PI },
  ge: { k: 'op', v: '>=' },
  geq: { k: 'op', v: '>=' },
  le: { k: 'op', v: '<=' },
  leq: { k: 'op', v: '<=' },
  ne: { k: 'op', v: '!=' },
  neq: { k: 'op', v: '!=' },
  cup: { k: 'op', v: 'cup' },
};

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) i++;
    else if (ch === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i))!;
      i += m[0].length;
      const name = m[1];
      if (SKIP.has(name) || name === ',' || name === ';' || name === '!' || name === ' ') continue;
      const t = CMD[name];
      if (!t) throw new Error(`unknown LaTeX command \\${name} in ${s}`);
      out.push(t);
    } else if (/[0-9.]/.test(ch)) {
      const m = /^[0-9]*\.?[0-9]+/.exec(s.slice(i))!;
      out.push({ k: 'num', v: Number(m[0]) });
      i += m[0].length;
    } else if (/[a-zA-Z]/.test(ch)) {
      out.push(ch === 'e' ? { k: 'num', v: Math.E } : { k: 'var', v: ch });
      i++;
    } else {
      out.push({ k: 'op', v: ch });
      i++;
    }
  }
  return out;
}

// Strict real semantics: ln(0) and a division by zero are undefined (NaN), not ±Infinity that could later become 0.
const div = (a: number, b: number) => (b === 0 ? NaN : a / b);

class Parser {
  i = 0;
  constructor(private t: Tok[]) {}
  peek(): Tok | undefined {
    return this.t[this.i];
  }
  isOp(v: string) {
    const p = this.peek();
    return !!p && p.k === 'op' && p.v === v;
  }
  eat(v: string) {
    if (!this.isOp(v)) throw new Error(`expected "${v}" at token ${this.i}: ${JSON.stringify(this.peek())}`);
    this.i++;
  }
  done() {
    return this.i >= this.t.length;
  }
  expr(): Ev {
    let left = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.t[this.i++] as { v: string }).v;
      const a = left;
      const b = this.term();
      left = op === '+' ? (e) => a(e) + b(e) : (e) => a(e) - b(e);
    }
    return left;
  }
  startsAtom() {
    const p = this.peek();
    if (!p) return false;
    if (p.k === 'num' || p.k === 'var') return true;
    if (p.k === 'cmd') return true;
    return p.k === 'op' && (p.v === '(' || p.v === '{');
  }
  term(): Ev {
    let left = this.unary();
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = (this.t[this.i++] as { v: string }).v;
        const a = left;
        const b = this.unary();
        left = op === '*' ? (e) => a(e) * b(e) : (e) => div(a(e), b(e));
      } else if (this.startsAtom()) {
        const a = left;
        const b = this.power();
        left = (e) => a(e) * b(e);
      } else return left;
    }
  }
  unary(): Ev {
    if (this.isOp('-')) {
      this.i++;
      const a = this.unary();
      return (e) => -a(e);
    }
    if (this.isOp('+')) {
      this.i++;
      return this.unary();
    }
    return this.power();
  }
  power(): Ev {
    const base = this.atom();
    if (this.isOp('^')) {
      this.i++;
      let ex: Ev;
      if (this.isOp('{')) ex = this.group();
      else {
        const p = this.t[this.i++];
        if (p.k === 'num') {
          // a single digit after ^ (x^23 is not used by the templates)
          const v = p.v;
          ex = () => v;
        } else if (p.k === 'var') {
          const n = p.v;
          ex = (e) => e[n];
        } else throw new Error('bad exponent');
      }
      return (e) => Math.pow(base(e), ex(e));
    }
    return base;
  }
  group(): Ev {
    this.eat('{');
    const a = this.expr();
    this.eat('}');
    return a;
  }
  atom(): Ev {
    const p = this.t[this.i++];
    if (!p) throw new Error('unexpected end');
    if (p.k === 'num') {
      const v = p.v;
      return () => v;
    }
    if (p.k === 'var') {
      const n = p.v;
      return (e) => {
        if (!(n in e)) throw new Error(`variable ${n} not given`);
        return e[n];
      };
    }
    if (p.k === 'cmd') {
      if (p.v === 'frac') {
        const a = this.group();
        const b = this.group();
        return (e) => div(a(e), b(e));
      }
      if (p.v === 'sqrt') {
        const a = this.group();
        return (e) => Math.sqrt(a(e));
      }
      if (p.v === 'ln') {
        const a = this.power();
        return (e) => {
          const v = a(e);
          return v > 0 ? Math.log(v) : NaN;
        };
      }
    }
    if (p.k === 'op' && p.v === '(') {
      const a = this.expr();
      this.eat(')');
      return a;
    }
    if (p.k === 'op' && p.v === '{') {
      this.i--;
      return this.group();
    }
    throw new Error(`unexpected token ${JSON.stringify(p)}`);
  }
}

/** A LaTeX expression as a function of named variables (e.g. texFn('\\dfrac{2x}{x^2+1}')({ x: 1 }) = 1). */
export function texFn(tex: string): Ev {
  const p = new Parser(tokenize(tex));
  const f = p.expr();
  if (!p.done()) throw new Error(`could not parse all of: ${tex}`);
  return f;
}

/** A LaTeX expression as a function of one variable. */
export function texFn1(tex: string, v = 'x'): (x: number) => number {
  const f = texFn(tex);
  return (x) => f({ [v]: x });
}

/** The part after the last top-level "=" (drops labels such as "f'(x)=" or "y="). */
export function rhs(tex: string): string {
  const k = tex.lastIndexOf('=');
  return k === -1 ? tex : tex.slice(k + 1);
}

/** Contents of $$display$$ maths in a text. */
export const displayMath = (s: string) => [...s.matchAll(/\$\$([\s\S]+?)\$\$/g)].map((m) => m[1]);
/** Contents of $inline$ maths (display maths removed first). */
export const inlineMath = (s: string) => [...s.replace(/\$\$[\s\S]+?\$\$/g, ' ').matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
/** The single inline formula of an option text. */
export const optionTex = (text: string) => {
  const m = inlineMath(text);
  if (m.length !== 1) throw new Error(`expected one formula in option ${text}`);
  return m[0];
};

/** "Defined" for the checks: a finite, not astronomically large value (a pole evaluated in floating point). */
export const defined = (y: number) => Number.isFinite(y) && Math.abs(y) < 1e8;

// ---------- sets and conditions ----------

export interface Iv {
  lo: number;
  hi: number;
  lc: boolean;
  hc: boolean;
}

/** Parses "(-\\infty,-3)\\cup[2,e^{4})" into intervals. */
export function parseSet(tex: string): Iv[] {
  return tex.split('\\cup').map((piece) => {
    const s = piece.trim();
    const lc = s[0] === '[';
    const hc = s[s.length - 1] === ']';
    if (!'(['.includes(s[0]) || !')]'.includes(s[s.length - 1])) throw new Error(`not an interval: ${s}`);
    const inner = s.slice(1, -1);
    let depth = 0;
    let cut = -1;
    for (let i = 0; i < inner.length; i++) {
      if ('({['.includes(inner[i])) depth++;
      else if (')}]'.includes(inner[i])) depth--;
      else if (inner[i] === ',' && depth === 0) cut = i;
    }
    if (cut < 0) throw new Error(`no comma in interval ${s}`);
    return { lo: texFn(inner.slice(0, cut))({}), hi: texFn(inner.slice(cut + 1))({}), lc, hc };
  });
}

export const inIvs = (s: readonly Iv[], x: number) => s.some((i) => (x > i.lo || (i.lc && x === i.lo)) && (x < i.hi || (i.hc && x === i.hi)));

/** A (chained) relation such as "2x\\le y<2x+9" or "y\\ne x+4" as a predicate. */
export function texRelation(tex: string): (env: Env) => boolean {
  const toks = tex.replace(/\\(ge|geq|le|leq|ne|neq)(?![a-zA-Z])/g, (_m, r: string) => ({ ge: '>=', geq: '>=', le: '<=', leq: '<=', ne: '!=', neq: '!=' })[r]!);
  const parts = toks.split(/(>=|<=|!=|<|>|=)/);
  const exprs = parts.filter((_, i) => i % 2 === 0).map((p) => texFn(p));
  const ops = parts.filter((_, i) => i % 2 === 1);
  if (!ops.length) throw new Error(`no relation in ${tex}`);
  return (env) =>
    ops.every((op, i) => {
      const a = exprs[i](env);
      const b = exprs[i + 1](env);
      return op === '>=' ? a >= b - 1e-12 : op === '<=' ? a <= b + 1e-12 : op === '<' ? a < b - 1e-12 : op === '>' ? a > b + 1e-12 : op === '!=' ? Math.abs(a - b) > 1e-12 : Math.abs(a - b) <= 1e-12;
    });
}

/** An option such as "$y\\ge 2x$ and $y\\ne 2x+9$": every formula in it must hold. */
export function conditions(text: string): (env: Env) => boolean {
  const rels = inlineMath(text).map(texRelation);
  return (env) => rels.every((r) => r(env));
}

// ---------- small numerics ----------

/** Root of f in [a, b] by bisection (f(a), f(b) of opposite sign). */
export function bisect(f: (x: number) => number, a: number, b: number): number {
  let fa = f(a);
  for (let k = 0; k < 200; k++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fa * fm <= 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/** Number of a (possibly signed, decimal) number in a text. */
export const numberIn = (s: string) => Number(/-?\d+(\.\d+)?/.exec(s.replace(/\\,/g, ''))![0]);
