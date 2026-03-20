/**
 * Tests for IAPWS-IF97 Forward Equations (Regions 1–5)
 * Verification values from IAPWS-IF97 official verification tables.
 */
import { describe, it, expect } from 'vitest';
import { region1 } from '../../src/regions/region1';
import { region2 } from '../../src/regions/region2';
import { region3ByRhoT } from '../../src/regions/region3';
import { saturationPressure, saturationTemperature } from '../../src/regions/region4';
import { region5 } from '../../src/regions/region5';

/** Relative error helper */
function relErr(actual: number, expected: number): number {
  if (expected === 0) return Math.abs(actual);
  return Math.abs((actual - expected) / expected);
}

const TOL = 1e-6; // relative tolerance

// ─── Region 1 (Table 5, IAPWS-IF97) ────────────────────────────────────────
describe('Region 1', () => {
  const cases = [
    { T: 300, p: 3, v: 0.100215168e-2, h: 0.115331273e3, s: 0.392294792, cp: 0.417301218e1, w: 0.150773921e4 },
    { T: 300, p: 80, v: 0.971180894e-3, h: 0.184142828e3, s: 0.368563852, cp: 0.401008987e1, w: 0.163469054e4 },
    { T: 500, p: 3, v: 0.120241800e-2, h: 0.975542239e3, s: 0.258041912e1, cp: 0.465580682e1, w: 0.124071337e4 },
  ];

  cases.forEach(({ T, p, v, h, s, cp, w }) => {
    it(`T=${T}K, P=${p}MPa`, () => {
      const state = region1(p, T);
      expect(relErr(state.specificVolume, v)).toBeLessThan(TOL);
      expect(relErr(state.enthalpy, h)).toBeLessThan(TOL);
      expect(relErr(state.entropy, s)).toBeLessThan(TOL);
      expect(relErr(state.cp, cp)).toBeLessThan(TOL);
      expect(relErr(state.speedOfSound, w)).toBeLessThan(TOL);
    });
  });
});

// ─── Region 2 (Table 15, IAPWS-IF97) ───────────────────────────────────────
describe('Region 2', () => {
  const cases = [
    { T: 300, p: 0.0035, v: 0.394913866e2, h: 0.254991145e4, s: 0.852238967e1, cp: 0.191300162e1, w: 0.427920172e3 },
    { T: 700, p: 0.0035, v: 0.923015898e2, h: 0.333568375e4, s: 0.101749996e2, cp: 0.208141274e1, w: 0.644289068e3 },
    { T: 700, p: 30, v: 0.542946619e-2, h: 0.263149474e4, s: 0.517540298e1, cp: 0.103505092e2, w: 0.480386523e3 },
  ];

  cases.forEach(({ T, p, v, h, s, cp, w }) => {
    it(`T=${T}K, P=${p}MPa`, () => {
      const state = region2(p, T);
      expect(relErr(state.specificVolume, v)).toBeLessThan(TOL);
      expect(relErr(state.enthalpy, h)).toBeLessThan(TOL);
      expect(relErr(state.entropy, s)).toBeLessThan(TOL);
      expect(relErr(state.cp, cp)).toBeLessThan(TOL);
      expect(relErr(state.speedOfSound, w)).toBeLessThan(TOL);
    });
  });
});

// ─── Region 3 (Table 33, IAPWS-IF97) ───────────────────────────────────────
describe('Region 3', () => {
  const cases = [
    { T: 650, rho: 500, p: 0.255837018e2, h: 0.186343019e4, s: 0.405427273e1, cp: 0.138935717e2, w: 0.502005554e3 },
    { T: 650, rho: 200, p: 0.222930643e2, h: 0.237512401e4, s: 0.485438792e1, cp: 0.446579342e2, w: 0.383444594e3 },
  ];

  cases.forEach(({ T, rho, p, h, s, cp, w }) => {
    it(`T=${T}K, ρ=${rho}kg/m³`, () => {
      const state = region3ByRhoT(rho, T);
      expect(relErr(state.pressure, p)).toBeLessThan(TOL);
      expect(relErr(state.enthalpy, h)).toBeLessThan(TOL);
      expect(relErr(state.entropy, s)).toBeLessThan(TOL);
      expect(relErr(state.cp, cp)).toBeLessThan(TOL);
      expect(relErr(state.speedOfSound, w)).toBeLessThan(TOL);
    });
  });
});

// ─── Region 4 (Table 36, IAPWS-IF97) ───────────────────────────────────────
describe('Region 4 — Saturation', () => {
  it('Psat(T=300K) ≈ 0.00353658941e-1 MPa', () => {
    expect(relErr(saturationPressure(300), 0.353658941e-2)).toBeLessThan(TOL);
  });
  it('Psat(T=500K) ≈ 0.263889776e1 MPa', () => {
    expect(relErr(saturationPressure(500), 0.263889776e1)).toBeLessThan(TOL);
  });
  it('Psat(T=600K) ≈ 0.123443146e2 MPa', () => {
    expect(relErr(saturationPressure(600), 0.123443146e2)).toBeLessThan(TOL);
  });

  it('Tsat(P=0.1MPa) ≈ 0.372755919e3 K', () => {
    expect(relErr(saturationTemperature(0.1), 0.372755919e3)).toBeLessThan(TOL);
  });
  it('Tsat(P=1MPa) ≈ 0.453035632e3 K', () => {
    expect(relErr(saturationTemperature(1), 0.453035632e3)).toBeLessThan(TOL);
  });
  it('Tsat(P=10MPa) ≈ 0.584149488e3 K', () => {
    expect(relErr(saturationTemperature(10), 0.584149488e3)).toBeLessThan(TOL);
  });
});

// ─── Region 5 (Table 42, IAPWS-IF97) ───────────────────────────────────────
describe('Region 5', () => {
  const cases = [
    { T: 1500, p: 0.5, v: 0.138455090e1, h: 0.521976855e4, s: 0.965408875e1, cp: 0.261609445e1, w: 0.917068690e3 },
    { T: 1500, p: 30, v: 0.230761299e-1, h: 0.516723514e4, s: 0.772970133e1, cp: 0.272724317e1, w: 0.928548002e3 },
    { T: 2000, p: 30, v: 0.311385219e-1, h: 0.657122604e4, s: 0.853640523e1, cp: 0.288569882e1, w: 0.106736948e4 },
  ];

  cases.forEach(({ T, p, v, h, s, cp, w }) => {
    it(`T=${T}K, P=${p}MPa`, () => {
      const state = region5(p, T);
      expect(relErr(state.specificVolume, v)).toBeLessThan(TOL);
      expect(relErr(state.enthalpy, h)).toBeLessThan(TOL);
      expect(relErr(state.entropy, s)).toBeLessThan(TOL);
      expect(relErr(state.cp, cp)).toBeLessThan(TOL);
      expect(relErr(state.speedOfSound, w)).toBeLessThan(TOL);
    });
  });
});
