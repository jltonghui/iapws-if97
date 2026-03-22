import { describe, expect, it } from 'vitest';
import { solvePx } from '../../src/index.js';
import { saturationTemperature } from '../../src/regions/region4.js';
import { REGION3_SUBREGIONS } from '../../src/regions/region3-data.js';
import { region3ByRhoT } from '../../src/regions/region3.js';
import { region3SatVolume, region3Volume } from '../../src/regions/region3-subregions.js';
import { b3ab, b3cd, b3ef, b3gh, b3ij, b3jk, b3mn, b3op, b3qu, b3rx, b3uv, b3wx } from '../../src/regions/boundaries.js';

function midpoint(a: number, b: number): number {
  return (a + b) / 2;
}

function expectConsistentRegion3Volume(p: number, T: number) {
  const v = region3Volume(p, T);
  const state = region3ByRhoT(1 / v, T);
  expect(v).toBeGreaterThan(0);
  expect(state.pressure).toBeCloseTo(p, 2);
}

describe('Region 3 subregion dispatch', () => {
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
      expect(region3SatVolume(p, T, 0)).toBeCloseTo(solvePx(p, 0).specificVolume, 5);
    }

    for (const p of vaporBranchOnlyCases) {
      const T = saturationTemperature(p);
      expect(region3SatVolume(p, T, 1)).toBeGreaterThan(0);
    }

    for (const p of vaporCases) {
      const T = saturationTemperature(p);
      expect(region3SatVolume(p, T, 1)).toBeCloseTo(solvePx(p, 1).specificVolume, 5);
    }
  });
});
