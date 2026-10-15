import { describe, expect, it } from 'vitest';
import { solvePx } from '../../src/index.js';
import { evalSubregion } from '../../src/regions/region3-eval.js';
import { saturationPressure, saturationTemperature } from '../../src/regions/region4.js';
import { REGION3_SUBREGIONS } from '../../src/regions/region3-data.js';
import { region3ByRhoT } from '../../src/regions/region3.js';
import { region3SatVolume, region3Volume } from '../../src/boundaries.js';
import { b3ab, b3cd, b3ef, b3gh, b3ij, b3jk, b3mn, b3op, b3qu, b3rx, b3uv, b3wx } from '../../src/regions/boundaries.js';
import { IF97Error } from '../../src/types.js';
import { expectDigitsClose } from '../helpers/assertions.js';

function midpoint(a: number, b: number): number {
  return (a + b) / 2;
}

function expectConsistentRegion3Volume(p: number, T: number) {
  const v = region3Volume(p, T);
  const state = region3ByRhoT(1 / v, T);
  expect(v).toBeGreaterThan(0);
  expectDigitsClose(state.pressure, p, 2);
}

describe('Region 3 subregion dispatch', () => {
  it.each([0.5, -1, 2, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '0', '1', null, undefined])(
    'rejects a saturation phase selector other than numeric 0 or 1: %s', (x) => {
      expect(() => region3SatVolume(20, 638.8, x as never)).toThrow(IF97Error);
    },
  );

  it('preserves saturated liquid and vapor endpoint volumes, including negative zero', () => {
    expectDigitsClose(region3SatVolume(20, 638.8, 0), 0.0020320919521443687, 10);
    expect(region3SatVolume(20, 638.8, -0)).toBe(region3SatVolume(20, 638.8, 0));
    expectDigitsClose(region3SatVolume(20, 638.8, 1), 0.0058188123235870205, 10);
  });

  it.each([100.00000000000001, 101, 200])('rejects pressure above 100 MPa: %s', (p) => {
    expect(() => region3Volume(p, 650)).toThrow(IF97Error);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '650', null, undefined, 1n, Symbol('input')])(
    'rejects non-finite or nonnumeric pressure and temperature: %s', (value) => {
      expect(() => region3Volume(value as never, 650)).toThrow(IF97Error);
      expect(() => region3Volume(25, value as never)).toThrow(IF97Error);
    },
  );

  it('preserves the inclusive 100 MPa pressure boundary', () => {
    expectDigitsClose(region3Volume(100, 650), 0.0013770665118984268, 10);
    expectConsistentRegion3Volume(100, 650);
  });

  it('rejects non-finite or non-positive densities before evaluating the Helmholtz equation', () => {
    expect(() => region3ByRhoT(0, 650)).toThrow(IF97Error);
    expect(() => region3ByRhoT(-1, 650)).toThrow(IF97Error);
    expect(() => region3ByRhoT(Number.NaN, 650)).toThrow(IF97Error);
  });

  it('exposes a complete Region 3 subregion table', () => {
    expect(Object.keys(REGION3_SUBREGIONS)).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    ]);
  });

  it('covers the major v(p,T) dispatcher branches', () => {
    const cases = [
      { p: 45.0, T: b3ab(45.0) - 0.2 },
      { p: 45.0, T: b3ab(45.0) + 0.2 },

      { p: 30.0, T: b3cd(30.0) - 0.2 },
      { p: 30.0, T: midpoint(b3cd(30.0), b3ab(30.0)) },
      { p: 30.0, T: midpoint(b3ab(30.0), b3ef(30.0)) },
      { p: 30.0, T: b3ef(30.0) + 0.2 },

      { p: 24.0, T: b3cd(24.0) - 0.1 },
      { p: 24.0, T: midpoint(b3cd(24.0), b3gh(24.0)) },
      { p: 24.0, T: midpoint(b3gh(24.0), b3ef(24.0)) },
      { p: 24.0, T: midpoint(b3ef(24.0), b3ij(24.0)) },
      { p: 24.0, T: midpoint(b3ij(24.0), b3jk(24.0)) },
      { p: 24.0, T: b3jk(24.0) + 0.1 },

      { p: 23.2, T: b3cd(23.2) - 0.05 },
      { p: 23.2, T: midpoint(b3cd(23.2), b3gh(23.2)) },
      { p: 23.2, T: midpoint(b3gh(23.2), b3ef(23.2)) },
      { p: 23.2, T: midpoint(b3ef(23.2), b3ij(23.2)) },
      { p: 23.2, T: midpoint(b3ij(23.2), b3jk(23.2)) },
      { p: 23.2, T: b3jk(23.2) + 0.05 },

      { p: 22.7, T: b3cd(22.7) - 0.05 },
      { p: 22.7, T: midpoint(b3cd(22.7), b3gh(22.7)) },
      { p: 22.7, T: midpoint(b3gh(22.7), b3mn(22.7)) },
      { p: 22.7, T: midpoint(b3mn(22.7), b3ef(22.7)) },
      { p: 22.7, T: midpoint(b3ef(22.7), b3op(22.7)) },
      { p: 22.7, T: midpoint(b3op(22.7), b3ij(22.7)) },
      { p: 22.7, T: midpoint(b3ij(22.7), b3jk(22.7)) },
      { p: 22.7, T: b3jk(22.7) + 0.05 },

      { p: 22.2, T: b3cd(22.2) - 0.05 },
      { p: 22.2, T: midpoint(b3cd(22.2), b3qu(22.2)) },
      { p: 22.2, T: midpoint(b3qu(22.2), b3uv(22.2)) },
      { p: 22.2, T: midpoint(b3uv(22.2), b3ef(22.2)) },
      { p: 22.2, T: midpoint(b3ef(22.2), b3wx(22.2)) },
      { p: 22.2, T: midpoint(b3wx(22.2), b3rx(22.2)) },
      { p: 22.2, T: midpoint(b3rx(22.2), b3jk(22.2)) },
      { p: 22.2, T: b3jk(22.2) + 0.05 },

      { p: 21.0, T: b3cd(21.0) - 0.05 },
      { p: 21.0, T: midpoint(b3cd(21.0), saturationTemperature(21.0)) },
      { p: 21.0, T: midpoint(saturationTemperature(21.0), b3jk(21.0)) },
      { p: 21.0, T: b3jk(21.0) + 0.05 },

      { p: 20.0, T: b3cd(20.0) - 0.05 },
      { p: 20.0, T: midpoint(b3cd(20.0), saturationTemperature(20.0)) },
      { p: 20.0, T: saturationTemperature(20.0) + 0.05 },

      { p: 17.0, T: saturationTemperature(17.0) - 0.05 },
      { p: 17.0, T: saturationTemperature(17.0) + 0.05 },
    ];

    for (const { p, T } of cases) {
      expectConsistentRegion3Volume(p, T);
    }
  });

  it('keeps the Region 3 PT solve working on a representative high-pressure point', () => {
    const state = region3ByRhoT(1 / region3Volume(25.5, 650), 650);

    expect(state.pressure).toBeGreaterThan(0);
    expect(state.specificVolume).toBeGreaterThan(0);
    expect(state.enthalpy).toBeGreaterThan(0);
  });

  it('covers the Region 3 saturation boundary helpers', () => {
    const liquidBranchOnlyCases = [18.5, 21.5, 21.95];
    const liquidCases = [19.5, 20.0];
    const vaporBranchOnlyCases = [21.5, 21.95];
    const vaporCases = [20.0, 20.8];

    for (const p of liquidBranchOnlyCases) {
      const T = saturationTemperature(p);
      expect(region3SatVolume(p, T, 0)).toBeGreaterThan(0);
    }

    for (const p of liquidCases) {
      const T = saturationTemperature(p);
      expectDigitsClose(region3SatVolume(p, T, 0), solvePx(p, 0).specificVolume, 5);
    }

    for (const p of vaporBranchOnlyCases) {
      const T = saturationTemperature(p);
      expect(region3SatVolume(p, T, 1)).toBeGreaterThan(0);
    }

    for (const p of vaporCases) {
      const T = saturationTemperature(p);
      expectDigitsClose(region3SatVolume(p, T, 1), solvePx(p, 1).specificVolume, 5);
    }
  });

  // Adjacent temperatures bracket the 100-digit inverse at the calibrated
  // C/S pressure 19.00881189173929 MPa.
  it.each([
    { side: 'C', T: 634.6593786039792, subregion: REGION3_SUBREGIONS.C, volume: 0.0019263090209062218 },
    { side: 'S', T: 634.6593786039793, subregion: REGION3_SUBREGIONS.S, volume: 0.0019263090209060564 },
  ])('uses the same native liquid-side $side correlation in saturation and PT dispatchers', ({ side, T, subregion, volume }) => {
    const p = saturationPressure(T);
    const expected = evalSubregion(subregion, p, T);

    expect(p >= 19.00881189173929).toBe(side === 'S');
    expect(region3SatVolume(p, T, 0)).toBe(expected);
    expect(region3Volume(p, T)).toBe(expected);
    expectDigitsClose(expected, volume, 10);
  });
});
