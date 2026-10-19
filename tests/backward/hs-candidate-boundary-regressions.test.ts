import { describe, expect, it } from 'vitest';
import { Region, solveHS, solvePT, solvePx, solveTx } from '../../src/index.js';
import { detectRegionHS } from '../../src/detect.js';
import { region2 } from '../../src/regions/region2.js';
import { region5 } from '../../src/regions/region5.js';

describe('HS candidate boundaries', () => {
  it('keeps an out-of-dome liquid input on its single-phase root', () => {
    const h = 164.54293477820008;
    const s = 0.5628454681846428;
    const recovered = solveHS(h, s);
    expect(recovered.region).toBe(Region.Region1);
    expect(Math.abs(recovered.enthalpy - h)).toBeLessThan(1e-9);
    expect(Math.abs(recovered.entropy - s)).toBeLessThan(1e-12);
  });

  it('returns a reconstructed root instead of a clamped vapor endpoint when HS has multiple roots', () => {
    const h = 2563.592408806321;
    const s = 5.210888474722529;
    const recovered = solveHS(h, s);
    expect([Region.Region2, Region.Region4]).toContain(recovered.region);
    if (recovered.region === Region.Region4) {
      expect(recovered.quality).toBeGreaterThan(0);
      expect(recovered.quality).toBeLessThan(1);
    }
    expect(Math.abs(recovered.enthalpy - h)).toBeLessThan(1e-9);
    expect(Math.abs(recovered.entropy - s)).toBeLessThan(1e-12);
  });

  it('preserves a Region 3 vapor endpoint within the existing quality resolution', () => {
    const forward = solvePT(17.969098460653143, 630);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expect(recovered.region).toBe(Region.Region4);
    expect(recovered.quality).toBe(1);
    expect(Math.abs(recovered.enthalpy - forward.enthalpy)).toBeLessThan(1e-7);
    expect(Math.abs(recovered.entropy - forward.entropy)).toBeLessThan(1e-10);
    expect(recovered.viscosity).not.toBeNull();
  });

  it('accepts a converged mixture at the lower end of the Region 3 saturation interval', () => {
    const forward = solvePx(16.52916425260623, 1e-6);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expect(recovered.region).toBe(Region.Region4);
    expect(recovered.quality).toBeGreaterThan(0);
    expect(recovered.quality).toBeLessThan(1);
    const reconstructed = solveTx(recovered.temperature, recovered.quality!);
    expect(Math.abs(reconstructed.enthalpy - forward.enthalpy)).toBeLessThan(1e-9);
    expect(Math.abs(reconstructed.entropy - forward.entropy)).toBeLessThan(1e-12);
  });

  it.each([
    { h: 3926.0526767410993, s: 6.522664370752368 },
    (() => {
      const source = solvePT(49.99945, 1073.1500000006);
      return { h: source.enthalpy, s: source.entropy };
    })(),
  ])('keeps an admissible Region 5 interior root above its approximate entropy boundary', ({ h, s }) => {
    expect(detectRegionHS(h, s)).toBe(Region.Region5);
    const recovered = solveHS(h, s);
    expect(recovered.region).toBe(Region.Region5);
    expect(recovered.temperature).toBeGreaterThan(1073.15);
    const reconstructed = solvePT(recovered.pressure, recovered.temperature);
    expect(reconstructed.region).toBe(Region.Region5);
    expect(Math.abs(reconstructed.enthalpy - h)).toBeLessThan(1e-9);
    expect(Math.abs(reconstructed.entropy - s)).toBeLessThan(1e-12);
  });

  it('keeps a genuine Region 2/5 formulation gap on its canonical seam', () => {
    const lower = region2(50, 1073.15);
    const upper = region5(50, 1073.15);
    const h = (lower.enthalpy + upper.enthalpy) / 2;
    const s = (lower.entropy + upper.entropy) / 2;
    expect(detectRegionHS(h, s)).toBe(Region.Region2);
    const recovered = solveHS(h, s);
    expect(recovered.region).toBe(Region.Region2);
    expect(recovered.temperature).toBe(1073.15);
    expect(recovered.enthalpy).toBeLessThan(h);
  });
});
