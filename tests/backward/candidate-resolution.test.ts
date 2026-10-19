import { describe, expect, it, vi } from 'vitest';
import { ConvergenceError, IF97Error, Region, solvePT, solvePx } from '../../src/index.js';
import { findHSSeam, findPressureSeam } from '../../src/core/formulation-seams.js';
import { resolveBackwardCandidates } from '../../src/backward/candidate-resolution.js';
import { backwardCandidateError } from '../../src/backward/solution-validation.js';
import { detectRegionPT, nativeB23TemperatureBracket } from '../../src/core/region-detector.js';
import { region2 } from '../../src/regions/region2.js';
import * as region3PT from '../../src/core/region3-pt.js';

const options = { solverName: 'candidate-regression' };

describe('inverse candidate resolution', () => {
  const state = solvePT(3, 300);
  const constraints = [
    { label: 'pressure', expected: state.pressure },
    { label: 'enthalpy', expected: state.enthalpy },
  ] as const;

  it.each([
    { ...state, enthalpy: Number.NaN },
    { ...state, enthalpy: state.enthalpy + 0.01 },
    { ...state, region: Region.Region2 },
    { ...state, pressure: 101 },
  ])('filters an invalid candidate before selecting a later root', (invalid) => {
    expect(resolveBackwardCandidates([() => invalid, () => state], constraints, options)).toBe(state);
  });

  it('does not normalize a candidate into a different PT owner', () => {
    const invalid = { ...solvePT(30, 650), region: Region.Region2 };
    expect(backwardCandidateError(invalid, [], options)).toBeInstanceOf(IF97Error);
    expect(resolveBackwardCandidates([() => invalid], [], options)).toBeNull();
    expect(invalid.region).toBe(Region.Region2);
  });

  it('normalizes B23 roundoff before choosing a fit-gap fallback', () => {
    const pressure = 35.69243672919936;
    const [temperature] = nativeB23TemperatureBracket(pressure);
    const candidate = region2(pressure, temperature);
    const seam = findHSSeam(2605.5950266108721, 5.0992220574005964)!;
    const constraints = [
      { label: 'enthalpy', expected: candidate.enthalpy },
      { label: 'entropy', expected: candidate.entropy },
    ] as const;

    expect(seam.kind).toBe('gap');
    expect(detectRegionPT(pressure, temperature)).toBe(Region.Region3);
    const result = resolveBackwardCandidates([() => candidate], constraints, { ...options, seam })!;
    expect(result.region).toBe(Region.Region2);
    expect(detectRegionPT(result.pressure, result.temperature)).toBe(Region.Region2);
    expect(Math.abs(result.enthalpy - candidate.enthalpy)).toBeLessThan(1e-8);
    expect(Math.abs(result.entropy - candidate.entropy)).toBeLessThan(1e-11);
    expect(candidate.temperature).toBe(temperature);
  });

  it('rejects normalization outside the original constraints before using the gap budget', () => {
    const pressure = 35.69243672919936;
    const [temperature] = nativeB23TemperatureBracket(pressure);
    const candidate = region2(pressure, temperature - 1e-8);
    const seam = findHSSeam(2605.5950266108721, 5.0992220574005964)!;
    const constraints = [{ label: 'enthalpy', expected: candidate.enthalpy, tolerance: 0 }] as const;

    expect(resolveBackwardCandidates([() => candidate], constraints, options)).toBeNull();
    expect(resolveBackwardCandidates([() => candidate], constraints, { ...options, seam })).toBe(seam.state);
  });

  it.each([
    new ConvergenceError('candidate normalization', 1),
    new IF97Error('candidate normalization failed'),
  ])('does not disguise a normalization execution failure as a gap fallback: %s', (failure) => {
    const seam = findPressureSeam(30, 2611.8, 'enthalpy')!;
    const [, temperature] = nativeB23TemperatureBracket(30);
    const candidate = region3PT.solveRegion3PTBasic(30, temperature);
    const normalize = vi.spyOn(region3PT, 'solveRegion3PTBasic').mockImplementationOnce(() => {
      throw failure;
    });
    try {
      expect(() => resolveBackwardCandidates([() => candidate], [], { ...options, seam })).toThrow(failure);
      expect(normalize).toHaveBeenCalledOnce();
    } finally {
      normalize.mockRestore();
    }
  });

  it('exhausts candidates and gives valid saturation priority', () => {
    const saturated = solvePx(1, 0.5);
    expect(resolveBackwardCandidates([() => state, () => saturated], [], options)).toBe(saturated);
  });

  it('returns an available root even if another numerical solve fails', () => {
    expect(resolveBackwardCandidates([
      () => { throw new ConvergenceError('candidate', 1); },
      () => state,
    ], constraints, options)).toBe(state);
  });

  it('uses the local EOS budget only for a proven gap with no root', () => {
    const seam = findPressureSeam(30, 2611.8, 'enthalpy')!;
    expect(seam.kind).toBe('gap');
    expect(resolveBackwardCandidates([() => null], [
      { label: 'pressure', expected: 30 },
      { label: 'enthalpy', expected: 2611.8 },
    ], { ...options, seam })).toBe(seam.state);
  });

  it('does not disguise a numerical failure as a gap fallback', () => {
    const seam = findPressureSeam(30, 2611.8, 'enthalpy')!;
    const failure = new ConvergenceError('candidate', 1);
    expect(() => resolveBackwardCandidates([
      () => { throw failure; },
    ], [{ label: 'enthalpy', expected: 2611.8 }], { ...options, seam })).toThrow(failure);
  });

  it('does not disguise a non-finite EOS result as an empty gap', () => {
    const seam = findPressureSeam(30, 2611.8, 'enthalpy')!;
    expect(() => resolveBackwardCandidates([
      () => ({ ...seam.state, enthalpy: Number.NaN }),
    ], [{ label: 'enthalpy', expected: 2611.8 }], { ...options, seam })).toThrow('failed to match enthalpy');
  });

  it.each([
    { pressure: Number.NaN },
    { temperature: Number.POSITIVE_INFINITY },
    { specificVolume: Number.NaN },
    { cp: Number.NaN },
  ])('preserves non-finite EOS failure even when the input residual also fails: %o', (invalid) => {
    const seam = findPressureSeam(30, 2611.8, 'enthalpy')!;
    expect(() => resolveBackwardCandidates([
      () => ({ ...seam.state, ...invalid }),
    ], [{ label: 'enthalpy', expected: 2611.8 }], { ...options, seam })).toThrow(IF97Error);
  });

  it('propagates programming failures even when another candidate could match', () => {
    const failure = new Error('unexpected evaluator failure');
    expect(() => resolveBackwardCandidates([
      () => { throw failure; }, () => state,
    ], constraints, options)).toThrow(failure);
  });
});
