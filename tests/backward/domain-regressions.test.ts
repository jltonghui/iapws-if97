import { describe, expect, it } from 'vitest';
import { IF97Error, Region, solveHS, solvePH, solvePS, solvePT, solvePx, solveTH, solveTS, solveTx } from '../../src/index.js';
import { detectRegionHS } from '../../src/detect.js';
import { boundary23_T_to_P } from '../../src/boundaries.js';
import { saturationPressure, saturationTemperature } from '../../src/saturation.js';
import { Pc, Tc } from '../../src/constants.js';
import { region3ByRhoT, region3PressureResidual } from '../../src/regions/region3.js';
import { region5 } from '../../src/regions/region5.js';
import { solveRegion3PTBasic } from '../../src/core/region3-pt.js';
import { validateBackwardState } from '../../src/backward/solution-validation.js';
import { expectBackwardValue } from '../helpers/backward-assertions.js';

describe('Public domain round-trip regressions', () => {
  it('accepts the entropy of cold compressed liquid', () => {
    const forward = solvePT(100, 273.15);
    const recovered = solvePS(forward.pressure, forward.entropy);
    expectBackwardValue(recovered.temperature, forward.temperature, 'temperature');
    const fromHS = solveHS(forward.enthalpy, forward.entropy);
    expectBackwardValue(fromHS.pressure, forward.pressure, 'pressure');
  });

  it('keeps Region 3 forward pressure inside the public envelope', () => {
    const forward = solvePT(100, 628.7055555555555);
    expect(forward.pressure).toBe(100);
    expect(() => solvePH(forward.pressure, forward.enthalpy)).not.toThrow();
    expect(() => solvePS(forward.pressure, forward.entropy)).not.toThrow();
  });

  it('accepts the forward enthalpy at the lower PT corner', () => {
    const forward = solvePT(0.000611212677444, 273.15);
    expect(() => solvePH(forward.pressure, forward.enthalpy)).not.toThrow();
  });

  it('accepts the closed PH liquid lower boundary after public pressure rounding', () => {
    const forward = solvePT(99.99999999999996, 273.15);
    const recovered = solvePH(forward.pressure, forward.enthalpy);
    expect(recovered.temperature).toBe(273.15);
    expectBackwardValue(solvePT(recovered.pressure, recovered.temperature).enthalpy, forward.enthalpy, 'enthalpy');
  });

  it.each([16.530817169029813, 16.52916425270455])('accepts the closed Region 1 PH/PS upper boundary after public temperature rounding at p=%s', (p) => {
    const forward = solvePT(p, 623.1499999999999);
    expect(forward.region).toBe(Region.Region1);
    for (const recovered of [solvePH(forward.pressure, forward.enthalpy), solvePS(forward.pressure, forward.entropy)]) {
      expect(recovered.region).toBe(Region.Region1);
      const reconstructed = solvePT(recovered.pressure, recovered.temperature);
      expectBackwardValue(reconstructed.enthalpy, forward.enthalpy, 'enthalpy');
      expectBackwardValue(reconstructed.entropy, forward.entropy, 'entropy');
    }
  });

  it.each([16.52918078176885, 16.53081716902986])('keeps the derived PH/PS/HS temperature inside the open Region 3 lower boundary at p=%s', (p) => {
    const forward = solvePT(p, 623.1500000000001);
    expect(forward.region).toBe(Region.Region3);
    for (const recovered of [solvePH(p, forward.enthalpy), solvePS(p, forward.entropy), solveHS(forward.enthalpy, forward.entropy)]) {
      const reconstructed = solvePT(recovered.pressure, recovered.temperature);
      expect(recovered.temperature).toBeGreaterThan(623.15);
      expectBackwardValue(reconstructed.enthalpy, forward.enthalpy, 'enthalpy');
      expectBackwardValue(reconstructed.entropy, forward.entropy, 'entropy');
    }
  });

  it('does not move a caller temperature across the Region 1/3 boundary', () => {
    const state = solveRegion3PTBasic(100, 623.15);
    expect(() => validateBackwardState(state, [
      { label: 'temperature', expected: 623.15 },
      { label: 'enthalpy', expected: state.enthalpy },
    ], { solverName: 'fixed-temperature boundary', expectedRegion: Region.Region3 })).toThrow(/Region 1, not Region 3/);
  });

  it('preserves PH/PS liquid states below Pt on the native saturation boundary', () => {
    const forward = solvePT(0.000611212677444, 273.1500001);
    expect(forward.region).toBe(Region.Region1);
    for (const recovered of [solvePH(forward.pressure, forward.enthalpy), solvePS(forward.pressure, forward.entropy)]) {
      expect(recovered.region).toBe(Region.Region1);
      const reconstructed = solvePT(recovered.pressure, recovered.temperature);
      expectBackwardValue(reconstructed.enthalpy, forward.enthalpy, 'enthalpy');
      expectBackwardValue(reconstructed.entropy, forward.entropy, 'entropy');
    }
  });

  it('rejects unsupported sub-triple mixtures through PH/PS', () => {
    expect(() => solvePH(0.000611212677444, 1800)).toThrow(IF97Error);
    expect(() => solvePS(0.000611212677444, 5)).toThrow(IF97Error);
  });

  it('keeps a sub-triple liquid saturation state reconstructible through PS and HS', () => {
    const T = 273.159;
    const forward = solvePT(saturationPressure(T), T);
    for (const recovered of [solvePS(forward.pressure, forward.entropy), solveHS(forward.enthalpy, forward.entropy)]) {
      const reconstructed = solvePT(recovered.pressure, recovered.temperature);
      expect(reconstructed.region).toBe(Region.Region1);
      expectBackwardValue(reconstructed.enthalpy, forward.enthalpy, 'enthalpy');
      expectBackwardValue(reconstructed.entropy, forward.entropy, 'entropy');
    }
  });

  it.each([
    { p: 0.0006116576116569999, T: 273.16 },
    { p: 0.0006570887062059462, T: 274.15 },
    { p: 0.0006570881491178972, T: 274.15 },
    { p: 0.0008124066165713919, T: 277.13 },
    { p: 0.0009918173478067787, T: 280 },
    { p: 16.529164252704476, T: 623.15 },
  ])('confirms the actual HS saturation state before routing a nearby liquid at T=$T K, p=$p MPa', ({ p, T }) => {
    const forward = solvePT(p, T);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expect(recovered.region).toBe(Region.Region1);
    const reconstructed = solvePT(recovered.pressure, recovered.temperature);
    expectBackwardValue(reconstructed.enthalpy, forward.enthalpy, 'enthalpy');
    expectBackwardValue(reconstructed.entropy, forward.entropy, 'entropy');
  });

  it('accepts the closed Region 1 upper HS envelope at 100 MPa', () => {
    const forward = solvePT(100, 336.64206349206347);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expectBackwardValue(recovered.pressure, 100, 'pressure');
    expectBackwardValue(recovered.temperature, forward.temperature, 'temperature');
  });

  it.each([
    { p: 100, T: 623.1500001 },
    { p: 99.999, T: 623.150001 },
  ])('recovers the native Region 3 HS envelope above 623.15 K at p=$p MPa', ({ p, T }) => {
    const forward = solvePT(p, T);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expect(recovered.region).toBe(Region.Region3);
    expectBackwardValue(recovered.pressure, p, 'pressure');
    const reconstructed = solvePT(recovered.pressure, recovered.temperature);
    expectBackwardValue(reconstructed.enthalpy, forward.enthalpy, 'enthalpy');
    expectBackwardValue(reconstructed.entropy, forward.entropy, 'entropy');
  });

  it('keeps the native Region 3 lower HS boundary open and its pressure ceiling closed', () => {
    const openBoundary = solveRegion3PTBasic(100, 623.15);
    expect(() => solveHS(openBoundary.enthalpy, openBoundary.entropy)).toThrow(IF97Error);
    const forward = solvePT(100, 623.1500001);
    expect(() => solveHS(forward.enthalpy + 1e-6, forward.entropy)).toThrow(IF97Error);
  });

  it.each([1e-8, 1e-7])('recovers HS just inside the open Region 5 lower boundary, offset=%s K', (offset) => {
    const forward = solvePT(0.0007395221818020803, 1073.15 + offset);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expect(recovered.region).toBe(Region.Region5);
    expect(recovered.temperature).toBeGreaterThan(1073.15);
    const reconstructed = solvePT(recovered.pressure, recovered.temperature);
    expectBackwardValue(reconstructed.enthalpy, forward.enthalpy, 'enthalpy');
    expectBackwardValue(reconstructed.entropy, forward.entropy, 'entropy');
  });

  it('keeps the infeasible Region 2/5 enthalpy gap excluded', () => {
    const boundary = region5(0.0007395221818020803, 1073.15);
    expect(() => solveHS(boundary.enthalpy - 1e-5, boundary.entropy)).toThrow(IF97Error);
  });

  it.each([
    { p: 0.0006115513936183199, T: 273.159 },
    { p: 0.000611212677444, T: 273.155 },
  ])('recovers legal Region 2 HS below the triple temperature at T=$T K', ({ p, T }) => {
    const forward = solvePT(p, T);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expect(recovered.region).toBe(Region.Region2);
    expectBackwardValue(recovered.pressure, p, 'pressure');
    expectBackwardValue(recovered.temperature, T, 'temperature');
  });

  it.each(['PH', 'PS', 'HS', 'TH', 'TS'] as const)('accepts the upper PT corner through %s', (mode) => {
    const forward = solvePT(0.000611212677444, 2273.15);
    const recovered = {
      PH: () => solvePH(forward.pressure, forward.enthalpy),
      PS: () => solvePS(forward.pressure, forward.entropy),
      HS: () => solveHS(forward.enthalpy, forward.entropy),
      TH: () => solveTH(forward.temperature, forward.enthalpy),
      TS: () => solveTS(forward.temperature, forward.entropy),
    }[mode]();
    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure');
    expectBackwardValue(recovered.temperature, forward.temperature, 'temperature');
  });

  it.each([
    { p: 25.07228318828885, T: 677.15 },
    { p: 29.24099841727468, T: 695.15 },
    { p: 54.93792704166003, T: 773.15 },
  ])('recovers public PH/PS constraints next to B23 at p=$p MPa', ({ p, T }) => {
    const forward = solvePT(p, T);
    for (const recovered of [solvePH(p, forward.enthalpy), solvePS(p, forward.entropy)]) {
      const reconstructed = solvePT(recovered.pressure, recovered.temperature);
      expectBackwardValue(reconstructed.enthalpy, recovered.enthalpy, 'enthalpy');
      expectBackwardValue(reconstructed.entropy, recovered.entropy, 'entropy');
    }
  });

  it.each([647.0949, 647.0959])('preserves the liquid PS branch next to saturation at T=%s K', (T) => {
    const forward = solvePT(saturationPressure(T) + 1e-10, T);
    const recovered = solvePS(forward.pressure, forward.entropy);
    const reconstructed = solvePT(recovered.pressure, recovered.temperature);
    expectBackwardValue(reconstructed.entropy, forward.entropy, 'entropy');
    expectBackwardValue(reconstructed.enthalpy, forward.enthalpy, 'enthalpy');
  });

  it.each([677.15, 695.15, 773.15])('recovers public HS constraints on B23 at T=%s K', (T) => {
    const forward = solvePT(boundary23_T_to_P(T), T);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    const reconstructed = solvePT(recovered.pressure, recovered.temperature);
    expectBackwardValue(reconstructed.enthalpy, forward.enthalpy, 'enthalpy');
    expectBackwardValue(reconstructed.entropy, forward.entropy, 'entropy');
  });

  it.each([629.15, 650, 700, 800])('uses native B23 pressure ownership at T=%s K', (T) => {
    const p = boundary23_T_to_P(T);
    const bits = new BigUint64Array(new Float64Array([p]).buffer);
    bits[0] -= 1n;
    expect(solvePT(new Float64Array(bits.buffer)[0], T).region).toBe(Region.Region2);
    expect(solvePT(p - 1e-11, T).region).toBe(Region.Region2);
    expect(solvePT(p, T).region).toBe(Region.Region3);
  });

  it.each([273.155, 273.159, 300, 623.15])('uses native saturation pressure ownership at T=%s K', (T) => {
    const p = saturationPressure(T);
    const bits = new BigUint64Array(new Float64Array([p]).buffer);
    bits[0] -= 1n;
    expect(solvePT(new Float64Array(bits.buffer)[0], T).region).toBe(Region.Region2);
    expect(solvePT(p, T).region).toBe(Region.Region1);
  });

  it.each([623.1500000000001, 623.1500000000002])('keeps the native saturated liquid above the Region 1/3 seam at T=%s K', (T) => {
    const p = saturationPressure(T);
    const bits = new BigUint64Array(new Float64Array([p]).buffer);
    bits[0] -= 1n;
    expect(solvePT(new Float64Array(bits.buffer)[0], T).region).toBe(Region.Region2);
    const liquid = solvePT(p, T);
    expect(liquid.region).toBe(Region.Region3);
    expect(liquid.density).toBeGreaterThan(322);
    expect(liquid.pressure).toBe(p);
    expect(liquid.temperature).toBe(T);
    expect(solvePT(boundary23_T_to_P(T), T).region).toBe(Region.Region3);
  });

  it.each([623.1500000000001, 647.0949])('shares the exact native Region 3 liquid EOS with saturation at T=%s K', (T) => {
    const forward = solvePT(saturationPressure(T), T);
    const endpoint = solveTx(T, 0);
    expect(forward.specificVolume).toBe(endpoint.specificVolume);
    expect(forward.enthalpy).toBe(endpoint.enthalpy);
    expect(forward.entropy).toBe(endpoint.entropy);
    for (const recovered of [solveTS(T, forward.entropy), solveHS(forward.enthalpy, forward.entropy)]) {
      expect(recovered.region).toBe(Region.Region4);
      expect(recovered.quality).toBe(0);
      expect(recovered.cp).not.toBeNull();
    }
  });

  it.each([-1n, 1n])('keeps a fixed Region 3 pressure %s ULP from native saturation on its actual EOS target', (offset) => {
    const T = 647.0949;
    const bits = new BigUint64Array(new Float64Array([saturationPressure(T)]).buffer);
    bits[0] += offset;
    const p = new Float64Array(bits.buffer)[0];
    const state = solvePT(p, T);
    expect(state.pressure).toBe(p);
    expect(offset < 0n ? state.density < 322 : state.density > 322).toBe(true);
    const densityError = Math.abs(region3PressureResidual(state.density, T, p)) *
      state.density * state.isothermalCompressibility!;
    expect(densityError).toBeLessThanOrEqual(2 * Number.EPSILON * state.density);
  });

  it.each([-0.001, -0.0009, 0.0009, 0.001])('supports finite PT derivatives at Pc and Tc + %s K', (offset) => {
    const state = solvePT(Pc, Tc + offset);
    for (const value of [state.cp, state.cv, state.isothermalCompressibility, state.speedOfSound, state.viscosity, state.thermalConductivity]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it.each([273.26, 623.15])('recovers the liquid saturation endpoint through HS at T=%s K', (T) => {
    const forward = solveTx(T, 0);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure');
    expectBackwardValue(recovered.temperature, forward.temperature, 'temperature');
    expect(recovered.quality).toBe(0);
    expect(recovered.cp).not.toBeNull();
  });

  it.each([623.150001, 623.1501])('keeps PH/PS inside the actual Region 4 span above the 623.15 K seam at T=%s K', (T) => {
    const forward = solveTx(T, 1 - 1e-9);
    for (const recovered of [solvePH(forward.pressure, forward.enthalpy), solvePS(forward.pressure, forward.entropy)]) {
      expect(recovered.region).toBe(Region.Region4);
      expectBackwardValue(recovered.temperature, T, 'temperature');
      expect(Math.abs((recovered.quality ?? Number.NaN) - forward.quality!)).toBeLessThanOrEqual(1e-6);
    }
  });

  it.each([1 - 1e-9, 1])('confirms the actual Region 4 HS state above the 623.15 K seam at x=%s', (x) => {
    const forward = solveTx(623.150001, x);
    expect(detectRegionHS(forward.enthalpy, forward.entropy)).toBe(Region.Region4);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expect(recovered.region).toBe(Region.Region4);
    expectBackwardValue(recovered.temperature, forward.temperature, 'temperature');
    expect(Math.abs(recovered.quality! - x)).toBeLessThanOrEqual(1e-6);
  });

  it('recovers the vapor saturation endpoint through HS at 623.15 K', () => {
    const forward = solveTx(623.15, 1);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expectBackwardValue(recovered.temperature, forward.temperature, 'temperature');
    expect(recovered.quality).toBe(1);
    expect(recovered.cp).not.toBeNull();
  });

  it('preserves near-critical saturation endpoint metadata through HS', () => {
    const forward = solvePx(22.06399, 1);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure');
    expect(recovered.quality).toBe(1);
    expect(recovered.cp).not.toBeNull();
  });

  it('keeps the two available near-critical saturation phases physically distinct', () => {
    const liquid = solvePx(22.06399, 0);
    const vapor = solvePx(22.06399, 1);
    expect(vapor.specificVolume).toBeGreaterThan(liquid.specificVolume);
    expect(vapor.enthalpy).toBeGreaterThan(liquid.enthalpy);
    expect(vapor.entropy).toBeGreaterThan(liquid.entropy);
  });

  it('rejects a numerically inconsistent near-critical saturation pair', () => {
    expect(() => solvePx(22.0639999, 0)).toThrow(IF97Error);
    expect(() => solvePx(22.0639999, 1)).toThrow(IF97Error);
  });

  it.each([1e-10, 1e-9])('rejects an unavailable near-critical PT vapor branch at Tsat + %s K', (offset) => {
    const p = 22.0639999;
    expect(() => solvePT(p, saturationTemperature(p) + offset)).toThrow(IF97Error);
  });

  it.each([300, 640, 660, 700])('preserves pure PH/PS states at the inconsistent saturation pressure, T=%s K', (T) => {
    const forward = solvePT(22.0639999, T);
    for (const recovered of [solvePH(forward.pressure, forward.enthalpy), solvePS(forward.pressure, forward.entropy)]) {
      expectBackwardValue(recovered.temperature, T, 'temperature');
      expect(recovered.region).toBe(forward.region);
      const reconstructed = solvePT(recovered.pressure, recovered.temperature);
      expectBackwardValue(reconstructed.enthalpy, forward.enthalpy, 'enthalpy');
      expectBackwardValue(reconstructed.entropy, forward.entropy, 'entropy');
    }
  });

  it('retains the saturation inconsistency error when PH/PS cannot reconstruct a physical PT state', () => {
    const critical = region3ByRhoT(322, Tc);
    expect(() => solvePH(22.0639999, critical.enthalpy)).toThrow(/Region 4 numerical inconsistency/);
    expect(() => solvePS(22.0639999, critical.entropy)).toThrow(/Region 4 numerical inconsistency/);
  });
});
