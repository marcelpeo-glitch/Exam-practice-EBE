// Templates for the topic "Economic applications" (QM1 past exams: market equilibrium d(p) = s(p) with √p or p√p,
// the price at which demand reaches a level, revenue and profit maximisation with P(Q) = a − √Q, the car dealer's
// inventory problem (ordering vs holding costs, optimal order size) and the cheapest fence around a rectangular plot).
// Every key is computed in code from the generated numbers and checked by the template itself (ensure); wrong options
// come from modelled mistakes. See economic-applications.test.ts for the independent checks.
import { buildMcq, INSTRUCTION, num, numericField, type Choice } from '../build';
import { numDiff, numDiff2 } from '../mathx';
import type { Rng } from '../rng';
import { round } from '../stats';
import type { GenType, Generated, Template } from '../types';
import { amountIntervals, choiceQuestion, coefTex, ensure, euro, intervalMcq, isNice, numericQuestion, numTex, valueMcq } from './_econ';

type Mistake = { value: number; why: string };

/** Extra wrong options when the modelled mistakes coincide: the key ±15 %, ±30 %, ... */
const slip =
  (key: number, fmt: (v: number) => string) =>
  (i: number): Choice => {
    const v = key * (1 + (i % 2 ? -1 : 1) * 0.15 * (Math.floor(i / 2) + 1));
    return { text: fmt(v), value: v, why: 'an arithmetic slip somewhere along the way.' };
  };

/** Numeric question, or single choice with value options (or, for amounts, intervals as in the past exams). */
function finish(
  type: GenType,
  rng: Rng,
  optionCount: number,
  q: { stem: string; key: number; dp: number; explanation: string; mistakes: Mistake[]; fmt: (v: number) => string; intervals?: boolean },
): Generated {
  if (type === 'numeric') return numericQuestion(q.stem, q.key, q.dp, q.explanation);
  if (q.intervals) {
    const mcq = intervalMcq(rng, q.key, q.mistakes, optionCount, { format: amountIntervals((x) => euro(x, 0)), kind: 'amount' });
    if (mcq) return choiceQuestion(q.stem, mcq, q.explanation);
  }
  const mcq = valueMcq(rng, q.key, q.mistakes, optionCount, q.fmt, { positive: true, fallback: slip(q.key, q.fmt) });
  return choiceQuestion(q.stem, mcq, q.explanation);
}

/** "c·" as a factor in a product with a number: 1 → "", otherwise "c\cdot ". */
const times = (c: number) => (c === 1 ? '' : `${numTex(c)}\\cdot `);

// =====================================================================================================================
// 1. Market equilibrium / price for a given demand
// =====================================================================================================================

const MARKETS = [
  ['olive oil', 'thousand litres'],
  ['avocados', 'tonnes'],
  ['festival tickets', 'hundred tickets'],
  ['organic honey', 'hundred jars'],
  ['tulip bulbs', 'thousand bulbs'],
  ['craft beer', 'hundred crates'],
  ['oat milk', 'thousand cartons'],
] as const;

const pOpt = (v: number) => `$p=${num(v, 2)}$`;

