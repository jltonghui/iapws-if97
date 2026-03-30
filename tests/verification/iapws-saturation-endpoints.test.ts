import { describe, expect, it } from 'vitest';
import {
  Region,
  solveHS,
  solvePH,
  solvePS,
  solvePx,
  solveTH,
  solveTS,
  solveTx,
  type SteamState,
} from '../../src/index.js';
import { saturationPressure, saturationTemperature } from '../../src/regions/region4.js';

interface SaturationCase {
  source: string;
  name: string;
  pressure: number;
  temperature: number;
}

const TABLE_35_CASES: readonly SaturationCase[] = [
  { source: 'IF97 Table 35 Psat(T)', name: 'T=300 K', pressure: 0.353658941e-2, temperature: 300 },
  { source: 'IF97 Table 35 Psat(T)', name: 'T=500 K', pressure: 0.263889776e1, temperature: 500 },
  { source: 'IF97 Table 35 Psat(T)', name: 'T=600 K', pressure: 0.123443146e2, temperature: 600 },
  { source: 'IF97 Table 35 Tsat(p)', name: 'p=0.1 MPa', pressure: 0.1, temperature: 0.372755919e3 },
  { source: 'IF97 Table 35 Tsat(p)', name: 'p=1 MPa', pressure: 1, temperature: 0.453035632e3 },
  { source: 'IF97 Table 35 Tsat(p)', name: 'p=10 MPa', pressure: 10, temperature: 0.584149488e3 },
] as const;

const SATURATION_ENDPOINTS = [
  { label: 'saturated liquid', quality: 0 as const },
  { label: 'saturated vapor', quality: 1 as const },
] as const;

const BACKWARD_SOLVERS = [
  { name: 'solvePH', solve: (state: SteamState) => solvePH(state.pressure, state.enthalpy) },
  { name: 'solvePS', solve: (state: SteamState) => solvePS(state.pressure, state.entropy) },
  { name: 'solveHS', solve: (state: SteamState) => solveHS(state.enthalpy, state.entropy) },
  { name: 'solveTH', solve: (state: SteamState) => solveTH(state.temperature, state.enthalpy) },
  { name: 'solveTS', solve: (state: SteamState) => solveTS(state.temperature, state.entropy) },
] as const;

function relativeError(actual: number, expected: number): number {
  return expected === 0 ? Math.abs(actual) : Math.abs((actual - expected) / expected);
}

function expectRelativeClose(label: string, actual: number, expected: number, tolerance = 1e-6): void {
  const error = relativeError(actual, expected);
  if (error >= tolerance) {
    throw new Error(
      `${label} mismatch: actual=${actual}, expected=${expected}, relErr=${error}, tol=${tolerance}`,
    );
  }
}

function expectSaturationStateMatches(actual: SteamState, expected: SteamState): void {
  if (actual.region !== Region.Region4) {
    throw new Error(`region mismatch: actual=${actual.region}, expected=${Region.Region4}`);
  }
  if (actual.quality !== expected.quality) {
    throw new Error(`quality mismatch: actual=${actual.quality}, expected=${expected.quality}`);
  }

  expectRelativeClose('pressure', actual.pressure, expected.pressure);
  expectRelativeClose('temperature', actual.temperature, expected.temperature);
  expectRelativeClose('enthalpy', actual.enthalpy, expected.enthalpy);
  expectRelativeClose('entropy', actual.entropy, expected.entropy);
  expectRelativeClose('specificVolume', actual.specificVolume, expected.specificVolume);
}

function caseId(testCase: SaturationCase, endpointLabel: string): string {
  return `${testCase.source}: ${testCase.name}, ${endpointLabel}`;
}

describe('IAPWS saturation endpoint verification', () => {
  TABLE_35_CASES.forEach((testCase) => {
    describe(`${testCase.source} ${testCase.name}`, () => {
      it('matches the official saturation relation', () => {
        expectRelativeClose(
          'Psat(T)',
          saturationPressure(testCase.temperature),
          testCase.pressure,
        );
        expectRelativeClose(
          'Tsat(p)',
          saturationTemperature(testCase.pressure),
          testCase.temperature,
        );
      });

      SATURATION_ENDPOINTS.forEach((endpoint) => {
        describe(endpoint.label, () => {
          it('solveTx and solvePx produce the same endpoint state', () => {
            const fromTx = solveTx(testCase.temperature, endpoint.quality);
            const fromPx = solvePx(testCase.pressure, endpoint.quality);

            expect(fromTx.region).toBe(Region.Region4);
            expect(fromTx.quality).toBe(endpoint.quality);
            expectSaturationStateMatches(fromPx, fromTx);
          });

          BACKWARD_SOLVERS.forEach((backwardSolver) => {
            it(`${backwardSolver.name} reproduces the saturation endpoint`, () => {
              const forward = solveTx(testCase.temperature, endpoint.quality);
              const backward = backwardSolver.solve(forward);

              try {
                expectSaturationStateMatches(backward, forward);
              } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                throw new Error(`${caseId(testCase, endpoint.label)} via ${backwardSolver.name}: ${detail}`);
              }
            });
          });
        });
      });
    });
  });
});
