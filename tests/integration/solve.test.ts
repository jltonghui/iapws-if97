/**
 * Integration tests for the main solvePT() dispatcher.
 * Verifies end-to-end: P,T → full state with transport properties.
 */
import { describe, it, expect } from 'vitest';
import { solvePT, solve } from '../../src/core/solver.js';
import { region1 } from '../../src/regions/region1.js';
import { region2 } from '../../src/regions/region2.js';
import { solveTx } from '../../src/saturation/two-phase.js';
import { Tc, Pc, Pt, Tt, P_MIN } from '../../src/constants.js';
import { Region, IF97Error, OutOfRangeError } from '../../src/types.js';
import { expectBackwardValue, expectRegion4RoundTrip } from '../helpers/backward-assertions.js';
import { expectDigitsClose } from '../helpers/assertions.js';

function relErr(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : Math.abs((a - b) / b);
}

const TOL = 1e-6;

describe('solvePT — Integration', () => {
  it('Region 1: T=300K P=3MPa', () => {
    const s = solvePT(3, 300);
    expect(s.region).toBe(Region.Region1);
    expect(relErr(s.specificVolume, 0.100215168e-2)).toBeLessThan(TOL);
    expect(relErr(s.enthalpy, 0.115331273e3)).toBeLessThan(TOL);
    expectDigitsClose(s.density, 1 / 0.100215168e-2, 2);
    // Transport properties should be numeric
    expect(s.viscosity).toBeGreaterThan(0);
    expect(s.thermalConductivity).toBeGreaterThan(0);
    expect(s.surfaceTension).toBeNull();
    expect(typeof s.dielectricConstant).toBe('number');
    expect(typeof s.ionizationConstant).toBe('number');
  });

  it('Region 2: T=700K P=0.0035MPa', () => {
    const s = solvePT(0.0035, 700);
    expect(s.region).toBe(Region.Region2);
    expect(relErr(s.enthalpy, 0.333568375e4)).toBeLessThan(TOL);
    expect(s.viscosity).toBeGreaterThan(0);
  });

  it('Region 3: T=650K P=25.5MPa', () => {
    const s = solvePT(25.5, 650);
    expect(s.region).toBe(Region.Region3);
    expect(s.specificVolume).toBeGreaterThan(0);
    expect(s.enthalpy).toBeGreaterThan(0);
    expect(s.viscosity).toBeGreaterThan(0);
  });

  it('Region 5: T=1500K P=0.5MPa', () => {
    const s = solvePT(0.5, 1500);
    expect(s.region).toBe(Region.Region5);
    expect(relErr(s.enthalpy, 0.521976855e4)).toBeLessThan(TOL);
    expect(s.surfaceTension).toBeNull();
  });

  it('throws OutOfRangeError for invalid P', () => {
    expect(() => solvePT(200, 300)).toThrow(OutOfRangeError);
  });

  it('accepts PT at P_MIN (the full IF97 lower pressure bound)', () => {
    const state = solvePT(P_MIN, 273.15);
    expect(state.region).toBe(Region.Region1);
  });

  it('throws OutOfRangeError for invalid T', () => {
    expect(() => solvePT(1, 3000)).toThrow(OutOfRangeError);
  });

  it('throws IF97Error at the exact critical point', () => {
    expect(() => solvePT(Pc, Tc)).toThrow(IF97Error);
    expect(() => solvePT(Pc, Tc)).toThrow(/critical/i);
  });

  it('throws OutOfRangeError for PT pairs outside the IF97 envelope', () => {
    expect(() => solvePT(80, 1500)).toThrow(OutOfRangeError);
  });

  it('rejects non-finite PT inputs at the solver boundary', () => {
    expect(() => solvePT(Number.NaN, 300)).toThrow(IF97Error);
    expect(() => solvePT(3, Number.POSITIVE_INFINITY)).toThrow(IF97Error);
  });
});