const equilibrium: Template = {
  id: 'economic-applications.equilibrium',
  topic: 'Economic applications',
  title: 'Market equilibrium d(p) = s(p) with √p, p or p√p (substitute u and solve a quadratic), or the price at which demand reaches a level',
  types: ['single-choice', 'numeric'],
  difficulty: 1,
  generate({ rng, type, optionCount }) {
    const [good, unit] = rng.pick(MARKETS);
    const kind = rng.pick(['root', 'power', 'level'] as const);
    const ask = type === 'numeric' ? 'Calculate the equilibrium price, at which demand equals supply.' : 'What is the equilibrium price, at which demand equals supply?';
    let stem: string, explanation: string, key: number, check: number;
    let mistakes: Mistake[];
    if (kind === 'root') {
      let b: number, c: number;
      do {
        b = rng.pick([1, 1.5, 2, 2.5, 3, 4]);
        c = rng.pick([1, 1.5, 2, 2.5, 3, 4, 5]);
      } while (b === c || !Number.isInteger(b + c));
      const s0 = rng.int(3, 12);
      const a = (b + c) * s0;
      key = s0 * s0;
      const d = (p: number) => a - b * Math.sqrt(p);
      check = d(key) - c * Math.sqrt(key);
      stem = `On the market for ${good}, demand and supply (both in ${unit}) depend on the price $p$ in euros: $$d(p)=${a}-${coefTex(b)}\\sqrt{p}$$ $$s(p)=${coefTex(c)}\\sqrt{p}$$ ${ask}`;
      explanation =
        `Equilibrium means $d(p)=s(p)$: $$${a}-${coefTex(b)}\\sqrt{p}=${coefTex(c)}\\sqrt{p} \\;\\Rightarrow\\; ${a}=${numTex(b + c)}\\sqrt{p} \\;\\Rightarrow\\; \\sqrt{p}=\\frac{${a}}{${b + c}}=${s0} \\;\\Rightarrow\\; p=${s0}^2=${key}$$` +
        `Check: $d(${key})=${a}-${times(b)}${s0}=${num(d(key))}$ and $s(${key})=${times(c)}${s0}=${num(c * s0)}$.`;
      mistakes = [
        { value: s0, why: 'solves for $\\sqrt{p}$ but forgets to square.' },
        { value: (a / Math.abs(c - b)) ** 2, why: 'subtracts the coefficients of $\\sqrt{p}$ instead of adding them (sign error when moving a term).' },
        { value: (a / b) ** 2, why: 'sets the demand equal to zero instead of equal to the supply.' },
        { value: (a / c) ** 2, why: 'drops the $\\sqrt{p}$ term of the demand.' },
        { value: (a * a) / (b + c), why: 'squares the numerator but not the denominator of $\\sqrt{p}$.' },
      ];
    } else if (kind === 'power') {
      const k = rng.pick([0.5, 1, 1.5]);
      const uTex = k === 0.5 ? '\\sqrt{p}' : k === 1 ? 'p' : 'p\\sqrt{p}';
      const u0 = k === 0.5 ? rng.int(3, 12) : k === 1 ? rng.int(4, 20) : rng.pick([8, 27, 64]);
      const w = rng.int(1, Math.min(6, u0 - 2));
      const B = u0 - w;
      const A = u0 * w;
      const toP = (u: number) => (k === 0.5 ? u * u : k === 1 ? u : Math.cbrt(u) ** 2);
      key = toP(u0);
      check = A / key ** k - (key ** k - B);
      const v = k === 1 ? 'p' : 'u';
      stem = `For ${good} (quantities in ${unit}, price $p$ in euros) the demand and supply functions are $$d(p)=\\dfrac{${A}}{${uTex}}$$ $$s(p)=${uTex}-${B}$$ ${ask}`;
      const back =
        k === 0.5
          ? `so $\\sqrt{p}=${u0}$ and $p=${u0}^2=${key}$.`
          : k === 1
            ? `so $p=${u0}$.`
            : `so $p\\sqrt{p}=p^{3/2}=${u0}$ and $p=${u0}^{2/3}=\\left(\\sqrt[3]{${u0}}\\right)^2=${Math.cbrt(u0)}^2=${key}$.`;
      explanation =
        (k === 1 ? '' : `Write $u=${uTex}$ (so $u>0$). `) +
        `Equilibrium: $$\\frac{${A}}{${v}}=${v}-${B} \\;\\Rightarrow\\; ${A}=${v}^2-${B}${v} \\;\\Rightarrow\\; ${v}^2-${B}${v}-${A}=0 \\;\\Rightarrow\\; (${v}-${u0})(${v}+${w})=0$$` +
        `Since $${v}>0$, $${v}=${u0}$, ${back} Check: $d(${key})=\\frac{${A}}{${u0}}=${w}$ and $s(${key})=${u0}-${B}=${w}$.`;
      mistakes = [
        ...(k !== 1 ? [{ value: u0, why: `solves for $u=${uTex}$ but forgets to turn $u=${u0}$ back into a price.` }] : []),
        { value: toP(w), why: `sign error in the quadratic equation ($${v}^2+${B}${v}-${A}=0$), which gives $${v}=${w}$.` },
        { value: toP(Math.sqrt(A)), why: `forgets the $-${B}$ of the supply and solves $\\frac{${A}}{${v}}=${v}$.` },
        ...(k === 1.5 ? [{ value: u0 * u0, why: 'squares $u$, as if $u$ were $\\sqrt{p}$.' }] : []),
        ...(k === 0.5 ? [{ value: Math.sqrt(u0), why: 'takes the square root of $u$ instead of squaring it.' }] : []),
        ...(k === 1 ? [{ value: A / B, why: `treats the equation as linear and divides $${A}$ by $${B}$.` }] : []),
      ];
    } else {
      const c = rng.int(1, 5);
      const s0 = rng.int(2, 9);
      const X = rng.pick([2, 3, 4, 5, 6, 8, 10, 12]);
      const K = X * (c + s0);
      key = s0 * s0;
      check = K / (c + Math.sqrt(key)) - X;
      const seller = rng.pick(['A farm shop', 'A market stall', 'A small web shop', 'A cooperative']);
      stem = `${seller} sells ${good}. The daily demand $d$ (in ${unit}) at a price of $p$ euros is $$d(p)=\\dfrac{${K}}{${c}+\\sqrt{p}}$$ At which price $p$ is the daily demand equal to $${X}$ ${unit}?`;
      explanation =
        `Solve $d(p)=${X}$: $$\\frac{${K}}{${c}+\\sqrt{p}}=${X} \\;\\Rightarrow\\; ${c}+\\sqrt{p}=\\frac{${K}}{${X}}=${c + s0} \\;\\Rightarrow\\; \\sqrt{p}=${s0} \\;\\Rightarrow\\; p=${key}$$` +
        `Check: $d(${key})=\\frac{${K}}{${c}+${s0}}=${X}$.`;
      mistakes = [
        { value: s0, why: 'solves for $\\sqrt{p}$ but forgets to square.' },
        { value: (K / X + c) ** 2, why: `sign error: $\\sqrt{p}=\\frac{${K}}{${X}}+${c}$.` },
        { value: (K / X) ** 2, why: `forgets the $${c}$ in the denominator.` },
        { value: (K - X * c) ** 2, why: `forgets to multiply $\\sqrt{p}$ by $${X}$ when clearing the fraction.` },
      ];
    }
    ensure(Math.abs(check) < 1e-9, 'equilibrium / demand level');
    return finish(type, rng, optionCount, { stem, key, dp: 2, explanation, mistakes, fmt: pOpt });
  },
};

