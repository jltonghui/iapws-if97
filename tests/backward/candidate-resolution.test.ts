import { describe, expect, it } from 'vitest';
import { ConvergenceError, IF97Error, Region, solvePT, solvePx } from '../../src/index.js';
import { findPressureSeam } from '../../src/core/formulation-seams.js';
import { resolveBackwardCandidates } from '../../src/backward/candidate-resolution.js';
import { backwardCandidateError } from '../../src/backward/solution-validation.js';

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
