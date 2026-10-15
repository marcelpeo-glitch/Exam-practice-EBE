// Templates for the topic "Derivatives". Each template computes its answer in code (mathjs / plain arithmetic) and
// builds the wrong options from modelled student mistakes. See derivatives.test.ts for the independent checks.
import { buildMcq, INSTRUCTION, mistakesNote, num, numericField, sgn } from '../build';
import { diff, evalAt } from '../mathx';
import type { Template } from '../types';

/** f(x) = (a x + b) e^{c x}; asks for f'(0) — product rule + chain rule. */
const productExpAtZero: Template = {
  id: 'derivatives.product-exp-at-zero',
  topic: 'Derivatives',
  title: "Value of f'(0) for f(x) = (ax + b)e^{cx} (product and chain rule)",
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const a = rng.sign() * rng.int(2, 9);
    const b = rng.sign() * rng.int(1, 9);
    let c = rng.sign() * rng.int(2, 6);
    if (a + c * b === 0) c += 1; // keep the answer non-zero
    const expr = `(${a}*x + ${b}) * exp(${c}*x)`;
    // The answer, computed symbolically by mathjs (not by hand): f'(0).
    const answer = evalAt(diff(expr), { x: 0 });
    const fTex = `f(x)=\\left(${a}x ${sgn(b)}\\right)e^{${c}x}`;
    const stem = `A firm's cost per unit (in euros) depends on a production setting $x$ according to $$${fTex}$$ Calculate the rate of change $f'(0)$.`;
    const explanation =
      `Use the product rule with $u=${a}x ${sgn(b)}$ and $v=e^{${c}x}$, so $u'=${a}$ and (chain rule) $v'=${c}e^{${c}x}$:\n` +
      `$$f'(x)=${a}e^{${c}x}+\\left(${a}x ${sgn(b)}\\right)\\cdot ${c}e^{${c}x}$$` +
      `At $x=0$, $e^{0}=1$, so $$f'(0)=${a}+(${b})(${c})=${num(answer)}$$`;

    if (type === 'numeric') {
      return { type, stem, instruction: INSTRUCTION.numeric(0), correctAnswer: answer, tolerance: 0, explanation };
    }
    const mcq = buildMcq(
      rng,
      { text: `$${num(answer)}$`, value: answer },
      [
        { text: `$${num(a + b)}$`, value: a + b, why: `forgetting the chain rule: treating the derivative of $e^{${c}x}$ as $e^{${c}x}$.` },
        { text: `$${num(a * c)}$`, value: a * c, why: "multiplying the two derivatives ($u'v'$) instead of using the product rule." },
        { text: `$${num(a)}$`, value: a, why: "differentiating only the first factor ($u'v$)." },
        { text: `$${num(b * c)}$`, value: b * c, why: "differentiating only the second factor ($uv'$)." },
        { text: `$${num(b)}$`, value: b, why: "giving $f(0)$ instead of $f'(0)$." },
      ],
      { count: optionCount, fallback: (i) => ({ text: `$${num(answer + (i + 1) * rng.sign())}$`, value: answer + (i + 1) * rng.sign() }) },
    );
    return {
      type,
      stem,
      options: mcq.options,
      correctAnswer: mcq.correctAnswer,
      explanation: explanation + mistakesNote(mcq.distractors),
    };
  },
};

export const TEMPLATES: Template[] = [productExpAtZero];
