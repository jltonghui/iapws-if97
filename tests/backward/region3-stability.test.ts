import { describe, expect, it } from 'vitest';
import { Region, solveBasic } from '../../src/index.js';
import { validateBackwardState } from '../../src/backward/solution-validation.js';

const stabilityProperties = ['cp', 'cv', 'isothermalCompressibility', 'speedOfSound'] as const;

describe('backward Region 3 stability validation', () => {
  const stable = solveBasic({ mode: 'PT', p: 25, T: 650 });
  const options = { solverName: 'stability-regression', expectedRegion: Region.Region3 };

  it.each(stabilityProperties)('rejects invalid %s', (property) => {
    for (const value of [-1, 0, NaN, Infinity, null]) {
      expect(() => validateBackwardState({ ...stable, [property]: value }, [], options))
        .toThrow(/stability-regression.*Region 3 numerical inconsistency/);
    }
  });

  it('accepts a stable Region 3 state', () => {
    expect(validateBackwardState(stable, [], options)).toEqual(stable);
  });

  it('retains null derivative properties for a Region 4 mixture', () => {
    const mixture = solveBasic({ mode: 'Px', p: 20, x: 0.5 });
    for (const property of stabilityProperties) expect(mixture[property]).toBeNull();
    expect(validateBackwardState(mixture, [], {
      solverName: 'mixture-regression', expectedRegion: Region.Region4,
    })).toEqual(mixture);
  });
});
