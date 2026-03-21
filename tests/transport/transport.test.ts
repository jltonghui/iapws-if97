// tests/transport/transport.test.ts
import { describe, it, expect } from 'vitest';
import { viscosity, thermalConductivity, surfaceTension, dielectricConstant, ionizationConstant } from '../../src/transport/properties.js';
import { Tc, RHOc } from '../../src/constants.js';

describe('Transport Properties', () => {
  describe('viscosity', () => {
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
  });

  describe('thermalConductivity', () => {
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

    it('critical enhancement λ₂ is significant near the critical point', () => {
      // Near-critical conditions: T ≈ Tc, ρ ≈ RHOc
      const T = Tc + 1; // Just above critical temperature
      const rho = RHOc;
      const cp = 100; // Very large cp near critical point [kJ/(kg·K)]
      const cv = 3.0; // cv stays moderate
      // Large isothermal compressibility near critical point
      const drhodP_T = 500; // [kg/m³/MPa]
      const mu = viscosity(T, rho);

      const kWithout = thermalConductivity(T, rho);
      const kWith = thermalConductivity(T, rho, cp, cv, drhodP_T, mu);

      // λ₂ should make the enhanced value larger than the base value
      expect(kWith).toBeGreaterThan(kWithout);
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
  });

  describe('surfaceTension', () => {
    it('returns ~0.0728 N/m at 293.15K (20°C)', () => {
      const sigma = surfaceTension(293.15);
      expect(sigma).not.toBeNull();
      expect(sigma).toBeCloseTo(0.0728, 3);
    });

    it('returns 0 at critical temperature', () => {
      const sigma = surfaceTension(Tc);
      expect(sigma).not.toBeNull();
      expect(sigma).toBeCloseTo(0, 6);
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
  });

  describe('dielectricConstant', () => {
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
  });
});
