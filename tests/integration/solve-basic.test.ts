import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../src/index.js';
import type { BasicProperties, SolveInput } from '../../src/index.js';
import * as transport from '../../src/transport/properties.js';
import { region1, region2 } from '../../src/regions.js';
import { P_MIN, Pc, Tc } from '../../src/constants.js';
import { solvePH } from '../../src/backward/ph.js';
import { solvePS } from '../../src/backward/ps.js';

vi.mock('../../src/transport/properties.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/transport/properties.js')>();
  return {
    viscosity: vi.fn(actual.viscosity),
    thermalConductivity: vi.fn(actual.thermalConductivity),
    surfaceTension: vi.fn(actual.surfaceTension),
    dielectricConstant: vi.fn(actual.dielectricConstant),
    ionizationConstant: vi.fn(actual.ionizationConstant),
  };
});

const liquid = region1(3, 300);
const vapor = region2(3, 700);
const transportNames = ['viscosity', 'thermalConductivity', 'surfaceTension', 'dielectricConstant', 'ionizationConstant'] as const;

function expectNoTransportCalls(): void {
  for (const name of transportNames) {
    expect(transport[name]).not.toHaveBeenCalled();
  }
}

afterEach(() => vi.clearAllMocks());

describe('solveBasic', () => {
  const cases: { input: SolveInput; direct: () => api.SteamState }[] = [
    { input: { mode: 'PT', p: 3, T: 300 }, direct: () => api.solvePT(3, 300) },
    { input: { mode: 'PT', p: 3, T: 700 }, direct: () => api.solvePT(3, 700) },
    { input: { mode: 'PT', p: 25, T: 650 }, direct: () => api.solvePT(25, 650) },
    { input: { mode: 'PT', p: 0.5, T: 1500 }, direct: () => api.solvePT(0.5, 1500) },
    { input: { mode: 'PH', p: 3, h: liquid.enthalpy }, direct: () => api.solvePH(3, liquid.enthalpy) },
    { input: { mode: 'PS', p: 3, s: liquid.entropy }, direct: () => api.solvePS(3, liquid.entropy) },
    { input: { mode: 'PH', p: Pc, h: 2000 }, direct: () => api.solvePH(Pc, 2000) },
    { input: { mode: 'PH', p: Pc, h: 2200 }, direct: () => api.solvePH(Pc, 2200) },
    { input: { mode: 'PS', p: Pc, s: 4.3 }, direct: () => api.solvePS(Pc, 4.3) },
    { input: { mode: 'PS', p: Pc, s: 4.5 }, direct: () => api.solvePS(Pc, 4.5) },
    { input: { mode: 'HS', h: liquid.enthalpy, s: liquid.entropy }, direct: () => api.solveHS(liquid.enthalpy, liquid.entropy) },
    { input: { mode: 'TH', T: 700, h: vapor.enthalpy }, direct: () => api.solveTH(700, vapor.enthalpy) },
    { input: { mode: 'TS', T: 700, s: vapor.entropy }, direct: () => api.solveTS(700, vapor.entropy) },
    { input: { mode: 'Px', p: 1, x: 0.5 }, direct: () => api.solvePx(1, 0.5) },
    { input: { mode: 'Px', p: 20, x: 0.5 }, direct: () => api.solvePx(20, 0.5) },
    { input: { mode: 'Px', p: 20, x: 0 }, direct: () => api.solvePx(20, 0) },
    { input: { mode: 'Px', p: 20, x: 1 }, direct: () => api.solvePx(20, 1) },
    { input: { mode: 'Tx', T: 640, x: 0.5 }, direct: () => api.solveTx(640, 0.5) },
  ];

  it.each(cases)('matches full $input without evaluating transport', ({ input, direct }) => {
    const basic: BasicProperties = api.solveBasic(input);

    expectNoTransportCalls();
    expect(basic).not.toHaveProperty('density');
    for (const name of transportNames) {
      expect(basic).not.toHaveProperty(name);
    }
    const full = api.solve(input);
    expect(full).toMatchObject(basic);
    expect(direct()).toEqual(full);
  });

  it('accepts long-form aliases and preserves native properties', () => {
    const basic = api.solveBasic({ mode: 'PH', pressure: 3, enthalpy: liquid.enthalpy });

    expect(basic.enthalpy).toBe(region1(basic.pressure, basic.temperature).enthalpy);
    expect(basic).toEqual(api.solveBasic({ mode: 'PH', p: 3, h: liquid.enthalpy }));
    expectNoTransportCalls();
  });

  it('accepts the full IF97 lower pressure bound', () => {
    expect(api.solveBasic({ mode: 'PT', pressure: P_MIN, temperature: 273.15 }).region).toBe(api.Region.Region1);
    expectNoTransportCalls();
  });

  it.each([
    { mode: 'PT', p: NaN, T: 300 },
    { mode: 'PT', p: 3, T: Infinity },
    { mode: 'PT', p: 200, T: 300 },
    { mode: 'PT', p: 1, T: 3000 },
    { mode: 'PT', p: 80, T: 1500 },
    { mode: 'PT', p: Pc, T: Tc },
    { mode: 'Px', p: Pc, x: 0.5 },
    { mode: 'Tx', T: Tc, x: 0.5 },
    { mode: 'Px', p: 1, x: -0.1 },
    { mode: 'TH', T: Tc, h: 2000 },
    { mode: 'TS', T: Tc, s: 4 },
    { mode: 'PH', p: 3, h: Infinity },
    { mode: 'PS', p: NaN, s: liquid.entropy },
    { mode: 'HS', h: liquid.enthalpy, s: NaN },
  ] satisfies SolveInput[])('preserves full solver validation for %j', (input) => {
    expect(() => api.solveBasic(input)).toThrow(api.IF97Error);
    expect(() => api.solve(input)).toThrow(api.IF97Error);
    expectNoTransportCalls();
  });

  it.each([
    { mode: 'PH', p: Pc, h: 2087.5468 },
    { mode: 'PS', p: Pc, s: 4.41202 },
  ] as const)('rejects an unstable Region 3 $mode state before evaluating transport', (input) => {
    const direct = input.mode === 'PH'
      ? [() => solvePH(input.p, input.h), () => api.solvePH(input.p, input.h)]
      : [() => solvePS(input.p, input.s), () => api.solvePS(input.p, input.s)];
    for (const run of [...direct, () => api.solveBasic(input), () => api.solve(input)]) {
      expect(run).toThrowError(expect.objectContaining({
        name: 'IF97Error',
        message: expect.stringMatching(new RegExp(`solve${input.mode}.*Region 3 numerical inconsistency`)),
      }));
    }
    expectNoTransportCalls();
  });

  it.each([
    null,
    'PT',
    { mode: 'unknown' },
    { mode: 'PT', p: 3 },
    { mode: 'PT', p: 3, pressure: 4, T: 300 },
  ])('rejects malformed runtime input %j', (input) => {
    expect(() => api.solveBasic(input as SolveInput)).toThrow(api.IF97Error);
    expectNoTransportCalls();
  });

  it.each([
    { mode: 'TH', T: 523.15, h: region1(5, 523.15).enthalpy },
    { mode: 'TS', T: 274.15, s: region1(1, 274.15).entropy },
  ] satisfies SolveInput[])('preserves $mode ambiguity rejection', (input) => {
    expect(() => api.solveBasic(input)).toThrow(api.AmbiguousStateError);
    expectNoTransportCalls();
  });

  it.each([
    { input: { mode: 'PT', p: 3, T: 300 }, counts: [1, 1, 0, 1, 1] },
    { input: { mode: 'Px', p: 20, x: 0.5 }, counts: [0, 0, 1, 0, 0] },
    { input: { mode: 'Px', p: 20, x: 0 }, counts: [1, 1, 1, 1, 1] },
  ] satisfies { input: SolveInput; counts: number[] }[])('keeps full transport evaluation for $input', ({ input, counts }) => {
    api.solve(input);

    expect(transportNames.map((name) => vi.mocked(transport[name]).mock.calls.length)).toEqual(counts);
  });
});
