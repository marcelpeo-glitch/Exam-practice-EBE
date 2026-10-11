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
  // Regressions from the pre-merge review.
  it.each([
    ['1÷2π', 1 / (2 * Math.PI)], // implicit product before π binds tighter than ÷ (Casio)
    ['2π÷2π', 1],
    ['1÷2√(3)', 1 / (2 * Math.sqrt(3))],
    ['1÷2sin(30)', 1],
    ['6÷2(1+2)', 9], // before a bracket it stays at the ×/÷ level
    ['2e−1', 2 * Math.E - 1], // lowercase e is Euler's number, not an exponent
    ['0.5e−0.5', 0.5 * Math.E - 0.5],
    ['1.5E3', 1500],
    ['1.5E−3', 0.0015],
    ['e^(2)', Math.E ** 2],
  ])('Casio-like: %s', (expr, expected) => {
    expect(evaluate(expr, { angle: 'deg' })).toBeCloseTo(expected as number, 10);
  });
  it('exact trig values and no floating-point noise', () => {
    expect(evaluate('cos(90)')).toBe(0);
    expect(evaluate('sin(180)')).toBe(0);
    expect(evaluate('sin(-90)')).toBe(-1);
    expect(evaluate('tan(45)')).toBeCloseTo(1, 12);
    expect(() => evaluate('tan(90)')).toThrow('Math error');
    expect(evaluate('sin(π)', { angle: 'rad' })).toBe(0);
    expect(() => evaluate('tan(π÷2)', { angle: 'rad' })).toThrow('Math error');
    expect(evaluate('0.3−0.1−0.2')).toBe(0);
    expect(formatResult(evaluate('cos(90)'))).toBe('0');
  });
  it('rejects malformed numbers', () => {
    expect(() => evaluate('1.2.3')).toThrow('Syntax error');
    expect(() => evaluate('1E3.5')).toThrow('Syntax error');
    expect(() => evaluate('E3')).toThrow('Syntax error');
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
