import { describe, expect, it } from 'vitest';
import { detectRegionHS } from '../../src/detect.js';
import { formulationSeamAtPressure } from '../../src/core/formulation-seams.js';
import { Region, solve, solveBasic, solveHS, solvePT, solveTx } from '../../src/index.js';

describe('HS interior roots next to formulation gaps', () => {
  it.each([
    { p: 16.529164579092946, T: 623.1500000006232, region: Region.Region3 },
    { p: 61.13675890219045, T: 787.7747187870362, region: Region.Region2 },
  ])('recovers the Region $region root at p=$p MPa', ({ p, T, region }) => {
    const source = solvePT(p, T);
    const h = source.enthalpy, s = source.entropy;
    expect(source.region).toBe(region);
    expect(detectRegionHS(h, s)).toBe(region);
    for (const state of [solveHS(h, s), solve({ mode: 'HS', h, s }), solveBasic({ mode: 'HS', h, s })]) {
      expect(state.region).toBe(region);
      for (const checked of [state, solvePT(state.pressure, state.temperature)]) {
        expect(checked.region).toBe(region);
        expect(Math.abs(checked.enthalpy - h)).toBeLessThanOrEqual(1e-9);
        expect(Math.abs(checked.entropy - s)).toBeLessThanOrEqual(1e-12);
      }
    }
  });

  it('keeps saturation priority when a valid two-phase root also exists', () => {
    const source = solvePT(16.52915060088343, 623.1505123980968);
    expect(source.region).toBe(Region.Region2);
    const h = source.enthalpy, s = source.entropy;
    expect(detectRegionHS(h, s)).toBe(Region.Region4);
    for (const state of [solveHS(h, s), solve({ mode: 'HS', h, s }), solveBasic({ mode: 'HS', h, s })]) {
      expect(state.region).toBe(Region.Region4);
      expect(state.quality).toBeGreaterThan(0);
      expect(state.quality).toBeLessThan(1);
      const checked = solveTx(state.temperature, state.quality!);
      expect(Math.abs(checked.enthalpy - h)).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(checked.entropy - s)).toBeLessThanOrEqual(1e-12);
    }
  });

  it('retains the canonical EOS fallback for a genuine Region 2/5 gap', () => {
    const pair = formulationSeamAtPressure(30, '25')!;
    const h = (pair.lower.enthalpy + pair.upper.enthalpy) / 2;
    const s = (pair.lower.entropy + pair.upper.entropy) / 2;
    expect(detectRegionHS(h, s)).toBe(Region.Region2);
    for (const state of [solveHS(h, s), solve({ mode: 'HS', h, s }), solveBasic({ mode: 'HS', h, s })]) {
      expect(state.region).toBe(Region.Region2);
      expect(state.temperature).toBe(pair.temperature);
      expect(Math.abs(state.enthalpy - h)).toBeGreaterThan(1e-9);
      expect(Math.abs(state.enthalpy - h)).toBeLessThanOrEqual(
        Math.abs(pair.upper.enthalpy - pair.lower.enthalpy) + 1e-9,
      );
      expect(Math.abs(state.entropy - s)).toBeLessThanOrEqual(
        Math.abs(pair.upper.entropy - pair.lower.entropy) + 1e-12,
      );
      const checked = solvePT(state.pressure, state.temperature);
      expect(checked.region).toBe(state.region);
      expect(checked.enthalpy).toBe(state.enthalpy);
      expect(checked.entropy).toBe(state.entropy);
    }
  });
});