// =====================================================================================================================
// 2. Revenue and profit maximisation
// =====================================================================================================================

const SELLERS = [
  ['A start-up', 'handmade sneakers'],
  ['A small brewery', 'crates of pale ale'],
  ['A publisher', 'puzzle books'],
  ['A bakery chain', 'sourdough loaves'],
  ['An electronics firm', 'wireless chargers'],
  ['A design studio', 'art posters'],
  ['A coffee roastery', 'bags of coffee beans'],
] as const;

const optimum: Template = {
  id: 'economic-applications.optimum',
  topic: 'Economic applications',
  title: 'Revenue maximum for d(p) = a − b√p, or profit maximum for P(Q) = a − b√Q or a − bQ with linear/quadratic costs (Q*, p*, maximal profit)',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const [firm, good] = rng.pick(SELLERS);
    const kind = rng.pick(['rev-root', 'profit-root', 'profit-lin'] as const);
    const qOpt = (v: number) => `$Q=${num(v, 2)}$`;
    const money = (v: number) => euro(v, 2);

    if (kind === 'rev-root') {
      const b = rng.pick([1, 2, 3, 4]);
      const s = b % 2 ? 2 * rng.int(2, 8) : rng.int(4, 16);
      const a = 1.5 * b * s;
      const d = (p: number) => a - b * Math.sqrt(p);
      const R = (p: number) => p * d(p);
      const pStar = s * s;
      const Rmax = R(pStar);
      ensure(Math.abs(numDiff(R, pStar)) < 1e-4 && numDiff2(R, pStar) < 0, 'revenue maximum');
      const ask = rng.pick(['price', 'revenue'] as const);
      const stem =
        `${firm} sells ${good}. At a price of $p$ euros per unit the weekly demand is $$d(p)=${a}-${coefTex(b)}\\sqrt{p}$$ units. ` +
        (ask === 'price' ? 'At which price $p$ is the weekly revenue maximal?' : 'What is the maximal weekly revenue (in euros)?');
      const explanation =
        `The revenue is $$R(p)=p\\cdot d(p)=${a}p-${coefTex(b)}p\\sqrt{p}=${a}p-${coefTex(b)}p^{3/2}$$` +
        `$$R'(p)=${a}-${numTex(1.5 * b)}\\sqrt{p}=0 \\;\\Rightarrow\\; \\sqrt{p}=\\frac{2\\cdot ${a}}{${3 * b}}=${s} \\;\\Rightarrow\\; p=${s}^2=${pStar}$$` +
        `$R''(p)=-\\frac{${3 * b}}{4\\sqrt{p}}<0$, so this is a maximum. ` +
        `The maximal revenue is $$R(${pStar})=${pStar}\\cdot\\left(${a}-${times(b)}${s}\\right)=${pStar}\\cdot ${num(d(pStar))}=${num(Rmax)}$$`;
      if (ask === 'price')
        return finish(type, rng, optionCount, {
          stem,
          key: pStar,
          dp: 2,
          explanation,
          fmt: pOpt,
          mistakes: [
            { value: s, why: 'solves for $\\sqrt{p}$ but forgets to square.' },
            { value: (a / b) ** 2, why: 'forgets the factor $\\tfrac32$ when differentiating $p\\sqrt{p}=p^{3/2}$ (this is the price at which demand drops to zero).' },
            { value: ((3 * a) / (2 * b)) ** 2, why: 'turns the factor $\\tfrac32$ upside down when solving $R\'(p)=0$.' },
            { value: (a / b) ** 2 / 2, why: 'takes half of the highest possible price, a rule that only holds for a linear demand function.' },
          ],
        });
      return finish(type, rng, optionCount, {
        stem,
        key: Rmax,
        dp: 2,
        explanation,
        fmt: money,
        mistakes: [
          { value: a * pStar, why: `forgets the $-${coefTex(b)}\\sqrt{p}$ part of the demand when computing the revenue.` },
          { value: s * d(pStar), why: 'multiplies the demand by $\\sqrt{p}$ instead of by $p$.' },
          { value: R(s), why: `uses $p=${s}$ (forgets to square $\\sqrt{p}=${s}$).` },
          { value: pStar, why: 'gives the optimal price instead of the maximal revenue.' },
          { value: d(pStar), why: 'gives the demand at the optimal price instead of the revenue.' },
        ],
      });
    }

    if (kind === 'profit-root') {
      const b = rng.pick([1, 2, 3]);
      const s = b % 2 ? 2 * rng.int(3, 10) : rng.int(6, 20);
      const c = rng.pick([2, 4, 5, 8, 10, 12, 15, 20]);
      const a = c + 1.5 * b * s;
      const top = 0.5 * b * s ** 3;
      const step = top > 3000 ? 100 : top > 600 ? 50 : 10;
      const F = step * rng.int(1, Math.max(1, Math.floor((0.6 * top) / step)));
      const P = (Q: number) => a - b * Math.sqrt(Q);
      const profit = (Q: number) => Q * P(Q) - F - c * Q;
      const Q0 = s * s;
      const pmax = profit(Q0);
      ensure(Math.abs(numDiff(profit, Q0)) < 1e-4 && numDiff2(profit, Q0) < 0 && pmax > 0, 'profit maximum');
      const ask = rng.pick(['quantity', 'profit'] as const);
      const stem =
        `${firm} sells ${good}. When it sells $Q$ units per week, the price per unit in euros is $$P(Q)=${a}-${coefTex(b)}\\sqrt{Q}$$ ` +
        `The weekly costs are a fixed €${F} plus €${c} per unit, so $$C(Q)=${F}+${c}Q$$ ` +
        (ask === 'quantity' ? 'Which production level $Q$ maximises the weekly profit?' : 'What is the maximal weekly profit (in euros)?');
      const explanation =
        `Profit is revenue minus costs: $$\\pi(Q)=Q\\cdot P(Q)-C(Q)=${a}Q-${coefTex(b)}Q\\sqrt{Q}-${F}-${c}Q=${a - c}Q-${coefTex(b)}Q^{3/2}-${F}$$` +
        `$$\\pi'(Q)=${a - c}-\\frac{${3 * b}}{2}\\sqrt{Q}=0 \\;\\Rightarrow\\; \\sqrt{Q}=\\frac{2\\cdot ${a - c}}{${3 * b}}=${s} \\;\\Rightarrow\\; Q=${s}^2=${Q0}$$` +
        `$\\pi''(Q)=-\\frac{${3 * b}}{4\\sqrt{Q}}<0$, so this is a maximum. ` +
        `$$\\pi(${Q0})=${a - c}\\cdot ${Q0}-${times(b)}${s}^3-${F}=${(a - c) * Q0}-${b * s ** 3}-${F}=${num(pmax)}$$`;
      const Qrev = ((2 * a) / (3 * b)) ** 2;
      if (ask === 'quantity')
        return finish(type, rng, optionCount, {
          stem,
          key: Q0,
          dp: 2,
          explanation,
          fmt: qOpt,
          mistakes: [
            { value: s, why: 'solves for $\\sqrt{Q}$ but forgets to square.' },
            { value: Qrev, why: 'maximises the revenue $Q\\cdot P(Q)$ and forgets the variable costs.' },
            { value: ((a - c) / b) ** 2, why: 'forgets the factor $\\tfrac32$ when differentiating $Q\\sqrt{Q}=Q^{3/2}$.' },
            { value: ((2 * (a + c)) / (3 * b)) ** 2, why: `sign error: adds the €${c} per unit instead of subtracting it.` },
          ],
        });
      return finish(type, rng, optionCount, {
        stem,
        key: pmax,
        dp: 2,
        explanation,
        fmt: money,
        intervals: rng.chance(0.5),
        mistakes: [
          { value: pmax + F, why: 'forgets to subtract the fixed costs.' },
          { value: Q0 * P(Q0), why: 'gives the revenue at the optimum instead of the profit.' },
          { value: profit(Qrev), why: 'evaluates the profit at the revenue-maximising quantity (ignores the variable costs).' },
          { value: pmax - F, why: 'subtracts the fixed costs twice.' },
          { value: profit(s), why: `uses $Q=${s}$ (forgets to square $\\sqrt{Q}=${s}$).` },
        ],
      });
    }

    // profit-lin: P(Q) = a − bQ, C(Q) = F + cQ + dQ²
    const b = rng.pick([0.5, 1, 1.5, 2, 3]);
    const d = rng.pick([0.5, 1, 1.5, 2]);
    const Q0 = rng.int(5, 30);
    const c = rng.pick([4, 5, 6, 8, 10, 12, 15, 20]);
    const a = c + 2 * (b + d) * Q0;
    const top = (b + d) * Q0 * Q0;
    const step = top > 2000 ? 100 : top > 400 ? 50 : 10;
    const F = step * rng.int(1, Math.max(1, Math.floor((0.6 * top) / step)));
    const P = (Q: number) => a - b * Q;
    const profit = (Q: number) => Q * P(Q) - (F + c * Q + d * Q * Q);
    const pmax = profit(Q0);
    ensure(Math.abs(numDiff(profit, Q0)) < 1e-4 && numDiff2(profit, Q0) < 0 && pmax > 0 && P(Q0) > 0, 'profit maximum (linear demand)');
    const ask = rng.pick(['quantity', 'profit', 'price'] as const);
    const stem =
      `${firm} sells ${good}. The price per unit (in euros) at which it can sell $Q$ units per week is $$P(Q)=${a}-${coefTex(b)}Q$$ and the weekly costs (in euros) are $$C(Q)=${F}+${c}Q+${coefTex(d)}Q^2$$ ` +
      (ask === 'quantity'
        ? 'Which production level $Q$ maximises the weekly profit?'
        : ask === 'profit'
          ? 'What is the maximal weekly profit (in euros)?'
          : 'Which price $P$ per unit should the firm charge to maximise its weekly profit?');
    const explanation =
      `$$\\pi(Q)=Q\\cdot P(Q)-C(Q)=${a}Q-${coefTex(b)}Q^2-${F}-${c}Q-${coefTex(d)}Q^2=${a - c}Q-${coefTex(b + d)}Q^2-${F}$$` +
      `$$\\pi'(Q)=${a - c}-${num(2 * (b + d))}Q=0 \\;\\Rightarrow\\; Q=\\frac{${a - c}}{${num(2 * (b + d))}}=${Q0}$$` +
      `and $\\pi''(Q)=-${num(2 * (b + d))}<0$, so this is a maximum. ` +
      `The maximal profit is $$\\pi(${Q0})=${a - c}\\cdot ${Q0}-${times(b + d)}${Q0}^2-${F}=${num(pmax)}$$` +
      `and the price that goes with it is $P(${Q0})=${a}-${times(b)}${Q0}=${num(P(Q0))}$ euros.`;
    const wrongQ: Mistake[] = [
      { value: (a - c) / (b + d), why: 'forgets the factor 2 when differentiating $Q^2$.' },
      { value: (a - c) / (2 * b), why: `forgets the quadratic cost term $${coefTex(d)}Q^2$.` },
      { value: a / (2 * (b + d)), why: `forgets the variable cost of €${c} per unit.` },
      { value: (a - c) / (2 * b + d), why: `differentiates $${coefTex(d)}Q^2$ as $${coefTex(d)}Q$.` },
      { value: a / (2 * b), why: 'maximises the revenue instead of the profit.' },
    ];
    if (ask === 'quantity') return finish(type, rng, optionCount, { stem, key: Q0, dp: 2, explanation, fmt: qOpt, mistakes: wrongQ });
    if (ask === 'profit')
      return finish(type, rng, optionCount, {
        stem,
        key: pmax,
        dp: 2,
        explanation,
        fmt: money,
        intervals: rng.chance(0.4),
        mistakes: [
          { value: pmax + F, why: 'forgets to subtract the fixed costs.' },
          { value: Q0 * P(Q0), why: 'gives the revenue at the optimum instead of the profit.' },
          ...wrongQ.map((m) => ({ value: profit(m.value), why: `evaluates the profit at $Q=${num(m.value, 2)}$, which ${m.why}` })),
        ],
      });
    return finish(type, rng, optionCount, {
      stem,
      key: P(Q0),
      dp: 2,
      explanation,
      fmt: (v) => `$P=${num(v, 2)}$`,
      mistakes: [
        { value: c + 2 * d * Q0, why: 'gives the marginal cost at the optimum instead of the price.' },
        { value: Q0, why: 'gives the optimal quantity instead of the price.' },
        ...wrongQ.map((m) => ({ value: P(m.value), why: `uses $Q=${num(m.value, 2)}$, which ${m.why}` })),
      ],
    });
  },
};

