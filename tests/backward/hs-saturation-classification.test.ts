import { describe, expect, it } from 'vitest';
import { solveHS, solvePT, solveTx } from '../../src/index.js';
import { Tc } from '../../src/constants.js';
import { detectRegionHS } from '../../src/core/region-detector.js';
import { saturationPressure, saturationTemperature } from '../../src/regions/region4.js';
import { Region } from '../../src/types.js';
import {
  expectBackwardValue,
  expectRegion4RoundTrip,
} from '../helpers/backward-assertions.js';

const PRESSURE = 1;
const SATURATION_TEMPERATURE = saturationTemperature(PRESSURE);

describe('H-S classification next to the saturation boundary', () => {
  it.each([
    { offset: -0.005, region: Region.Region1 },
    { offset: -0.001, region: Region.Region1 },
    { offset: 0.001, region: Region.Region2 },
    { offset: 0.005, region: Region.Region2 },
  ])('keeps Tsat $offset K in Region $region', ({ offset, region }) => {
    const forward = solvePT(PRESSURE, SATURATION_TEMPERATURE + offset);

    expect(forward.region).toBe(region);
    expect(detectRegionHS(forward.enthalpy, forward.entropy)).toBe(region);

    const backward = solveHS(forward.enthalpy, forward.entropy);
    expect(backward.region).toBe(region);
    expectBackwardValue(backward.pressure, PRESSURE, 'pressure');
    expectBackwardValue(backward.temperature, forward.temperature, 'temperature');
  });

  it.each([1, 0.01, 0.001, 0.0001])(
    'distinguishes Region 4 endpoints from adjacent Region 3 at Tc−%s K',
    (delta) => {
      const saturationT = Tc - delta;
      const pressure = saturationPressure(saturationT);

      for (const quality of [0, 1] as const) {
        const endpoint = solveTx(saturationT, quality);
        const backward = solveHS(endpoint.enthalpy, endpoint.entropy);
        expectRegion4RoundTrip(backward, endpoint, {
          pressureTolerance: 1e-6,
          temperatureTolerance: 1e-6,
          qualityTolerance: 1e-8,
        });
      }

      for (const offset of [-1e-5, 1e-5]) {
        const singlePhase = solvePT(pressure, saturationT + offset);
        expect(singlePhase.region).toBe(Region.Region3);
        expect(solveHS(singlePhase.enthalpy, singlePhase.entropy).region).toBe(Region.Region3);
      }
    },
  );

  it('keeps a platform-rounded near-critical saturation input in Region 4', () => {
    const backward = solveHS(2088.9078193652176, 4.4141248142462741);

    expect(backward.region).toBe(Region.Region4);
  });
});
