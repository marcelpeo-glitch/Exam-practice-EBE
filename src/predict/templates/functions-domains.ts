// Templates for the topic "Functions & domains" (QM1 past exams: ln of a quadratic, a root of a quotient, 1/(c+ln x),
// x²/(x²+1), and once a function of two variables). Every key is a set built from the zeros/poles found in code and is
// checked against where the function is actually defined (assertDomain); wrong options come from modelled mistakes.
// See functions-domains.test.ts for the independent checks.
import { buildMcq, buildMulti, INSTRUCTION, mistakesNote, num, numericField } from '../build';
import { evalAt } from '../mathx';
import type { Rng } from '../rng';
import type { Template } from '../types';
import { assertDomain, coef, iv, lin, linE, realFn, setMcq, setTex, termsExpr, termsTex, type Interval, type SetChoice } from './_fnderiv';

const pickName = (rng: Rng) => rng.pick(['g', 'h', 'k', 'r'] as const);

/** Two integer zeros p < q, both non-zero, not opposite, at least 3 apart. */
function twoZeros(rng: Rng): [number, number] {
  for (;;) {
    const p = rng.int(-6, 3);
    const q = p + rng.int(3, 6);
    if (p !== 0 && q !== 0 && p + q !== 0) return [p, q];
  }
}

// =====================================================================================================================
// 1. ln / √ of a quadratic
// =====================================================================================================================

type QKind = 'ln-out' | 'ln-in' | 'ln-roots' | 'sqrt-roots' | 'sqrt-in' | 'recip-sqrt' | 'ln-pos';

