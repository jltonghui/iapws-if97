import { describe, expect, it } from 'vitest';
import {
  gibbsPropertyDerivatives,
  helmholtzPropertyDerivatives,
} from '../../src/backward/thermodynamic-derivatives.js';
import { region1 } from '../../src/regions/region1.js';
import { region2 } from '../../src/regions/region2.js';
import { region3ByRhoT } from '../../src/regions/region3.js';
import { region5 } from '../../src/regions/region5.js';

function derivative(f: (x: number) => number, x: number, step: number): number {
  return (f(x + step) - f(x - step)) / (2 * step);
}

function expectRelative(actual: number, expected: number): void {
  expect(Math.abs((actual - expected) / expected)).toBeLessThan(2e-6);
}

describe('thermodynamic property derivatives', () => {
  it.each([
    { name: 'Region 1', stateAt: region1, p: 3, T: 300 },
    { name: 'Region 2', stateAt: region2, p: 30, T: 700 },
    { name: 'Region 5', stateAt: region5, p: 30, T: 1500 },
  ])('matches finite differences in $name', ({ stateAt, p, T }) => {
    const actual = gibbsPropertyDerivatives(stateAt(p, T));

    expectRelative(actual.dhDp, derivative((candidate) => stateAt(candidate, T).enthalpy, p, 1e-4));
    expectRelative(actual.dhDT, derivative((candidate) => stateAt(p, candidate).enthalpy, T, 1e-3));
    expectRelative(actual.dsDp, derivative((candidate) => stateAt(candidate, T).entropy, p, 1e-4));
    expectRelative(actual.dsDT, derivative((candidate) => stateAt(p, candidate).entropy, T, 1e-3));
  });

  it('matches Region 3 finite differences in density and temperature', () => {
    const rho = 500;
    const T = 650;
    const actual = helmholtzPropertyDerivatives(region3ByRhoT(rho, T), rho);

    expectRelative(actual.dpDrho, derivative((candidate) => region3ByRhoT(candidate, T).pressure, rho, 1e-3));
    expectRelative(actual.dpDT, derivative((candidate) => region3ByRhoT(rho, candidate).pressure, T, 1e-3));
    expectRelative(actual.dhDrho, derivative((candidate) => region3ByRhoT(candidate, T).enthalpy, rho, 1e-3));
    expectRelative(actual.dhDT, derivative((candidate) => region3ByRhoT(rho, candidate).enthalpy, T, 1e-3));
    expectRelative(actual.dsDrho, derivative((candidate) => region3ByRhoT(candidate, T).entropy, rho, 1e-3));
    expectRelative(actual.dsDT, derivative((candidate) => region3ByRhoT(rho, candidate).entropy, T, 1e-3));
  });
});
