// tests/transport/transport.test.ts
import { describe, it, expect } from 'vitest';
import { viscosity, thermalConductivity, surfaceTension, dielectricConstant, ionizationConstant } from '../../src/transport/properties.js';
import { Tc, RHOc } from '../../src/constants.js';
import { IF97Error } from '../../src/types.js';
import { expectDigitsClose } from '../helpers/assertions.js';

describe('Transport Properties', () => {
  describe('viscosity', () => {
    // R12-08 Table 4, in μPa·s; compare in the table's units at half its last digit.
    // https://iapws.org/public/documents/FPpx6/visc.pdf
    it.each([
      { T: 298.15, rho: 998, mu: 889.735100 },
      { T: 298.15, rho: 1200, mu: 1437.649467 },
      { T: 373.15, rho: 1000, mu: 307.883622 },
      { T: 433.15, rho: 1, mu: 14.538324 },
      { T: 433.15, rho: 1000, mu: 217.685358 },
      { T: 873.15, rho: 1, mu: 32.619287 },
      { T: 873.15, rho: 100, mu: 35.802262 },
      { T: 873.15, rho: 600, mu: 77.430195 },
      { T: 1173.15, rho: 1, mu: 44.217245 },
      { T: 1173.15, rho: 100, mu: 47.640433 },
      { T: 1173.15, rho: 400, mu: 64.154608 },
    ])('matches IAPWS 2008 Table 4 at T=$T K, rho=$rho kg/m^3', ({ T, rho, mu }) => {
      expectDigitsClose(viscosity(T, rho) * 1e6, mu, 6);
    });

    it('returns positive finite value for liquid water at 300K', () => {
      const mu = viscosity(300, 997);
      expect(mu).toBeGreaterThan(0);
      expect(mu).toBeLessThan(0.01);
      expect(isFinite(mu)).toBe(true);
    });

    it('returns lower viscosity for steam than liquid', () => {
      const muLiquid = viscosity(373.15, 958);
      const muSteam = viscosity(373.15, 0.6);
      expect(muSteam).toBeLessThan(muLiquid);
    });

    it('rejects non-finite and non-positive inputs', () => {
      expect(() => viscosity(Number.NaN, 997)).toThrow(IF97Error);
      expect(() => viscosity(300, Number.POSITIVE_INFINITY)).toThrow(IF97Error);
      expect(() => viscosity(300, -1)).toThrow(IF97Error);
    });

    it.each([
      { T: 50, rho: 1000 },
      { T: 70, rho: 1000 },
      { T: 50, rho: 0 },
      { T: 70, rho: 0 },
    ])('rejects non-physical extrapolation at T=$T K, rho=$rho kg/m^3', ({ T, rho }) => {
      expect(() => viscosity(T, rho)).toThrow(IF97Error);
    });

    it.each([
      { T: 250, rho: 1000 },
      { T: 300, rho: 0 },
    ])('preserves finite positive viscosity at T=$T K, rho=$rho kg/m^3', ({ T, rho }) => {
      const mu = viscosity(T, rho);
      expect(Number.isFinite(mu)).toBe(true);
      expect(mu).toBeGreaterThan(0);
    });
  });

  describe('thermalConductivity', () => {
    // R15-11 Table 4, in mW/(m·K); the dilute-gas rows print one extra decimal.
    // https://iapws.org/technical-guidance/release/ThCond.download
    it.each([
      { T: 298.15, rho: 0, k: 18.4341883, digits: 7 },
      { T: 298.15, rho: 998, k: 607.712868, digits: 6 },
      { T: 298.15, rho: 1200, k: 799.038144, digits: 6 },
      { T: 873.15, rho: 0, k: 79.1034659, digits: 7 },
    ])('matches IAPWS 2011 Table 4 at T=$T K, rho=$rho kg/m^3', ({ T, rho, k, digits }) => {
      expectDigitsClose(thermalConductivity(T, rho) * 1e3, k, digits);
    });

    it('returns positive finite value for liquid water at 300K', () => {
      const k = thermalConductivity(300, 997);
      expect(k).toBeGreaterThan(0.5); // ~0.6 W/(m·K)
      expect(k).toBeLessThan(1.0);
    });

    it('returns lower conductivity for steam', () => {
      const kLiq = thermalConductivity(373.15, 958);
      const kSteam = thermalConductivity(373.15, 0.6);
      expect(kSteam).toBeLessThan(kLiq);
    });

    it('backward compatible: returns same result without optional params', () => {
      const k = thermalConductivity(300, 997);
      expect(k).toBeGreaterThan(0.5);
      expect(k).toBeLessThan(1.0);
      expect(isFinite(k)).toBe(true);
    });

    // R15-11 industrial Tables 7 and 9: μ in μPa·s, λ₂ in mW/(m·K).
    it.each([
      { T: 620, rho: 613.227777, cp: 7.63433705, cv: 3.03793441, drhodP: 5.20937820, mu: 70.9051068, k2: 12.6391714, digits: 7 },
      { T: 620, rho: 699.226043, cp: 5.32047725, cv: 2.91692653, drhodP: 1.84869007, mu: 84.1527945, k2: 5.75816285, digits: 8 },
      { T: 647.35, rho: 222, cp: 101.054488, cv: 4.37466458, drhodP: 177.778595, mu: 31.2204749, k2: 187.183159, digits: 6 },
    ])('matches IAPWS 2011 industrial λ₂ at T=$T K, rho=$rho kg/m^3', ({ T, rho, cp, cv, drhodP, mu, k2, digits }) => {
      const base = thermalConductivity(T, rho);
      const enhanced = thermalConductivity(T, rho, cp, cv, drhodP, mu * 1e-6);
      expectDigitsClose((enhanced - base) * 1e3, k2, digits);
    });

    it('critical enhancement λ₂ is negligible far from critical point', () => {
      // Normal liquid conditions far from critical point
      const T = 300;
      const rho = 997;
      const cp = 4.18; // [kJ/(kg·K)]
      const cv = 4.13;
      const drhodP_T = 0.5; // small compressibility
      const mu = viscosity(T, rho);

      const kWithout = thermalConductivity(T, rho);
      const kWith = thermalConductivity(T, rho, cp, cv, drhodP_T, mu);

      // Far from critical point, λ₂ should be negligible
      // Allow up to 1% difference
      expect(Math.abs(kWith - kWithout) / kWithout).toBeLessThan(0.01);
    });

    it('rejects invalid primary and optional inputs', () => {
      expect(() => thermalConductivity(Number.NaN, 997)).toThrow(IF97Error);
      expect(() => thermalConductivity(300, -1)).toThrow(IF97Error);
      expect(() => thermalConductivity(300, 997, Number.POSITIVE_INFINITY, 1, 1, 1e-3)).toThrow(IF97Error);
      expect(() => thermalConductivity(300, 997, 4.2, 0, 1, 1e-3)).toThrow(IF97Error);
      expect(() => thermalConductivity(300, 997, 4.2, 4.0, 1, 0)).toThrow(IF97Error);
    });

    it.each([0, -1])('rejects cp=%s with critical-enhancement parameters', (cp) => {
      const T = 647.35;
      expect(() => thermalConductivity(T, RHOc, cp, 3, 500, viscosity(T, RHOc))).toThrow(IF97Error);
    });

    it.each([0, -1])('rejects cp=%s even without the other optional parameters', (cp) => {
      expect(() => thermalConductivity(300, 997, cp)).toThrow(IF97Error);
    });
  });

  describe('surfaceTension', () => {
    // R1-76(2014) Table 1, calculated column, in mN/m (0.01 mN/m resolution).
    // https://iapws.org/public/documents/CH-L9/Surf-H2O-2014.pdf
    it.each([
      { T: 273.16, sigma: 75.65 },
      { T: 293.15, sigma: 72.74 },
      { T: 373.15, sigma: 58.91 },
      { T: 573.15, sigma: 14.36 },
      { T: 643.15, sigma: 0.39 },
    ])('matches IAPWS 2014 Table 1 at T=$T K', ({ T, sigma }) => {
      expectDigitsClose(surfaceTension(T)! * 1e3, sigma, 2);
    });

    // G14-19 Table 2 independently publishes pure-water σw with nine decimals.
    // https://iapws.org/technical-guidance/release/Seawater-Surf.download
    it.each([
      { T: 293.15, sigma: 72.736140422 },
      { T: 298.15, sigma: 71.972205230 },
      { T: 353.15, sigma: 62.672854967 },
    ])('matches published pure-water check values in IAPWS G14-19 at T=$T K', ({ T, sigma }) => {
      expectDigitsClose(surfaceTension(T)! * 1e3, sigma, 9);
    });

    it('returns ~0.0728 N/m at 293.15K (20°C)', () => {
      const sigma = surfaceTension(293.15);
      expect(sigma).not.toBeNull();
      expectDigitsClose(sigma!, 0.0728, 3);
    });

    it('returns 0 at critical temperature', () => {
      const sigma = surfaceTension(Tc);
      expect(sigma).not.toBeNull();
      expectDigitsClose(sigma!, 0, 6);
    });

    it('decreases with temperature', () => {
      const sigma300 = surfaceTension(300);
      const sigma400 = surfaceTension(400);
      const sigma500 = surfaceTension(500);
      expect(sigma300).not.toBeNull();
      expect(sigma400).not.toBeNull();
      expect(sigma500).not.toBeNull();
      expect(sigma300!).toBeGreaterThan(sigma400!);
      expect(sigma400!).toBeGreaterThan(sigma500!);
    });

    it('returns null outside the valid range', () => {
      expect(surfaceTension(250)).toBeNull();
      expect(surfaceTension(Tc + 10)).toBeNull();
    });

    it('rejects non-finite temperatures', () => {
      expect(() => surfaceTension(Number.NaN)).toThrow(IF97Error);
      expect(() => surfaceTension(Number.POSITIVE_INFINITY)).toThrow(IF97Error);
    });
  });

  describe('dielectricConstant', () => {
    // R8-97 Table 4: molar density in mol/dm³, ε dimensionless; both rounded to 5 decimals.
    // https://iapws.org/public/documents/NPjmT/dielec.pdf
    it.each([
      { T: 240, rhoM: 54.33701, eps: 104.34982 },
      { T: 300, rhoM: 55.31735, eps: 77.74735 },
      { T: 300, rhoM: 55.56148, eps: 78.11269 },
      { T: 300, rhoM: 68.69265, eps: 103.69632 },
      { T: 650, rhoM: 2.24692, eps: 1.26715 },
      { T: 650, rhoM: 40.31090, eps: 17.71733 },
      { T: 650, rhoM: 52.58636, eps: 26.62132 },
      { T: 870, rhoM: 1.45275, eps: 1.12721 },
      { T: 870, rhoM: 20.98927, eps: 4.98281 },
      { T: 870, rhoM: 45.01376, eps: 15.09746 },
    ])('matches IAPWS 1997 Table 4 at T=$T K, rho=$rhoM mol/dm^3', ({ T, rhoM, eps }) => {
      // ε increases with density here; the two published rounding intervals must overlap.
      const epsLow = dielectricConstant(T, (rhoM - 5e-6) * 18.015268);
      const epsHigh = dielectricConstant(T, (rhoM + 5e-6) * 18.015268);
      expect(epsLow).toBeLessThanOrEqual(eps + 5e-6);
      expect(epsHigh).toBeGreaterThanOrEqual(eps - 5e-6);
    });

    it('returns ~80 for liquid water at 298.15K', () => {
      const eps = dielectricConstant(298.15, 997);
      expect(eps).toBeGreaterThan(75);
      expect(eps).toBeLessThan(85);
    });

    it('returns ~1 for dilute steam', () => {
      const eps = dielectricConstant(500, 0.5);
      expect(eps).toBeGreaterThan(0.9);
      expect(eps).toBeLessThan(2);
    });

    it('rejects non-finite and non-positive inputs', () => {
      expect(() => dielectricConstant(Number.NaN, 997)).toThrow(IF97Error);
      expect(() => dielectricConstant(300, Number.NEGATIVE_INFINITY)).toThrow(IF97Error);
      expect(() => dielectricConstant(300, -1)).toThrow(IF97Error);
    });

    it.each([
      { T: 200, rho: 997 },
      { T: 228, rho: 997 },
      { T: 200, rho: 0 },
      { T: 228, rho: 0 },
    ])('rejects the equation singularity and lower temperatures at T=$T K, rho=$rho kg/m^3', ({ T, rho }) => {
      expect(() => dielectricConstant(T, rho)).toThrow(IF97Error);
    });

    it.each([228.0001, 238, 874, 2273.15])('preserves finite dielectric extrapolation at T=%s K', (T) => {
      const eps = dielectricConstant(T, 997);
      expect(Number.isFinite(eps)).toBe(true);
      expect(eps).toBeGreaterThan(1);
    });
  });

  describe('ionizationConstant', () => {
    it('returns ~14 for water at 298.15K', () => {
      const pKw = ionizationConstant(298.15, 997);
      expect(pKw).toBeGreaterThan(13);
      expect(pKw).toBeLessThan(15);
    });

    it('returns null outside the released validity range', () => {
      expect(ionizationConstant(1500, 10)).toBeNull();
    });

    it('rejects non-finite and non-positive inputs', () => {
      expect(() => ionizationConstant(Number.NaN, 997)).toThrow(IF97Error);
      expect(() => ionizationConstant(300, Number.NaN)).toThrow(IF97Error);
      expect(() => ionizationConstant(300, -1)).toThrow(IF97Error);
    });
  });
});
