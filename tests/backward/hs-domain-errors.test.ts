import { describe, expect, it, vi } from 'vitest';
import { H_MAX, H_MIN, P_MIN, R2_T_MAX, R5_P_MAX, R5_T_MAX, S_MAX, S_MIN, T_MIN } from '../../src/constants.js';
import { detectRegionHS } from '../../src/detect.js';
import { ConvergenceError, OutOfRangeError, solve, solveBasic, solveHS, solvePT } from '../../src/index.js';
import * as newton from '../../src/solvers/damped-newton-2d.js';
import { expectBackwardValue } from '../helpers/backward-assertions.js';

const outsideInputs = [
  { h: 6422, s: 6.7 },
  { h: 1500, s: 1 },
  { h: 7376.9, s: 9 },
  { h: 4500, s: 13 },
  { h: 0, s: 5 },
  { h: 0, s: -0.005 },
  { h: 0, s: 0.00001 },
  { h: 2500, s: 11 },
  { h: 1, s: -0.0001 },
  { h: 10, s: -0.0001 },
  { h: 10, s: 0.00001 },
  { h: 0, s: 9.1556 },
];
const routes = [
  { name: 'solveHS', run: solveHS },
  { name: 'solve', run: (h: number, s: number) => solve({ mode: 'HS', h, s }) },
  { name: 'solveBasic', run: (h: number, s: number) => solveBasic({ mode: 'HS', h, s }) },
];

describe('HS domain errors', () => {
  it.each(outsideInputs)('detects h=$h, s=$s outside the joint domain within global ranges', ({ h, s }) => {
    expect(h).toBeGreaterThanOrEqual(H_MIN);
    expect(h).toBeLessThanOrEqual(H_MAX);
    expect(s).toBeGreaterThanOrEqual(S_MIN);
    expect(s).toBeLessThanOrEqual(S_MAX);
    expect(detectRegionHS(h, s)).toBe(-1);
  });

  describe.each(routes)('$name', ({ run }) => {
    it.each(outsideInputs)('reports conditional bounds for h=$h, s=$s', ({ h, s }) => {
      let error: unknown;
      try {
        run(h, s);
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(OutOfRangeError);
      const range = error as OutOfRangeError;
      expect([range.value, range.min, range.max].every(Number.isFinite)).toBe(true);
      expect(range.min).toBeLessThanOrEqual(range.max);
      expect(range.value < range.min || range.value > range.max).toBe(true);
      expect(range.value === h || range.value === s).toBe(true);
      expect(range.min === H_MIN && range.max === H_MAX).toBe(false);
      expect(range.min === S_MIN && range.max === S_MAX).toBe(false);
      expect(range.message).toContain(String(s));
    });

    it('preserves a numerical failure for an admissible Region 5 input', () => {
      const forward = solvePT(1, 1500);
      const failure = new ConvergenceError('dampedNewton2D', 3);
      const refinement = vi.spyOn(newton, 'dampedNewton2D').mockImplementation(() => {
        throw failure;
      });
      try {
        expect(() => run(forward.enthalpy, forward.entropy)).toThrow(failure);
        expect(refinement).toHaveBeenCalled();
      } finally {
        refinement.mockRestore();
      }
    });
  });

  it.each([
    { p: P_MIN, T: R2_T_MAX + 1e-4 },
    { p: R5_P_MAX, T: R2_T_MAX + 1e-4 },
    { p: P_MIN, T: 1500 },
    { p: R5_P_MAX, T: 1500 },
    { p: P_MIN, T: R5_T_MAX },
    { p: R5_P_MAX, T: R5_T_MAX },
    { p: 1, T: R5_T_MAX },
  ])('round-trips the Region 5 envelope at p=$p, T=$T', ({ p, T }) => {
    const forward = solvePT(p, T);
    expect(detectRegionHS(forward.enthalpy, forward.entropy)).not.toBe(-1);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expectBackwardValue(recovered.pressure, p, 'pressure');
    expectBackwardValue(recovered.temperature, T, 'temperature');
  });

  it.each([P_MIN, 1, 18.93846365 - 1e-4, 18.93846365 + 1e-4, 30, 60, 100])('round-trips the minimum-temperature Region 1 envelope at p=%s', (p) => {
    const forward = solvePT(p, T_MIN);
    expect(detectRegionHS(forward.enthalpy, forward.entropy)).not.toBe(-1);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expectBackwardValue(recovered.pressure, p, 'pressure');
    expectBackwardValue(recovered.temperature, T_MIN, 'temperature');
  });

  it('preserves the admissible low-entropy Region 1 branch near minimum temperature', () => {
    const recovered = solveHS(1, 0.00001);
    const checked = solvePT(recovered.pressure, recovered.temperature);
    expectBackwardValue(checked.enthalpy, 1, 'enthalpy');
    expectBackwardValue(checked.entropy, 0.00001, 'entropy');
  });

  it.each([
    { edge: 'Region 2 minimum pressure', p: P_MIN, T: 700, bound: 'min', delta: -1e-6 },
    { edge: 'minimum pressure', p: P_MIN, T: 1500, bound: 'min', delta: -1e-6 },
    { edge: 'maximum pressure', p: R5_P_MAX, T: 1500, bound: 'max', delta: 1e-6 },
    { edge: 'maximum temperature', p: 1, T: R5_T_MAX, bound: 'max', delta: 1e-6 },
  ] as const)('reports the native $edge boundary for a nearby outside point', ({ p, T, bound, delta }) => {
    const forward = solvePT(p, T);
    const h = forward.enthalpy + delta;
    expect(detectRegionHS(h, forward.entropy)).toBe(-1);
    for (const { run } of routes) {
      let error: unknown;
      try {
        run(h, forward.entropy);
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(OutOfRangeError);
      const range = error as OutOfRangeError;
      expect(range.value).toBe(h);
      expect(range[bound]).toBeCloseTo(forward.enthalpy, 6);
      expect(range.value < range.min || range.value > range.max).toBe(true);
    }
  });
});
