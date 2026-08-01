import { describe, expect, it } from 'vitest';
import { solveHS } from '../../src/backward/hs.js';
import { Tc, Tt } from '../../src/constants.js';
import {
  region4BackwardTemperatureHS,
  tryRegion4HSState,
} from '../../src/saturation/region4-hs.js';
import { solveTx } from '../../src/saturation/two-phase.js';
import { expectRegion4RoundTrip } from '../helpers/backward-assertions.js';

describe('Region 4 backward T(h,s)', () => {
  it.each([
    { h: 1800, s: 5.3, T: 346.8475498 },
    { h: 2400, s: 6.0, T: 425.1373305 },
    { h: 2500, s: 5.5, T: 522.5579013 },
  ])('matches IAPWS SR4-04(2014) Table 29 at h=$h, s=$s', ({ h, s, T }) => {
    expect(region4BackwardTemperatureHS(h, s)).toBeCloseTo(T, 7);
  });

  it.each([
    { T: 300, x: 0.01 },
    { T: 500, x: 0.9 },
    { T: 630, x: 0.1 },
    { T: 646, x: 0.99 },
  ])('round-trips T=$T K, x=$x without a saturation sweep', ({ T, x }) => {
    const forward = solveTx(T, x);
    const backward = solveHS(forward.enthalpy, forward.entropy);

    expectRegion4RoundTrip(backward, forward, {
      pressureTolerance: 1e-5,
      temperatureTolerance: 1e-5,
      qualityTolerance: 1e-5,
      specificVolumeTolerance: 1e-5,
    });
  });

  it.each([0.1, 0.5, 0.7])(
    'round-trips a triple-point mixture at x=%s',
    (x) => {
      const forward = solveTx(Tt, x);
      const backward = solveHS(forward.enthalpy, forward.entropy);

      expectRegion4RoundTrip(backward, forward, {
        pressureTolerance: 1e-8,
        temperatureTolerance: 1e-8,
        qualityTolerance: 1e-8,
      });
    },
  );

  it.each([
    { T: Tt + 1e-4, x: 0 },
    { T: Tt + 1e-4, x: 1e-7 },
    { T: Tt + 1e-4, x: 1e-6 },
    { T: Tt + 1e-4, x: 1 - 1e-6 },
    { T: Tt + 1e-4, x: 1 },
    { T: 500, x: 0 },
    { T: 500, x: 5e-7 },
    { T: 500, x: 1 - 5e-7 },
    { T: 500, x: 1 },
    { T: 646, x: 0 },
    { T: 646, x: 1e-6 },
    { T: 646, x: 1 - 1e-6 },
    { T: 646, x: 1 },
  ])('preserves endpoint or interior quality x=$x at T=$T K', ({ T, x }) => {
    const forward = solveTx(T, x);
    const backward = solveHS(forward.enthalpy, forward.entropy);

    expectRegion4RoundTrip(backward, forward, {
      pressureTolerance: 1e-7,
      temperatureTolerance: 1e-7,
      qualityTolerance: 1e-8,
    });
  });

  it.each([
    { delta: 1e-4 },
    { delta: 4.9e-5 },
    { delta: 1e-5 },
    { delta: 4e-6 },
    { delta: 2e-8 },
  ])(
    'round-trips a valid state $delta K below the critical point',
    ({ delta }) => {
      const forward = solveTx(Tc - delta, 0.5);
      expect(tryRegion4HSState(forward.enthalpy, forward.entropy)).not.toBeNull();
      const backward = solveHS(forward.enthalpy, forward.entropy);

      expectRegion4RoundTrip(backward, forward, {
        pressureTolerance: 1e-6,
        temperatureTolerance: 1e-6,
        qualityTolerance: 1e-4,
      });
    },
  );
});