const quadratic: Template = {
  id: 'functions-domains.quadratic-inside',
  topic: 'Functions & domains',
  title: 'Domain of ln, √ or 1/√ of a quadratic (zeros, sign of a parabola, open vs closed end points)',
  types: ['single-choice', 'multi-select'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const kinds: QKind[] = ['ln-out', 'ln-in', 'ln-roots', 'sqrt-roots', 'sqrt-in', 'recip-sqrt', ...(type === 'single-choice' ? (['ln-pos'] as QKind[]) : [])];
    const kind = rng.pick(kinds);
    const name = pickName(rng);
    const a = rng.pick([1, 1, 1, 2, 3]);
    let p: number;
    let q: number;
    let k = 0;
    let h = 0;
    let s = 0;
    let argTex: string;
    let argExpr: string;
    let factorTex = '';
    if (kind === 'ln-out' || kind === 'ln-in') {
      k = rng.int(2, 7);
      [p, q] = [-k, k];
      const t: [number, string][] = kind === 'ln-out' ? [[a, 'x^2'], [-a * k * k, '']] : [[a * k * k, ''], [-a, 'x^2']];
      argTex = termsTex(t);
      argExpr = termsExpr(t);
    } else if (kind === 'ln-pos') {
      h = rng.sign() * rng.int(1, 4);
      s = rng.int(1, 3);
      [p, q] = [h - s, h + s];
      const t: [number, string][] = [[1, 'x^2'], [-2 * h, 'x'], [h * h + s * s, '']];
      argTex = termsTex(t);
      argExpr = termsExpr(t);
    } else {
      [p, q] = twoZeros(rng);
      const sg = kind === 'sqrt-in' ? -1 : 1;
      const t: [number, string][] = [[sg * a, 'x^2'], [-sg * a * (p + q), 'x'], [sg * a * p * q, '']];
      argTex = termsTex(t);
      argExpr = termsExpr(t);
      factorTex = `${kind === 'sqrt-in' ? `-${a === 1 ? '' : a}` : a === 1 ? '' : a}\\left(${lin(1, -p)}\\right)\\left(${lin(1, -q)}\\right)`;
    }
    const numer = rng.pick(['1', 'x', `${rng.int(2, 9)}`]);
    const outer = kind.startsWith('ln') ? 'ln' : kind === 'recip-sqrt' ? 'recip' : 'sqrt';
    const fTex = outer === 'ln' ? `\\ln\\left(${argTex}\\right)` : outer === 'sqrt' ? `\\sqrt{${argTex}}` : `\\dfrac{${numer}}{\\sqrt{${argTex}}}`;
    const fExpr = outer === 'ln' ? `log(${argExpr})` : outer === 'sqrt' ? `sqrt(${argExpr})` : `(${numer})/sqrt(${argExpr})`;

    // The key, from the zeros of the argument and the type of condition (>0 for ln and 1/√, ≥0 for √).
    const strict = outer !== 'sqrt';
    const outside = kind === 'ln-out' || kind === 'ln-roots' || kind === 'sqrt-roots' || kind === 'recip-sqrt';
    const key: Interval[] =
      kind === 'ln-pos' ? [iv(null, null)] : outside ? [iv(null, p, false, !strict), iv(q, null, !strict, false)] : [iv(p, q, !strict, !strict)];
    assertDomain(realFn(fExpr), key);

    const cond = outer === 'ln' ? `${argTex}>0` : outer === 'sqrt' ? `${argTex}\\ge 0` : `${argTex}>0`;
    const why0 =
      outer === 'ln'
        ? 'A logarithm is only defined for a strictly positive argument, so we need'
        : outer === 'sqrt'
          ? 'A square root is only defined for a non-negative argument, so we need'
          : 'The square root needs a non-negative argument and the denominator must not be zero, so the argument must be strictly positive:';
    let solve: string;
    if (kind === 'ln-out') solve = `This means $x^2>${k * k}$, i.e. $x<-${k}$ or $x>${k}$.`;
    else if (kind === 'ln-in') solve = `This means $x^2<${k * k}$, i.e. $-${k}<x<${k}$.`;
    else if (kind === 'ln-pos')
      solve = `Complete the square: $$${argTex}=\\left(${lin(1, -h)}\\right)^2+${s * s}\\ge ${s * s}>0$$ so the argument is positive for **every** real $x$ (the parabola has no zeros).`;
    else if (kind === 'sqrt-in')
      solve = `Factor: $${argTex}=${factorTex}$, a parabola that opens downwards with zeros $x=${p}$ and $x=${q}$. It is non-negative between the zeros, end points included: $${p}\\le x\\le ${q}$.`;
    else
      solve = `Factor: $${argTex}=${factorTex}$, a parabola that opens upwards with zeros $x=${p}$ and $x=${q}$. It is ${strict ? 'positive' : 'non-negative'} outside the zeros: $x${strict ? '<' : '\\le '}${p}$ or $x${strict ? '>' : '\\ge '}${q}$.`;
    const explanation = `${why0} $$${cond}$$\n${solve}\nHence the domain is $${setTex(key)}$.`;

    if (type === 'multi-select') {
      const cands = [...new Set([p - 2, p - 1, p, p + 0.5, p + 1, (p + q) / 2, q - 1, q - 0.5, q, q + 1, q + 3, 0])];
      const statements = cands.map((v) => {
        const arg = evalAt(argExpr, { x: v });
        const ok = key.some((i) => (v > i.lo || (i.lc && v === i.lo)) && (v < i.hi || (i.hc && v === i.hi)));
        const state = arg > 0 ? 'positive' : arg === 0 ? 'zero' : 'negative';
        const verdict =
          arg === 0
            ? outer === 'sqrt'
              ? '$\\sqrt{0}=0$ is defined, so it belongs to the domain.'
              : outer === 'ln'
                ? '$\\ln(0)$ is not defined.'
                : 'the denominator $\\sqrt{0}$ is zero.'
            : arg > 0
              ? 'so it belongs to the domain.'
              : 'so it does not belong to the domain.';
        return { text: `$x=${num(v)}$`, correct: ok, why: `the argument is $${num(arg)}$ (${state}); ${verdict}` };
      });
      const multi = buildMulti(rng, statements, optionCount);
      const stem = `Consider the function $$${name}(x)=${fTex}$$ Which of the following values of $x$ lie in the domain of $${name}$?`;
      const lines = multi.reasons.map((r) => `- **${r.id}** ${r.correct ? '(in the domain)' : '(not in the domain)'}: ${r.why}`);
      return { type, stem, instruction: INSTRUCTION.multi, options: multi.options, correctAnswer: multi.correctAnswer, explanation: `${explanation}\n\n**The options**\n${lines.join('\n')}` };
    }

    const d: SetChoice[] = [];
    if (kind === 'ln-pos') {
      d.push(
        { set: [iv(0, null)], why: 'a logarithm needs a positive *argument*, not a positive $x$.' },
        { set: [iv(null, h), iv(h, null)], why: `the argument is smallest at $x=${h}$, but its minimum value is $${s * s}>0$, so $x=${h}$ is allowed.` },
        { set: [iv(null, p), iv(q, null)], why: `sign error when completing the square: $\\left(${lin(1, -h)}\\right)^2-${s * s}$ would have zeros $${p}$ and $${q}$, but here it is $+${s * s}$.` },
        { set: [iv(h, null)], why: `keeps only the $x$-values where the argument is increasing.` },
        { set: [iv(p, q)], why: `sign error when completing the square, and then the wrong side of the zeros.` },
      );
    } else if (outside) {
      const zeroWhy = outer === 'ln' ? 'includes the zeros, but $\\ln(0)$ is not defined.' : outer === 'recip' ? 'includes the zeros, but there the denominator $\\sqrt{0}$ is zero.' : '';
      if (strict) d.push({ set: [iv(null, p, false, true), iv(q, null, true, false)], why: zeroWhy });
      else d.push({ set: [iv(null, p), iv(q, null)], why: 'excludes the zeros, but $\\sqrt{0}=0$ is defined.' });
      d.push(
        { set: [iv(p, q)], why: 'between the zeros the argument is negative: this is where the function is *not* defined (the inequality was solved the wrong way round).' },
        { set: [iv(q, null, !strict, false)], why: `keeps only the values to the right of the larger zero and forgets $x${strict ? '<' : '\\le '}${p}$.` },
        strict
          ? { set: [iv(p, q, true, true)], why: 'the complement of the correct set (the zeros themselves are not allowed either).' }
          : { set: [iv(p, q, true, true)], why: `solves $${argTex}\\le 0$ instead of $\\ge 0$: this is where the argument is negative or zero.` },
        { set: [iv(0, null)], why: `${outer === 'ln' ? 'a logarithm' : 'a square root'} puts a condition on its *argument*, not on $x$ itself.` },
        { set: [iv(null, null)], why: 'assumes the argument is always positive.' },
      );
      if (kind === 'ln-out') d.splice(1, 0, { set: [iv(null, -k * k), iv(k * k, null)], why: `forgets to take the square root: $x^2>${k * k}$ means $|x|>${k}$, not $|x|>${k * k}$.` });
    } else {
      // between the zeros: ln-in (open) or sqrt-in (closed)
      d.push(
        { set: [iv(null, p, false, !strict), iv(q, null, !strict, false)], why: 'outside the zeros the argument is negative: the inequality was solved the wrong way round.' },
        strict
          ? { set: [iv(p, q, true, true)], why: 'includes the end points, but there the argument is $0$ and $\\ln(0)$ is not defined.' }
          : { set: [iv(p, q)], why: 'excludes the end points, but $\\sqrt{0}=0$ is defined.' },
        // [0, q] is only a "forgot the negative x" mistake when p < 0; otherwise the mirror mistake of (−∞, q].
        p < 0
          ? { set: [iv(0, q, !strict, !strict)], why: 'forgets the negative values of $x$ (a condition on the argument, not on $x$).' }
          : { set: [iv(p, null, !strict, false)], why: `only uses the lower bound $x${strict ? '>' : '\\ge '}${p}$.` },
        { set: [iv(null, q, false, !strict)], why: `only uses the upper bound $x${strict ? '<' : '\\le '}${q}$.` },
        { set: [iv(null, null)], why: 'assumes the argument is always positive.' },
      );
      if (kind === 'ln-in') d.splice(1, 0, { set: [iv(-k * k, k * k)], why: `forgets to take the square root: $x^2<${k * k}$ means $|x|<${k}$.` });
    }
    const mcq = setMcq(rng, key, d, optionCount);
    const stem = rng.pick([
      `Determine the domain of the function $$${name}(x)=${fTex}$$`,
      `What is the largest set of real numbers on which $$${name}(x)=${fTex}$$ is defined?`,
      `Let $$${name}(x)=${fTex}$$ Which set is the (largest possible) domain of $${name}$?`,
    ]);
    return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
  },
};

