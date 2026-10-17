import { afterEach, describe, expect, it, vi } from 'vitest';
import { R2_T_MAX, R5_T_MAX, T_MIN } from '../../src/constants.js';
import { ConvergenceError, solve, solveBasic, solvePH, solvePS, solvePT } from '../../src/index.js';
import * as newton from '../../src/solvers/damped-newton-2d.js';

const modes = [
  {
    name: 'PH', property: 'enthalpy', reportedValue: 4359.57, delta: 1e-6, backward: solvePH,
    unified: (p: number, value: number) => solve({ mode: 'PH', p, h: value }),
    basic: (p: number, value: number) => solveBasic({ mode: 'PH', p, h: value }),
  },
  {
    name: 'PS', property: 'entropy', reportedValue: 7, delta: 1e-9, backward: solvePS,
    unified: (p: number, value: number) => solve({ mode: 'PS', p, s: value }),
    basic: (p: number, value: number) => solveBasic({ mode: 'PS', p, s: value }),
  },
] as const;

afterEach(() => vi.restoreAllMocks());

describe.each(modes)('$name conditional domain errors', ({ property, reportedValue, delta, backward, unified, basic }) => {
  it('reports the pressure-dependent ceiling for the reported input', () => {
    for (const run of [backward, unified, basic]) {
      expect(() => run(88.2, reportedValue)).toThrowError(expect.objectContaining({
        name: 'OutOfRangeError',
        parameter: expect.stringContaining('p=88.2'),
        value: reportedValue,
        min: expect.closeTo(solvePT(88.2, T_MIN)[property], 9),
        max: expect.closeTo(solvePT(88.2, R2_T_MAX)[property], 9),
      }));
    }
  });

  it.each([
    { p: 50, Tmax: R5_T_MAX },
    { p: 50 + 1e-6, Tmax: R2_T_MAX },
  ])('reports conditional bounds on both sides of the 50 MPa limit at p=$p', ({ p, Tmax }) => {
    const minimum = solvePT(p, T_MIN)[property];
    const maximum = solvePT(p, Tmax)[property];
    for (const value of [minimum - delta, maximum + delta]) {
      for (const run of [backward, unified, basic]) {
        expect(() => run(p, value)).toThrowError(expect.objectContaining({
          name: 'OutOfRangeError',
          parameter: expect.stringContaining(`p=${p}`),
          value,
          min: expect.closeTo(minimum, 9),
          max: expect.closeTo(maximum, 9),
        }));
      }
    }
  });

  it.each([50, 50 + 1e-6])('keeps the native minimum-temperature endpoint at p=%s', (p) => {
    const forward = solvePT(p, T_MIN);
    for (const run of [backward, unified, basic]) {
      const recovered = run(p, forward[property]);
      expect(recovered.pressure).toBe(p);
      expect(recovered.temperature).toBeCloseTo(T_MIN, 9);
      expect(Math.abs(recovered[property] - forward[property])).toBeLessThan(property === 'enthalpy' ? 1e-9 : 1e-12);
      const reconstructed = solvePT(recovered.pressure, recovered.temperature);
      expect(Math.abs(recovered[property] - reconstructed[property])).toBeLessThan(property === 'enthalpy' ? 1e-9 : 1e-12);
    }
  });

  it('preserves a numerical failure for an admissible Region 3 input', () => {
    const forward = solvePT(25, 650);
    const failure = new ConvergenceError('dampedNewton2D', 3);
    const refinement = vi.spyOn(newton, 'dampedNewton2D').mockImplementation(() => { throw failure; });
    for (const run of [backward, unified, basic]) {
      expect(() => run(forward.pressure, forward[property])).toThrow(failure);
    }
    expect(refinement).toHaveBeenCalledTimes(3);
  });
});
