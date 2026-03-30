import { describe, expect, it } from 'vitest';
import { solvePT } from '../../src/core/solver.js';
import { validateBackwardState } from '../../src/backward/solution-validation.js';
import { backwardConstraintTolerance } from '../../src/backward/tolerances.js';
import { IF97Error } from '../../src/types.js';

describe('backward enthalpy tolerance', () => {
  it('uses a spec-scale default tolerance for enthalpy constraints', () => {
    expect(backwardConstraintTolerance('enthalpy', 3000)).toBeCloseTo(0.003, 12);
  });

  it('rejects enthalpy mismatches above the tightened default tolerance', () => {
    const state = solvePT(0.0035, 700);
    const drifted = { ...state, enthalpy: state.enthalpy + 0.01 };

    expect(() =>
      validateBackwardState(
        drifted,
        [
          { label: 'pressure', expected: state.pressure },
          { label: 'enthalpy', expected: state.enthalpy },
        ],
        { solverName: 'tolerance-regression' },
      ),
    ).toThrow(IF97Error);
  });
});
