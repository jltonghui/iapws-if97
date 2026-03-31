import { describe, expect, it } from 'vitest';
import { solveTH } from '../../src/backward/th.js';
import { detectRegionTH } from '../../src/core/region-detector.js';
import { solvePT } from '../../src/core/solver.js';
import { solveTx } from '../../src/saturation/two-phase.js';
import { region1 } from '../../src/regions/region1.js';
import { region2 } from '../../src/regions/region2.js';
import { Tc } from '../../src/constants.js';
import { Region, IF97Error, OutOfRangeError } from '../../src/types.js';
import { expectBackwardValue, expectRegion4RoundTrip, expectSpecificVolume } from '../helpers/backward-assertions.js';

describe('detectRegionTH', () => {
  it('detects Region 1 from a known compressed-liquid state', () => {
    const state = region1(3, 300);
    expect(detectRegionTH(state.temperature, state.enthalpy)).toBe(Region.Region1);
  });

  it('detects Region 2 from a known superheated state', () => {
    const state = region2(0.0035, 700);
    expect(detectRegionTH(state.temperature, state.enthalpy)).toBe(Region.Region2);
  });

  it('detects Region 4 from a two-phase state', () => {
    const state = solveTx(500, 0.4);
    expect(detectRegionTH(state.temperature, state.enthalpy)).toBe(Region.Region4);
  });

  it('detects deferred Region 3 territory', () => {
    const state = solvePT(25, 650);
    expect(detectRegionTH(state.temperature, state.enthalpy)).toBe(Region.Region3);
  });

  it('detects Region 2 at the critical temperature below the B23 boundary pressure', () => {
    const state = solvePT(19, Tc);
    expect(state.region).toBe(Region.Region2);
    expect(detectRegionTH(state.temperature, state.enthalpy)).toBe(Region.Region2);
  });

  it('detects Region 3 at the critical temperature above the B23 boundary pressure', () => {
    const state = solvePT(22, Tc);
    expect(state.region).toBe(Region.Region3);
    expect(detectRegionTH(state.temperature, state.enthalpy)).toBe(Region.Region3);
  });

  it('detects deferred Region 5 territory', () => {
    const state = solvePT(0.5, 1500);
    expect(detectRegionTH(state.temperature, state.enthalpy)).toBe(Region.Region5);
  });

  it('detects Region 4 for mid-quality state at T > 623.15 K', () => {
    const state = solveTx(640, 0.5);
    expect(detectRegionTH(state.temperature, state.enthalpy)).toBe(Region.Region4);
  });

  it('returns -1 for T below T_MIN', () => {
    expect(detectRegionTH(200, 0)).toBe(-1);
  });

  it('returns -1 for T above T_MAX', () => {
    expect(detectRegionTH(3000, 0)).toBe(-1);
  });

  it('returns -1 for physically impossible enthalpy', () => {
    expect(detectRegionTH(300, 1e9)).toBe(-1);
  });
});

