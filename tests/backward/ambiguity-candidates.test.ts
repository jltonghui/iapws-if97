import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AmbiguousStateError,
  IF97Error,
  Region,
  solve,
  solveBasic,
  solvePT,
  solveTH,
  solveTS,
  solveTx,
  type BasicProperties,
} from '../../src/index.js';
import { detectRegionTH, detectRegionTS } from '../../src/detect.js';
import * as pressureSolver from '../../src/backward/fixed-temperature-solver.js';
import * as validation from '../../src/backward/solution-validation.js';
import * as stationary from '../../src/backward/fixed-temperature-stationary.js';

function ambiguity(run: () => unknown): AmbiguousStateError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AmbiguousStateError);
    if (error instanceof AmbiguousStateError) return error;
    throw error;
  }
  throw new Error('Expected an ambiguous state');
}

function expectCandidates(
  candidates: readonly BasicProperties[],
  T: number,
  target: number,
  property: 'enthalpy' | 'entropy',
): void {
  const pressures = candidates.map((candidate) => candidate.pressure);
  expect(pressures).toEqual([...pressures].sort((a, b) => a - b));
  for (const candidate of candidates) {
    expect(candidate.temperature).toBe(T);
    expect(Math.abs(candidate[property] - target)).toBeLessThanOrEqual(property === 'enthalpy' ? 1e-9 : 1e-12);
    for (const field of ['density', 'viscosity', 'thermalConductivity', 'surfaceTension', 'dielectricConstant', 'ionizationConstant']) {
      expect(candidate).not.toHaveProperty(field);
    }
    const reconstructed = candidate.region === Region.Region4
      ? solveBasic({ mode: 'Tx', T, x: candidate.quality! })
      : solveBasic({ mode: 'PT', T, p: candidate.pressure });
    expect(reconstructed.region).toBe(candidate.region);
    expect(candidate[property]).toBe(reconstructed[property]);
    expect(Math.abs(reconstructed[property] - target)).toBeLessThanOrEqual(property === 'enthalpy' ? 1e-7 : 1e-10);
    expect(candidate.specificVolume).toBeCloseTo(reconstructed.specificVolume, 12);
    if (candidate.saturation !== undefined) {
      expect(candidate.saturation.temperature).toBe(T);
      expect(candidate.saturation.pressure).toBe(candidate.pressure);
      expect(candidate.saturation.liquid).not.toHaveProperty('density');
      expect(candidate.saturation.vapor).not.toHaveProperty('viscosity');
    }
  }
}

afterEach(() => vi.restoreAllMocks());

