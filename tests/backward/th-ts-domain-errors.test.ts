import { afterEach, expect, it, vi } from 'vitest';
import { P_MAX, P_MIN, R5_P_MAX } from '../../src/constants.js';
import { detectRegionTH, detectRegionTS } from '../../src/detect.js';
import { ConvergenceError, IF97Error, OutOfRangeError, solve, solveBasic, solveTH, solveTS } from '../../src/index.js';
import { region1 } from '../../src/regions/region1.js';
import { region2 } from '../../src/regions/region2.js';
import { saturationPressure } from '../../src/regions/region4.js';
import { region5 } from '../../src/regions/region5.js';
import { uniqueFixedTemperatureState } from '../../src/backward/fixed-temperature-candidates.js';
import * as pressureSolver from '../../src/backward/fixed-temperature-solver.js';

afterEach(() => vi.restoreAllMocks());

it.each([
  { mode: 'TH' as const, value: 4000 },
  { mode: 'TS' as const, value: 10 },
])('rejects the reported $mode combination with OutOfRangeError', ({ mode, value }) => {
  const input = mode === 'TH' ? { mode, T: 300, h: value } : { mode, T: 300, s: value };
  for (const run of [
    () => mode === 'TH' ? solveTH(300, value) : solveTS(300, value),
    () => solve(input),
    () => solveBasic(input),
  ]) {
    expect(run).toThrow(OutOfRangeError);
  }
});

it.each([
  { T: 300, property: 'enthalpy' as const },
  { T: 300, property: 'entropy' as const },
  { T: 1500, property: 'enthalpy' as const },
  { T: 1500, property: 'entropy' as const },
])('reports both native $property limits at T=$T K', ({ T, property }) => {
  const endpoints = T === 300
    ? [region1(saturationPressure(T), T), region1(P_MAX, T), region2(P_MIN, T)]
    : [region5(P_MIN, T), region5(R5_P_MAX, T)];
  const min = Math.min(...endpoints.map((state) => state[property]));
  const max = Math.max(...endpoints.map((state) => state[property]));
  for (const value of [min - 1e-4, max + 1e-4]) {
    const input = property === 'enthalpy' ? { mode: 'TH' as const, T, h: value } : { mode: 'TS' as const, T, s: value };
    for (const run of [
      () => property === 'enthalpy' ? solveTH(T, value) : solveTS(T, value),
      () => solve(input),
      () => solveBasic(input),
    ]) {
      let error: unknown;
      try { run(); } catch (caught) { error = caught; }
      expect(error).toBeInstanceOf(OutOfRangeError);
      expect(error).toMatchObject({ value, min, max });
      expect((error as OutOfRangeError).parameter).toContain(`T=${T} K`);
    }
    expect(property === 'enthalpy' ? detectRegionTH(T, value) : detectRegionTS(T, value)).toBe(-1);
  }
});

it('uses an interior stationary enthalpy minimum in the conditional range', () => {
  const T = 523.15;
  const minimum = region1(6.506932487320858, T).enthalpy;
  let error: unknown;
  try { solveTH(T, minimum - 1e-6); } catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(OutOfRangeError);
  expect((error as OutOfRangeError).min).toBeCloseTo(minimum, 9);
});

it.each(['enthalpy', 'entropy'] as const)('keeps an unproven interior %s gap distinct from a range error', (property) => {
  const T = 273.155;
  const value = property === 'enthalpy' ? 1000 : 4;
  expect(uniqueFixedTemperatureState(T, value, property)).toBeNull();
  const run = () => property === 'enthalpy' ? solveTH(T, value) : solveTS(T, value);
  expect(run).toThrow(IF97Error);
  expect(run).not.toThrow(OutOfRangeError);
  expect(property === 'enthalpy' ? detectRegionTH(T, value) : detectRegionTS(T, value)).toBe(-1);
});

for (const failure of [
  new IF97Error('Numerical inconsistency at injected root'),
  new ConvergenceError('bracketedNewton', 3),
]) {
  it.each(['enthalpy', 'entropy'] as const)(`preserves the original ${failure.name} for %s in solvers and detection`, (property) => {
    const T = 1500;
    const value = region5(1, T)[property];
    const input = property === 'enthalpy' ? { mode: 'TH' as const, T, h: value } : { mode: 'TS' as const, T, s: value };
    vi.spyOn(pressureSolver, 'solveFixedTemperaturePressure').mockImplementation(() => { throw failure; });
    expect.assertions(4);
    for (const run of [
      () => property === 'enthalpy' ? solveTH(T, value) : solveTS(T, value),
      () => solve(input),
      () => solveBasic(input),
      () => property === 'enthalpy' ? detectRegionTH(T, value) : detectRegionTS(T, value),
    ]) {
      try { run(); } catch (error) { expect(error).toBe(failure); }
    }
  });
}