describe('solveTH backward equations', () => {
  it('round-trips a Region 1 state', () => {
    const forward = region1(3, 300);
    const backward = solveTH(forward.temperature, forward.enthalpy);

    expect(backward.region).toBe(Region.Region1);
    expectBackwardValue(backward.temperature, forward.temperature, 'temperature');
    expectBackwardValue(backward.pressure, forward.pressure, 'pressure');
  });

  it('round-trips a Region 2 state', () => {
    const forward = region2(0.0035, 700);
    const backward = solveTH(forward.temperature, forward.enthalpy);

    expect(backward.region).toBe(Region.Region2);
    expectBackwardValue(backward.temperature, forward.temperature, 'temperature');
    expectBackwardValue(backward.pressure, forward.pressure, 'pressure');
  });

  it('preserves the exact target enthalpy for a fixed-temperature Region 2 solve', () => {
    const backward = solveTH(473.15, 2855);

    expect(backward.region).toBe(Region.Region2);
    expect(backward.temperature).toBe(473.15);
    expect(backward.enthalpy).toBe(2855);
  });

  it('preserves a low-pressure Region 4 state', () => {
    const forward = solveTx(500, 0.4);
    const backward = solveTH(forward.temperature, forward.enthalpy);

    expectRegion4RoundTrip(backward, forward);
  });

  it('preserves a high-pressure Region 4 state above 623.15 K', () => {
    const forward = solveTx(640, 0.4);
    const backward = solveTH(forward.temperature, forward.enthalpy);

    expectRegion4RoundTrip(backward, forward, { specificVolumeTolerance: 1e-6 });
  });

  it('preserves saturation endpoints at x = 0 and x = 1', () => {
    const saturatedLiquid = solveTx(500, 0);
    const saturatedVapor = solveTx(500, 1);

    const fromLiquid = solveTH(saturatedLiquid.temperature, saturatedLiquid.enthalpy);
    const fromVapor = solveTH(saturatedVapor.temperature, saturatedVapor.enthalpy);

    expect(fromLiquid.region).toBe(Region.Region4);
    expect(fromLiquid.quality).toBe(0);
    expect(fromVapor.region).toBe(Region.Region4);
    expect(fromVapor.quality).toBe(1);
  });

  it('round-trips a supercritical Region 3 state', () => {
    const forward = solvePT(25, 650);
    const backward = solveTH(forward.temperature, forward.enthalpy);

    expect(backward.region).toBe(Region.Region3);
    expectBackwardValue(backward.temperature, forward.temperature, 'temperature');
    expectBackwardValue(backward.pressure, forward.pressure, 'pressure');
    expectSpecificVolume(backward.specificVolume, forward.specificVolume);
  });

  it('round-trips a subcritical high-pressure Region 3 state', () => {
    const forward = solvePT(50, 640);
    const backward = solveTH(forward.temperature, forward.enthalpy);

    expect(backward.region).toBe(Region.Region3);
    expectBackwardValue(backward.temperature, forward.temperature, 'temperature');
    expectBackwardValue(backward.pressure, forward.pressure, 'pressure');
    expectSpecificVolume(backward.specificVolume, forward.specificVolume);
  });

  it('round-trips a Region 5 state', () => {
    const forward = solvePT(0.5, 1500);
    const backward = solveTH(forward.temperature, forward.enthalpy);

    expect(backward.region).toBe(Region.Region5);
    expectBackwardValue(backward.temperature, forward.temperature, 'temperature');
    expectBackwardValue(backward.pressure, forward.pressure, 'pressure');
    expectSpecificVolume(backward.specificVolume, forward.specificVolume);
  });

  it('rejects the exact critical-point temperature', () => {
    const critical = solvePT(25, Tc);

    expect(() => solveTH(Tc, critical.enthalpy)).toThrowError(IF97Error);
    expect(() => solveTH(Tc, critical.enthalpy)).toThrow(/critical/i);
  });

  it('rejects temperatures inside the critical exclusion band from below', () => {
    const T = Tc - 5e-4;
    const nearCritical = solvePT(25, T);

    expect(() => solveTH(T, nearCritical.enthalpy)).toThrowError(IF97Error);
    expect(() => solveTH(T, nearCritical.enthalpy)).toThrow(/critical/i);
  });

  it('rejects temperatures inside the critical exclusion band from above', () => {
    const T = Tc + 5e-4;
    const nearCritical = solvePT(25, T);

    expect(() => solveTH(T, nearCritical.enthalpy)).toThrowError(IF97Error);
    expect(() => solveTH(T, nearCritical.enthalpy)).toThrow(/critical/i);
  });

  it('still solves just outside the critical exclusion band from below', () => {
    const T = Tc - 2e-3;
    const state = solvePT(25, T);
    const backward = solveTH(T, state.enthalpy);

    expectBackwardValue(backward.temperature, T, 'temperature');
    expectBackwardValue(backward.pressure, state.pressure, 'pressure');
  });

  it('still solves just outside the critical exclusion band from above', () => {
    const T = Tc + 2e-3;
    const state = solvePT(25, T);
    const backward = solveTH(T, state.enthalpy);

    expectBackwardValue(backward.temperature, T, 'temperature');
    expectBackwardValue(backward.pressure, state.pressure, 'pressure');
  });

  it('throws OutOfRangeError for T below T_MIN', () => {
    expect(() => solveTH(200, 0)).toThrow(OutOfRangeError);
  });

  it('throws OutOfRangeError for T above T_MAX', () => {
    expect(() => solveTH(2500, 0)).toThrow(OutOfRangeError);
  });

  it('throws OutOfRangeError for H outside the supported range', () => {
    expect(() => solveTH(300, 1e9)).toThrow(OutOfRangeError);
  });
});
