import { describe, expect, it, vi } from 'vitest';
import { detectRegionHS } from '../../src/detect.js';
import { ConvergenceError, OutOfRangeError, Region, solve, solveBasic, solveHS, solvePT } from '../../src/index.js';
import * as hsState from '../../src/backward/hs-state.js';
import * as newton from '../../src/solvers/damped-newton-2d.js';
import { formulationSeamAtPressure } from '../../src/core/formulation-seams.js';

describe('HS candidates at the Region 1/3 maximum-pressure corner', () => {
  it.each([
    { p: 100, T: 623.1499999999999, region: Region.Region1 },
    { p: 100, T: 623.15, region: Region.Region1 },
    { p: 100, T: 623.1500000000001, region: Region.Region3 },
    { p: 100, T: 623.150000001, region: Region.Region3 },
    { p: 100, T: 623.1500000003482, region: Region.Region3 },
    { p: 100, T: 623.15001, region: Region.Region3 },
    { p: 100, T: 623.1505992310506, region: Region.Region3 },
    { p: 100, T: 623.151, region: Region.Region3 },
    { p: 99.99999999999966, T: 623.150000000001, region: Region.Region3 },
  ])('keeps the PT-owned Region $region root at p=$p, T=$T', ({ p, T, region }) => {
    const source = solvePT(p, T);
    const h = source.enthalpy, s = source.entropy;
    expect(source.region).toBe(region);
    expect(detectRegionHS(h, s)).toBe(region);
    for (const candidate of [solveHS(h, s), solve({ mode: 'HS', h, s }), solveBasic({ mode: 'HS', h, s })]) {
      expect(candidate.region).toBe(region);
      expect(candidate.pressure).toBeLessThanOrEqual(100);
      const reconstructed = solvePT(candidate.pressure, candidate.temperature);
      expect(reconstructed.region).toBe(region);
      expect(Math.abs(reconstructed.enthalpy - h)).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(reconstructed.entropy - s)).toBeLessThanOrEqual(1e-12);
    }
  });

  it.each([1e-7, 1e-4])('rejects an enthalpy excess of %s beyond the pressure corner', (excess) => {
    const source = solvePT(100, 623.1500000000001);
    const h = source.enthalpy + excess, s = source.entropy;
    expect(detectRegionHS(h, s)).toBe(-1);
    for (const run of [
      () => solveHS(h, s),
      () => solve({ mode: 'HS', h, s }),
      () => solveBasic({ mode: 'HS', h, s }),
    ]) expect(run).toThrow(OutOfRangeError);
  });

  it('rejects a distant upper-envelope violation before probing nearby roots', () => {
    const h = 2000, s = 3.3977675988147995;
    expect(detectRegionHS(h, s)).toBe(-1);
    for (const run of [
      () => solveHS(h, s),
      () => solve({ mode: 'HS', h, s }),
      () => solveBasic({ mode: 'HS', h, s }),
    ]) expect(run).toThrow(OutOfRangeError);
  });

  it('reuses the candidate selected during classification', () => {
    const source = solvePT(100, 623.1500000000001);
    const refinement = vi.spyOn(newton, 'dampedNewton2D');
    try {
      expect(solveHS(source.enthalpy, source.entropy).region).toBe(Region.Region3);
      expect(refinement).toHaveBeenCalledOnce();
    } finally {
      refinement.mockRestore();
    }
  });

  it('preserves numerical failure when the nearby candidates cannot be evaluated', () => {
    const source = solvePT(100, 623.1500000000001);
    const failure = new ConvergenceError('dampedNewton2D', 3);
    const refinement = vi.spyOn(hsState, 'solveHSInRegion').mockImplementation(() => { throw failure; });
    try {
      expect(() => solveHS(source.enthalpy, source.entropy)).toThrow(failure);
      expect(() => detectRegionHS(source.enthalpy, source.entropy)).toThrow(failure);
    } finally {
      refinement.mockRestore();
    }
  });

  it('reports a numerical seam failure consistently in the solver and detector', () => {
    const seam = formulationSeamAtPressure(30, '25')!;
    const h = (seam.lower.enthalpy + seam.upper.enthalpy) / 2;
    const s = (seam.lower.entropy + seam.upper.entropy) / 2;
    const failure = new ConvergenceError('dampedNewton2D', 3);
    const refinement = vi.spyOn(newton, 'dampedNewton2D').mockImplementation(() => { throw failure; });
    try {
      expect(() => solveHS(h, s)).toThrow(failure);
      expect(() => detectRegionHS(h, s)).toThrow(failure);
    } finally {
      refinement.mockRestore();
    }
  });
});
