import { describe, expect, it, vi } from 'vitest';
import { solveHS, solvePT, solveTx } from '../../src/index.js';
import { Tc, Tt } from '../../src/constants.js';
import { detectRegionHS } from '../../src/detect.js';
import { saturationPressure, saturationTemperature } from '../../src/regions/region4.js';
import { IF97Error, Region } from '../../src/types.js';
import { region3ByRhoT } from '../../src/regions/region3.js';
import * as saturationCommon from '../../src/saturation/common.js';
import * as region4HS from '../../src/saturation/region4-hs.js';
import * as hsState from '../../src/backward/hs-state.js';
import {
  expectBackwardValue,
  expectRegion4RoundTrip,
} from '../helpers/backward-assertions.js';

const PRESSURE = 1;
const SATURATION_TEMPERATURE = saturationTemperature(PRESSURE);

describe('H-S classification next to the saturation boundary', () => {
  it.each([
    { p: 0.1, T: 372.5 },
    { p: saturationPressure(610) + 0.001, T: 610 },
  ])('rules out the saturation dome before inverse solving at p=$p, T=$T', ({ p, T }) => {
    const forward = solvePT(p, T);
    const saturation = vi.spyOn(region4HS, 'tryRegion4HSState');
    try {
      expect(detectRegionHS(forward.enthalpy, forward.entropy)).toBe(Region.Region1);
      const backward = solveHS(forward.enthalpy, forward.entropy);
      expect(backward.region).toBe(Region.Region1);
      expectBackwardValue(backward.pressure, p, 'pressure');
      expectBackwardValue(backward.temperature, T, 'temperature');
      expect(saturation).not.toHaveBeenCalled();
    } finally {
      saturation.mockRestore();
    }
  });

  it.each([372.5, 610])('retains saturation confirmation at the T=%s liquid endpoint', (T) => {
    const forward = solveTx(T, 0);
    const saturation = vi.spyOn(region4HS, 'tryRegion4HSState');
    try {
      expect(detectRegionHS(forward.enthalpy, forward.entropy)).toBe(Region.Region4);
      expectRegion4RoundTrip(solveHS(forward.enthalpy, forward.entropy), forward);
      expect(saturation).toHaveBeenCalled();
    } finally {
      saturation.mockRestore();
    }
  });

  it('keeps saturation confirmation when endpoint inversion is unavailable', () => {
    const forward = solvePT(0.1, 372.5);
    const endpoints = vi.spyOn(saturationCommon, 'saturationEndpointsAtTemperature')
      .mockImplementationOnce(() => { throw new IF97Error('Unavailable saturation endpoint'); });
    const saturation = vi.spyOn(region4HS, 'tryRegion4HSState').mockReturnValue(null);
    try {
      expect(detectRegionHS(forward.enthalpy, forward.entropy)).toBe(Region.Region1);
      expect(saturation).toHaveBeenCalledOnce();
    } finally {
      endpoints.mockRestore();
      saturation.mockRestore();
    }
  });

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

  it('keeps a fixed near-critical vapor input on its stable Region 3 branch', () => {
    const h = 2088.9078193652176;
    const s = 4.4141248142462741;
    const backward = solveHS(h, s);
    const raw = region3ByRhoT(1 / backward.specificVolume, backward.temperature);

    expect(backward.region).toBe(Region.Region3);
    expect(backward.quality).toBeNull();
    expect(1 / backward.specificVolume).toBeLessThan(322);
    expect(backward.pressure).toBeLessThan(saturationPressure(backward.temperature));
    expect(raw.isothermalCompressibility).toBeGreaterThan(0);
    expectBackwardValue(raw.enthalpy, h, 'enthalpy', 1e-8);
    expectBackwardValue(raw.entropy, s, 'entropy', 1e-11);
  });
});

describe('HS saturation classification near the B23 corner', () => {
  it.each([
    { p: 16.528998960962053, T: 623.15 },
    { p: 16.52896135965548, T: 623.1491 },
    { p: 16.52896135965548, T: 623.15 },
  ])('recovers the superheated Region 2 state at p=$p, T=$T', ({ p, T }) => {
    const forward = solvePT(p, T);
    expect(forward.region).toBe(Region.Region2);
    expect(detectRegionHS(forward.enthalpy, forward.entropy)).toBe(Region.Region2);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expect(recovered.region).toBe(Region.Region2);
    expectBackwardValue(recovered.pressure, p, 'pressure');
    expectBackwardValue(recovered.temperature, T, 'temperature');
    const checked = solvePT(recovered.pressure, recovered.temperature);
    expectBackwardValue(checked.enthalpy, forward.enthalpy, 'enthalpy', 1e-7);
    expectBackwardValue(checked.entropy, forward.entropy, 'entropy', 1e-10);
  });

  it('rejects an HS input below the lower envelope in the disputed entropy zone', () => {
    const liquid = solveTx(Tt, 0);
    const vapor = solveTx(Tt, 1);
    const entropy = 5.210920786823613;
    const quality = (entropy - liquid.entropy) / (vapor.entropy - liquid.entropy);
    const enthalpy = liquid.enthalpy + quality * (vapor.enthalpy - liquid.enthalpy) - 1e-7;
    expect(detectRegionHS(enthalpy, entropy)).toBe(-1);
    expect(() => solveHS(enthalpy, entropy)).toThrow(IF97Error);
  });

  it('validates Region 3 when saturation recovery is unavailable', () => {
    const forward = solvePT(17.969098460653143, 630);
    const saturation = vi.spyOn(region4HS, 'tryRegion4HSState').mockReturnValue(null);
    try {
      expect(detectRegionHS(forward.enthalpy, forward.entropy)).toBe(Region.Region3);
      const recovered = solveHS(forward.enthalpy, forward.entropy);
      expect(recovered.region).toBe(Region.Region3);
      const checked = solvePT(recovered.pressure, recovered.temperature);
      expectBackwardValue(checked.enthalpy, forward.enthalpy, 'enthalpy', 1e-7);
      expectBackwardValue(checked.entropy, forward.entropy, 'entropy', 1e-10);
    } finally {
      saturation.mockRestore();
    }
  });

  it('retains the saturation route when neither single-phase candidate is available', () => {
    const forward = solvePT(16.528998960962053, 623.15);
    const candidates = vi.spyOn(hsState, 'solveHSInRegion')
      .mockImplementation(() => { throw new IF97Error('Unavailable single-phase candidate'); });
    try {
      expect(detectRegionHS(forward.enthalpy, forward.entropy)).toBe(Region.Region4);
    } finally {
      candidates.mockRestore();
    }
  });

  it('propagates unexpected errors from candidate validation', () => {
    const forward = solvePT(16.528998960962053, 623.15);
    const error = new Error('Unexpected candidate failure');
    const candidates = vi.spyOn(hsState, 'solveHSInRegion')
      .mockImplementation(() => { throw error; });
    try {
      expect(() => detectRegionHS(forward.enthalpy, forward.entropy)).toThrow(error);
    } finally {
      candidates.mockRestore();
    }
  });
});
