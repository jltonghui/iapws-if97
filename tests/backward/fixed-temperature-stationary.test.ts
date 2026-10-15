import { describe, expect, it, vi } from 'vitest';
import { createFixedTemperatureStationaryPressureFinder } from '../../src/backward/fixed-temperature-stationary.js';
import { P_MIN, Tc } from '../../src/constants.js';
import { solveRegion3PTBasic } from '../../src/core/region3-pt.js';
import { boundary23_T_to_P } from '../../src/regions/boundaries.js';
import { region1 } from '../../src/regions/region1.js';
import { region2 } from '../../src/regions/region2.js';
import { saturationPressure } from '../../src/regions/region4.js';
import { region5 } from '../../src/regions/region5.js';
import { saturationEndpointsAtTemperature } from '../../src/saturation/common.js';

describe('fixed-temperature stationary pressures', () => {
  it('keeps cached coefficients intact across repeated pressure intervals', () => {
    const T = 523.15;
    const pressures = createFixedTemperatureStationaryPressureFinder(T, 'enthalpy');
    const lower = region1(saturationPressure(T), T);
    const upper = region1(100, T);

    expect(pressures(lower, upper)).toHaveLength(1);
    expect(pressures(lower, upper)[0]).toBeCloseTo(6.506932487320858, 8);
    expect(pressures(region1(10, T), upper)).toEqual([]);
    expect(pressures(lower, upper)[0]).toBeCloseTo(6.506932487320858, 8);
  });

  it('isolates temperature and property coefficients between finders', () => {
    const T = 273.155;
    const lower = region1(saturationPressure(T), T);
    const upper = region1(100, T);
    const entropy = createFixedTemperatureStationaryPressureFinder(T, 'entropy');
    const enthalpy = createFixedTemperatureStationaryPressureFinder(T, 'enthalpy');
    const warmerEntropy = createFixedTemperatureStationaryPressureFinder(300, 'entropy');

    expect(entropy(lower, upper)[0]).toBeCloseTo(18.91573061865241, 8);
    expect(enthalpy(lower, upper)).toEqual([]);
    expect(warmerEntropy(region1(saturationPressure(300), 300), region1(100, 300))).toEqual([]);
    expect(entropy(lower, upper)[0]).toBeCloseTo(18.91573061865241, 8);
  });

  it.each(['enthalpy', 'entropy'] as const)('reuses Region 3 temperature powers across both %s branches', (property) => {
    const T = 640;
    const endpoints = saturationEndpointsAtTemperature(T);
    const lower = solveRegion3PTBasic(boundary23_T_to_P(T), T);
    const upper = solveRegion3PTBasic(100, T);
    const pressures = createFixedTemperatureStationaryPressureFinder(T, property);
    const powers = vi.spyOn(Math, 'pow');

    try {
      expect(pressures(lower, endpoints.vapor)).toEqual([]);
      const firstPowers = powers.mock.calls.filter(([base]) => base === Tc / T).length;
      expect(firstPowers).toBeGreaterThan(0);
      expect(pressures(endpoints.liquid, upper)).toEqual([]);
      expect(pressures(lower, endpoints.vapor)).toEqual([]);
      expect(powers.mock.calls.filter(([base]) => base === Tc / T)).toHaveLength(firstPowers);
    } finally {
      powers.mockRestore();
    }
  });

  it.each([
    { T: 300, upper: saturationPressure(300), stateAt: region2 },
    { T: 700, upper: boundary23_T_to_P(700), stateAt: region2 },
    { T: 900, upper: 100, stateAt: region2 },
    { T: 1073.15, upper: 100, stateAt: region2 },
    { T: 1500, upper: 50, stateAt: region5 },
    { T: 2273.15, upper: 50, stateAt: region5 },
  ])('finds no extrema on the steam isotherm at T=$T K', ({ T, upper, stateAt }) => {
    for (const property of ['enthalpy', 'entropy'] as const) {
      const pressures = createFixedTemperatureStationaryPressureFinder(T, property);
      expect(pressures(stateAt(P_MIN, T), stateAt(upper, T))).toEqual([]);
    }
  });
});
