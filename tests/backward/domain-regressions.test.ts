import { describe, expect, it } from 'vitest';
import { IF97Error, Region, solve, solveBasic, solveHS, solvePH, solvePS, solvePT, solvePx, solveTH, solveTS, solveTx } from '../../src/index.js';
import { detectRegionHS, detectRegionPH, detectRegionPS } from '../../src/detect.js';
import { boundary23_T_to_P } from '../../src/boundaries.js';
import { saturationPressure, saturationTemperature } from '../../src/saturation.js';
import { H_MAX, P_MIN, Pc, S_MAX, T_MAX, Tc } from '../../src/constants.js';
import { region3ByRhoT, region3PressureResidual } from '../../src/regions/region3.js';
import { region1 } from '../../src/regions/region1.js';
import { region2 } from '../../src/regions/region2.js';
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

  it.each([3.0000000000000013, 18.28049948300001, 99.99999999999999])('accepts the closed PS liquid lower boundary after public pressure rounding at p=%s', (p) => {
    const forward = solvePT(p, 273.15);
    const input = { mode: 'PS', p: forward.pressure, s: forward.entropy } as const;
    expect(detectRegionPS(input.p, input.s)).toBe(Region.Region1);
    for (const recovered of [solvePS(input.p, input.s), solve(input), solveBasic(input)]) {
      expect(recovered.region).toBe(Region.Region1);
      expect(recovered.pressure).toBe(input.p);
      expect(recovered.temperature).toBe(273.15);
      expect(recovered.entropy).toBe(input.s);
      expectBackwardValue(solvePT(input.p, recovered.temperature).entropy, input.s, 'entropy', 1e-14);
    }
  });

  it.each([3, 18.280499483, 100])('rejects PS below the liquid lower boundary beyond machine noise at p=%s', (p) => {
    const s = region1(p, 273.15).entropy - 1e-12;
    expect(detectRegionPS(p, s)).toBe(-1);
    expect(() => solvePS(p, s)).toThrow(IF97Error);
    expect(() => solve({ mode: 'PS', p, s })).toThrow(IF97Error);
    expect(() => solveBasic({ mode: 'PS', p, s })).toThrow(IF97Error);
  });

  it.each([3, 100])('preserves the existing PH liquid lower-bound tolerance at p=%s', (p) => {
    const h = region1(p, 273.15).enthalpy - (p === 3 ? 1e-9 : 5e-8);
    expect(detectRegionPH(p, h)).toBe(Region.Region1);
    expect(solvePH(p, h).temperature).toBe(273.15);
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

  it('recovers the native Region 3 seam endpoint through a valid EOS while retaining the pressure ceiling', () => {
    const openBoundary = solveRegion3PTBasic(100, 623.15);
    const canonical = solvePT(100, 623.15);
    const recovered = solveHS(openBoundary.enthalpy, openBoundary.entropy);
    const reconstructed = solvePT(recovered.pressure, recovered.temperature);
    expectBackwardValue(recovered.pressure, 100, 'pressure', 1e-8);
    expect(reconstructed.region).toBe(recovered.region);
    expect(Math.abs(recovered.enthalpy - reconstructed.enthalpy)).toBeLessThan(1e-7);
    expect(Math.abs(recovered.entropy - reconstructed.entropy)).toBeLessThan(1e-10);
    if (recovered.region === Region.Region1) {
      expect(recovered.temperature).toBe(623.15);
      expect(Math.abs(recovered.enthalpy - openBoundary.enthalpy)).toBeLessThanOrEqual(Math.abs(canonical.enthalpy - openBoundary.enthalpy) + 1e-7);
      expect(Math.abs(recovered.entropy - openBoundary.entropy)).toBeLessThanOrEqual(Math.abs(canonical.entropy - openBoundary.entropy) + 1e-10);
    } else {
      expect(recovered.region).toBe(Region.Region3);
      expect(recovered.temperature).toBeGreaterThan(623.15);
      expectBackwardValue(reconstructed.enthalpy, openBoundary.enthalpy, 'enthalpy', 1e-7);
      expectBackwardValue(reconstructed.entropy, openBoundary.entropy, 'entropy', 1e-10);
    }
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

  it('recovers a coupled Region 2/5 HS gap as an actual owned seam state', () => {
    const boundary = region5(0.0007395221818020803, 1073.15);
    const h = boundary.enthalpy - 1e-5;
    const recovered = solveHS(h, boundary.entropy);
    const lower = region2(recovered.pressure, 1073.15);
    const upper = region5(recovered.pressure, 1073.15);
    const fraction = (h - lower.enthalpy) / (upper.enthalpy - lower.enthalpy);
    expect(recovered.region).toBe(Region.Region2);
    expect(recovered.temperature).toBe(1073.15);
    expect(fraction).toBeGreaterThanOrEqual(0);
    expect(fraction).toBeLessThanOrEqual(1);
    expect(Math.abs(lower.entropy + fraction * (upper.entropy - lower.entropy) - boundary.entropy)).toBeLessThan(1e-10);
    expect(Math.abs(recovered.enthalpy - lower.enthalpy)).toBeLessThan(1e-8);
    expect(Math.abs(recovered.entropy - lower.entropy)).toBeLessThan(1e-10);
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

  it('derives the global upper limits from the runtime Region 5 corner', () => {
    const corner = region5(P_MIN, T_MAX);
    expect(H_MAX).toBe(corner.enthalpy);
    expect(S_MAX).toBe(corner.entropy);
  });

  it('accepts the global upper limits through HS', () => {
    const recovered = solveHS(H_MAX, S_MAX);
    expect(recovered.region).toBe(Region.Region5);
    expectBackwardValue(recovered.pressure, P_MIN, 'pressure');
    expectBackwardValue(recovered.temperature, T_MAX, 'temperature');
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