// =====================================================================================================================
// 2. One excluded point: the denominator c + ln(ax), c + ln(x − h) or e^{ax} − k vanishes
// =====================================================================================================================

type EKind = 'ln' | 'shift' | 'exp';

const expTex = (e: number) => (e === 1 ? 'e' : `e^{${e}}`);

const excludedPoint: Template = {
  id: 'functions-domains.excluded-point',
  topic: 'Functions & domains',
  title: 'Domain of a quotient whose denominator contains ln or e^x (one excluded point, plus the log condition)',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const kind = rng.pick<EKind>(['ln', 'ln', 'shift', 'exp']);
    const name = pickName(rng);
    const m = rng.int(2, 9);
    const numer = rng.pick([['1', '1'], [`${m}`, `${m}`], ['x', 'x'], [lin(1, m), linE(1, m)]] as const);
    let fTex: string;
    let fExpr: string;
    let x0: number;
    let x0Tex: string;
    let key: Interval[];
    let d: SetChoice[];
    let explanation: string;
    let where: string;
    if (kind === 'ln') {
      const a = rng.pick([1, 1, 2, 3]);
      const c = rng.sign() * rng.int(1, 3);
      const axTex = a === 1 ? 'x' : `${a}x`;
      fTex = `\\dfrac{${numer[0]}}{\\ln(${axTex})${c > 0 ? '+' : '-'}${Math.abs(c)}}`;
      fExpr = `(${numer[1]})/(log(${a}*x) + (${c}))`;
      x0 = Math.exp(-c) / a;
      x0Tex = a === 1 ? expTex(-c) : `\\frac{${expTex(-c)}}{${a}}`;
      key = [iv(0, [x0, x0Tex]), iv([x0, x0Tex], null)];
      where = '$x>0$';
      explanation =
        `Two conditions. The logarithm needs a positive argument: $${axTex}>0$${a === 1 ? '' : ', so $x>0$'}. The denominator must not be zero: ` +
        `$$\\ln(${axTex})${c > 0 ? '+' : '-'}${Math.abs(c)}=0 \\iff \\ln(${axTex})=${-c} \\iff ${axTex}=${expTex(-c)}${a === 1 ? '' : ` \\iff x=\\frac{${expTex(-c)}}{${a}}`}$$` +
        `So $x=${x0Tex}\\approx ${num(x0, 3)}$ must be left out. The domain is $${setTex(key)}$.`;
      const xs = Math.exp(c) / a;
      const xsTex = a === 1 ? expTex(c) : `\\frac{${expTex(c)}}{${a}}`;
      d = [
        { set: [iv(0, null)], why: 'forgets that the denominator must not be zero.' },
        { set: [iv(0, [xs, xsTex]), iv([xs, xsTex], null)], why: `sign error: solves $\\ln(${axTex})=${c}$ instead of $${-c}$.` },
        { set: [iv(null, [x0, x0Tex]), iv([x0, x0Tex], null)], why: 'forgets that the logarithm needs $x>0$.' },
        { set: [iv([x0, x0Tex], null)], why: 'requires the denominator to be positive instead of non-zero.' },
        { set: [iv(0, [1 / a, a === 1 ? '1' : `\\frac{1}{${a}}`]), iv([1 / a, a === 1 ? '1' : `\\frac{1}{${a}}`], null)], why: `excludes the point where $\\ln(${axTex})=0$ instead of where the whole denominator is zero.` },
      ];
      if (a > 1) d.push({ set: [iv(0, [a * Math.exp(-c), `${a}${expTex(-c)}`]), iv([a * Math.exp(-c), `${a}${expTex(-c)}`], null)], why: `solves $${a}x=${expTex(-c)}$ as $x=${a}${expTex(-c)}$.` });
      if (a === 1 && c < 0) d.push({ set: [iv(0, -c), iv(-c, null)], why: `forgets to undo the logarithm: takes $x=${-c}$ instead of $x=${expTex(-c)}$.` });
    } else if (kind === 'shift') {
      const h = rng.sign() * rng.int(1, 5);
      const c = rng.sign() * rng.int(1, 3);
      fTex = `\\dfrac{${numer[0]}}{\\ln\\left(${lin(1, -h)}\\right)${c > 0 ? '+' : '-'}${Math.abs(c)}}`;
      fExpr = `(${numer[1]})/(log(x - (${h})) + (${c}))`;
      x0 = h + Math.exp(-c);
      x0Tex = `${h}+${expTex(-c)}`;
      key = [iv(h, [x0, x0Tex]), iv([x0, x0Tex], null)];
      where = `$x>${h}$`;
      explanation =
        `The logarithm needs $${lin(1, -h)}>0$, so $x>${h}$. The denominator must not be zero: ` +
        `$$\\ln\\left(${lin(1, -h)}\\right)=${-c} \\iff ${lin(1, -h)}=${expTex(-c)} \\iff x=${x0Tex}\\approx ${num(x0, 3)}$$\n` +
        `The domain is $${setTex(key)}$.`;
      const xs = h + Math.exp(c);
      const xsTex = `${h}+${expTex(c)}`;
      const xm = -h + Math.exp(-c);
      d = [
        { set: [iv(h, null)], why: 'forgets that the denominator must not be zero.' },
        { set: [iv(h, [xs, xsTex]), iv([xs, xsTex], null)], why: `sign error: solves $\\ln\\left(${lin(1, -h)}\\right)=${c}$ instead of $${-c}$.` },
        { set: [iv(0, [Math.exp(-c), expTex(-c)]), iv([Math.exp(-c), expTex(-c)], null)], why: `ignores the shift: treats $\\ln\\left(${lin(1, -h)}\\right)$ as $\\ln(x)$.` },
        { set: [iv([x0, x0Tex], null)], why: 'requires the denominator to be positive instead of non-zero.' },
        { set: [iv(-h, [xm, `${-h}+${expTex(-c)}`]), iv([xm, `${-h}+${expTex(-c)}`], null)], why: `sign error in the shift: $${lin(1, -h)}>0$ means $x>${h}$, not $x>${-h}$.` },
        { set: [iv(h, h + 1), iv(h + 1, null)], why: `excludes the point where $\\ln\\left(${lin(1, -h)}\\right)=0$ instead of where the whole denominator is zero.` },
      ];
    } else {
      const a = rng.pick([1, 1, 2, 3]);
      const kk = rng.pick([2, 3, 4, 5, 6, 7, 8, 10]);
      const eTex = a === 1 ? 'e^{x}' : `e^{${a}x}`;
      fTex = `\\dfrac{${numer[0]}}{${eTex}-${kk}}`;
      fExpr = `(${numer[1]})/(exp(${a}*x) - ${kk})`;
      x0 = Math.log(kk) / a;
      x0Tex = a === 1 ? `\\ln(${kk})` : `\\frac{\\ln(${kk})}{${a}}`;
      key = [iv(null, [x0, x0Tex]), iv([x0, x0Tex], null)];
      where = 'every real $x$';
      explanation =
        `The exponential function is defined for every $x$, so the only condition is that the denominator is not zero: ` +
        `$$${eTex}=${kk} \\iff ${a === 1 ? 'x' : `${a}x`}=\\ln(${kk})${a === 1 ? '' : ` \\iff x=\\frac{\\ln(${kk})}{${a}}`}\\approx ${num(x0, 3)}$$\n` +
        `The domain is $${setTex(key)}$.`;
      const kx = kk / a;
      const kxTex = a === 1 ? String(kk) : `\\frac{${kk}}{${a}}`;
      d = [
        { set: [iv(null, null)], why: 'forgets that the denominator must not be zero.' },
        { set: [iv(null, [kx, kxTex]), iv([kx, kxTex], null)], why: `forgets the logarithm: solves $${eTex}=${kk}$ as $${a === 1 ? 'x' : `${a}x`}=${kk}$.` },
        { set: [iv([x0, x0Tex], null)], why: 'requires the denominator to be positive instead of non-zero.' },
        { set: [iv(0, [x0, x0Tex]), iv([x0, x0Tex], null)], why: 'adds a condition $x>0$ that is not needed: $e^{x}$ is defined for every $x$.' },
        { set: [iv(null, [Math.exp(kk) / a, a === 1 ? `e^{${kk}}` : `\\frac{e^{${kk}}}{${a}}`]), iv([Math.exp(kk) / a, a === 1 ? `e^{${kk}}` : `\\frac{e^{${kk}}}{${a}}`], null)], why: 'takes the exponential of $' + kk + '$ instead of its logarithm.' },
      ];
      if (a > 1) d.push({ set: [iv(null, [Math.log(kk), `\\ln(${kk})`]), iv([Math.log(kk), `\\ln(${kk})`], null)], why: `forgets to divide by $${a}$.` });
    }
    assertDomain(realFn(fExpr), key);

    if (type === 'numeric') {
      const dp = x0 < 1 ? 3 : 2;
      const stem = `The function $$${name}(x)=${fTex}$$ is defined for ${where} except for exactly one value $x_0$. Calculate $x_0$.`;
      const f = numericField('x0', undefined, x0, dp);
      return { type, stem, instruction: INSTRUCTION.numeric(dp), correctAnswer: f.answer, tolerance: f.tolerance, explanation };
    }
    const mcq = setMcq(rng, key, rng.shuffle(d), optionCount);
    const stem = rng.pick([
      `Find the domain of $$${name}(x)=${fTex}$$`,
      `For which values of $x$ is the function $$${name}(x)=${fTex}$$ defined?`,
      `The largest possible domain of $$${name}(x)=${fTex}$$ is`,
    ]);
    return { type, stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
  },
};

