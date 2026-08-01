import { describe, expect, it } from 'vitest';
import { region3ByRhoT } from '../../src/regions/region3.js';
import { dampedNewton2D } from '../../src/solvers/damped-newton-2d.js';
import { ConvergenceError, IF97Error } from '../../src/types.js';

describe('dampedNewton2D', () => {
  it('solves a coupled linear system', () => {
    const [x, y] = dampedNewton2D(([a, b]) => ({
      residual: [a + b - 3, 2 * a - b],
      jacobian: [[1, 1], [2, -1]],
    }), [0, 0]);

    expect(x).toBeCloseTo(1, 12);
    expect(y).toBeCloseTo(2, 12);
  });

  it('damps a Newton step until it enters the valid domain', () => {
    const evaluated: number[] = [];
    const [x, y] = dampedNewton2D(([a, b]) => {
      evaluated.push(a);
      return {
        residual: [a * a - 4, b - 1],
        jacobian: [[2 * a, 0], [0, 1]],
      };
    }, [0.1, 0], {
      isValid: ([a]) => a > 0 && a <= 3,
    });

    expect(x).toBeCloseTo(2, 10);
    expect(y).toBeCloseTo(1, 10);
    expect(evaluated.every((value) => value > 0 && value <= 3)).toBe(true);
  });

  it('rejects an invalid initial point with ConvergenceError', () => {
    expect(() => dampedNewton2D(() => ({
      residual: [0, 0],
      jacobian: [[1, 0], [0, 1]],
    }), [-1, 0], {
      isValid: ([x]) => x > 0,
    })).toThrow(ConvergenceError);
  });

  it('rejects an invalid Region 3 density seed before evaluation', () => {
    try {
      dampedNewton2D(([rho, T]) => {
        const state = region3ByRhoT(rho, T);
        return {
          residual: [state.pressure - 25, state.enthalpy - 2000],
          jacobian: [[1, 0], [0, 1]],
        };
      }, [-1, 650], {
        isValid: ([rho, T]) => rho > 0 && T > 0,
      });
      throw new Error('expected dampedNewton2D to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(ConvergenceError);
      expect(error).toMatchObject({ solver: 'dampedNewton2D' });
    }
  });

  it('converts an IF97Error thrown by the evaluator to ConvergenceError', () => {
    expect(() => dampedNewton2D(() => {
      throw new IF97Error('invalid trial state');
    }, [1, 1])).toThrow(ConvergenceError);
  });

  it('rejects a singular Jacobian with ConvergenceError', () => {
    expect(() => dampedNewton2D(() => ({
      residual: [1, 1],
      jacobian: [[1, 1], [2, 2]],
    }), [0, 0])).toThrow(ConvergenceError);
  });

  it('rejects non-finite evaluations with ConvergenceError', () => {
    expect(() => dampedNewton2D(() => ({
      residual: [Number.NaN, 1],
      jacobian: [[1, 0], [0, 1]],
    }), [0, 0])).toThrow(ConvergenceError);
  });

  it('rejects a step that cannot reduce the residual', () => {
    expect(() => dampedNewton2D(() => ({
      residual: [1, 1],
      jacobian: [[1, 0], [0, 1]],
    }), [0, 0], { maxBacktracks: 3 })).toThrow(ConvergenceError);
  });
});
