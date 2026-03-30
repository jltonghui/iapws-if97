import { describe, expect, it } from 'vitest';
import { nelderMead } from '../../src/solvers/nelder-mead.js';
import { ConvergenceError } from '../../src/types.js';
import { expectDigitsClose } from '../helpers/assertions.js';

describe('nelderMead', () => {
  it('finds the minimum of a simple quadratic', () => {
    const result = nelderMead((x) => (x[0] - 3) ** 2, [0]);
    expectDigitsClose(result.x[0], 3, 8);
    expect(result.fx).toBeLessThan(1e-12);
  });

  it('finds the minimum of a 2D quadratic bowl', () => {
    const result = nelderMead(
      (x) => (x[0] - 1.5) ** 2 + (x[1] + 2) ** 2,
      [5, 5],
    );

    expectDigitsClose(result.x[0], 1.5, 7);
    expectDigitsClose(result.x[1], -2, 7);
    expect(result.fx).toBeLessThan(1e-10);
  });

  it('converges from an all-zero initial simplex using zeroDelta initialization', () => {
    const result = nelderMead(
      (x) => (x[0] - 1) ** 2 + (x[1] - 1) ** 2,
      [0, 0],
    );

    expectDigitsClose(result.x[0], 1, 6);
    expectDigitsClose(result.x[1], 1, 6);
  });

  it('throws ConvergenceError when the objective is non-finite at the starting point', () => {
    expect(() =>
      nelderMead(() => Number.NaN, [0]),
    ).toThrow(ConvergenceError);
  });

  it('throws ConvergenceError when maxIterations is exhausted', () => {
    expect(() =>
      nelderMead((x) => (x[0] - 1) ** 2, [0], { maxIterations: 0 }),
    ).toThrow(ConvergenceError);
  });

  it('throws ConvergenceError when reduction cannot proceed with sigma >= 1', () => {
    expect(() =>
      nelderMead(
        (x) => (x[0] - 1) ** 2,
        [0],
        { sigma: 1, maxIterations: 5 },
      ),
    ).toThrow(ConvergenceError);
  });
});