// =====================================================================================================================
// 3. Root or log of a quotient (sign chart), or a root over a linear denominator
// =====================================================================================================================

type RKind = 'sqrt' | 'sqrt-neg' | 'ln' | 'split';

const rootQuotient: Template = {
  id: 'functions-domains.root-of-quotient',
  topic: 'Functions & domains',
  title: 'Domain of √((x−a)/(x−b)), ln((x−a)/(x−b)) or √(x−a)/(x−b): sign chart, zero included, pole excluded',
  types: ['single-choice'],
  difficulty: 2,
  generate({ rng, optionCount }) {
    const kind = rng.pick<RKind>(['sqrt', 'sqrt', 'sqrt-neg', 'ln', 'split']);
    const name = pickName(rng);
    let a: number;
    let b: number;
    for (;;) {
      a = rng.int(-5, 6);
      b = rng.int(-5, 6);
      if (Math.abs(a - b) >= 2 && (kind !== 'split' || b > a)) break;
    }
    const L = Math.min(a, b);
    const H = Math.max(a, b);
    const numT = kind === 'sqrt-neg' ? termsTex([[a, ''], [-1, 'x']]) : lin(1, -a);
    const numE = kind === 'sqrt-neg' ? termsExpr([[a, ''], [-1, 'x']]) : termsExpr([[1, 'x'], [-a, '']]);
    const denT = lin(1, -b);
    const denE = termsExpr([[1, 'x'], [-b, '']]);
    const fTex =
      kind === 'ln' ? `\\ln\\left(\\dfrac{${numT}}{${denT}}\\right)` : kind === 'split' ? `\\dfrac{\\sqrt{${numT}}}{${denT}}` : `\\sqrt{\\dfrac{${numT}}{${denT}}}`;
    const fExpr = kind === 'ln' ? `log((${numE})/(${denE}))` : kind === 'split' ? `sqrt(${numE})/(${denE})` : `sqrt((${numE})/(${denE}))`;

    let key: Interval[];
    let d: SetChoice[];
    let explanation: string;
    const chart = `The numerator is zero at $x=${a}$ and the denominator at $x=${b}$; these split the line into three parts.`;
    if (kind === 'sqrt') {
      key = a < b ? [iv(null, a, false, true), iv(b, null)] : [iv(null, b), iv(a, null, true, false)];
      explanation =
        `The root needs $$\\dfrac{${numT}}{${denT}}\\ge 0, \\qquad x\\ne ${b}.$$ ${chart} The quotient is positive when numerator and denominator have the same sign, ` +
        `i.e. for $x<${L}$ and for $x>${H}$; it is zero at $x=${a}$ (allowed, $\\sqrt{0}=0$) and undefined at $x=${b}$. Hence the domain is $${setTex(key)}$.`;
      d = [
        { set: a < b ? [iv(null, a, false, true), iv(b, null, true)] : [iv(null, b, false, true), iv(a, null, true)], why: `includes $x=${b}$, where the denominator is zero.` },
        { set: [iv(null, L), iv(H, null)], why: `excludes $x=${a}$, but there the quotient is $0$ and $\\sqrt{0}=0$ is defined.` },
        { set: a < b ? [iv(b, null)] : [iv(a, null, true)], why: `splits the root into $\\sqrt{${numT}}/\\sqrt{${denT}}$, which needs $x\\ge ${a}$ and $x>${b}$; but the quotient is also non-negative when both parts are negative.` },
        { set: a < b ? [iv(a, b, true, false)] : [iv(b, a, false, true)], why: 'reads the sign chart the wrong way round (this is where the quotient is $\\le 0$).' },
        { set: [iv(null, b), iv(b, null)], why: 'only excludes the zero of the denominator and forgets that the root needs a non-negative argument.' },
        { set: [iv(a, null, true)], why: 'only looks at the numerator.' },
      ];
    } else if (kind === 'sqrt-neg') {
      key = a < b ? [iv(a, b, true, false)] : [iv(b, a, false, true)];
      explanation =
        `The root needs $$\\dfrac{${numT}}{${denT}}\\ge 0, \\qquad x\\ne ${b}.$$ ${chart} The numerator $${numT}$ is positive for $x<${a}$, the denominator $${denT}$ is positive for $x>${b}$. ` +
        `The quotient is non-negative where they have the same sign, which is between $${L}$ and $${H}$; $x=${a}$ is allowed (quotient $0$) and $x=${b}$ is not. Hence the domain is $${setTex(key)}$.`;
      d = [
        { set: [iv(L, H, true, true)], why: `includes $x=${b}$, where the denominator is zero.` },
        { set: [iv(L, H)], why: `excludes $x=${a}$, but $\\sqrt{0}=0$ is defined.` },
        { set: a < b ? [iv(null, a, false, true), iv(b, null)] : [iv(null, b), iv(a, null, true)], why: `ignores the minus sign in $${numT}$ and so reads the sign chart the wrong way round.` },
        { set: [iv(null, a, false, true)], why: 'only looks at the numerator.' },
        { set: [iv(null, b), iv(b, null)], why: 'only excludes the zero of the denominator and forgets that the root needs a non-negative argument.' },
        { set: [iv(b, null)], why: 'only looks at the denominator.' },
      ];
    } else if (kind === 'ln') {
      key = [iv(null, L), iv(H, null)];
      explanation =
        `The logarithm needs $$\\dfrac{${numT}}{${denT}}>0.$$ ${chart} The quotient is positive when numerator and denominator have the same sign: for $x<${L}$ and for $x>${H}$ (both end points excluded: at $x=${a}$ the argument is $0$, at $x=${b}$ it does not exist). Hence the domain is $${setTex(key)}$.`;
      d = [
        { set: a < b ? [iv(null, a, false, true), iv(b, null)] : [iv(null, b), iv(a, null, true)], why: `includes $x=${a}$, but there the argument is $0$ and $\\ln(0)$ is not defined.` },
        { set: [iv(H, null)], why: `splits the logarithm into $\\ln(${numT})-\\ln(${denT})$, which needs both parts positive; but the quotient is also positive when both are negative.` },
        { set: [iv(L, H)], why: 'reads the sign chart the wrong way round (there the quotient is negative).' },
        { set: [iv(null, L, false, true), iv(H, null, true)], why: 'includes both end points.' },
        { set: [iv(null, b), iv(b, null)], why: 'only excludes the zero of the denominator.' },
        { set: [iv(0, null)], why: 'a logarithm puts a condition on its *argument*, not on $x$ itself.' },
      ];
    } else {
      key = [iv(a, b, true, false), iv(b, null)];
      explanation =
        `Two conditions: the root needs $${numT}\\ge 0$, so $x\\ge ${a}$, and the denominator must not be zero, so $x\\ne ${b}$. ` +
        `Since $${b}>${a}$, the point $x=${b}$ lies inside $[${a},\\infty)$ and has to be removed. Hence the domain is $${setTex(key)}$.`;
      d = [
        { set: [iv(a, null, true)], why: 'forgets that the denominator must not be zero.' },
        { set: [iv(a, b), iv(b, null)], why: `excludes $x=${a}$, but $\\sqrt{0}=0$ is fine (the denominator is then $${a - b}\\ne 0$).` },
        { set: [iv(null, b), iv(b, null)], why: 'forgets that the root needs a non-negative argument.' },
        { set: [iv(b, null)], why: 'requires the denominator to be positive as well.' },
        { set: [iv(a, b, true, false)], why: `stops at the zero of the denominator instead of only removing that single point.` },
        { set: [iv(a, null)], why: `excludes $x=${a}$ and forgets $x\\ne ${b}$.` },
      ];
    }
    assertDomain(realFn(fExpr), key);
    const mcq = setMcq(rng, key, rng.shuffle(d), optionCount);
    const stem = rng.pick([
      `Consider $$${name}(x)=${fTex}$$ On which set is $${name}$ defined (its largest possible domain)?`,
      `Determine the domain of $$${name}(x)=${fTex}$$`,
      `The function $$${name}(x)=${fTex}$$ has as its domain`,
    ]);
    return { type: 'single-choice', stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
  },
};

// =====================================================================================================================
// 4. Functions of two variables
// =====================================================================================================================

type Cond = { text: string; pred: (x: number, y: number) => boolean; why?: string };
type TKind = 'recip-root' | 'ln-root' | 'root-frac' | 'disk';

const twoVariables: Template = {
  id: 'functions-domains.two-variables',
  topic: 'Functions & domains',
  title: 'Domain of a function of two variables (root, log and denominator conditions combined)',
  types: ['single-choice'],
  difficulty: 3,
  generate({ rng, optionCount }) {
    const kind = rng.pick<TKind>(['recip-root', 'recip-root', 'ln-root', 'root-frac', 'disk']);
    const m = rng.sign() * rng.int(1, 3);
    const c = rng.int(2, 5);
    const c2 = c * c;
    const mx = `${coef(m)}x`;
    const ymx = termsTex([[1, 'y'], [-m, 'x']]);
    const ymxE = termsExpr([[1, 'y'], [-m, 'x']]);
    const L = (x: number) => m * x; // boundary y = mx
    let fTex: string;
    let fExpr: string;
    let key: Cond;
    let d: Cond[];
    let explanation: string;
    let probes: [number, number][];
    const xs = [-2, -1, 0, 1, 2, 3];
    if (kind === 'recip-root') {
      const numer = rng.pick(['1', 'x', 'x+y', '2']);
      const flip = rng.chance(0.5);
      fTex = flip ? `\\dfrac{${numer}}{\\sqrt{${ymx}}-${c}}` : `\\dfrac{${numer}}{${c}-\\sqrt{${ymx}}}`;
      fExpr = flip ? `(${numer})/(sqrt(${ymxE}) - ${c})` : `(${numer})/(${c} - sqrt(${ymxE}))`;
      key = { text: `$y\\ge ${mx}$ and $y\\ne ${lin(m, c2)}$`, pred: (x, y) => y >= L(x) && y !== L(x) + c2 };
      explanation =
        `The square root needs $${ymx}\\ge 0$, i.e. $y\\ge ${mx}$. The denominator must not be zero: $$\\sqrt{${ymx}}=${c} \\iff ${ymx}=${c2} \\iff y=${lin(m, c2)}.$$ ` +
        `So the domain is described by $y\\ge ${mx}$ and $y\\ne ${lin(m, c2)}$.`;
      d = [
        { text: `$y\\ge ${mx}$`, pred: (x, y) => y >= L(x), why: 'forgets that the denominator must not be zero.' },
        { text: `$y\\ne ${lin(m, c2)}$`, pred: (x, y) => y !== L(x) + c2, why: 'forgets that the square root needs a non-negative argument.' },
        { text: `$y\\ge ${mx}$ and $y\\ne ${lin(m, c)}$`, pred: (x, y) => y >= L(x) && y !== L(x) + c, why: `forgets to square: $\\sqrt{${ymx}}=${c}$ gives $${ymx}=${c2}$, not $${c}$.` },
        { text: `$y>${mx}$ and $y\\ne ${lin(m, c2)}$`, pred: (x, y) => y > L(x) && y !== L(x) + c2, why: `excludes $y=${mx}$, but there $\\sqrt{0}=0$ and the denominator is $${flip ? -c : c}\\ne 0$.` },
        { text: `$y\\le ${mx}$ and $y\\ne ${lin(m, c2)}$`, pred: (x, y) => y <= L(x) && y !== L(x) + c2, why: 'reverses the inequality of the root condition.' },
        { text: `$y\\ge ${mx}$ and $y\\ne ${lin(m, -c2)}$`, pred: (x, y) => y >= L(x) && y !== L(x) - c2, why: 'sign error when solving $\\sqrt{\\cdot}=' + c + '$.' },
      ];
      probes = xs.flatMap((x) => [-1, 0, 0.5, c, c2, c2 + 1].map((t): [number, number] => [x, L(x) + t]));
    } else if (kind === 'ln-root') {
      fTex = `\\ln\\left(${c}-\\sqrt{${ymx}}\\right)`;
      fExpr = `log(${c} - sqrt(${ymxE}))`;
      key = { text: `$${mx}\\le y<${lin(m, c2)}$`, pred: (x, y) => y >= L(x) && y < L(x) + c2 };
      explanation =
        `The square root needs $${ymx}\\ge 0$, i.e. $y\\ge ${mx}$. The logarithm needs a positive argument: $$${c}-\\sqrt{${ymx}}>0 \\iff \\sqrt{${ymx}}<${c} \\iff ${ymx}<${c2}.$$ ` +
        `Together: $${mx}\\le y<${lin(m, c2)}$.`;
      d = [
        { text: `$y<${lin(m, c2)}$`, pred: (x, y) => y < L(x) + c2, why: `forgets the root condition $y\\ge ${mx}$.` },
        { text: `$y\\ge ${mx}$`, pred: (x, y) => y >= L(x), why: 'forgets that the logarithm needs a positive argument.' },
        { text: `$${mx}<y<${lin(m, c2)}$`, pred: (x, y) => y > L(x) && y < L(x) + c2, why: `excludes $y=${mx}$, but there the argument is $${c}>0$.` },
        { text: `$${mx}\\le y<${lin(m, c)}$`, pred: (x, y) => y >= L(x) && y < L(x) + c, why: `forgets to square: $\\sqrt{${ymx}}<${c}$ means $${ymx}<${c2}$.` },
        { text: `$${mx}\\le y\\le ${lin(m, c2)}$`, pred: (x, y) => y >= L(x) && y <= L(x) + c2, why: `includes $y=${lin(m, c2)}$, where the argument is $0$ and $\\ln(0)$ is not defined.` },
        { text: `$y>${lin(m, c2)}$`, pred: (x, y) => y > L(x) + c2, why: 'reverses the inequality of the log condition.' },
      ];
      probes = xs.flatMap((x) => [-1, 0, 0.5, c, c2 - 0.5, c2, c2 + 1].map((t): [number, number] => [x, L(x) + t]));
    } else if (kind === 'root-frac') {
      const a = rng.int(1, 3);
      const k = rng.sign() * rng.int(1, 4);
      const ax2 = `${coef(a)}x^2`;
      fTex = `\\dfrac{\\sqrt{y-${ax2}}}{${lin(1, -k)}}`;
      fExpr = `sqrt(y - ${a}*x^2)/(x - (${k}))`;
      const P = (x: number) => a * x * x;
      key = { text: `$y\\ge ${ax2}$ and $x\\ne ${k}$`, pred: (x, y) => y >= P(x) && x !== k };
      explanation = `The square root needs $y-${ax2}\\ge 0$, i.e. $y\\ge ${ax2}$ (on or above the parabola). The denominator must not be zero: $x\\ne ${k}$. So the domain is $y\\ge ${ax2}$ and $x\\ne ${k}$.`;
      d = [
        { text: `$y\\ge ${ax2}$`, pred: (x, y) => y >= P(x), why: 'forgets that the denominator must not be zero.' },
        { text: `$y>${ax2}$ and $x\\ne ${k}$`, pred: (x, y) => y > P(x) && x !== k, why: 'excludes the parabola itself, but $\\sqrt{0}=0$ is defined.' },
        { text: `$y\\le ${ax2}$ and $x\\ne ${k}$`, pred: (x, y) => y <= P(x) && x !== k, why: 'reverses the inequality of the root condition.' },
        { text: `$x\\ne ${k}$`, pred: (x) => x !== k, why: 'forgets that the square root needs a non-negative argument.' },
        { text: `$y\\ge ${ax2}$ and $y\\ne ${k}$`, pred: (x, y) => y >= P(x) && y !== k, why: 'applies the denominator condition to the wrong variable.' },
        { text: `$y\\ge ${ax2}$ and $x\\ne ${-k}$`, pred: (x, y) => y >= P(x) && x !== -k, why: `sign error: $${lin(1, -k)}=0$ at $x=${k}$.` },
      ];
      probes = [-k, k, 0, 1, -1, 2].flatMap((x) => [-1, 0, 1, Math.abs(k)].map((t): [number, number] => [x, P(x) + t]));
      probes.push([k, -1], [-k, k]);
    } else {
      const r = rng.int(2, 6);
      const R = r * r;
      const isLn = rng.chance(0.4);
      fTex = isLn ? `\\ln\\left(${R}-x^2-y^2\\right)` : `\\sqrt{${R}-x^2-y^2}`;
      fExpr = isLn ? `log(${R} - x^2 - y^2)` : `sqrt(${R} - x^2 - y^2)`;
      const Q = (x: number, y: number) => x * x + y * y;
      key = isLn ? { text: `$x^2+y^2<${R}$`, pred: (x, y) => Q(x, y) < R } : { text: `$x^2+y^2\\le ${R}$`, pred: (x, y) => Q(x, y) <= R };
      explanation = isLn
        ? `The logarithm needs a positive argument: $${R}-x^2-y^2>0 \\iff x^2+y^2<${R}$, the inside of the circle with centre $(0,0)$ and radius $${r}$ (the circle itself excluded).`
        : `The square root needs a non-negative argument: $${R}-x^2-y^2\\ge 0 \\iff x^2+y^2\\le ${R}$, the disk with centre $(0,0)$ and radius $${r}$ (circle included).`;
      d = [
        isLn
          ? { text: `$x^2+y^2\\le ${R}$`, pred: (x, y) => Q(x, y) <= R, why: 'includes the circle, where the argument is $0$ and $\\ln(0)$ is not defined.' }
          : { text: `$x^2+y^2<${R}$`, pred: (x, y) => Q(x, y) < R, why: 'excludes the circle, but $\\sqrt{0}=0$ is defined.' },
        { text: isLn ? `$x^2+y^2>${R}$` : `$x^2+y^2\\ge ${R}$`, pred: (x, y) => (isLn ? Q(x, y) > R : Q(x, y) >= R), why: 'reverses the inequality.' },
        { text: isLn ? `$x^2+y^2<${r}$` : `$x^2+y^2\\le ${r}$`, pred: (x, y) => (isLn ? Q(x, y) < r : Q(x, y) <= r), why: `confuses the radius $${r}$ with its square $${R}$.` },
        { text: isLn ? `$x<${r}$ and $y<${r}$` : `$x\\le ${r}$ and $y\\le ${r}$`, pred: (x, y) => (isLn ? x < r && y < r : x <= r && y <= r), why: 'treats $x$ and $y$ separately instead of the sum of squares.' },
        { text: isLn ? `$x+y<${r}$` : `$x+y\\le ${r}$`, pred: (x, y) => (isLn ? x + y < r : x + y <= r), why: 'takes the square root term by term: $\\sqrt{x^2+y^2}\\ne x+y$.' },
      ];
      probes = [];
      for (let x = -r - 1; x <= r + 1; x++) for (let y = -r - 1; y <= r + 1; y++) probes.push([x, y]);
    }
    // Key computed in code must match where f is defined (probes include points exactly on the boundaries).
    const f = realFn(fExpr, ['x', 'y']);
    for (const [x, y] of probes) {
      const v = f(x, y);
      if ((Number.isFinite(v) && Math.abs(v) < 1e12) !== key.pred(x, y)) throw new Error(`two-variable domain check failed at (${x}, ${y})`);
    }
    // Distractors must describe a different set (on the probes).
    const kept: Cond[] = [key];
    const accept = (c: Cond) => {
      if (kept.some((k) => probes.every(([x, y]) => k.pred(x, y) === c.pred(x, y)))) return { text: key.text };
      kept.push(c);
      return { text: c.text, why: c.why };
    };
    const choices = rng.shuffle(d).map(accept);
    const mcq = buildMcq(rng, { text: key.text }, choices, { count: optionCount });
    const stem = rng.pick([
      `Consider the function of two variables $$k(x,y)=${fTex}$$ Which description gives its domain?`,
      `For which points $(x,y)$ is $$g(x,y)=${fTex}$$ defined? Choose the description of the domain.`,
      `The domain of the two-variable function $$h(x,y)=${fTex}$$ consists of all points $(x,y)$ with`,
    ]);
    return { type: 'single-choice', stem, options: mcq.options, correctAnswer: mcq.correctAnswer, explanation: explanation + mistakesNote(mcq.distractors) };
  },
};

export const TEMPLATES: Template[] = [quadratic, excludedPoint, rootQuotient, twoVariables];

