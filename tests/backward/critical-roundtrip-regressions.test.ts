import { describe, expect, it, vi } from 'vitest';
import { ConvergenceError, IF97Error, Region, solveBasic, solvePH, solvePS, solvePT } from '../../src/index.js';
import { region3PressureResidual } from '../../src/regions/region3.js';
import type { BasicProperties } from '../../src/types.js';
import { solveRegion3StateAtPressure } from '../../src/core/region3-pt.js';
import * as newton from '../../src/solvers/newton-raphson.js';

function expectStable(state: BasicProperties): void {
  expect(state.region).toBe(Region.Region3);
  for (const value of [state.cp, state.cv, state.isothermalCompressibility, state.speedOfSound]) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
  }
}

describe('stable Region 3 roots next to the critical point', () => {
  it.each([
    { T: 647.0959627047504, rho0: 316.83519291206136, error: new ConvergenceError('vapor', 1) },
    { T: 647.0959627047504, rho0: 327.8662860193438, error: new ConvergenceError('liquid', 1) },
    { T: 647.096000000022, rho0: 316.842, error: new IF97Error('unrelated EOS failure') },
  ])('preserves the original failure at T=$T, rho0=$rho0', ({ T, rho0, error }) => {
    const spy = vi.spyOn(newton, 'newtonRaphson').mockImplementation(() => { throw error; });
    let caught: unknown;
    try {
      solveRegion3StateAtPressure(22.06399, T, rho0);
    } catch (failure) {
      caught = failure;
    } finally {
      spy.mockRestore();
    }
    expect(caught).toBe(error);
  });

  it('recovers PT when unrestricted Newton crosses the unstable density interval', () => {
    const p = 22.063999999999957;
    const T = 647.096000000022;
    for (const state of [solvePT(p, T), solveBasic({ mode: 'PT', p, T })]) {
      expectStable(state);
      const rho = 1 / state.specificVolume;
      const densityError = Math.abs(region3PressureResidual(rho, T, p)) *
        rho * state.isothermalCompressibility!;
      expect(densityError).toBeLessThan(1e-9);
      expect(state.pressure).toBe(p);
      expect(state.temperature).toBe(T);
    }
  });

  it.each([22.063999999999993, 22.06399999999999, 22.06399999999])(
    'recovers stable PH/PS roots below Pc at p=%s', (p) => {
      const source = solvePT(p, 647.0960000000001);
      expectStable(source);
      for (const state of [
        solvePH(p, source.enthalpy),
        solvePS(p, source.entropy),
        solveBasic({ mode: 'PH', p, h: source.enthalpy }),
        solveBasic({ mode: 'PS', p, s: source.entropy }),
      ]) {
        expectStable(state);
        expect(Math.abs(state.pressure - p)).toBeLessThan(1e-12);
        expect(Math.abs(state.enthalpy - source.enthalpy)).toBeLessThan(1e-6);
        expect(Math.abs(state.entropy - source.entropy)).toBeLessThan(1e-9);
        const reconstructed = solvePT(state.pressure, state.temperature);
        expect(Math.abs(reconstructed.enthalpy - source.enthalpy)).toBeLessThan(1e-6);
        expect(Math.abs(reconstructed.entropy - source.entropy)).toBeLessThan(1e-9);
      }
    },
  );

  it.each([647.096, 647.0960000000001])('keeps PH/PS reconstructible immediately above Pc at T=%s', (T) => {
    const p = 22.064000000000004;
    const source = solvePT(p, T);
    for (const state of [
      solvePH(p, source.enthalpy),
      solvePS(p, source.entropy),
      solveBasic({ mode: 'PH', p, h: source.enthalpy }),
      solveBasic({ mode: 'PS', p, s: source.entropy }),
    ]) {
      expectStable(state);
      expect(Math.abs(state.enthalpy - source.enthalpy)).toBeLessThan(1e-6);
      expect(Math.abs(state.entropy - source.entropy)).toBeLessThan(1e-9);
      const reconstructed = solvePT(state.pressure, state.temperature);
      expectStable(reconstructed);
      expect(Math.abs(reconstructed.enthalpy - source.enthalpy)).toBeLessThan(1e-6);
      expect(Math.abs(reconstructed.entropy - source.entropy)).toBeLessThan(1e-9);
    }
  });
});
