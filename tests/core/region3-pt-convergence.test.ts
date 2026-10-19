import { afterEach, describe, expect, it, vi } from 'vitest';
import { solveRegion3PTBasic } from '../../src/core/region3-pt.js';
import { region3ByRhoT } from '../../src/regions/region3.js';
import * as newton from '../../src/solvers/newton-raphson.js';

afterEach(() => vi.restoreAllMocks());

describe('Region 3 PT convergence', () => {
  it('rejects a stable density with an excessive pressure residual', () => {
    const p = 25;
    const T = 650;
    const rho = 488.8753162840478;
    const state = region3ByRhoT(rho, T);
    const relErr = Math.abs(state.pressure - p) / p;

    expect(relErr).toBeGreaterThan(1e-7);
    expect(relErr).toBeLessThan(1e-6);
    expect(state.cp).toBeGreaterThan(0);
    expect(state.cv).toBeGreaterThan(0);
    expect(state.isothermalCompressibility).toBeGreaterThan(0);
    expect(state.speedOfSound).toBeGreaterThan(0);
    vi.spyOn(newton, 'newtonRaphson').mockReturnValue(rho);

    expect(() => solveRegion3PTBasic(p, T)).toThrow('density solve did not converge');
  });

  it.each([
    [25, 650],
    [64.10754062861993, 625.55],
    [100, 623.15],
    [22.06399, 647.0959627047504],
  ])('retains target pressure after convergence at p=%s MPa, T=%s K', (p, T) => {
    const state = solveRegion3PTBasic(p, T);
    const eos = region3ByRhoT(1 / state.specificVolume, T);

    expect(Math.abs(eos.pressure - p) / p).toBeLessThanOrEqual(1e-12);
    expect(state.pressure).toBe(p);
    expect(state.temperature).toBe(T);
  });
});