// =====================================================================================================================
// 3. Inventory: ordering costs vs holding costs (EOQ)
// =====================================================================================================================

const SHOPS = [
  ['A bicycle shop', 'e-bikes'],
  ['A music store', 'pianos'],
  ['A kitchen-appliance retailer', 'espresso machines'],
  ['An electronics store', 'gaming laptops'],
  ['A garden centre', 'garden sheds'],
  ['A scooter dealer', 'electric scooters'],
  ['A furniture store', 'leather sofas'],
] as const;
const RATES = [0.04, 0.05, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25];
const VALUES = [200, 250, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000, 2400, 2500, 3000];
const ORDER_COSTS = [20, 25, 30, 40, 50, 60, 75, 80, 90, 100, 120, 125, 150, 160, 180, 200, 240, 250, 300, 400, 500];

const inventory: Template = {
  id: 'economic-applications.inventory',
  topic: 'Economic applications',
  title: 'Inventory (EOQ): yearly ordering and holding costs for an order size, the optimal order size, or the minimal total yearly cost',
  types: ['single-choice', 'numeric'],
  difficulty: 2,
  generate({ rng, type, optionCount }) {
    const [shop, item] = rng.pick(SHOPS);
    let D = 0,
      K = 0,
      r = 0,
      v = 0,
      h = 0,
      xs = 0;
    for (let tries = 0; !D; tries++) {
      if (tries > 1000) throw new Error('inventory: no suitable numbers');
      r = rng.pick(RATES);
      v = rng.pick(VALUES);
      h = round(r * v, 6);
      xs = rng.int(4, 16);
      const ks = ORDER_COSTS.filter((k) => {
        const dd = (xs * xs * h) / (2 * k);
        return Math.abs(dd - Math.round(dd)) < 1e-9 && dd >= 40 && dd <= 1200;
      });
      if (ks.length) {
        K = rng.pick(ks);
        D = Math.round((xs * xs * h) / (2 * K));
      }
    }
    const C = (x: number) => (K * D) / x + (h * x) / 2;
    ensure(C(xs) < C(xs - 1) && C(xs) < C(xs + 1) && Math.abs(numDiff(C, xs)) < 1e-6, 'EOQ');
    const pct = num(r * 100);
    const divisors = Array.from({ length: 3 * xs }, (_, i) => i + 2).filter((x) => x !== xs && D % x === 0);
    let ask = rng.pick(['optimal', 'costs', 'total'] as const);
    if (ask === 'costs' && !divisors.length) ask = 'optimal';
    const table = {
      header: ['Figure', 'Value'],
      rows: [
        ['Sales per year', `${D} ${item}`],
        ['Cost per order (whatever its size)', euro(K)],
        ['Value of one unit', euro(v)],
        ['Holding cost per year', `${pct}% of the value of the average stock`],
      ],
    };
    const intro =
      `${shop} sells ${item} at a steady rate over the year. Whenever the last one is sold, a new batch of $x$ ${item} arrives at once, so the average stock is $\\frac{x}{2}$. ` +
      'The relevant figures are in the table.';
    const model =
      `There are $\\frac{${D}}{x}$ orders per year, and the average stock of $\\frac{x}{2}$ ${item} is worth $\\frac{x}{2}\\cdot ${v}$ euros, so $$C(x)=${K}\\cdot\\frac{${D}}{x}+${num(r)}\\cdot ${v}\\cdot\\frac{x}{2}=\\frac{${K * D}}{x}+${num(h / 2)}x$$`;
    const optimal =
      `$$C'(x)=-\\frac{${K * D}}{x^2}+${num(h / 2)}=0 \\;\\Rightarrow\\; x^2=\\frac{${K * D}}{${num(h / 2)}}=${xs * xs} \\;\\Rightarrow\\; x=${xs}$$` +
      `$C''(x)=\\frac{${2 * K * D}}{x^3}>0$, so this is a minimum.`;

    if (ask === 'costs') {
      const x = rng.pick(divisors);
      const o = (K * D) / x;
      const hc = (h * x) / 2;
      const stem = `${intro} Suppose the shop orders $x=${x}$ ${item} each time. What are its yearly ordering costs and its yearly holding costs?`;
      const explanation =
        `With $x=${x}$ there are $\\frac{${D}}{${x}}=${D / x}$ orders per year, costing $${D / x}\\cdot ${K}=${num(o)}$ euros. ` +
        `The average stock is $\\frac{${x}}{2}=${num(x / 2)}$ ${item}, worth $${num(x / 2)}\\cdot ${v}=${num((x * v) / 2)}$ euros; ${pct}% of that is $${num(hc)}$ euros. ` +
        `In general, ${model.replace('There are', 'there are')}`;
      if (type === 'numeric')
        return {
          type,
          stem,
          table,
          instruction: INSTRUCTION.numericFields(2),
          fields: [numericField('order', 'Yearly ordering costs (€)', o, 2), numericField('hold', 'Yearly holding costs (€)', hc, 2)],
          explanation,
        };
      const pair = (p: number, q: number, why?: string): Choice => ({ text: `ordering costs ${euro(p)}, holding costs ${euro(q)}`, ...(why ? { why } : {}) });
      const mcq = buildMcq(
        rng,
        pair(o, hc),
        [
          pair(o, 2 * hc, 'takes the whole order $x$ as the average stock instead of $\\frac{x}{2}$.'),
          pair(K * x, hc, 'multiplies the order cost by the order size instead of by the number of orders.'),
          pair(hc, o, 'swaps the two kinds of costs.'),
          pair(o, (h * D) / 2, 'takes half of the yearly sales as the average stock.'),
          pair(K * D, hc, 'pays the order cost for every unit sold.'),
        ],
        { count: optionCount, fallback: (i) => pair(o * (1 + 0.25 * (i + 1)), hc, 'an arithmetic slip.') },
      );
      return { ...choiceQuestion(stem, mcq, explanation), table };
    }
    if (ask === 'optimal') {
      const stem = `${intro} Which order size $x$ keeps the total yearly ordering and holding costs as low as possible?`;
      const explanation = `${model}${optimal} The optimal order size is ${xs} ${item} per order.`;
      if (type === 'numeric') return { ...numericQuestion(stem, xs, 0, explanation), table };
      const fmt = (n: number) => `$x=${n}$`;
      const ms: Mistake[] = [
        { value: xs / Math.SQRT2, why: 'forgets that the average stock is half the order size (holding costs $h\\cdot x$ instead of $h\\cdot\\frac{x}{2}$).' },
        { value: D / xs, why: 'gives the number of orders per year instead of the order size.' },
        { value: (2 * K) / h, why: 'sets the cost of one order equal to the holding cost of one unit.' },
        { value: xs * xs, why: 'forgets to take the square root at the end.' },
        { value: xs / 10, why: `enters the percentage as a whole number (${pct} instead of ${num(r)}).` },
      ]
        .map((m) => ({ ...m, value: Math.round(m.value) }))
        .filter((m) => m.value >= 1 && m.value !== xs);
      const mcq = buildMcq(
        rng,
        { text: fmt(xs), value: xs },
        ms.map((m) => ({ text: fmt(m.value), value: m.value, why: m.why })),
        {
          count: optionCount,
          order: 'ascending',
          epsilon: 1e-9,
          fallback: (i) => {
            const n = xs + (i % 2 ? -1 : 1) * (Math.floor(i / 2) + 1);
            return { text: fmt(n), value: n < 1 ? NaN : n, why: 'close to the optimum, but the total costs there are higher (compare $C(x)$).' };
          },
        },
      );
      return { ...choiceQuestion(stem, mcq, explanation), table };
    }
    const total = C(xs);
    const stem = `${intro} What are the lowest possible total yearly costs (ordering plus holding) in euros?`;
    const explanation =
      `${model}${optimal} At $x=${xs}$ both parts are equal: ordering costs $\\frac{${K * D}}{${xs}}=${num((K * D) / xs)}$ and holding costs $${num(h / 2)}\\cdot ${xs}=${num((h * xs) / 2)}$, ` +
      `so the minimal total is $${num(total)}$ euros per year.`;
    const res = finish(type, rng, optionCount, {
      stem,
      key: total,
      dp: 2,
      explanation,
      fmt: (n) => euro(n, 2),
      mistakes: [
        { value: total / 2, why: 'gives only the ordering costs (or only the holding costs) at the optimum.' },
        { value: (K * D) / xs + h * xs, why: 'takes the whole order as the average stock when computing the holding costs.' },
        { value: C(D / xs), why: 'uses the number of orders per year as the order size.' },
        { value: K + (h * xs) / 2, why: 'counts the order cost only once instead of once per order.' },
      ],
    });
    return { ...res, table };
  },
};

