import { describe, expect, it } from 'vitest';
import { detectRegionPH, detectRegionPS } from '../../src/detect.js';
import { Region, solve, solveBasic, solvePH, solvePS, solvePT, solvePx } from '../../src/index.js';
import { formulationSeamAtPressure } from '../../src/core/formulation-seams.js';

const modes = [
  { mode: 'PH', property: 'enthalpy', detect: detectRegionPH, backward: solvePH, tolerance: 1e-8 },
  { mode: 'PS', property: 'entropy', detect: detectRegionPS, backward: solvePS, tolerance: 1e-11 },
] as const;

describe.each(modes)('$mode saturation candidate ownership', ({ mode, property, detect, backward, tolerance }) => {
  it.each([0.1, 1, 10, 20].flatMap((p) => [-1e-7, -1e-8, 1e-8, 1e-7].map((offset) => ({ p, offset }))))(
    'preserves the single-phase root outside the saturation span at p=$p MPa, dT=$offset K', ({ p, offset }) => {
      const liquid = solvePx(p, 0);
      const vapor = solvePx(p, 1);
      const source = solvePT(p, liquid.temperature + offset);
      const target = source[property];
      expect(offset < 0 ? target < liquid[property] : target > vapor[property]).toBe(true);
      expect(source.quality).toBeNull();
      expect(detect(p, target)).toBe(source.region);
      const input = mode === 'PH' ? { mode, p, h: target } : { mode, p, s: target };

      for (const recovered of [backward(p, target), solve(input), solveBasic(input)]) {
        expect(recovered.region).toBe(source.region);
        expect(recovered.quality).toBeNull();
        expect(Math.abs(recovered[property] - target)).toBeLessThanOrEqual(tolerance);
        const checked = solvePT(p, recovered.temperature);
        expect(checked.region).toBe(source.region);
        expect(Math.abs(checked[property] - target)).toBeLessThanOrEqual(tolerance);
      }
    },
  );

  it.each([0.1, 1, 10, 20].flatMap((p) => [0, 0.5, 1].map((quality) => ({ p, quality }))))(
    'preserves the saturation root at p=$p MPa, x=$quality', ({ p, quality }) => {
      const source = solvePx(p, quality);
      const target = source[property];
      expect(detect(p, target)).toBe(Region.Region4);
      const input = mode === 'PH' ? { mode, p, h: target } : { mode, p, s: target };

      for (const recovered of [backward(p, target), solve(input), solveBasic(input)]) {
        expect(recovered.region).toBe(Region.Region4);
        expect(recovered.quality).toBeCloseTo(quality, 12);
        expect(recovered.temperature).toBe(source.temperature);
        expect(Math.abs(recovered[property] - target)).toBeLessThanOrEqual(tolerance);
      }
    },
  );

  it.each([
    { p: 1.3100948918132127, T: 465.11867525097915, property: 'entropy' },
    { p: 14.15786256402883, T: 610.7063761263745, property: 'enthalpy' },
    { p: 14.15786256402883, T: 610.7063761263745, property: 'entropy' },
  ].filter((entry) => entry.property === property))('uses the actual saturation span rather than an inverse-temperature reconstruction at p=$p', ({ p, T }) => {
    const source = solvePT(p, T);
    const target = source[property];
    const endpoint = solvePx(p, source.region === Region.Region1 ? 0 : 1);
    expect(source.region === Region.Region1 ? target < endpoint[property] : target > endpoint[property]).toBe(true);
    expect(detect(p, target)).toBe(source.region);
    const recovered = backward(p, target);
    expect(recovered.region).toBe(source.region);
    expect(Math.abs(recovered[property] - target)).toBeLessThanOrEqual(tolerance);
  });

  it('preserves saturation priority when the P13 target lies inside both valid branches', () => {
    const p = 16.52916425262254;
    const source = solvePT(p, 623.1500000000902);
    const liquid = solvePx(p, 0);
    const vapor = solvePx(p, 1);
    const target = source[property];
    expect(source.region).toBe(Region.Region2);
    expect(target).toBeGreaterThan(liquid[property]);
    expect(target).toBeLessThan(vapor[property]);
    expect(detect(p, target)).toBe(Region.Region4);
    const recovered = backward(p, target);
    expect(recovered.region).toBe(Region.Region4);
    expect(recovered.quality).toBeGreaterThan(0);
    expect(recovered.quality).toBeLessThan(1);
    expect(Math.abs(recovered[property] - target)).toBeLessThanOrEqual(tolerance);
  });

  it('keeps B23 overlap ownership when distant saturation endpoints are unavailable', () => {
    const p = 22.0639999;
    const seam = formulationSeamAtPressure(p, '23')!;
    const target = (seam.lower[property] + seam.upper[property]) / 2;
    expect(seam.upper[property]).toBeLessThan(seam.lower[property]);
    expect(() => solvePx(p, 1)).toThrow();
    expect(detect(p, target)).toBe(Region.Region3);
    const recovered = backward(p, target);
    expect(recovered.region).toBe(Region.Region3);
    expect(Math.abs(recovered[property] - target)).toBeLessThanOrEqual(tolerance);
  });
});
