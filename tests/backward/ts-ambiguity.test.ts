import { describe, expect, it } from 'vitest';
import { AmbiguousStateError, IF97Error, Region, solve, solvePT, solvePx, solveTS, solveTx } from '../../src/index.js';
import { detectRegionTS } from '../../src/detect.js';
import { saturationPressure } from '../../src/saturation.js';
import { boundary23_T_to_P } from '../../src/boundaries.js';
import { region1, region2 } from '../../src/regions.js';
import { expectBackwardValue, expectRegion4RoundTrip } from '../helpers/backward-assertions.js';

describe('TS uniqueness', () => {
  it.each([
    [22.054, 1],
    [22.063, 1 - 1e-9],
    [22.063, 1],
  ])('preserves the pressure-family vapor endpoint at p=%s, x=%s', (pressure, quality) => {
    const forward = solvePx(pressure, quality);
    const recovered = solveTS(forward.temperature, forward.entropy);

    expect(recovered.region).toBe(Region.Region4);
    expect(recovered.quality).not.toBeNull();
    expect(Math.abs(recovered.quality! - quality)).toBeLessThan(1e-8);
    expect(Math.abs(recovered.entropy - forward.entropy)).toBeLessThanOrEqual(1e-12);
    expect(recovered.temperature).toBe(forward.temperature);
    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure', 1e-9);
  });

  it('rejects two liquid roots and a wet state through every public TS entry point', () => {
    const T = 274.15;
    const first = solvePT(1, T);
    const second = solvePT(28.139514663979547, T);
    const wet = solveTx(T, 0.000005293319033232329);

    expect(first.region).toBe(Region.Region1);
    expect(second.region).toBe(Region.Region1);
    expect(wet.region).toBe(Region.Region4);
    expect(first.isobaricExpansion).toBeLessThan(0);
    expect(second.isobaricExpansion).toBeGreaterThan(0);
    expect(Math.abs(second.entropy - first.entropy)).toBeLessThan(1e-10);
    expect(Math.abs(wet.entropy - first.entropy)).toBeLessThan(1e-10);

    for (const run of [
      () => solveTS(T, first.entropy),
      () => solve({ mode: 'TS', T, s: first.entropy }),
      () => solve({ mode: 'TS', temperature: T, entropy: first.entropy }),
      () => detectRegionTS(T, first.entropy),
    ]) {
      expect(run).toThrow(AmbiguousStateError);
      expect(run).toThrow(IF97Error);
      expect(run).toThrow(/T-s.*s=.*kJ\/\(kg·K\)/);
    }
  });

  it('rejects two liquid roots below the triple point instead of reporting no state', () => {
    const T = 273.155;
    const first = solvePT(1, T);
    const second = solvePT(37.669245638433054, T);
    expect(first.region).toBe(Region.Region1);
    expect(second.region).toBe(Region.Region1);
    expect(Math.abs(second.entropy - first.entropy)).toBeLessThan(1e-10);

    expect(() => solveTS(T, first.entropy)).toThrow(AmbiguousStateError);
    expect(() => detectRegionTS(T, first.entropy)).toThrow(AmbiguousStateError);
  });

  it('counts the liquid root immediately inside an excluded saturation endpoint', () => {
    const forward = solvePT(0.0006116125558738073, 273.159);
    expect(forward.region).toBe(Region.Region1);
    expect(() => solveTS(forward.temperature, forward.entropy)).toThrow(AmbiguousStateError);
    expect(() => detectRegionTS(forward.temperature, forward.entropy)).toThrow(AmbiguousStateError);
  });

  it('recovers a vapor whose entropy rounds to an excluded endpoint value', () => {
    const T = 273.159;
    const forward = solvePT(saturationPressure(T) * (1 - Number.EPSILON), T);
    const recovered = solveTS(T, forward.entropy);

    expect(forward.region).toBe(Region.Region2);
    expect(recovered.region).toBe(forward.region);
    expect(recovered.pressure).toBeLessThan(saturationPressure(T));
    expect(recovered.entropy).toBe(forward.entropy);
    expectBackwardValue(solvePT(recovered.pressure, T).entropy, forward.entropy, 'entropy');
  });

  it.each([700, 850])('recovers an exact floating endpoint match at B23, T=%s K', (T) => {
    const boundary = boundary23_T_to_P(T);
    const bits = new DataView(new ArrayBuffer(8));
    bits.setFloat64(0, boundary);
    bits.setBigUint64(0, bits.getBigUint64(0) - 1n);
    const forward = solvePT(bits.getFloat64(0), T);
    const recovered = solveTS(T, forward.entropy);

    expect(forward.region).toBe(Region.Region2);
    expect(recovered.region).toBe(forward.region);
    expect(recovered.pressure).toBeLessThan(boundary);
    expect(recovered.entropy).toBe(forward.entropy);
  });

  it.each([650, 700])('prefers the owned root only in a B23 overlap at T=%s K', (T) => {
    const s = region2(boundary23_T_to_P(T), T).entropy + 5e-13;
    const recovered = solveTS(T, s);
    expect(recovered.region).toBe(T === 650 ? Region.Region3 : Region.Region2);
    expect(recovered.entropy).toBe(s);
    expectBackwardValue(solvePT(recovered.pressure, T).entropy, s, 'entropy');
  });

  it('preserves the unique tangent root below the triple point', () => {
    const maximum = solvePT(18.91573061865241, 273.155);
    expect(Math.abs(maximum.isobaricExpansion!)).toBeLessThan(1e-12);
    expect(solvePT(maximum.pressure - 0.01, maximum.temperature).entropy).toBeLessThan(maximum.entropy);
    expect(solvePT(maximum.pressure + 0.01, maximum.temperature).entropy).toBeLessThan(maximum.entropy);

    const recovered = solveTS(maximum.temperature, maximum.entropy);
    expect(recovered.region).toBe(Region.Region1);
    expectBackwardValue(recovered.pressure, maximum.pressure, 'pressure', 1e-5);
    expect(recovered.entropy).toBe(maximum.entropy);
    expect(detectRegionTS(maximum.temperature, maximum.entropy)).toBe(Region.Region1);
  });

  it('keeps two nearby liquid roots distinct below an entropy maximum', () => {
    const maximum = solvePT(18.91573061865241, 273.155);
    const s = maximum.entropy - 1e-7;
    expect(() => solveTS(maximum.temperature, s)).toThrow(AmbiguousStateError);
    expect(() => detectRegionTS(maximum.temperature, s)).toThrow(AmbiguousStateError);
  });

  it('distinguishes no root above an entropy maximum from ambiguity', () => {
    const maximum = solvePT(18.91573061865241, 273.155);
    const s = maximum.entropy + 1e-7;
    expect(detectRegionTS(maximum.temperature, s)).toBe(-1);
    expect(() => solveTS(maximum.temperature, s)).toThrow(IF97Error);
    expect(() => solveTS(maximum.temperature, s)).not.toThrow(AmbiguousStateError);
  });

  it('rejects an entropy maximum that also matches a wet state', () => {
    const maximum = solvePT(14.342775610085017, 274.15);
    const liquid = solveTx(maximum.temperature, 0);
    const vapor = solveTx(maximum.temperature, 1);
    const x = (maximum.entropy - liquid.entropy) / (vapor.entropy - liquid.entropy);
    const wet = solveTx(maximum.temperature, x);
    expect(Math.abs(maximum.isobaricExpansion!)).toBeLessThan(1e-12);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(1);
    expect(Math.abs(wet.entropy - maximum.entropy)).toBeLessThan(1e-10);
    expect(() => solveTS(maximum.temperature, maximum.entropy)).toThrow(AmbiguousStateError);
    expect(() => detectRegionTS(maximum.temperature, maximum.entropy)).toThrow(AmbiguousStateError);
  });

  it('does not let a saturation endpoint hide a second liquid root', () => {
    const saturated = solveTx(274.15, 0);
    const compressed = solvePT(29.210718380353228, saturated.temperature);
    expect(Math.abs(compressed.entropy - saturated.entropy)).toBeLessThan(1e-10);
    expect(() => solveTS(saturated.temperature, saturated.entropy)).toThrow(AmbiguousStateError);
    expect(() => detectRegionTS(saturated.temperature, saturated.entropy)).toThrow(AmbiguousStateError);
  });

  it('does not snap a unique cold liquid state to the nearby saturation entropy', () => {
    const T = 277.15;
    const forward = solvePT(0.001, T);
    const saturated = solveTx(T, 0);
    const entropyGap = saturated.entropy - forward.entropy;
    expect(entropyGap).toBeGreaterThan(1e-12);
    expect(entropyGap).toBeLessThan(1e-9);

    const recovered = solveTS(T, forward.entropy);
    expect(recovered.region).toBe(Region.Region1);
    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure', 1e-6);
    expect(recovered.entropy).toBe(forward.entropy);
    expect(Math.abs(solvePT(recovered.pressure, T).entropy - forward.entropy)).toBeLessThan(1e-12);
    expect(detectRegionTS(T, forward.entropy)).toBe(Region.Region1);
  });

  it('recovers pressure near the density maximum despite a small entropy derivative', () => {
    const T = 277.1444;
    const pressure = 0.0018727;
    const forward = solvePT(pressure, T);
    const recovered = solveTS(T, forward.entropy);

    expect(recovered.region).toBe(Region.Region1);
    expect(Math.abs(recovered.pressure - pressure) / pressure).toBeLessThan(1e-5);
    expect(Math.abs(region1(recovered.pressure, T).entropy - forward.entropy)).toBeLessThan(1e-14);
  });

  it.each([
    { T: 274.15, p: 100, region: Region.Region1 },
    { T: 274.15, p: 0.00062, region: Region.Region2 },
    { T: 640, p: 19, region: Region.Region3 },
  ])('recovers the unique state at T=$T K, p=$p MPa', ({ T, p, region }) => {
    const forward = solvePT(p, T);
    expect(forward.region).toBe(region);
    const recovered = solveTS(T, forward.entropy);
    expect(recovered.region).toBe(region);
    expectBackwardValue(recovered.pressure, p, 'pressure');
    expect(recovered.entropy).toBe(forward.entropy);
    expectBackwardValue(solvePT(recovered.pressure, T).entropy, forward.entropy, 'entropy');
    expect(detectRegionTS(T, forward.entropy)).toBe(region);
  });

  it.each([0, 1])('counts the shared Region 3/4 endpoint x=%s as one state', (x) => {
    const saturated = solveTx(640, x);
    const recovered = solveTS(saturated.temperature, saturated.entropy);
    expectRegion4RoundTrip(recovered, saturated);
    expect(detectRegionTS(saturated.temperature, saturated.entropy)).toBe(Region.Region4);
  });

  it('counts a near-critical PT liquid and its shared saturation endpoint as one state', () => {
    const T = 647.0949;
    const forward = solvePT(saturationPressure(T), T);
    const recovered = solveTS(T, forward.entropy);

    expect(recovered.region).toBe(Region.Region4);
    expect(recovered.quality).toBe(0);
    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure');
    expect(recovered.temperature).toBe(T);
    expect(recovered.entropy).toBe(forward.entropy);
    expectBackwardValue(solvePT(recovered.pressure, T).entropy, forward.entropy, 'entropy');
  });

  it('recovers a near-critical liquid state outside the endpoint matching tolerance', () => {
    const T = 647.0949;
    const forward = solvePT(saturationPressure(T) + 1e-6, T);
    const saturated = solveTx(T, 0);
    expect(Math.abs(forward.entropy - saturated.entropy)).toBeGreaterThan(1e-9);

    const recovered = solveTS(T, forward.entropy);
    expect(recovered.region).toBe(Region.Region3);
    expect(recovered.density).toBeGreaterThan(322);
    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure');
    expect(recovered.entropy).toBe(forward.entropy);
    expectBackwardValue(solvePT(recovered.pressure, T).entropy, forward.entropy, 'entropy');
  });
});
