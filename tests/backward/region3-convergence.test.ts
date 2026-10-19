import { afterEach, describe, expect, it, vi } from 'vitest';
import { Region, solvePH, solvePS, solvePT } from '../../src/index.js';
import { region3ByRhoT } from '../../src/regions/region3.js';
import * as newton from '../../src/solvers/damped-newton-2d.js';

afterEach(() => vi.restoreAllMocks());

describe('Region 3 backward convergence', () => {
  it.each([
    { mode: 'PH', property: 'enthalpy', backward: solvePH },
    { mode: 'PS', property: 'entropy', backward: solvePS },
  ] as const)('rejects a stable $mode iterate with excessive pressure residual', ({ property, backward }) => {
    const state = region3ByRhoT(500, 650);
    const pressure = state.pressure * (1 + 5e-6);
    const refinement = vi.spyOn(newton, 'dampedNewton2D').mockReturnValue([500, 650]);

    expect(() => backward(pressure, state[property])).toThrowError(/failed to match pressure/);
    expect(refinement).toHaveBeenCalledOnce();
  });

  it('refines PH enthalpy beyond the default scaled Newton tolerance', () => {
    const forward = solvePT(71.20285, 804.0152245083152);
    const recovered = solvePH(forward.pressure, forward.enthalpy);

    expect(recovered.region).toBe(Region.Region3);
    expect(Math.abs(recovered.enthalpy - forward.enthalpy)).toBeLessThan(1e-9);
    expect(Math.abs(recovered.pressure - forward.pressure) / forward.pressure).toBeLessThan(1e-9);
  });
});
