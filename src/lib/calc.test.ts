import { describe, expect, it } from 'vitest';
import { evaluate, formatResult } from './calc';

describe('calculator', () => {
  it.each([
    ['1+2×3', 7],
    ['(1+2)×3', 9],
    ['2^3^2', 512],
    ['-2^2', -4],
    ['2^-1', 0.5],
    ['10÷4', 2.5],
    ['2π', 2 * Math.PI],
    ['3(4+1)', 15],
    ['√16+1', 5],
    ['√(16)', 4],
    ['ln(e)', 1],
    ['log(1000)', 3],
    ['exp(0)', 1],
    ['5!', 120],
    ['1.2E3', 1200],
    ['sin(30)', 0.5],
    ['sin(30)^2', 0.25],
    ['(570−520)÷80', 0.625],
    ['1-0.88^5', 1 - 0.88 ** 5],
    ['2(3', 6],
  ])('%s', (expr, expected) => {
    expect(evaluate(expr, { angle: 'deg' })).toBeCloseTo(expected as number, 10);
  });
  it('radians and Ans', () => {
    expect(evaluate('cos(π)', { angle: 'rad' })).toBeCloseTo(-1);
    expect(evaluate('Ans×2', { ans: 21 })).toBe(42);
  });
  it('errors', () => {
    expect(() => evaluate('1÷0')).toThrow('Math error');
    expect(() => evaluate('ln(0)')).toThrow('Math error');
    expect(() => evaluate('2+')).toThrow();
    expect(() => evaluate('')).toThrow();
    expect(() => evaluate('alert(1)')).toThrow();
  });
  it('formats results', () => {
    expect(formatResult(0.1 + 0.2)).toBe('0.3');
    expect(formatResult(1 / 3)).toBe('0.3333333333');
    expect(formatResult(1.5e12)).toBe('1.5E12');
    expect(formatResult(2.5e-11)).toBe('2.5E-11');
  });
});