// =====================================================================================================================
// 4. The cheapest fence around a rectangle with one free side
// =====================================================================================================================

const PLOTS = [
  { who: 'A farmer', what: 'a rectangular paddock for her goats', wall: 'a river', special: 'facing the road' },
  { who: 'A café owner', what: 'a rectangular terrace', wall: 'the café wall', special: 'facing the street' },
  { who: 'A primary school', what: 'a rectangular vegetable garden', wall: 'the gym wall', special: 'facing the playground' },
  { who: 'A festival organiser', what: 'a rectangular VIP area', wall: 'a canal', special: 'facing the main stage' },
  { who: 'A dog owner', what: 'a rectangular dog run', wall: 'the back wall of the house', special: 'facing the neighbours' },
] as const;

/** A simple sketch of the plot: the free side along the wall/water at the top, prices per metre on the other sides. */
function sketch(wall: string, bottom: string, left: string, right: string): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="340" height="190" viewBox="0 0 340 190" font-family="Arial, sans-serif" font-size="13">' +
    '<rect width="340" height="190" fill="#ffffff"/>' +
    '<path d="M60 48 q15 -8 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0" fill="none" stroke="#2563eb" stroke-width="3"/>' +
    `<text x="170" y="28" text-anchor="middle" fill="#1e3a8a">${wall}: no fence</text>` +
    '<rect x="90" y="55" width="160" height="95" fill="#e5e7eb"/>' +
    '<path d="M90 55 V150 H250 V55" fill="none" stroke="#111827" stroke-width="3"/>' +
    `<text x="170" y="172" text-anchor="middle">L: ${bottom}</text>` +
    `<text x="84" y="107" text-anchor="end">B: ${left}</text>` +
    `<text x="256" y="107">B: ${right}</text>` +
    '<text x="170" y="107" text-anchor="middle" fill="#374151">area A</text></svg>';
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const fence: Template = {
  id: 'economic-applications.fence',
  topic: 'Economic applications',
  title: 'Cheapest fence around a rectangle of given area with one free side and different prices per metre (ratio L/B, a side, or the minimal cost)',
  types: ['single-choice', 'numeric'],
  difficulty: 3,
  generate({ rng, type, optionCount }) {
    const plot = rng.pick(PLOTS);
    let cN = 0,
      cS = 0,
      alpha = 0,
      beta = 0,
      rho = 0,
      B = 0,
      A = 0,
      L = 0,
      specialLength = false;
    for (let tries = 0; ; tries++) {
      if (tries > 1000) throw new Error('fence: no suitable numbers');
      cN = rng.pick([10, 15, 20, 25, 30, 40]);
      cS = cN + rng.pick([5, 10, 15, 20, 30, 40]);
      specialLength = rng.chance(0.4);
      alpha = specialLength ? cS : cN;
      beta = specialLength ? 2 * cN : cS + cN;
      rho = beta / alpha;
      B = rng.int(8, 40);
      A = rho * B * B;
      L = rho * B;
      if (isNice(rho, 2) && Math.abs(A - Math.round(A)) < 1e-9 && isNice(L, 1) && Math.abs(rho - 1) > 0.05 && A <= 6000) break;
    }
    A = Math.round(A);
    const cost = (b: number) => (alpha * A) / b + beta * b;
    const Cmin = cost(B);
    ensure(Math.abs(numDiff(cost, B)) < 1e-6 && numDiff2(cost, B) > 0 && Math.abs(Cmin - 2 * beta * B) < 1e-6, 'fence optimum');
    const betaOne = specialLength ? cN : cS; // "forgets the second width side"
    const lenRow = `other length side${specialLength ? ` (${plot.special})` : ''}`;
    const table = {
      header: ['Side', 'Price per metre'],
      rows: [
        [`length side along ${plot.wall}`, 'no fence needed'],
        [lenRow, euro(alpha)],
        [`width side${specialLength ? '' : ` (${plot.special})`}`, euro(specialLength ? cN : cS)],
        ['other width side', euro(cN)],
      ],
    };
    const images = [
      {
        src: sketch(plot.wall.replace(/^the |^a /, ''), `€${alpha}/m`, `€${specialLength ? cN : cS}/m`, `€${cN}/m`),
        alt: `Sketch: a rectangle with length L along ${plot.wall} (no fence) and width B; prices per metre on the other three sides.`,
      },
    ];
    const ask = rng.pick(['ratio', 'width', 'length', 'cost'] as const);
    const q = {
      ratio: 'For which ratio $L/B$ are the fencing costs as low as possible?',
      width: 'Which width $B$ (in metres) keeps the fencing costs as low as possible?',
      length: 'Which length $L$ (in metres) keeps the fencing costs as low as possible?',
      cost: 'What are the lowest possible fencing costs (in euros)?',
    }[ask];
    const stem =
      `${plot.who} wants to fence off ${plot.what} with an area of $${A}$ m². One side of length $L$ runs along ${plot.wall} and needs no fence; ` +
      `the side ${plot.special} needs a more expensive fence. The prices per metre are given in the table and the sketch. ${q}`;
    const explanation =
      `Only one length side is fenced (€${alpha} per metre); the two width sides together cost €${specialLength ? cN : cS} + €${cN} = €${beta} per metre of $B$. So $$C=${alpha}L+${beta}B \\quad\\text{with}\\quad LB=${A}$$` +
      `Substitute $L=\\frac{${A}}{B}$: $$C(B)=\\frac{${alpha * A}}{B}+${beta}B, \\qquad C'(B)=-\\frac{${alpha * A}}{B^2}+${beta}=0 \\;\\Rightarrow\\; B^2=\\frac{${alpha * A}}{${beta}}=${B * B} \\;\\Rightarrow\\; B=${B}$$` +
      `$C''(B)=\\frac{${2 * alpha * A}}{B^3}>0$, so this is a minimum. Then $L=\\frac{${A}}{${B}}=${num(L)}$, the ratio is $L/B=${num(rho)}$ (in general $L/B=\\frac{${beta}}{${alpha}}$), ` +
      `and the costs are $${alpha}\\cdot ${num(L)}+${beta}\\cdot ${B}=${num(Cmin)}$ euros.`;
    const bWall = Math.sqrt((2 * alpha * A) / beta);
    const bOne = Math.sqrt((alpha * A) / betaOne);
    const wall = `also pays for a fence along ${plot.wall}.`;
    const spec = {
      ratio: {
        key: rho,
        fmt: (v: number) => `$L/B=${num(v, 2)}$`,
        mistakes: [
          { value: alpha / beta, why: 'turns the ratio upside down ($B/L$ instead of $L/B$).' },
          { value: beta / (2 * alpha), why: wall },
          { value: betaOne / alpha, why: 'forgets the second width side.' },
          { value: 1, why: 'assumes that a square is always the cheapest rectangle.' },
          { value: 2, why: 'uses $L=2B$, which only holds when every fenced metre has the same price.' },
        ],
      },
      width: {
        key: B,
        fmt: (v: number) => `$B=${num(v, 2)}$ m`,
        mistakes: [
          { value: L, why: 'mixes up the length and the width.' },
          { value: Math.sqrt(A), why: 'assumes that a square is always the cheapest rectangle.' },
          { value: bWall, why: wall },
          { value: bOne, why: 'forgets the second width side.' },
          { value: (alpha * A) / beta, why: 'forgets to take the square root.' },
        ],
      },
      length: {
        key: L,
        fmt: (v: number) => `$L=${num(v, 2)}$ m`,
        mistakes: [
          { value: B, why: 'mixes up the length and the width.' },
          { value: Math.sqrt(A), why: 'assumes that a square is always the cheapest rectangle.' },
          { value: A / bWall, why: wall },
          { value: A / bOne, why: 'forgets the second width side.' },
        ],
      },
      cost: {
        key: Cmin,
        fmt: (v: number) => euro(v, 2),
        mistakes: [
          { value: Cmin / 2, why: 'gives only the cost of the width sides (or only of the length side).' },
          { value: (alpha + beta) * Math.sqrt(A), why: 'prices a square plot instead of the optimal rectangle.' },
          { value: 2 * Math.sqrt(2 * alpha * beta * A), why: wall },
          { value: alpha * B + beta * L, why: 'swaps $L$ and $B$ when computing the costs.' },
          { value: 2 * Math.sqrt(alpha * betaOne * A), why: 'forgets the second width side.' },
        ],
      },
    }[ask];
    const res = finish(type, rng, optionCount, { stem, key: spec.key, dp: 2, explanation, mistakes: spec.mistakes, fmt: spec.fmt });
    return { ...res, table, images };
  },
};

export const TEMPLATES: Template[] = [equilibrium, optimum, inventory, fence];
