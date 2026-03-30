import { describe, expect, it } from 'vitest';
import { newtonRaphson } from '../../src/solvers/newton-raphson.js';
import { ConvergenceError } from '../../src/types.js';
import { expectDigitsClose } from '../helpers/assertions.js';

describe('newtonRaphson', () => {
  it('finds the root of a linear function', () => {
    const root = newtonRaphson((x) => x - 3, 5);
    expectDigitsClose(root, 3, 9);
  });

  it('finds the root of a quadratic', () => {
    const root = newtonRaphson((x) => x * x - 4, 3);
    expectDigitsClose(root, 2, 9);
  });

  it('uses the analytical derivative when provided', () => {
    const root = newtonRaphson(
      (x) => Math.cos(x) - x,
      1,
      (x) => -Math.sin(x) - 1,
    );

    expectDigitsClose(root, 0.7390851332, 9);
  });

  it('handles an exact-root initial guess without iterating away', () => {
    const root = newtonRaphson((x) => x - 7, 7);
    expect(root).toBe(7);
  });

  it('throws ConvergenceError when the function evaluates to a non-finite value', () => {
    expect(() =>
      newtonRaphson((x) => (x > 0 ? Number.POSITIVE_INFINITY : x), 1),
    ).toThrow(ConvergenceError);
  });

  it('throws ConvergenceError when the derivative collapses away from a root', () => {
    expect(() => newtonRaphson((x) => x * x + 1, 1)).toThrow(ConvergenceError);
  });

  it('throws ConvergenceError when the analytical derivative is non-finite', () => {
    expect(() =>
      newtonRaphson((x) => x - 1, 0, () => Number.NaN),
    ).toThrow(ConvergenceError);
  });

  it('throws ConvergenceError when maxIterations is exhausted', () => {
    expect(() =>
      newtonRaphson((x) => x * x - 2, 1, null, { maxIterations: 1 }),
    ).toThrow(ConvergenceError);
  });
});
