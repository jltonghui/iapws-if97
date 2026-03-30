import { describe, expect, it } from 'vitest';
import { solve, solvePT } from '../../src/core/solver.js';
import { detectRegionHS, detectRegionPH, detectRegionPS } from '../../src/core/region-detector.js';
import { solvePH } from '../../src/backward/ph.js';
import { solvePS } from '../../src/backward/ps.js';
import { solveHS } from '../../src/backward/hs.js';
import { solvePx, solveTx } from '../../src/saturation/two-phase.js';
import { saturationPressure, saturationTemperature } from '../../src/regions/region4.js';
import {
  Pc,
  Pt,
  Tc,
  Tt,
  P_MIN,
  R3_H_CRT,
  R3_S_CRT,
} from '../../src/constants.js';
import { IF97Error, OutOfRangeError, Region } from '../../src/types.js';

describe('region4 boundary behavior', () => {
  describe('low-level endpoint normalization', () => {
    it.each([
      {
        name: 'Pc at Tc',
        actual: () => saturationPressure(Tc),
        expected: Pc,
      },
      {
        name: 'Tt at Pt',
        actual: () => saturationTemperature(Pt),
        expected: Tt,
      },
    ])('normalizes $name', ({ actual, expected }) => {
      expect(actual()).toBe(expected);
    });
  });

  describe('accepted saturation boundaries', () => {
    it.each([
      {
        name: 'solvePx saturated liquid at Pt',
        actual: () => solvePx(Pt, 0),
        expectedRegion: Region.Region4,
        expectedPressure: Pt,
        expectedTemperature: Tt,
        expectedQuality: 0,
      },
      {
        name: 'solvePx saturated vapor at Pt',
        actual: () => solvePx(Pt, 1),
        expectedRegion: Region.Region4,
        expectedPressure: Pt,
        expectedTemperature: Tt,
        expectedQuality: 1,
      },
      {
        name: 'solveTx saturated liquid at Tt',
        actual: () => solveTx(Tt, 0),
        expectedRegion: Region.Region4,
        expectedPressure: Pt,
        expectedTemperature: Tt,
        expectedQuality: 0,
      },
      {
        name: 'solveTx saturated vapor at Tt',
        actual: () => solveTx(Tt, 1),
        expectedRegion: Region.Region4,
        expectedPressure: Pt,
        expectedTemperature: Tt,
        expectedQuality: 1,
      },
      {
        name: 'solve mode Px at Pt',
        actual: () => solve({ mode: 'Px', p: Pt, x: 0 }),
        expectedRegion: Region.Region4,
        expectedPressure: Pt,
        expectedTemperature: Tt,
        expectedQuality: 0,
      },
      {
        name: 'solve mode Tx at Tt',
        actual: () => solve({ mode: 'Tx', T: Tt, x: 1 }),
        expectedRegion: Region.Region4,
        expectedPressure: Pt,
        expectedTemperature: Tt,
        expectedQuality: 1,
      },
    ])('$name', ({
      actual,
      expectedRegion,
      expectedPressure,
      expectedTemperature,
      expectedQuality,
    }) => {
      const state = actual();

      expect(state.region).toBe(expectedRegion);
      expect(state.pressure).toBe(expectedPressure);
      expect(state.temperature).toBe(expectedTemperature);
      expect(state.quality).toBe(expectedQuality);
    });

    it('round-trips the true triple-point liquid endpoint through PH, PS, and HS as Region 4', () => {
      const forward = solvePx(Pt, 0);

      const fromPH = solvePH(forward.pressure, forward.enthalpy);
      const fromPS = solvePS(forward.pressure, forward.entropy);
      const fromHS = solveHS(forward.enthalpy, forward.entropy);

      for (const candidate of [fromPH, fromPS, fromHS]) {
        expect(candidate.region).toBe(Region.Region4);
        expect(candidate.pressure).toBe(Pt);
        expect(candidate.temperature).toBe(Tt);
        expect(candidate.quality).toBe(0);
      }
    });

    it('round-trips the true triple-point vapor endpoint through PH, PS, and HS as Region 4', () => {
      const forward = solvePx(Pt, 1);

      const fromPH = solvePH(forward.pressure, forward.enthalpy);
      const fromPS = solvePS(forward.pressure, forward.entropy);
      const fromHS = solveHS(forward.enthalpy, forward.entropy);

      for (const candidate of [fromPH, fromPS, fromHS]) {
        expect(candidate.region).toBe(Region.Region4);
        expect(candidate.pressure).toBe(Pt);
        expect(candidate.temperature).toBe(Tt);
        expect(candidate.quality).toBe(1);
      }
    });
  });

  describe('rejected saturation boundaries', () => {
    it.each([
      {
        name: 'solvePx at Pc with x=0',
        actual: () => solvePx(Pc, 0),
        errorClass: IF97Error,
        message: /critical/i,
      },
      {
        name: 'solvePx at Pc with x=0.5',
        actual: () => solvePx(Pc, 0.5),
        errorClass: IF97Error,
        message: /critical/i,
      },
      {
        name: 'solvePx at Pc with x=1',
        actual: () => solvePx(Pc, 1),
        errorClass: IF97Error,
        message: /critical/i,
      },
      {
        name: 'solveTx at Tc with x=0',
        actual: () => solveTx(Tc, 0),
        errorClass: IF97Error,
        message: /critical/i,
      },
      {
        name: 'solveTx at Tc with x=0.5',
        actual: () => solveTx(Tc, 0.5),
        errorClass: IF97Error,
        message: /critical/i,
      },
      {
        name: 'solveTx at Tc with x=1',
        actual: () => solveTx(Tc, 1),
        errorClass: IF97Error,
        message: /critical/i,
      },
      {
        name: 'solve mode Px at Pc',
        actual: () => solve({ mode: 'Px', p: Pc, x: 0.5 }),
        errorClass: IF97Error,
        message: /critical/i,
      },
      {
        name: 'solve mode Tx at Tc',
        actual: () => solve({ mode: 'Tx', T: Tc, x: 0.5 }),
        errorClass: IF97Error,
        message: /critical/i,
      },
      {
        name: 'solveTx below true triple point',
        actual: () => solveTx(273.15, 0.5),
        errorClass: OutOfRangeError,
        message: /Temperature/i,
      },
      {
        name: 'solve mode Tx below true triple point',
        actual: () => solve({ mode: 'Tx', T: 273.15, x: 0.5 }),
        errorClass: OutOfRangeError,
        message: /Temperature/i,
      },
    ])('$name', ({ actual, errorClass, message }) => {
      expect(actual).toThrow(errorClass);
      expect(actual).toThrow(message);
    });
  });

  describe('PT boundary contract', () => {
    it.each([
      {
        name: 'solvePT at Pt and Tt',
        actual: () => solvePT(Pt, Tt),
        expectedRegion: Region.Region1,
      },
      {
        name: 'solvePT at Pt and 273.15 K',
        actual: () => solvePT(Pt, 273.15),
        expectedRegion: Region.Region1,
      },
      {
        name: 'solve mode PT at Pt and Tt',
        actual: () => solve({ mode: 'PT', p: Pt, T: Tt }),
        expectedRegion: Region.Region1,
      },
    ])('accepts $name', ({ actual, expectedRegion }) => {
      expect(actual().region).toBe(expectedRegion);
    });

    it.each([
      {
        name: 'solvePT at P_MIN and 273.15 K',
        actual: () => solvePT(P_MIN, 273.15),
        expectedRegion: Region.Region1,
      },
      {
        name: 'solve mode PT at P_MIN and 273.15 K',
        actual: () => solve({ mode: 'PT', p: P_MIN, T: 273.15 }),
        expectedRegion: Region.Region1,
      },
    ])('accepts $name', ({ actual, expectedRegion }) => {
      expect(actual().region).toBe(expectedRegion);
    });
  });

  describe('critical backward-entry rejection', () => {
    it.each([
      {
        name: 'solvePH at critical endpoint',
        actual: () => solvePH(Pc, R3_H_CRT),
      },
      {
        name: 'solvePS at critical endpoint',
        actual: () => solvePS(Pc, R3_S_CRT),
      },
      {
        name: 'solveHS at critical endpoint',
        actual: () => solveHS(R3_H_CRT, R3_S_CRT),
      },
    ])('$name', ({ actual }) => {
      expect(actual).toThrow(IF97Error);
      expect(actual).toThrow(/critical/i);
    });
  });

  describe('public detector consistency at Region 4 boundaries', () => {
    it('classifies the true triple-point endpoints as Region 4 for PH/PS/HS detection', () => {
      for (const x of [0, 1] as const) {
        const state = solvePx(Pt, x);

        expect(detectRegionPH(state.pressure, state.enthalpy)).toBe(Region.Region4);
        expect(detectRegionPS(state.pressure, state.entropy)).toBe(Region.Region4);
        expect(detectRegionHS(state.enthalpy, state.entropy)).toBe(Region.Region4);
      }
    });

    it('classifies subcritical high-pressure single-phase Region 3 states as Region 3 for PH/PS detection', () => {
      for (const { p, T } of [
        { p: 20, T: 630 },
        { p: 20, T: 640 },
        { p: 21, T: 640 },
      ]) {
        const state = solvePT(p, T);

        expect(state.region).toBe(Region.Region3);
        expect(detectRegionPH(state.pressure, state.enthalpy)).toBe(Region.Region3);
        expect(detectRegionPS(state.pressure, state.entropy)).toBe(Region.Region3);
      }
    });
  });
});
