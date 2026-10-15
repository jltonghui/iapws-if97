import { afterEach, describe, expect, it, vi } from 'vitest';
import * as region3PT from '../../src/core/region3-pt.js';
import {
  solveHS,
  solvePH,
  solvePS,
  solvePx as solvePxPublic,
  solveTH,
  solveTS,
  solveTx,
} from '../../src/index.js';
import { solvePx } from '../../src/saturation/two-phase.js';

afterEach(() => vi.restoreAllMocks());

describe('retained saturation endpoints', () => {
  it('retains both Region 3 phases without solving their densities again', () => {
    const solveEndpoint = vi.spyOn(region3PT, 'solveRegion3StateAtPressure');
    const state = solvePx(20, 0.4);

    expect(state.saturation).toBeDefined();
    expect(state.saturation!.liquid.enthalpy).toBeLessThan(state.enthalpy);
    expect(state.saturation!.vapor.enthalpy).toBeGreaterThan(state.enthalpy);
    expect(solveEndpoint).toHaveBeenCalledTimes(2);
  });

  it.each([0, 1])('retains both phases at quality %s without changing endpoint derivatives', (quality) => {
    const state = solvePx(20, quality);

    expect(state.saturation).toBeDefined();
    const endpoint = quality === 0 ? state.saturation!.liquid : state.saturation!.vapor;
    expect(state.enthalpy).toBe(endpoint.enthalpy);
    expect(state.cp).toBe(endpoint.cp);
    expect(state.cp).toBeGreaterThan(0);
    expect(endpoint.region).toBe(3);
    expect(endpoint.quality).toBeNull();
    expect(state.quality).toBe(quality);
  });

  it('exposes both phases through the public solver without additional density solves', () => {
    const solveEndpoint = vi.spyOn(region3PT, 'solveRegion3StateAtPressure');
    const state = solvePxPublic(20, 0.4);

    expect(state.saturation).toBeDefined();
    expect(state.saturation!.liquid.enthalpy).toBeLessThan(state.enthalpy);
    expect(state.saturation!.vapor.enthalpy).toBeGreaterThan(state.enthalpy);
    expect(solveEndpoint).toHaveBeenCalledTimes(2);
  });

  it.each(['Px', 'Tx', 'PH', 'PS', 'HS', 'TH', 'TS'] as const)(
    'preserves saturation endpoints through the public %s path',
    (mode) => {
      const forward = solveTx(640, 0.4);
      const { pressure: p, temperature: T, enthalpy: h, entropy: s } = forward;
      const state = {
        Px: () => solvePxPublic(p, 0.4),
        Tx: () => solveTx(T, 0.4),
        PH: () => solvePH(p, h),
        PS: () => solvePS(p, s),
        HS: () => solveHS(h, s),
        TH: () => solveTH(T, h),
        TS: () => solveTS(T, s),
      }[mode]();

      expect(state.region).toBe(4);
      expect(state.saturation).toBeDefined();
      expect(state.saturation!.liquid.enthalpy).toBeCloseTo(forward.saturation!.liquid.enthalpy, 7);
      expect(state.saturation!.vapor.enthalpy).toBeCloseTo(forward.saturation!.vapor.enthalpy, 7);
      for (const endpoint of [state.saturation!, state.saturation!.liquid, state.saturation!.vapor]) {
        expect(endpoint.pressure).toBe(state.pressure);
        expect(endpoint.temperature).toBe(state.temperature);
      }
    },
  );

  it.each([
    ['raw', solvePx],
    ['public', solvePxPublic],
  ] as const)('keeps %s endpoints acyclic and isolated between calls', (_, solver) => {
    const state = solver(20, 0.4);
    const liquidEnthalpy = state.saturation!.liquid.enthalpy;

    expect(state.saturation!.liquid).not.toHaveProperty('saturation');
    expect(state.saturation!.vapor).not.toHaveProperty('saturation');
    expect(() => JSON.stringify(state)).not.toThrow();
    state.saturation!.liquid.enthalpy = -1;
    expect(solver(20, 0.4).saturation!.liquid.enthalpy).toBe(liquidEnthalpy);
  });

  it('keeps repeated triple-point HS results isolated after endpoint mutation', () => {
    const forward = solveTx(273.16, 0.4);
    const state = solveHS(forward.enthalpy, forward.entropy);
    const liquidEnthalpy = state.saturation!.liquid.enthalpy;

    state.saturation!.liquid.enthalpy = -1;
    expect(solveHS(forward.enthalpy, forward.entropy).saturation!.liquid.enthalpy).toBe(liquidEnthalpy);
  });
});
