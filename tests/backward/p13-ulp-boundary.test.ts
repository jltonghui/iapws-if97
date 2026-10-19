import { describe, expect, it } from 'vitest';
import { detectRegionPH, detectRegionPS } from '../../src/detect.js';
import { Region, solve, solveBasic, solveHS, solvePH, solvePS, solvePT, solvePx, solveTx } from '../../src/index.js';
import { nextPositiveFloat } from '../../src/core/floating-point.js';
import { region1 } from '../../src/regions/region1.js';
import { saturationPressure } from '../../src/regions/region4.js';

const P13 = saturationPressure(623.15);
const modes = [
  { mode: 'PH', property: 'enthalpy', backward: solvePH, detect: detectRegionPH, tolerance: 1e-9 },
  { mode: 'PS', property: 'entropy', backward: solvePS, detect: detectRegionPS, tolerance: 1e-12 },
] as const;

describe('P13 ULP boundary candidates', () => {
  it.each([
    { mode: 'PH', p: 16.529164252604577, target: 2563.5920038884210, region: Region.Region2 },
    { mode: 'PH', p: 16.529164252604566, target: 1670.8582182746063, region: Region.Region1 },
    { mode: 'PS', p: 16.529164252605163, target: 3.7783235587712434, region: Region.Region3 },
  ] as const)('recovers the reported $mode target at p=$p without absorbing it into Region 4', ({ mode, p, target, region }) => {
    const { property, backward, detect, tolerance } = modes.find((entry) => entry.mode === mode)!;
    const liquid = solvePx(p, 0)[property];
    const vapor = solvePx(p, 1)[property];
    expect(target < liquid || target > vapor).toBe(true);
    expect(detect(p, target)).toBe(region);
    const input = mode === 'PH' ? { mode, p, h: target } : { mode, p, s: target };
    for (const recovered of [backward(p, target), solve(input), solveBasic(input)]) {
      expect(recovered.region).toBe(region);
      expect(recovered.quality).toBeNull();
      expect(recovered.pressure).toBe(p);
      expect(Math.abs(recovered[property] - target)).toBeLessThanOrEqual(tolerance);
      const checked = solvePT(p, recovered.temperature);
      expect(checked.region).toBe(region);
      expect(checked[property]).toBe(recovered[property]);
    }
  });

  it.each(modes)('keeps the PT-owned vapor below P13 in $mode', ({ property, backward, detect, tolerance }) => {
    const source = solvePT(16.52916425260452, 623.1499999999997);
    expect(source.region).toBe(Region.Region2);
    expect(source[property]).toBeGreaterThan(solvePx(source.pressure, 1)[property]);
    expect(detect(source.pressure, source[property])).toBe(Region.Region2);
    const recovered = backward(source.pressure, source[property]);
    expect(recovered.region).toBe(Region.Region2);
    expect(Math.abs(recovered[property] - source[property])).toBeLessThanOrEqual(tolerance);
    expect(solvePT(recovered.pressure, recovered.temperature).region).toBe(Region.Region2);
  });

  it('preserves a PT-consistent inverse for adjacent Region 1 enthalpy rounding', () => {
    const source = region1(22.685, nextPositiveFloat(623.15, -1));
    expect(solvePT(source.pressure, source.temperature).region).toBe(Region.Region1);
    const recovered = solvePH(source.pressure, source.enthalpy);
    expect(detectRegionPH(source.pressure, source.enthalpy)).toBe(recovered.region);
    const checked = solvePT(recovered.pressure, recovered.temperature);
    expect(checked.region).toBe(recovered.region);
    expect(Math.abs(checked.enthalpy - source.enthalpy)).toBeLessThanOrEqual(1e-9);
  });

  it.each([0, 1])('preserves the P13 Px/Tx endpoint x=%s through PH, PS and HS', (quality) => {
    for (const source of [solvePx(P13, quality), solveTx(623.15, quality)]) {
      for (const { property, backward, detect, tolerance } of modes) {
        expect(detect(source.pressure, source[property])).toBe(Region.Region4);
        const recovered = backward(source.pressure, source[property]);
        expect(recovered.region).toBe(Region.Region4);
        expect(recovered.quality).toBe(quality);
        expect(Math.abs(recovered[property] - source[property])).toBeLessThanOrEqual(tolerance);
      }
      const hs = solveHS(source.enthalpy, source.entropy);
      expect(hs.region).toBe(Region.Region4);
      expect(Math.abs(hs.enthalpy - source.enthalpy)).toBeLessThanOrEqual(1e-7);
      expect(Math.abs(hs.entropy - source.entropy)).toBeLessThanOrEqual(1e-10);
    }
  });

  it.each(modes)('resolves nearby PT sources and adjacent property floats through $mode', ({ property, backward, detect }) => {
    const tolerance = property === 'enthalpy' ? 1e-8 : 1e-11;
    for (const dp of [-4e-12, -2e-12, -5e-14, 0, 5e-14, 2e-12, 4e-12]) {
      const p = P13 + dp;
      const liquid = solvePx(p, 0)[property];
      const vapor = solvePx(p, 1)[property];
      for (const T of [623.15 - 3e-11, 623.15 - 8e-12, nextPositiveFloat(623.15, -1),
        623.15, nextPositiveFloat(623.15, 1), 623.15 + 8e-12, 623.15 + 3e-11]) {
        const source = solvePT(p, T);
        for (const target of [nextPositiveFloat(source[property], -1), source[property],
          nextPositiveFloat(source[property], 1)]) {
          const recovered = backward(p, target);
          expect(detect(p, target)).toBe(recovered.region);
          expect(recovered.region === Region.Region4).toBe(liquid <= target && target <= vapor);
          expect(Math.abs(recovered[property] - target)).toBeLessThanOrEqual(tolerance);
          if (recovered.region !== Region.Region4) {
            const checked = solvePT(recovered.pressure, recovered.temperature);
            expect(checked.region).toBe(recovered.region);
            expect(Math.abs(checked[property] - target)).toBeLessThanOrEqual(tolerance);
          }
        }
      }
    }
  });
});
