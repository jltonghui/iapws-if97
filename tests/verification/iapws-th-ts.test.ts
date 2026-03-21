import { describe, expect, it } from 'vitest';
import { Region, solve, solvePT, solveTH, solveTS } from '../../src/index.js';

function expectRelClose(actual: number, expected: number, tol = 1e-6) {
  const err = expected === 0 ? Math.abs(actual) : Math.abs((actual - expected) / expected);
  expect(err).toBeLessThan(tol);
}

describe('IAPWS TH/TS backward verification', () => {
  describe('Region 1 — Table 5 backward check', () => {
    it('solveTH / solveTS recover P=3MPa from T=300K', () => {
      const forward = solvePT(3, 300);
      const fromTH = solveTH(300, forward.enthalpy);
      const fromTS = solveTS(300, forward.entropy);

      expect(fromTH.region).toBe(Region.Region1);
      expect(fromTS.region).toBe(Region.Region1);
      expectRelClose(fromTH.pressure, 3);
      expectRelClose(fromTS.pressure, 3);
    });
  });

  describe('Region 2 — Table 15 backward check', () => {
    it('solveTH / solveTS recover P=0.0035MPa from T=700K', () => {
      const forward = solvePT(0.0035, 700);
      const fromTH = solveTH(700, forward.enthalpy);
      const fromTS = solveTS(700, forward.entropy);

      expect(fromTH.region).toBe(Region.Region2);
      expect(fromTS.region).toBe(Region.Region2);
      expectRelClose(fromTH.pressure, 0.0035);
      expectRelClose(fromTS.pressure, 0.0035);
    });
  });

  describe('Region 3 — Table 33 temperature-led backward verification', () => {
    const cases = [
      { T: 650, rho: 500, p: 0.255837018e2 },
      { T: 650, rho: 200, p: 0.222930643e2 },
      { T: 750, rho: 500, p: 0.783095639e2 },
    ];

    cases.forEach(({ T, rho, p }) => {
      it(`solveTH / solveTS recover pressure for T=${T}K, rho=${rho}kg/m^3`, () => {
        const forward = solvePT(p, T);

        const fromTH = solveTH(T, forward.enthalpy);
        const fromTS = solveTS(T, forward.entropy);

        expect(fromTH.region).toBe(Region.Region3);
        expect(fromTS.region).toBe(Region.Region3);

        expect(fromTH.temperature).toBeCloseTo(T, 9);
        expect(fromTS.temperature).toBeCloseTo(T, 9);

        expectRelClose(fromTH.pressure, p);
        expectRelClose(fromTS.pressure, p);
      });
    });
  });

  describe('Region 5 — Table 42 temperature-led backward verification', () => {
    const cases = [
      { T: 1500, p: 0.5 },
      { T: 1500, p: 30 },
      { T: 2000, p: 30 },
    ];

    cases.forEach(({ T, p }) => {
      it(`solveTH / solveTS recover pressure for T=${T}K, p=${p}MPa`, () => {
        const forward = solvePT(p, T);

        const fromTH = solveTH(T, forward.enthalpy);
        const fromTS = solveTS(T, forward.entropy);

        expect(fromTH.region).toBe(Region.Region5);
        expect(fromTS.region).toBe(Region.Region5);

        expect(fromTH.temperature).toBeCloseTo(T, 9);
        expect(fromTS.temperature).toBeCloseTo(T, 9);

        expectRelClose(fromTH.pressure, p);
        expectRelClose(fromTS.pressure, p);
      });
    });
  });

  describe('Unified solve() smoke for TH/TS on official points', () => {
    it('routes TH input on an official Region 3 point', () => {
      const forward = solvePT(25.5837018, 650);
      const state = solve({ mode: 'TH', T: 650, h: forward.enthalpy });

      expect(state.region).toBe(Region.Region3);
      expectRelClose(state.pressure, 25.5837018);
    });

    it('routes TS input on an official Region 5 point', () => {
      const forward = solvePT(30, 1500);
      const state = solve({ mode: 'TS', T: 1500, s: forward.entropy });

      expect(state.region).toBe(Region.Region5);
      expectRelClose(state.pressure, 30);
    });
  });
});
