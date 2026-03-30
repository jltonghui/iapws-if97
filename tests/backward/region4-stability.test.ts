import { describe, expect, it } from 'vitest';
import { solvePH } from '../../src/backward/ph.js';
import { solvePS } from '../../src/backward/ps.js';
import { solveHS } from '../../src/backward/hs.js';
import { solveTH } from '../../src/backward/th.js';
import { solveTS } from '../../src/backward/ts.js';
import { solveTx } from '../../src/saturation/two-phase.js';
import { Tc, Tt } from '../../src/constants.js';
import { Region } from '../../src/types.js';
import { expectRegion4RoundTrip } from '../helpers/backward-assertions.js';

type Region4Sample = {
  name: string;
  T: number;
  x: number;
  pressureDigits: number;
  temperatureDigits: number;
  qualityDigits: number;
};

const region4EdgeSamples: Region4Sample[] = [
  {
    name: 'just above the triple point',
    T: Tt + 1e-4,
    x: 0.3,
    pressureDigits: 10,
    temperatureDigits: 6,
    qualityDigits: 6,
  },
  {
    name: 'warm low-pressure saturation state',
    T: Tt + 1e-2,
    x: 0.7,
    pressureDigits: 10,
    temperatureDigits: 6,
    qualityDigits: 6,
  },
  {
    name: 'just outside the critical exclusion band',
    T: Tc - 2e-3,
    x: 0.4,
    pressureDigits: 6,
    temperatureDigits: 6,
    qualityDigits: 5,
  },
  {
    name: 'closer to the critical endpoint but still valid',
    T: Tc - 1.5e-3,
    x: 0.6,
    pressureDigits: 6,
    temperatureDigits: 6,
    qualityDigits: 5,
  },
];

const region4HsCriticalEdgeSamples: Region4Sample[] = [
  ...region4EdgeSamples,
  {
    name: 'very close to the critical endpoint but still subcritical',
    T: Tc - 1e-4,
    x: 0.5,
    pressureDigits: 6,
    temperatureDigits: 6,
    qualityDigits: 4,
  },
];

describe('region4 backward stability near endpoints', () => {
  it.each(region4EdgeSamples)('solvePH and solvePS preserve $name', ({
    T,
    x,
    pressureDigits,
    temperatureDigits,
    qualityDigits,
  }) => {
    const forward = solveTx(T, x);

    const fromPH = solvePH(forward.pressure, forward.enthalpy);
    const fromPS = solvePS(forward.pressure, forward.entropy);

    for (const candidate of [fromPH, fromPS]) {
      expectRegion4RoundTrip(candidate, forward, {
        pressureTolerance: Math.pow(10, -pressureDigits),
        temperatureTolerance: Math.pow(10, -temperatureDigits),
        qualityTolerance: Math.pow(10, -qualityDigits),
      });
    }
  });

  it.each(region4EdgeSamples)('solveTH and solveTS preserve $name', ({
    T,
    x,
    pressureDigits,
    temperatureDigits,
    qualityDigits,
  }) => {
    const forward = solveTx(T, x);

    const fromTH = solveTH(forward.temperature, forward.enthalpy);
    const fromTS = solveTS(forward.temperature, forward.entropy);

    for (const candidate of [fromTH, fromTS]) {
      expectRegion4RoundTrip(candidate, forward, {
        pressureTolerance: Math.pow(10, -pressureDigits),
        temperatureTolerance: Math.pow(10, -temperatureDigits),
        qualityTolerance: Math.pow(10, -qualityDigits),
      });
    }
  });

  it.each(region4HsCriticalEdgeSamples)('solveHS preserves $name', ({
    T,
    x,
    pressureDigits,
    temperatureDigits,
    qualityDigits,
  }) => {
    const forward = solveTx(T, x);
    const backward = solveHS(forward.enthalpy, forward.entropy);

    expectRegion4RoundTrip(backward, forward, {
      pressureTolerance: Math.pow(10, -pressureDigits),
      temperatureTolerance: Math.pow(10, -temperatureDigits),
      qualityTolerance: Math.pow(10, -qualityDigits),
    });
  });
});
