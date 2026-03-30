import { describe, expect, it } from 'vitest';
import {
  Region,
  solveHS,
  solvePH,
  solvePS,
  solvePT,
  solveTH,
  solveTS,
  type SteamState,
} from '../../src/index.js';

interface OfficialPtCase {
  source: string;
  name: string;
  pressure: number;
  temperature: number;
  region: Region;
}

const OFFICIAL_PT_CASES: readonly OfficialPtCase[] = [
  { source: 'IF97 Table 5', name: 'R1: T=300 K, p=3 MPa', pressure: 3, temperature: 300, region: Region.Region1 },
  { source: 'IF97 Table 5', name: 'R1: T=300 K, p=80 MPa', pressure: 80, temperature: 300, region: Region.Region1 },
  { source: 'IF97 Table 5', name: 'R1: T=500 K, p=3 MPa', pressure: 3, temperature: 500, region: Region.Region1 },
  { source: 'IF97 Table 15', name: 'R2: T=300 K, p=0.0035 MPa', pressure: 0.0035, temperature: 300, region: Region.Region2 },
  { source: 'IF97 Table 15', name: 'R2: T=700 K, p=0.0035 MPa', pressure: 0.0035, temperature: 700, region: Region.Region2 },
  { source: 'IF97 Table 15', name: 'R2: T=700 K, p=30 MPa', pressure: 30, temperature: 700, region: Region.Region2 },
  {
    source: 'IF97 Table 33 (T,rho point expressed as PT)',
    name: 'R3: T=650 K, p=25.5837018 MPa',
    pressure: 25.5837018,
    temperature: 650,
    region: Region.Region3,
  },
  {
    source: 'IF97 Table 33 (T,rho point expressed as PT)',
    name: 'R3: T=650 K, p=22.2930643 MPa',
    pressure: 22.2930643,
    temperature: 650,
    region: Region.Region3,
  },
  {
    source: 'IF97 Table 33 (T,rho point expressed as PT)',
    name: 'R3: T=750 K, p=78.3095639 MPa',
    pressure: 78.3095639,
    temperature: 750,
    region: Region.Region3,
  },
  { source: 'IF97 Table 42', name: 'R5: T=1500 K, p=0.5 MPa', pressure: 0.5, temperature: 1500, region: Region.Region5 },
  { source: 'IF97 Table 42', name: 'R5: T=1500 K, p=30 MPa', pressure: 30, temperature: 1500, region: Region.Region5 },
  { source: 'IF97 Table 42', name: 'R5: T=2000 K, p=30 MPa', pressure: 30, temperature: 2000, region: Region.Region5 },
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

function expectBackwardPropertyClose(
  label: string,
  actual: number,
  expected: number,
  tolerance = 1e-6,
): void {
  const error = relativeError(actual, expected);
  if (error >= tolerance) {
    throw new Error(
      `${label} mismatch: actual=${actual}, expected=${expected}, relErr=${error}, tol=${tolerance}`,
    );
  }
}

function expectBackwardStateMatchesPt(actual: SteamState, expected: SteamState): void {
  if (actual.region !== expected.region) {
    throw new Error(`region mismatch: actual=${actual.region}, expected=${expected.region}`);
  }
  expectBackwardPropertyClose('pressure', actual.pressure, expected.pressure);
  expectBackwardPropertyClose('temperature', actual.temperature, expected.temperature);
  expectBackwardPropertyClose('enthalpy', actual.enthalpy, expected.enthalpy);
  expectBackwardPropertyClose('entropy', actual.entropy, expected.entropy);
  expectBackwardPropertyClose('specificVolume', actual.specificVolume, expected.specificVolume);
}

function officialPtCaseId(testCase: OfficialPtCase): string {
  return `${testCase.source}: ${testCase.name}`;
}

const OFFICIAL_CASES_BY_SOURCE = new Map<string, OfficialPtCase[]>();
for (const testCase of OFFICIAL_PT_CASES) {
  const cases = OFFICIAL_CASES_BY_SOURCE.get(testCase.source) ?? [];
  cases.push(testCase);
  OFFICIAL_CASES_BY_SOURCE.set(testCase.source, cases);
}

describe('IAPWS PT-led backward cross-verification', () => {
  for (const [source, cases] of OFFICIAL_CASES_BY_SOURCE) {
    describe(source, () => {
      cases.forEach((testCase) => {
        describe(testCase.name, () => {
          it('solvePT lands in the expected region', () => {
            const forward = solvePT(testCase.pressure, testCase.temperature);
            expect(forward.region).toBe(testCase.region);
          });

          BACKWARD_SOLVERS.forEach((backwardSolver) => {
            it(`${backwardSolver.name} reproduces the PT state`, () => {
              const forward = solvePT(testCase.pressure, testCase.temperature);
              const backward = backwardSolver.solve(forward);

              try {
                expectBackwardStateMatchesPt(backward, forward);
              } catch (error) {
                const detail = error instanceof Error ? error.message : String(error);
                throw new Error(`${officialPtCaseId(testCase)} via ${backwardSolver.name}: ${detail}`);
              }
            });
          });
        });
      });
    });
  }
});
