import { describe, expect, it } from 'vitest';
import {
  findHSSeam,
  formulationSeamAtPressure,
  formulationSeamAtTemperature,
  matchFixedSeam,
} from '../../src/core/formulation-seams.js';
import { B23_P_MIN, P_MIN } from '../../src/constants.js';
import { Region } from '../../src/types.js';
import { boundary23_T_to_P } from '../../src/regions/boundaries.js';
import { region2 } from '../../src/regions/region2.js';
import { saturationPressure } from '../../src/regions/region4.js';

describe('formulation seam geometry', () => {
  it.each([
    { seam: '13' as const, p: 66, region: Region.Region1, T: 623.15 },
    { seam: '23' as const, p: 30, region: Region.Region3, T: null },
    { seam: '25' as const, p: 50, region: Region.Region2, T: 1073.15 },
  ])('evaluates both $seam equations at the same native boundary', ({ seam, p, region, T }) => {
    const pair = formulationSeamAtPressure(p, seam)!;
    expect(pair).not.toBeNull();
    expect(pair.canonical.region).toBe(region);
    expect(pair.lower.pressure).toBe(p);
    expect(pair.upper.pressure).toBe(p);
    expect(pair.lower.temperature).toBe(pair.upper.temperature);
    if (T !== null) expect(pair.temperature).toBe(T);
  });

  it('keeps artificial seams inside their shared domains', () => {
    expect(formulationSeamAtPressure(B23_P_MIN, '13')).toBeNull();
    expect(formulationSeamAtPressure(saturationPressure(623.15), '13')).toBeNull();
    expect(formulationSeamAtPressure((B23_P_MIN + saturationPressure(623.15)) / 2, '13')).toBeNull();
    expect(formulationSeamAtPressure(100, '23')!.canonical.region).toBe(Region.Region3);
    expect(formulationSeamAtTemperature(623.15)).toBeNull();
    expect(formulationSeamAtTemperature(623.1500000000001)).toBeNull();
    expect(formulationSeamAtTemperature(863.15)).toBeNull();
    expect(formulationSeamAtPressure(50.000001, '25')).toBeNull();
    expect(formulationSeamAtPressure(P_MIN, '25')).not.toBeNull();
  });

  it.each([
    B23_P_MIN,
    (B23_P_MIN + saturationPressure(623.15)) / 2,
    16.52916425260358,
    saturationPressure(623.15),
    boundary23_T_to_P(623.15),
  ])('rejects the B23 corner outside the Region 3 domain at p=%s MPa', (p) => {
    expect(formulationSeamAtPressure(p, '23')).toBeNull();
  });

  it.each([16.5292, 100])('retains B23 pressure seams above the corner at p=%s MPa', (p) => {
    const pair = formulationSeamAtPressure(p, '23')!;
    expect(pair.temperature).toBeGreaterThan(623.15);
    expect(pair.canonical.region).toBe(Region.Region3);
  });

  it('retains the exact Region 2 corner above the final native B23 float', () => {
    const pair = formulationSeamAtPressure(100, '23')!;
    const corner = region2(100, 863.15);
    for (const property of ['enthalpy', 'entropy'] as const) {
      const match = matchFixedSeam(pair, property, corner[property])!;
      expect(match.kind).toBe('canonical');
      expect(match.state.region).toBe(Region.Region2);
      expect(match.state.temperature).toBe(863.15);
    }
    expect(findHSSeam(corner.enthalpy, corner.entropy)!.state.region).toBe(Region.Region2);
  });

  it('recognizes the Region 3 endpoint of the B13 ribbon at 80 MPa', () => {
    const pair = formulationSeamAtPressure(80, '13')!;
    const match = findHSSeam(pair.upper.enthalpy, pair.upper.entropy);
    expect(match).not.toBeNull();
    expect(match!.pair.pressure).toBeCloseTo(80, 7);
  });

  it.each([
    { T: 650, kind: 'overlap' },
    { T: 700, kind: 'gap' },
  ])('uses the actual local B23 span at T=$T', ({ T, kind }) => {
    const pair = formulationSeamAtTemperature(T)!;
    for (const property of ['enthalpy', 'entropy'] as const) {
      const target = (pair.lower[property] + pair.upper[property]) / 2;
      const match = matchFixedSeam(pair, property, target, 'temperature')!;
      expect(match.kind).toBe(kind);
      expect(match.state).toBe(pair.canonical);
      expect(Math.abs(match.state[property] - target)).toBeLessThanOrEqual(match.budgets[property]);
      const outside = Math.max(pair.lower[property], pair.upper[property]);
      const bits = new BigUint64Array(new Float64Array([outside]).buffer);
      bits[0] += 1n;
      expect(matchFixedSeam(pair, property, new Float64Array(bits.buffer)[0], 'temperature')).toBeNull();
    }
  });

  it.each([
    { seam: '13' as const, p: 66 },
    { seam: '23' as const, p: 30 },
    { seam: '25' as const, p: 30 },
    { seam: '25' as const, p: 50 },
  ])('locates the coupled $seam h-s ribbon at p=$p', ({ seam, p }) => {
    const pair = formulationSeamAtPressure(p, seam)!;
    const h = (pair.lower.enthalpy + pair.upper.enthalpy) / 2;
    const s = (pair.lower.entropy + pair.upper.entropy) / 2;
    const match = findHSSeam(h, s)!;
    expect(match).not.toBeNull();
    expect(match.pair.seam).toBe(seam);
    expect(match.pair.pressure).toBeCloseTo(p, 5);
    expect(Math.abs(match.state.enthalpy - h)).toBeLessThanOrEqual(match.budgets.enthalpy);
    expect(Math.abs(match.state.entropy - s)).toBeLessThanOrEqual(match.budgets.entropy);
  });

  it('rejects h and s taken from unrelated boundary coordinates', () => {
    const highPressure = formulationSeamAtPressure(30, '25')!;
    const lowPressure = formulationSeamAtPressure(1, '25')!;
    expect(findHSSeam(
      highPressure.canonical.enthalpy,
      lowPressure.canonical.entropy,
    )).toBeNull();
  });

  it.each([625, 640, 650, 660, 675, 700, 725, 750, 800, 850, 860])(
    'locates B23 ribbons on both sides of the entropy folds at T=%s K', (T) => {
      const pair = formulationSeamAtTemperature(T)!;
      const match = findHSSeam(
        (pair.lower.enthalpy + pair.upper.enthalpy) / 2,
        (pair.lower.entropy + pair.upper.entropy) / 2,
      )!;
      expect(match).not.toBeNull();
      expect(match.pair.temperature).toBeCloseTo(T, 5);
    },
  );
});
