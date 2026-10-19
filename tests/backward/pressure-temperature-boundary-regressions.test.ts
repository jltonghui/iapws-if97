import { describe, expect, it } from 'vitest';
import {
  AmbiguousStateError, Region, solve, solveBasic, solvePH, solvePS, solvePT,
  solvePx, solveTH, solveTS, solveTx,
} from '../../src/index.js';
import { detectRegionPH, detectRegionPS, detectRegionTH, detectRegionTS } from '../../src/detect.js';

describe('pressure and temperature boundary regressions', () => {
  it.each([
    { mode: 'PH', p: 63.0888757113034, T: 792.1787594124675, target: 2669.4980664601635 },
    { mode: 'PS', p: 91.0055339189541, T: 847.5488050909946, target: 5.08397295403419 },
    { mode: 'PH', p: 0.0006115963643032312, T: 273.1586357018311, target: 2500.9084874970854 },
  ] as const)('recovers the Region 2 $mode root within boundary roundoff at p=$p', ({ mode, p, T, target }) => {
    const property = mode === 'PH' ? 'enthalpy' : 'entropy';
    const tolerance = mode === 'PH' ? 1e-9 : 1e-12;
    const source = solvePT(p, T);
    const input = mode === 'PH' ? { mode, p, h: target } : { mode, p, s: target };
    expect(source.region).toBe(Region.Region2);
    expect(Math.abs(source[property] - target)).toBeLessThanOrEqual(tolerance);
    expect(mode === 'PH' ? detectRegionPH(p, target) : detectRegionPS(p, target)).toBe(Region.Region2);

    for (const recovered of [
      mode === 'PH' ? solvePH(p, target) : solvePS(p, target),
      solve(input),
      solveBasic(input),
    ]) {
      expect(recovered.region).toBe(Region.Region2);
      expect(recovered.pressure).toBe(p);
      expect(Math.abs(recovered[property] - target)).toBeLessThanOrEqual(tolerance);
      const checked = solvePT(p, recovered.temperature);
      expect(checked.region).toBe(Region.Region2);
      expect(checked[property]).toBe(recovered[property]);
    }
  });

  it.each([
    { mode: 'TH', property: 'enthalpy', target: 2563.592003887833, tolerance: 1e-9 },
    { mode: 'TS', property: 'entropy', target: 5.21088782492956, tolerance: 1e-12 },
  ] as const)('reports both physical $mode roots at the P13 corner', ({ mode, property, target, tolerance }) => {
    const T = 623.1500000000902;
    const source = solvePT(16.52916425262254, T);
    expect(source.region).toBe(Region.Region2);
    expect(Math.abs(source[property] - target)).toBeLessThanOrEqual(tolerance);
    const input = mode === 'TH' ? { mode, T, h: target } : { mode, T, s: target };

    for (const run of [
      () => mode === 'TH' ? solveTH(T, target) : solveTS(T, target),
      () => solve(input),
      () => solveBasic(input),
      () => mode === 'TH' ? detectRegionTH(T, target) : detectRegionTS(T, target),
    ]) {
      let error: unknown;
      try { run(); } catch (caught) { error = caught; }
      expect(error).toBeInstanceOf(AmbiguousStateError);
      const candidates = (error as AmbiguousStateError).candidates;
      expect(candidates.map((state) => state.region).sort()).toEqual([Region.Region2, Region.Region4]);
      for (const candidate of candidates) {
        expect(candidate.temperature).toBe(T);
        expect(Math.abs(candidate[property] - target)).toBeLessThanOrEqual(tolerance);
        const checked = candidate.region === Region.Region4
          ? solveTx(T, candidate.quality!) : solvePT(candidate.pressure, T);
        expect(checked.region).toBe(candidate.region);
        expect(checked[property]).toBe(candidate[property]);
      }
    }
  });

  it.each(['enthalpy', 'entropy'] as const)('keeps saturation priority for fixed-pressure $property at P13', (property) => {
    const source = solvePT(16.52916425262254, 623.1500000000902);
    const target = source[property];
    expect(source.region).toBe(Region.Region2);
    expect(property === 'enthalpy'
      ? detectRegionPH(source.pressure, target) : detectRegionPS(source.pressure, target)).toBe(Region.Region4);
    const recovered = property === 'enthalpy'
      ? solvePH(source.pressure, target) : solvePS(source.pressure, target);
    expect(recovered.region).toBe(Region.Region4);
    expect(recovered.quality).toBeGreaterThan(0);
    expect(recovered.quality).toBeLessThan(1);
    expect(solvePx(source.pressure, recovered.quality!)[property]).toBe(recovered[property]);
  });
});
