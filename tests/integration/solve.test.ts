/**
 * Integration tests for the main solvePT() dispatcher.
 * Verifies end-to-end: P,T → full state with transport properties.
 */
import { describe, it, expect } from 'vitest';
import { solvePT, solve } from '../../src/core/solver.js';
import { region1 } from '../../src/regions/region1.js';
import { region2 } from '../../src/regions/region2.js';
import { Region, OutOfRangeError } from '../../src/types.js';

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
    expect(s.density).toBeCloseTo(1 / 0.100215168e-2, 2);
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

  it('throws OutOfRangeError for invalid T', () => {
    expect(() => solvePT(1, 3000)).toThrow(OutOfRangeError);
  });
});

describe('solve() unified dispatcher', () => {
  it('routes PT input', () => {
    const state = solve({ mode: 'PT', p: 3, T: 300 });
    expect(state.region).toBe(Region.Region1);
  });

  it('routes PH input', () => {
    const fwd = region1(3, 300);
    const state = solve({ mode: 'PH', p: 3, h: fwd.enthalpy });
    expect(state.temperature).toBeCloseTo(300, 0);
  });

  it('routes PS input', () => {
    const fwd = region1(3, 300);
    const state = solve({ mode: 'PS', p: 3, s: fwd.entropy });
    expect(state.temperature).toBeCloseTo(300, 0);
  });

  it('routes HS input', () => {
    const fwd = region2(0.0035, 300);
    const state = solve({ mode: 'HS', h: fwd.enthalpy, s: fwd.entropy });
    expect(state.temperature).toBeCloseTo(300, 0);
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
  });

  it('routes Tx input', () => {
    const state = solve({ mode: 'Tx', T: 373.15, x: 0.5 });
    expect(state.region).toBe(Region.Region4);
  });
});
