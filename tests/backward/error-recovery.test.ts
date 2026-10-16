import { afterEach, describe, expect, it, vi } from 'vitest';
import { IF97Error, Region, solveHS, solvePH, solvePS, solvePT, solvePx } from '../../src/index.js';
import { RegionMismatchError, SaturationEndpointError } from '../../src/errors.js';
import * as pressurePropertyRegion from '../../src/backward/pressure-property-region.js';
import * as hsRegion from '../../src/backward/hs-region.js';
import * as validation from '../../src/backward/solution-validation.js';

afterEach(() => vi.restoreAllMocks());

describe('typed backward recovery errors', () => {
  it('preserves the public error contract for unavailable saturation endpoints', () => {
    expect(() => solvePx(22.0639999, 0)).toThrow(SaturationEndpointError);
    const error = new SaturationEndpointError('endpoint failure');
    expect(error).toBeInstanceOf(IF97Error);
    expect(error.name).toBe('IF97Error');
    expect(error.message).toBe('endpoint failure');
  });

  it('reports PT region mismatch as structured data', () => {
    expect(() => validation.validateBackwardState({ ...solvePT(25, 650), region: Region.Region2 }, [], {
      solverName: 'solveHS', expectedRegion: Region.Region2,
    })).toThrow(RegionMismatchError);
    const error = new RegionMismatchError('solveHS', Region.Region3, Region.Region2);
    expect(error).toMatchObject({
      actualRegion: Region.Region3,
      expectedRegion: Region.Region2,
      name: 'IF97Error',
      message: 'solveHS produced a PT state in Region 3, not Region 2',
    });
  });

  it.each(['PH', 'PS'] as const)('recovers %s after changing the endpoint error message', (mode) => {
    const forward = solvePT(25, 650);
    const failure = new SaturationEndpointError('Region 4 numerical inconsistency at injected endpoint');
    failure.message = 'the diagnostic text changed';
    vi.spyOn(pressurePropertyRegion, mode === 'PH' ? 'detectRegionPH' : 'detectRegionPS').mockImplementation(() => {
      throw failure;
    });
    const recovered = mode === 'PH'
      ? solvePH(forward.pressure, forward.enthalpy)
      : solvePS(forward.pressure, forward.entropy);
    expect(recovered.region).toBe(Region.Region3);
    expect(recovered.temperature).toBeCloseTo(forward.temperature, 7);
  });

  it.each(['PH', 'PS'] as const)('propagates a plain IF97Error with the former %s recovery text', (mode) => {
    const forward = solvePT(25, 650);
    const failure = new IF97Error('Region 4 numerical inconsistency at injected endpoint');
    vi.spyOn(pressurePropertyRegion, mode === 'PH' ? 'detectRegionPH' : 'detectRegionPS').mockImplementation(() => {
      throw failure;
    });
    expect(() => mode === 'PH'
      ? solvePH(forward.pressure, forward.enthalpy)
      : solvePS(forward.pressure, forward.entropy)).toThrow(failure);
  });

  it('recovers an adjacent HS region after changing the mismatch message', () => {
    const forward = solvePT(25.07225811600566, 677.15);
    const failure = new RegionMismatchError('solveHS', Region.Region2, Region.Region3);
    failure.message = 'the diagnostic text changed';
    vi.spyOn(hsRegion, 'classifyRegionHS').mockReturnValue(Region.Region3);
    const validate = vi.spyOn(validation, 'validateBackwardState').mockImplementationOnce(() => {
      throw failure;
    });
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expect(recovered.region).toBe(Region.Region2);
    expect(recovered.temperature).toBeCloseTo(forward.temperature, 7);
    expect(validate).toHaveBeenCalledTimes(2);
  });

  it.each([
    new IF97Error('solveHS produced a PT state in Region 2, not Region 3'),
    new RegionMismatchError('solveHS', -1, Region.Region3),
    new RegionMismatchError('solveHS', Region.Region4, Region.Region3),
    new RegionMismatchError('solveHS', Region.Region5, Region.Region3),
    new RegionMismatchError('solveHS', Region.Region2, Region.Region1),
    new RegionMismatchError('solvePH', Region.Region2, Region.Region3),
    new Error('unrelated failure'),
  ])('propagates an ineligible HS recovery error: $message', (failure) => {
    const forward = solvePT(25.07225811600566, 677.15);
    vi.spyOn(hsRegion, 'classifyRegionHS').mockReturnValue(Region.Region3);
    const validate = vi.spyOn(validation, 'validateBackwardState').mockImplementationOnce(() => {
      throw failure;
    });
    expect(() => solveHS(forward.enthalpy, forward.entropy)).toThrow(failure);
    expect(validate).toHaveBeenCalledTimes(1);
  });
});
