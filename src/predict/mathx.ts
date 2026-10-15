// Symbolic and numeric maths for the question generators, on top of mathjs (only the parts we use are bundled).
import {
  absDependencies,
  addDependencies,
  cbrtDependencies,
  cosDependencies,
  create,
  derivativeDependencies,
  divideDependencies,
  eDependencies,
  evaluateDependencies,
  expDependencies,
  log10Dependencies,
  logDependencies,
  multiplyDependencies,
  parseDependencies,
  piDependencies,
  powDependencies,
  simplifyDependencies,
  sinDependencies,
  sqrtDependencies,
  subtractDependencies,
  tanDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
} from 'mathjs';

export const M = create({
  parseDependencies,
  derivativeDependencies,
  simplifyDependencies,
  evaluateDependencies,
  addDependencies,
  subtractDependencies,
  multiplyDependencies,
  divideDependencies,
  powDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
  expDependencies,
  logDependencies,
  log10Dependencies,
  sqrtDependencies,
  cbrtDependencies,
  absDependencies,
  sinDependencies,
  cosDependencies,
  tanDependencies,
  eDependencies,
  piDependencies,
});

/** d/dv of an expression, as a mathjs expression string (mathjs simplifies the result). */
export function diff(expr: string, v = 'x'): string {
  return M.derivative(expr, v).toString();
}

/** Evaluate an expression string, e.g. evalAt('x^2 + y', { x: 3, y: 1 }) = 10. */
export function evalAt(expr: string, scope: Record<string, number>): number {
  const v = M.evaluate(expr, { ...scope });
  if (typeof v !== 'number') throw new Error(`"${expr}" did not evaluate to a number`);
  return v;
}

/** An expression string as a JS function of one variable. */
export function fn(expr: string, v = 'x'): (x: number) => number {
  const code = M.parse(expr).compile();
  return (x: number) => code.evaluate({ [v]: x }) as number;
}

/** LaTeX for an expression string (mathjs' own rendering; fine for worked solutions). */
export function tex(expr: string): string {
  return M.parse(expr).toTex({ parenthesis: 'auto', implicit: 'hide' });
}

/** Simplify an expression string. */
export function simplify(expr: string): string {
  return M.simplify(expr).toString();
}

/** Central-difference derivative: an independent check on symbolic derivatives. */
export function numDiff(f: (x: number) => number, x: number, h = 1e-5): number {
  return (f(x + h) - f(x - h)) / (2 * h);
}

/** Second derivative by central differences. */
export function numDiff2(f: (x: number) => number, x: number, h = 1e-4): number {
  return (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
}

/** Partial derivatives of f(x, y) by central differences. */
export function numPartial(f: (x: number, y: number) => number, x: number, y: number, v: 'x' | 'y', h = 1e-5): number {
  return v === 'x' ? (f(x + h, y) - f(x - h, y)) / (2 * h) : (f(x, y + h) - f(x, y - h)) / (2 * h);
}

/** All roots of f in [a, b], found by scanning n sub-intervals for sign changes and bisecting. */
export function roots(f: (x: number) => number, a: number, b: number, n = 2000): number[] {
  const out: number[] = [];
  const dx = (b - a) / n;
  let x0 = a;
  let f0 = f(x0);
  for (let i = 1; i <= n; i++) {
    const x1 = a + i * dx;
    const f1 = f(x1);
    if (Number.isFinite(f0) && Number.isFinite(f1)) {
      if (f0 === 0) out.push(x0);
      else if (f0 * f1 < 0) {
        let lo = x0;
        let hi = x1;
        let flo = f0;
        for (let k = 0; k < 100; k++) {
          const mid = (lo + hi) / 2;
          const fm = f(mid);
          if (flo * fm <= 0) hi = mid;
          else {
            lo = mid;
            flo = fm;
          }
        }
        out.push((lo + hi) / 2);
      }
    }
    x0 = x1;
    f0 = f1;
  }
  if (f(b) === 0) out.push(b);
  return out.filter((r, i) => i === 0 || Math.abs(r - out[i - 1]) > 1e-9);
}

/** Greatest common divisor of integers. */
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** A fraction p/q in lowest terms as LaTeX (integers stay integers), e.g. frac(6, 4) = "\frac{3}{2}". */
export function frac(p: number, q: number): string {
  if (q === 0) throw new Error('division by zero');
  const g = gcd(p, q) || 1;
  let n = p / g;
  let d = q / g;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  if (d === 1) return String(n);
  return `${n < 0 ? '-' : ''}\\frac{${Math.abs(n)}}{${d}}`;
}
