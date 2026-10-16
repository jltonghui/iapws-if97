import { describe, expect, it, vi } from 'vitest';
import { solvePT } from '../../src/index.js';
import { Tc } from '../../src/constants.js';
import { tryRegion4HSState } from '../../src/saturation/region4-hs.js';
import { solveTx } from '../../src/saturation/two-phase.js';
import * as common from '../../src/saturation/common.js';
import * as newton2D from '../../src/solvers/damped-newton-2d.js';
import * as bracketed from '../../src/solvers/bracketed-newton.js';
import { IF97Error } from '../../src/types.js';
import { expectRegion4RoundTrip } from '../helpers/backward-assertions.js';

describe('Region 4 HS solver paths', () => {
  it.each([0.1, 0.5])('recovers a 400 K mixture at x=%s without 2D seeds', (x) => {
    const forward = solveTx(400, x);
    const solver = vi.spyOn(newton2D, 'dampedNewton2D');
    try {
      const recovered = tryRegion4HSState(forward.enthalpy, forward.entropy);
      expect(recovered).not.toBeNull();
      expectRegion4RoundTrip(recovered!, forward);
      expect(solver).not.toHaveBeenCalled();
    } finally {
      solver.mockRestore();
    }
  });

  it('rejects a nearby compressed liquid without 2D seeds', () => {
    const forward = solvePT(0.1, 372.5);
    const solver = vi.spyOn(newton2D, 'dampedNewton2D');
    try {
      expect(tryRegion4HSState(forward.enthalpy, forward.entropy)).toBeNull();
      expect(solver).not.toHaveBeenCalled();
    } finally {
      solver.mockRestore();
    }
  });

  it('recovers the liquid endpoint above 623.15 K without visiting the critical neighborhood', () => {
    const forward = solveTx(623.150001, 0);
    const solver = vi.spyOn(newton2D, 'dampedNewton2D');
    const endpoints = vi.spyOn(common, 'saturationEndpointsAtTemperature');
    try {
      const recovered = tryRegion4HSState(forward.enthalpy, forward.entropy);
      expect(recovered).not.toBeNull();
      expectRegion4RoundTrip(recovered!, forward);
      expect(recovered!.quality).toBe(0);
      expect(solver).not.toHaveBeenCalled();
      expect(endpoints.mock.calls.some(([T]) => T >= Tc - 1e-4)).toBe(false);
    } finally {
      endpoints.mockRestore();
      solver.mockRestore();
    }
  });

  it('retains 2D recovery after a bracket solver failure', () => {
    const forward = solveTx(400, 0.5);
    const solver = vi.spyOn(newton2D, 'dampedNewton2D');
    const bracket = vi.spyOn(bracketed, 'bracketedNewton').mockImplementationOnce(() => {
      throw new IF97Error('injected bracket failure');
    });
    try {
      const recovered = tryRegion4HSState(forward.enthalpy, forward.entropy);
      expect(recovered).not.toBeNull();
      expectRegion4RoundTrip(recovered!, forward);
      expect(solver).toHaveBeenCalled();
    } finally {
      bracket.mockRestore();
      solver.mockRestore();
    }
  });

  it('does not cache a failed critical search and preserves warm-call output', async () => {
    const forward = solveTx(Tc - 4.9e-5, 0.5);
    vi.resetModules();
    const currentCommon = await import('../../src/saturation/common.js');
    const { SaturationEndpointError } = await import('../../src/errors.js');
    const candidate = await import('../../src/saturation/region4-hs.js');
    const original = currentCommon.saturationEndpointsAtTemperature;
    const endpoints = vi.spyOn(currentCommon, 'saturationEndpointsAtTemperature').mockImplementation((T) => {
      if (T > 646.9) throw new SaturationEndpointError('injected upper failure');
      return original(T);
    });
    try {
      expect(candidate.tryRegion4HSState(forward.enthalpy, forward.entropy)).toBeNull();
    } finally {
      endpoints.mockRestore();
    }
    const recoveredEndpoints = vi.spyOn(currentCommon, 'saturationEndpointsAtTemperature');
    const currentNewton2D = await import('../../src/solvers/damped-newton-2d.js');
    const solver = vi.spyOn(currentNewton2D, 'dampedNewton2D');
    try {
      const first = candidate.tryRegion4HSState(forward.enthalpy, forward.entropy);
      expect(first).not.toBeNull();
      expectRegion4RoundTrip(first!, forward, {
        pressureTolerance: 1e-6,
        temperatureTolerance: 1e-6,
        qualityTolerance: 1e-4,
      });
      expect(recoveredEndpoints.mock.calls.some(([T]) => T > Tc - 1e-4)).toBe(true);
      const second = candidate.tryRegion4HSState(forward.enthalpy, forward.entropy);
      expect(second).toEqual(first);
      expect(solver).not.toHaveBeenCalled();
    } finally {
      solver.mockRestore();
      recoveredEndpoints.mockRestore();
    }
  });
});
