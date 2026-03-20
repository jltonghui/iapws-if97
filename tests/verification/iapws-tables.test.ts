// tests/verification/iapws-tables.test.ts
import { describe, it, expect } from 'vitest';
import { solvePT, solvePH, solvePS, solve } from '../../src/index.js';
import { region1 } from '../../src/regions/region1.js';
import { region2 } from '../../src/regions/region2.js';
import { region3ByRhoT } from '../../src/regions/region3.js';
import { region5 } from '../../src/regions/region5.js';
import { saturationPressure, saturationTemperature } from '../../src/regions/region4.js';

/** Assert relative error < tolerance */
function expectRelClose(actual: number, expected: number, tol = 1e-6) {
  expect(Math.abs((actual - expected) / expected)).toBeLessThan(tol);
}

describe('IAPWS-IF97 Verification Tables', () => {

  describe('Region 1 — Table 5', () => {
    const cases = [
      { T: 300, p: 3, v: 0.100215168e-2, h: 0.115331273e3, s: 0.392294792, cp: 0.417301218e1, w: 0.150773921e4 },
      { T: 300, p: 80, v: 0.971180894e-3, h: 0.184142828e3, s: 0.368563852, cp: 0.401008987e1, w: 0.163469054e4 },
      { T: 500, p: 3, v: 0.120241800e-2, h: 0.975542239e3, s: 0.258041912e1, cp: 0.465580682e1, w: 0.124071337e4 },
    ];
    cases.forEach(({ T, p, v, h, s, cp, w }) => {
      it(`T=${T}K, P=${p}MPa`, () => {
        const state = region1(p, T);
        expectRelClose(state.specificVolume, v);
        expectRelClose(state.enthalpy, h);
        expectRelClose(state.entropy, s);
        expectRelClose(state.cp, cp);
        expectRelClose(state.speedOfSound, w);
      });
    });
  });

  describe('Region 2 — Table 15', () => {
    const cases = [
      { T: 300, p: 0.0035, v: 0.394913866e2, h: 0.254991145e4, s: 0.852238967e1, cp: 0.191300162e1, w: 0.427920172e3 },
      { T: 700, p: 0.0035, v: 0.923015898e2, h: 0.333568375e4, s: 0.101749996e2, cp: 0.208141274e1, w: 0.644289068e3 },
      { T: 700, p: 30, v: 0.542946619e-2, h: 0.263149474e4, s: 0.517540298e1, cp: 0.103505092e2, w: 0.480386523e3 },
    ];
    cases.forEach(({ T, p, v, h, s, cp, w }) => {
      it(`T=${T}K, P=${p}MPa`, () => {
        const state = region2(p, T);
        expectRelClose(state.specificVolume, v);
        expectRelClose(state.enthalpy, h);
        expectRelClose(state.entropy, s);
        expectRelClose(state.cp, cp);
        expectRelClose(state.speedOfSound, w);
      });
    });
  });

  describe('Region 3 — Table 33', () => {
    const cases = [
      { T: 650, rho: 500, p: 0.255837018e2, h: 0.186343019e4, s: 0.405427273e1, cp: 0.138935717e2, w: 0.502005554e3 },
      { T: 650, rho: 200, p: 0.222930643e2, h: 0.237512401e4, s: 0.485438792e1, cp: 0.446579342e2, w: 0.383444594e3 },
    ];
    cases.forEach(({ T, rho, p, h, s, cp, w }) => {
      it(`T=${T}K, ρ=${rho}kg/m³`, () => {
        const state = region3ByRhoT(rho, T);
        expectRelClose(state.pressure, p);
        expectRelClose(state.enthalpy, h);
        expectRelClose(state.entropy, s);
        expectRelClose(state.cp, cp);
        expectRelClose(state.speedOfSound, w);
      });
    });
  });

  describe('Region 4 — Table 35', () => {
    it('Psat(300K)', () => expectRelClose(saturationPressure(300), 0.353658941e-2));
    it('Psat(500K)', () => expectRelClose(saturationPressure(500), 0.263889776e1));
    it('Psat(600K)', () => expectRelClose(saturationPressure(600), 0.123443146e2));
  });

  describe('Region 5 — Table 42', () => {
    const cases = [
      { T: 1500, p: 0.5, v: 0.138455090e1, h: 0.521976855e4, s: 0.965408875e1, cp: 0.261609445e1, w: 0.917068690e3 },
      { T: 1500, p: 30, v: 0.230761299e-1, h: 0.516723514e4, s: 0.772970133e1, cp: 0.272724317e1, w: 0.928548002e3 },
      { T: 2000, p: 30, v: 0.311385219e-1, h: 0.657122604e4, s: 0.853640523e1, cp: 0.288569882e1, w: 0.106736948e4 },
    ];
    cases.forEach(({ T, p, v, h, s, cp, w }) => {
      it(`T=${T}K, P=${p}MPa`, () => {
        const state = region5(p, T);
        expectRelClose(state.specificVolume, v);
        expectRelClose(state.enthalpy, h);
        expectRelClose(state.entropy, s);
        expectRelClose(state.cp, cp);
        expectRelClose(state.speedOfSound, w);
      });
    });
  });

  describe('Backward round-trip PH', () => {
    const pts = [
      { p: 3, T: 300 }, { p: 80, T: 300 }, { p: 0.0035, T: 300 }, { p: 30, T: 700 },
    ];
    pts.forEach(({ p, T }) => {
      it(`P=${p}MPa, T=${T}K`, () => {
        const fwd = solvePT(p, T);
        const back = solvePH(p, fwd.enthalpy);
        expect(Math.abs(back.temperature - T)).toBeLessThan(0.5);
      });
    });
  });

  describe('Backward round-trip PS', () => {
    const pts = [
      { p: 3, T: 300 }, { p: 80, T: 300 }, { p: 0.0035, T: 300 }, { p: 30, T: 700 },
    ];
    pts.forEach(({ p, T }) => {
      it(`P=${p}MPa, T=${T}K`, () => {
        const fwd = solvePT(p, T);
        const back = solvePS(p, fwd.entropy);
        expect(Math.abs(back.temperature - T)).toBeLessThan(0.5);
      });
    });
  });

  describe('Unified solve() smoke tests', () => {
    it('PT mode matches solvePT', () => {
      const a = solvePT(3, 300);
      const b = solve({ mode: 'PT', p: 3, T: 300 });
      expect(a.enthalpy).toBe(b.enthalpy);
    });
  });
});
