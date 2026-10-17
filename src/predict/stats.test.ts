import { describe, expect, it } from 'vitest';
import { T_TABLE, T_TABLE_LEVELS, binomCdf, binomPmf, choose, fiveNumber, normCdf, normInv, sd, tCdf, tInv, tStar, tTableDf, zStar, zTable } from './stats';

describe('normal distribution', () => {
  it('matches known values', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 15);
    expect(normCdf(1.96)).toBeCloseTo(0.9750021048517795, 13);
    expect(normCdf(-1)).toBeCloseTo(0.15865525393145707, 13);
    expect(normCdf(3)).toBeCloseTo(0.9986501019683699, 13);
  });
  it('matches the printed Table Z', () => {
    expect(zTable(0.63)).toBe(0.7357);
    expect(zTable(-1.25)).toBe(0.1056);
    expect(zTable(2.33)).toBe(0.9901);
    expect(zTable(0.625)).toBe(zTable(0.63));
  });
  it('inverts', () => {
    for (const p of [0.001, 0.025, 0.1, 0.5, 0.8, 0.975, 0.999]) expect(normCdf(normInv(p))).toBeCloseTo(p, 12);
    expect(normInv(0.975)).toBeCloseTo(1.959963984540054, 9);
  });
});

describe('t distribution', () => {
  it('matches known values', () => {
    expect(tCdf(2.228, 10)).toBeCloseTo(0.975, 4);
    expect(tCdf(0, 7)).toBeCloseTo(0.5, 12);
    expect(tInv(0.975, 1)).toBeCloseTo(12.706, 3);
    expect(tCdf(-1.5, 4) + tCdf(1.5, 4)).toBeCloseTo(1, 12);
  });
  // Values copied from the exam's Table T (img/qm1-shared/table-t.png).
  const printed: [number, number[]][] = [
    [1, [3.078, 6.314, 12.706, 31.821, 63.657]],
    [5, [1.476, 2.015, 2.571, 3.365, 4.032]],
    [14, [1.345, 1.761, 2.145, 2.624, 2.977]],
    [24, [1.318, 1.711, 2.064, 2.492, 2.797]],
    [30, [1.31, 1.697, 2.042, 2.457, 2.75]],
    [35, [1.306, 1.69, 2.03, 2.438, 2.725]],
    [75, [1.293, 1.665, 1.992, 2.377, 2.643]],
    [180, [1.286, 1.653, 1.973, 2.347, 2.603]],
    [1000, [1.282, 1.646, 1.962, 2.33, 2.581]],
  ];
  it('the transcribed Table T agrees with the exact quantiles (to the printed rounding)', () => {
    for (const [df, row] of T_TABLE)
      T_TABLE_LEVELS.forEach((c, i) => expect(Math.abs(row[i] - tInv(1 - (1 - c) / 2, df)), `df ${df}, ${c}`).toBeLessThan(0.0016));
  });
  it('reads the printed Table T', () => {
    for (const [df, row] of printed) [0.8, 0.9, 0.95, 0.98, 0.99].forEach((c, i) => expect(tStar(c, df), `df ${df}, ${c}`).toBe(row[i]));
    expect([zStar(0.8), zStar(0.9), zStar(0.95), zStar(0.98), zStar(0.99)]).toEqual([1.282, 1.645, 1.96, 2.326, 2.576]);
  });
  it('rounds df down to a table row', () => {
    expect(tTableDf(184)).toBe(180);
    expect(tTableDf(33)).toBe(32);
    expect(tTableDf(2000)).toBe(1000);
    expect(tTableDf(12)).toBe(12);
    expect(tStar(0.95, 184)).toBe(1.973);
  });
});

describe('binomial and descriptive', () => {
  it('binomial', () => {
    expect(choose(10, 3)).toBe(120);
    expect(binomPmf(2, 5, 0.3)).toBeCloseTo(0.3087, 10);
    expect(binomCdf(10, 10, 0.4)).toBeCloseTo(1, 12);
    expect(binomCdf(1, 4, 0.5)).toBeCloseTo(5 / 16, 12);
  });
  it('five-number summary and sd', () => {
    expect(fiveNumber([1, 2, 3, 4, 5, 6, 7])).toEqual({ min: 1, q1: 2, median: 4, q3: 6, max: 7 });
    expect(fiveNumber([1, 2, 3, 4, 5, 6, 7, 8])).toEqual({ min: 1, q1: 2.5, median: 4.5, q3: 6.5, max: 8 });
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138089935, 8);
  });
});
