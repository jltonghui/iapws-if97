import { describe, expect, it } from 'vitest';
import { AmbiguousStateError, IF97Error, Region, solve, solvePT, solvePx, solveTH, solveTx } from '../../src/index.js';
import { detectRegionTH } from '../../src/detect.js';
import { boundary23_T_to_P } from '../../src/boundaries.js';
import { saturationPressure } from '../../src/saturation.js';
import { region2 } from '../../src/regions.js';
import { expectBackwardValue, expectRegion4RoundTrip } from '../helpers/backward-assertions.js';

describe('TH uniqueness', () => {
  it.each([
    [22.054, 1],
    [22.063, 1 - 1e-9],
    [22.063, 1],
  ])('preserves the pressure-family vapor endpoint at p=%s, x=%s', (pressure, quality) => {
    const forward = solvePx(pressure, quality);
    const recovered = solveTH(forward.temperature, forward.enthalpy);

    expect(recovered.region).toBe(Region.Region4);
    expect(recovered.quality).not.toBeNull();
    expect(Math.abs(recovered.quality! - quality)).toBeLessThan(1e-8);
    expect(Math.abs(recovered.enthalpy - forward.enthalpy)).toBeLessThanOrEqual(1e-9);
    expect(recovered.temperature).toBe(forward.temperature);
    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure', 1e-9);
  });

  it('rejects liquid/wet ambiguity through every public TH entry point', () => {
    const wet = solveTx(473.15, 0.001);
    const liquid = solvePT(6.276280047308887, wet.temperature);

    expect(wet.region).toBe(Region.Region4);
    expect(liquid.region).toBe(Region.Region1);
    expectBackwardValue(liquid.enthalpy, wet.enthalpy, 'enthalpy', 1e-9);

    for (const run of [
      () => solveTH(wet.temperature, wet.enthalpy),
      () => solve({ mode: 'TH', T: wet.temperature, h: wet.enthalpy }),
      () => solve({ mode: 'TH', temperature: wet.temperature, enthalpy: wet.enthalpy }),
      () => detectRegionTH(wet.temperature, wet.enthalpy),
    ]) {
      expect(run).toThrow(AmbiguousStateError);
      expect(run).toThrow(/ambig/i);
    }
  });

  it.each([
    { T: 523.15, p1: 5, p2: 8.036947068569134 },
    { T: 573.15, p1: 40, p2: 83.51342452706831 },
    { T: 573.15, p1: 100, p2: 29.396228428433915 },
  ])('rejects two liquid roots at T=$T K, p=$p1/$p2 MPa', ({ T, p1, p2 }) => {
    const first = solvePT(p1, T);
    const second = solvePT(p2, T);

    expect(first.region).toBe(Region.Region1);
    expect(second.region).toBe(Region.Region1);
    expectBackwardValue(second.enthalpy, first.enthalpy, 'enthalpy', 1e-9);
    expect(() => solveTH(T, first.enthalpy)).toThrow(AmbiguousStateError);
    expect(() => solveTH(T, first.enthalpy)).toThrow(/ambig/i);
    expect(() => detectRegionTH(T, first.enthalpy)).toThrow(AmbiguousStateError);
    expect(() => detectRegionTH(T, first.enthalpy)).toThrow(/ambig/i);
  });

  it('preserves the single tangent root at an isotherm minimum', () => {
    const minimum = solvePT(6.506932487320858, 523.15);
    expect(Math.abs(1 - minimum.temperature * minimum.isobaricExpansion!)).toBeLessThan(1e-12);
    expect(solvePT(minimum.pressure - 0.01, minimum.temperature).enthalpy).toBeGreaterThan(minimum.enthalpy);
    expect(solvePT(minimum.pressure + 0.01, minimum.temperature).enthalpy).toBeGreaterThan(minimum.enthalpy);

    const recovered = solveTH(minimum.temperature, minimum.enthalpy);
    expect(recovered.region).toBe(Region.Region1);
    expectBackwardValue(recovered.pressure, minimum.pressure, 'pressure', 1e-5);
    expectBackwardValue(recovered.enthalpy, minimum.enthalpy, 'enthalpy', 1e-9);
    expect(detectRegionTH(minimum.temperature, minimum.enthalpy)).toBe(Region.Region1);
  });

  it.each([
    { T: 523.15, p: 6.506932487320858 },
    { T: 573.15, p: 59.94379720981708 },
  ])('keeps two nearby roots distinct above the minimum at T=$T K', ({ T, p }) => {
    const h = solvePT(p, T).enthalpy + 1e-6;
    expect(() => solveTH(T, h)).toThrow(AmbiguousStateError);
    expect(() => solveTH(T, h)).toThrow(/ambig/i);
  });

  it('does not let a saturation endpoint hide a second liquid root', () => {
    const saturated = solveTx(523.15, 0);
    const compressed = solvePT(9.103729939512032, saturated.temperature);
    expectBackwardValue(compressed.enthalpy, saturated.enthalpy, 'enthalpy', 1e-9);
    expect(() => solveTH(saturated.temperature, saturated.enthalpy)).toThrow(AmbiguousStateError);
    expect(() => detectRegionTH(saturated.temperature, saturated.enthalpy)).toThrow(AmbiguousStateError);
  });

  it.each([0, 1])('counts the shared Region 3/4 endpoint x=%s as one state', (x) => {
    const saturated = solveTx(640, x);
    const recovered = solveTH(saturated.temperature, saturated.enthalpy);
    expectRegion4RoundTrip(recovered, saturated);
    expect(detectRegionTH(saturated.temperature, saturated.enthalpy)).toBe(Region.Region4);
  });

  it('recovers the unique subcritical Region 3 vapor state', () => {
    const vapor = solvePT(19, 640);
    const saturated = solveTx(640, 1);
    expect(vapor.region).toBe(Region.Region3);
    expect(vapor.pressure).toBeLessThan(saturated.pressure);

    const recovered = solveTH(vapor.temperature, vapor.enthalpy);
    expect(recovered.region).toBe(Region.Region3);
    expectBackwardValue(recovered.pressure, vapor.pressure, 'pressure');
    expect(detectRegionTH(vapor.temperature, vapor.enthalpy)).toBe(Region.Region3);
  });

  it.each([700, 800])('preserves the PT-owned Region 3 state on B23 at T=%s K', (T) => {
    const forward = solvePT(boundary23_T_to_P(T), T);
    expect(forward.region).toBe(Region.Region3);

    const recovered = solveTH(T, forward.enthalpy);
    expect(recovered.region).toBe(forward.region);
    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure');
    expectBackwardValue(solvePT(recovered.pressure, T).enthalpy, forward.enthalpy, 'enthalpy');
    expect(detectRegionTH(T, forward.enthalpy)).toBe(forward.region);
  });

  it.each([99.999, 99.9976519710708, 100])('keeps the unique Region 2 state at the upper B23 temperature, p=%s MPa', (p) => {
    const forward = solvePT(p, 863.15);
    expect(forward.region).toBe(Region.Region2);

    const recovered = solveTH(forward.temperature, forward.enthalpy);
    expect(recovered.region).toBe(forward.region);
    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure');
    expectBackwardValue(solvePT(recovered.pressure, forward.temperature).enthalpy, forward.enthalpy, 'enthalpy');
  });

  it('detects both vapor and wet states at the 623.15 K formulation seam', () => {
    const T = 623.1500001;
    const vapor = solvePT(saturationPressure(T) - 1e-4, T);
    const saturatedLiquid = solveTx(T, 0);
    const saturatedVapor = solveTx(T, 1);
    const quality = (vapor.enthalpy - saturatedLiquid.enthalpy) /
      (saturatedVapor.enthalpy - saturatedLiquid.enthalpy);
    const wet = solveTx(T, quality);

    expect(vapor.region).toBe(Region.Region2);
    expect(wet.region).toBe(Region.Region4);
    expect(quality).toBeGreaterThan(0);
    expect(quality).toBeLessThan(1);
    expectBackwardValue(wet.temperature, vapor.temperature, 'temperature', 1e-9);
    expectBackwardValue(wet.enthalpy, vapor.enthalpy, 'enthalpy', 1e-9);
    expect(vapor.pressure).toBeLessThan(wet.pressure);
    expect(() => solveTH(T, vapor.enthalpy)).toThrow(AmbiguousStateError);
    expect(() => detectRegionTH(T, vapor.enthalpy)).toThrow(AmbiguousStateError);
  });

  it('recovers a near-critical PT state without substituting a different saturation endpoint', () => {
    const T = 647.094;
    const forward = solvePT(saturationPressure(T), T);
    const recovered = solveTH(T, forward.enthalpy);

    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure');
    expectBackwardValue(recovered.temperature, forward.temperature, 'temperature');
    expectBackwardValue(recovered.enthalpy, forward.enthalpy, 'enthalpy');
    expectBackwardValue(solvePT(recovered.pressure, T).enthalpy, forward.enthalpy, 'enthalpy');
  });

  it('keeps the liquid branch immediately above near-critical saturation', () => {
    const T = 647.0949;
    const h = solveTx(T, 0).enthalpy - 1e-8;
    const recovered = solveTH(T, h);

    expect(recovered.region).toBe(Region.Region3);
    expect(recovered.enthalpy).toBe(h);
    expect(recovered.density).toBeGreaterThan(322);
    expectBackwardValue(solvePT(recovered.pressure, T).enthalpy, h, 'enthalpy');
  });

  it('recovers a near-critical wet state next to the vapor endpoint', () => {
    const wet = solveTx(647.0949999, 0.999999999);
    const recovered = solveTH(wet.temperature, wet.enthalpy);

    expectRegion4RoundTrip(recovered, wet);
    expect(recovered.enthalpy).toBe(wet.enthalpy);
  });

  it.each([650, 700])('keeps a root just inside an open B23 endpoint at T=%s K', (T) => {
    const h = region2(boundary23_T_to_P(T), T).enthalpy + 5e-10;
    if (T === 650) {
      expect(() => solveTH(T, h)).toThrow(AmbiguousStateError);
    } else {
      const recovered = solveTH(T, h);
      expect(recovered.region).toBe(Region.Region2);
      expect(recovered.enthalpy).toBe(h);
      expectBackwardValue(solvePT(recovered.pressure, T).enthalpy, h, 'enthalpy');
    }
  });

  it('preserves a vapor state below the triple-point temperature', () => {
    const T = 273.159;
    const forward = solvePT(saturationPressure(T) - 1e-12, T);
    expect(forward.region).toBe(Region.Region2);

    const recovered = solveTH(T, forward.enthalpy);
    expect(recovered.region).toBe(forward.region);
    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure');
    expectBackwardValue(recovered.temperature, forward.temperature, 'temperature');
    expectBackwardValue(solvePT(recovered.pressure, T).enthalpy, forward.enthalpy, 'enthalpy');
    expect(detectRegionTH(T, forward.enthalpy)).toBe(forward.region);
  });

  it('recovers a vapor whose enthalpy rounds to an excluded endpoint value', () => {
    const T = 273.159;
    const forward = solvePT(saturationPressure(T) * (1 - Number.EPSILON), T);
    const recovered = solveTH(T, forward.enthalpy);

    expect(forward.region).toBe(Region.Region2);
    expect(recovered.region).toBe(forward.region);
    expect(recovered.pressure).toBeLessThan(saturationPressure(T));
    expect(recovered.enthalpy).toBe(forward.enthalpy);
    expectBackwardValue(solvePT(recovered.pressure, T).enthalpy, forward.enthalpy, 'enthalpy');
  });

  it.each([700, 850])('recovers an exact floating endpoint match at B23, T=%s K', (T) => {
    const boundary = boundary23_T_to_P(T);
    const bits = new DataView(new ArrayBuffer(8));
    bits.setFloat64(0, boundary);
    bits.setBigUint64(0, bits.getBigUint64(0) - 1n);
    const forward = solvePT(bits.getFloat64(0), T);
    const recovered = solveTH(T, forward.enthalpy);

    expect(forward.region).toBe(Region.Region2);
    expect(recovered.region).toBe(forward.region);
    expect(recovered.pressure).toBeLessThan(boundary);
    expect(recovered.enthalpy).toBe(forward.enthalpy);
  });

  it('distinguishes no physical root from ambiguity', () => {
    expect(detectRegionTH(523.15, 1000)).toBe(-1);
    expect(() => solveTH(523.15, 1000)).toThrow(IF97Error);
    expect(() => solveTH(523.15, 1000)).not.toThrow(AmbiguousStateError);
  });
});