describe('TH/TS ambiguity candidates', () => {
  it('lists liquid and wet candidates through every public TH entry point', () => {
    const wet = solveTx(473.15, 0.001);
    const T = wet.temperature;
    const h = wet.enthalpy;
    for (const run of [
      () => solveTH(T, h),
      () => solve({ mode: 'TH', T, h }),
      () => solve({ mode: 'TH', temperature: T, enthalpy: h }),
      () => solveBasic({ mode: 'TH', T, h }),
      () => detectRegionTH(T, h),
    ]) {
      const { candidates } = ambiguity(run);
      expect(candidates).toHaveLength(2);
      expect(candidates.map(({ region }) => region)).toEqual([Region.Region4, Region.Region1]);
      expect(candidates[0].pressure).toBe(wet.pressure);
      expect(candidates[0].quality).toBeCloseTo(wet.quality!, 12);
      expect(candidates[1].pressure).toBeCloseTo(6.276280047308887, 7);
      expect(candidates[1].quality).toBeNull();
      expectCandidates(candidates, T, h, 'enthalpy');
    }
  });

  it('keeps both Region 1 TH roots', () => {
    const first = solvePT(5, 523.15);
    const { candidates } = ambiguity(() => solveTH(first.temperature, first.enthalpy));
    expect(candidates).toHaveLength(2);
    expect(candidates.map(({ region }) => region)).toEqual([Region.Region1, Region.Region1]);
    expect(candidates[0].pressure).toBeCloseTo(5, 7);
    expect(candidates[1].pressure).toBeCloseTo(8.036947068569134, 7);
    expectCandidates(candidates, first.temperature, first.enthalpy, 'enthalpy');
  });

  it('preserves validated candidates without rounding their coordinates', () => {
    const wet = solveTx(473.15, 0.001);
    const validate = validation.validateBackwardState;
    vi.spyOn(validation, 'validateBackwardState').mockImplementationOnce((...args) => {
      const state = validate(...args);
      return { ...state, temperature: state.temperature + Number.EPSILON * state.temperature };
    });
    const { candidates } = ambiguity(() => solveTH(wet.temperature, wet.enthalpy));
    expect(candidates[0].temperature).toBe(wet.temperature + Number.EPSILON * wet.temperature);
    expect(candidates[0].saturation!.temperature).toBe(wet.temperature);
  });

  it('lists all three TS candidates through every public TS entry point', () => {
    const first = solvePT(1, 274.15);
    const T = first.temperature;
    const s = first.entropy;
    for (const run of [
      () => solveTS(T, s),
      () => solve({ mode: 'TS', T, s }),
      () => solve({ mode: 'TS', temperature: T, entropy: s }),
      () => solveBasic({ mode: 'TS', T, s }),
      () => detectRegionTS(T, s),
    ]) {
      const { candidates } = ambiguity(run);
      expect(candidates).toHaveLength(3);
      expect(candidates.map(({ region }) => region)).toEqual([Region.Region4, Region.Region1, Region.Region1]);
      expect(candidates[0].quality).toBeCloseTo(0.000005293319033232329, 12);
      expect(candidates[1].pressure).toBeCloseTo(1, 7);
      expect(candidates[2].pressure).toBeCloseTo(28.139514663979547, 7);
      expectCandidates(candidates, T, s, 'entropy');
    }
  });

  it('keeps two Region 1 TS roots below the triple temperature', () => {
    const first = solvePT(1, 273.155);
    const { candidates } = ambiguity(() => solveTS(first.temperature, first.entropy));
    expect(candidates).toHaveLength(2);
    expect(candidates.map(({ region }) => region)).toEqual([Region.Region1, Region.Region1]);
    expect(candidates[0].pressure).toBeCloseTo(1, 7);
    expect(candidates[1].pressure).toBeCloseTo(37.669245638433054, 7);
    expectCandidates(candidates, first.temperature, first.entropy, 'entropy');
  });

  it.each([
    { T: 523.15, property: 'enthalpy' as const, solve: solveTH, p: 9.103729939512032 },
    { T: 274.15, property: 'entropy' as const, solve: solveTS, p: 29.210718380353228 },
  ])('lists the shared saturation endpoint only once for $property', ({ T, property, solve: run, p }) => {
    const endpoint = solveTx(T, 0);
    const { candidates } = ambiguity(() => run(T, endpoint[property]));
    expect(candidates).toHaveLength(2);
    expect(candidates[0].region).toBe(Region.Region4);
    expect(candidates[0].quality).toBe(0);
    expect(candidates[0].cp).toBe(endpoint.cp);
    expect(candidates[1].region).toBe(Region.Region1);
    expect(candidates[1].pressure).toBeCloseTo(p, 6);
    expectCandidates(candidates, T, endpoint[property], property);
  });

  it('preserves the existing public error constructor calls', () => {
    const th = new AmbiguousStateError(300, 100);
    const ts = new AmbiguousStateError(300, 1, 'entropy');
    expect(th.candidates).toEqual([]);
    expect(ts.candidates).toEqual([]);
    expect(th).toBeInstanceOf(IF97Error);
    expect(th.message).toMatch(/T-h/);
    expect(ts.message).toMatch(/T-s/);
  });

  it('propagates a later search failure instead of exposing an incomplete candidate list', () => {
    const first = solvePT(1, 274.15);
    const failure = new IF97Error('later branch failed');
    const create = stationary.createFixedTemperatureStationaryPressureFinder;
    vi.spyOn(stationary, 'createFixedTemperatureStationaryPressureFinder').mockImplementation((...args) => {
      const find = create(...args);
      let branches = 0;
      return (...interval) => {
        if (++branches === 2) throw failure;
        return find(...interval);
      };
    });
    expect(() => solveTS(first.temperature, first.entropy)).toThrow(failure);
  });

  it.each([
    { name: 'property residual', invalid: { enthalpy: -1 } },
    { name: 'volume envelope', invalid: { specificVolume: -1 } },
    { name: 'region consistency', invalid: { region: Region.Region2 } },
  ])('rejects an invalid $name before publishing candidates', ({ invalid }) => {
    const wet = solveTx(473.15, 0.001);
    const solvePressure = pressureSolver.solveFixedTemperaturePressure;
    vi.spyOn(pressureSolver, 'solveFixedTemperaturePressure').mockImplementation((...args) => ({
      ...solvePressure(...args),
      ...invalid,
    }));
    expect(() => solveTH(wet.temperature, wet.enthalpy)).toThrow(IF97Error);
    expect(() => solveTH(wet.temperature, wet.enthalpy)).not.toThrow(AmbiguousStateError);
  });
});
