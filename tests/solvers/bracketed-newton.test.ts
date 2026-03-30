import { describe, it, expect } from 'vitest';
import { bracketedNewton } from '../../src/solvers/bracketed-newton.js';
import { ConvergenceError, IF97Error } from '../../src/types.js';
import { expectDigitsClose } from '../helpers/assertions.js';

describe('bracketedNewton', () => {
  it('finds root of a linear function', () => {
    const root = bracketedNewton((x) => x - 3, 0, 10, 5);
    expectDigitsClose(root, 3, 9);
  });

  it('finds root of a quadratic', () => {
    const root = bracketedNewton((x) => x * x - 4, 0, 10, 3);
    expectDigitsClose(root, 2, 9);
  });

  it('finds root when initial guess is outside bracket (clamped to midpoint)', () => {
    const root = bracketedNewton((x) => x - 5, 0, 10, -100);
    expectDigitsClose(root, 5, 9);
  });

  it('returns immediately when lower endpoint is the root', () => {
    const root = bracketedNewton((x) => x, 0, 10);
    expect(root).toBe(0);
  });

  it('returns immediately when upper endpoint is the root', () => {
    const root = bracketedNewton((x) => x - 10, 0, 10);
    expect(root).toBe(10);
  });

  it('throws IF97Error when bracket signs are the same', () => {
    expect(() => bracketedNewton((x) => x + 1, 0, 10)).toThrow(IF97Error);
    expect(() => bracketedNewton((x) => x + 1, 0, 10)).toThrow(/same sign/);
  });

  it('throws ConvergenceError when maxIterations exceeded', () => {
    // Use a valid bracket with 0 iterations allowed to force exhaustion
    expect(() =>
      bracketedNewton((x) => x - 5, 0, 10, undefined, { maxIterations: 0 }),
    ).toThrow(ConvergenceError);
  });

  it('respects a custom tolerance', () => {
    const root = bracketedNewton((x) => x - 1.23456789, 0, 2, 1, { tolerance: 1e-12 });
    expect(Math.abs(root - 1.23456789)).toBeLessThan(1e-12);
  });

  it('handles reversed bracket bounds', () => {
    const root = bracketedNewton((x) => x - 3, 10, 0, 5);
    expectDigitsClose(root, 3, 9);
  });
});