describe('solve() unified dispatcher', () => {
  it('routes PT input', () => {
    const state = solve({ mode: 'PT', p: 3, T: 300 });
    expect(state.region).toBe(Region.Region1);
  });

  it('accepts PT long-form aliases', () => {
    const state = solve({ mode: 'PT', pressure: 3, temperature: 300 });
    expect(state.region).toBe(Region.Region1);
  });

  it('accepts PT at P_MIN via the unified dispatcher', () => {
    const state = solve({ mode: 'PT', p: P_MIN, T: 273.15 });
    expect(state.region).toBe(Region.Region1);
  });

  it('routes PH input', () => {
    const fwd = region1(3, 300);
    const state = solve({ mode: 'PH', p: 3, h: fwd.enthalpy });
    expectBackwardValue(state.temperature, fwd.temperature, 'temperature');
  });

  it('accepts PH long-form aliases', () => {
    const fwd = region1(3, 300);
    const state = solve({ mode: 'PH', pressure: 3, enthalpy: fwd.enthalpy });
    expectBackwardValue(state.temperature, fwd.temperature, 'temperature');
  });

  it('routes PS input', () => {
    const fwd = region1(3, 300);
    const state = solve({ mode: 'PS', p: 3, s: fwd.entropy });
    expectBackwardValue(state.temperature, fwd.temperature, 'temperature');
  });

  it('accepts PS long-form aliases', () => {
    const fwd = region1(3, 300);
    const state = solve({ mode: 'PS', pressure: 3, entropy: fwd.entropy });
    expectBackwardValue(state.temperature, fwd.temperature, 'temperature');
  });

  it('routes HS input', () => {
    const fwd = region2(0.0035, 300);
    const state = solve({ mode: 'HS', h: fwd.enthalpy, s: fwd.entropy });
    expectBackwardValue(state.temperature, fwd.temperature, 'temperature');
  });

  it('accepts HS long-form aliases', () => {
    const fwd = region2(0.0035, 300);
    const state = solve({ mode: 'HS', enthalpy: fwd.enthalpy, entropy: fwd.entropy });
    expectBackwardValue(state.temperature, fwd.temperature, 'temperature');
  });

  it('routes Px input', () => {
    const state = solve({ mode: 'Px', p: 1, x: 0.5 });
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(0.5);
    expect(state.cp).toBeNull();
    expect(state.cv).toBeNull();
    expect(state.speedOfSound).toBeNull();
    expect(state.isobaricExpansion).toBeNull();
    expect(state.isothermalCompressibility).toBeNull();
    expect(state.viscosity).toBeNull();
    expect(state.thermalConductivity).toBeNull();
    expect(state.dielectricConstant).toBeNull();
    expect(state.ionizationConstant).toBeNull();
  });

  it('accepts Px long-form aliases', () => {
    const state = solve({ mode: 'Px', pressure: 1, quality: 0.5 });
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(0.5);
  });

  it('routes Tx input', () => {
    const state = solve({ mode: 'Tx', T: 373.15, x: 0.5 });
    expect(state.region).toBe(Region.Region4);
  });

  it('accepts Tx long-form aliases', () => {
    const state = solve({ mode: 'Tx', temperature: 373.15, quality: 0.5 });
    expect(state.region).toBe(Region.Region4);
  });

  it('accepts the triple-point saturation endpoints via Px and Tx', () => {
    const fromPx = solve({ mode: 'Px', p: Pt, x: 0 });
    const fromTx = solve({ mode: 'Tx', T: Tt, x: 1 });

    expect(fromPx.temperature).toBe(Tt);
    expect(fromPx.quality).toBe(0);
    expect(fromTx.pressure).toBe(Pt);
    expect(fromTx.quality).toBe(1);
  });

  it('rejects critical-point Px input', () => {
    expect(() => solve({ mode: 'Px', p: Pc, x: 0.5 })).toThrow(IF97Error);
    expect(() => solve({ mode: 'Px', p: Pc, x: 0.5 })).toThrow(/critical/i);
  });

  it('rejects critical-point Tx input', () => {
    expect(() => solve({ mode: 'Tx', T: Tc, x: 0.5 })).toThrow(IF97Error);
    expect(() => solve({ mode: 'Tx', T: Tc, x: 0.5 })).toThrow(/critical/i);
  });

  it('rejects the 273.15 K saturation extrapolation boundary for Tx input', () => {
    expect(() => solve({ mode: 'Tx', T: 273.15, x: 0.5 })).toThrow(OutOfRangeError);
  });

  it('routes TH input', () => {
    const fwd = region1(3, 300);
    const state = solve({ mode: 'TH', T: fwd.temperature, h: fwd.enthalpy });
    expectBackwardValue(state.pressure, fwd.pressure, 'pressure');
    expectBackwardValue(state.temperature, fwd.temperature, 'temperature');
  });

  it('accepts TH long-form aliases', () => {
    const fwd = region1(3, 300);
    const state = solve({ mode: 'TH', temperature: fwd.temperature, enthalpy: fwd.enthalpy });
    expectBackwardValue(state.pressure, fwd.pressure, 'pressure');
    expectBackwardValue(state.temperature, fwd.temperature, 'temperature');
  });

  it('routes TS input', () => {
    const fwd = region2(0.0035, 700);
    const state = solve({ mode: 'TS', T: fwd.temperature, s: fwd.entropy });
    expectBackwardValue(state.pressure, fwd.pressure, 'pressure');
    expectBackwardValue(state.temperature, fwd.temperature, 'temperature');
  });

  it('accepts TS long-form aliases', () => {
    const fwd = region2(0.0035, 700);
    const state = solve({ mode: 'TS', temperature: fwd.temperature, entropy: fwd.entropy });
    expectBackwardValue(state.pressure, fwd.pressure, 'pressure');
    expectBackwardValue(state.temperature, fwd.temperature, 'temperature');
  });

  it('routes TH input for Region 3', () => {
    const fwd = solvePT(25, 650);
    const state = solve({ mode: 'TH', T: fwd.temperature, h: fwd.enthalpy });
    expect(state.region).toBe(Region.Region3);
    expectBackwardValue(state.pressure, fwd.pressure, 'pressure');
    expectBackwardValue(state.temperature, fwd.temperature, 'temperature');
  });

  it('routes TS input for Region 3', () => {
    const fwd = solvePT(25, 650);
    const state = solve({ mode: 'TS', T: fwd.temperature, s: fwd.entropy });
    expect(state.region).toBe(Region.Region3);
    expectBackwardValue(state.pressure, fwd.pressure, 'pressure');
    expectBackwardValue(state.temperature, fwd.temperature, 'temperature');
  });

  it('routes TH input for Region 5', () => {
    const fwd = solvePT(0.5, 1500);
    const state = solve({ mode: 'TH', T: fwd.temperature, h: fwd.enthalpy });
    expect(state.region).toBe(Region.Region5);
    expectBackwardValue(state.pressure, fwd.pressure, 'pressure');
    expectBackwardValue(state.temperature, fwd.temperature, 'temperature');
  });

  it('routes TS input for Region 5', () => {
    const fwd = solvePT(0.5, 1500);
    const state = solve({ mode: 'TS', T: fwd.temperature, s: fwd.entropy });
    expect(state.region).toBe(Region.Region5);
    expectBackwardValue(state.pressure, fwd.pressure, 'pressure');
    expectBackwardValue(state.temperature, fwd.temperature, 'temperature');
  });

  it('routes TH input for Region 4 (two-phase)', () => {
    const fwd = solveTx(500, 0.5);
    const state = solve({ mode: 'TH', T: fwd.temperature, h: fwd.enthalpy });
    expectRegion4RoundTrip(state, fwd);
    expect(state.surfaceTension).not.toBeNull();
    expect(state.viscosity).toBeNull();
    expect(state.thermalConductivity).toBeNull();
    expect(state.dielectricConstant).toBeNull();
    expect(state.ionizationConstant).toBeNull();
  });

  it('routes TS input for Region 4 (two-phase)', () => {
    const fwd = solveTx(500, 0.5);
    const state = solve({ mode: 'TS', T: fwd.temperature, s: fwd.entropy });
    expectRegion4RoundTrip(state, fwd);
    expect(state.surfaceTension).not.toBeNull();
    expect(state.viscosity).toBeNull();
    expect(state.thermalConductivity).toBeNull();
    expect(state.dielectricConstant).toBeNull();
    expect(state.ionizationConstant).toBeNull();
  });

  it('keeps transport properties on saturated single-phase endpoints', () => {
    const liquid = solve({ mode: 'Px', p: 1, x: 0 });
    const vapor = solve({ mode: 'Px', p: 1, x: 1 });

    expect(liquid.region).toBe(Region.Region4);
    expect(liquid.quality).toBe(0);
    expect(liquid.viscosity).toBeGreaterThan(0);
    expect(liquid.thermalConductivity).toBeGreaterThan(0);
    expect(typeof liquid.dielectricConstant).toBe('number');

    expect(vapor.region).toBe(Region.Region4);
    expect(vapor.quality).toBe(1);
    expect(vapor.viscosity).toBeGreaterThan(0);
    expect(vapor.thermalConductivity).toBeGreaterThan(0);
    expect(typeof vapor.dielectricConstant).toBe('number');
  });

  it('throws IF97Error for unsupported runtime modes', () => {
    expect(() => solve({ mode: 'BAD', p: 1, T: 1 } as never)).toThrow(IF97Error);
  });

  it('throws IF97Error for conflicting aliases', () => {
    expect(() => solve({ mode: 'PT', p: 3, pressure: 4, T: 300 } as never)).toThrow(IF97Error);
  });

  it('rejects non-finite values in unified solve() input', () => {
    expect(() => solve({ mode: 'PT', p: Number.NaN, T: 300 })).toThrow(IF97Error);
    expect(() => solve({ mode: 'Px', p: 1, x: Number.NaN })).toThrow(IF97Error);
  });

  it('rejects runtime non-number values in unified solve() input', () => {
    expect(() => solve({ mode: 'PT', p: '3', T: 300 } as never)).toThrow(IF97Error);
  });

  it('returns null ionizationConstant beyond its validity range', () => {
    const state = solvePT(0.5, 1500);
    expect(state.ionizationConstant).toBeNull();
  });
});
