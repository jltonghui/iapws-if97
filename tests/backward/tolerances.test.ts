import { describe, expect, it } from 'vitest';
import { solvePT } from '../../src/core/solver.js';
import { solvePH, solvePS, solveTx } from '../../src/index.js';
import { P_MIN, Pt, Tt } from '../../src/constants.js';
import { validateBackwardState } from '../../src/backward/solution-validation.js';
import { backwardConstraintTolerance, region4SaturationPressureTolerance } from '../../src/backward/tolerances.js';
import { saturationPressure, saturationTemperature } from '../../src/regions/region4.js';
import { IF97Error, Region } from '../../src/types.js';

describe('backward enthalpy tolerance', () => {
  it('retains native properties instead of copying constraints within tolerance', () => {
    const state = solvePT(3, 300);
    const constraints = [
      { label: 'pressure', expected: state.pressure + 1e-10 },
      { label: 'temperature', expected: state.temperature + 1e-9 },
      { label: 'enthalpy', expected: state.enthalpy + 1e-5 },
      { label: 'entropy', expected: state.entropy + 1e-7 },
    ] as const;
    const validated = validateBackwardState(state, constraints, { solverName: 'native-state-regression' });

    expect(validated).toBe(state);
    for (const constraint of constraints) {
      expect(validated[constraint.label]).not.toBe(constraint.expected);
    }
  });

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

describe('backward pressure tolerance', () => {
  it.each([P_MIN, 0.0006121016088625308, 0.5, 1, 20])('scales pressure constraints and saturation consistency with p=%s MPa', (p) => {
    expect(backwardConstraintTolerance('pressure', p)).toBe(1e-9 * p);
    expect(region4SaturationPressureTolerance(p)).toBe(1e-8 * p);
  });

  it('rejects a low-pressure constraint mismatch hidden by a fixed MPa allowance', () => {
    const state = solvePT(0.0006121016088625308, 500);
    const drifted = { ...state, pressure: state.pressure + 5e-10 };
    expect(() => validateBackwardState(drifted, [
      { label: 'pressure', expected: state.pressure },
    ], { solverName: 'pressure-tolerance-regression' })).toThrow(/failed to match pressure/);
  });

  it('rejects a low-pressure Region 4 state off the saturation curve', () => {
    const state = solveTx(273.17, 0.5);
    const drifted = { ...state, pressure: state.pressure + 5e-9 };
    expect(() => validateBackwardState(drifted, [], {
      solverName: 'saturation-pressure-tolerance-regression',
    })).toThrow(/off the saturation curve/);
  });

  it('retains tiny pressure roundoff on the saturation curve', () => {
    const state = solveTx(273.17, 0.5);
    const drifted = { ...state, pressure: state.pressure + 1e-14 };
    expect(() => validateBackwardState(drifted, [], {
      solverName: 'saturation-pressure-roundoff',
    })).not.toThrow();
  });

  it('rejects computed pressure meaningfully below P_MIN', () => {
    const state = solvePT(P_MIN, 500);
    const drifted = { ...state, pressure: P_MIN - 5e-10 };
    expect(() => validateBackwardState(drifted, [], {
      solverName: 'pressure-lower-envelope-regression',
    })).toThrow(/outside the IF97 PT envelope/);
  });

  it('preserves pressure roundoff just below P_MIN', () => {
    const state = solvePT(P_MIN, 500);
    const drifted = { ...state, pressure: P_MIN * (1 - Number.EPSILON) };
    expect(validateBackwardState(drifted, [], {
      solverName: 'pressure-lower-envelope-roundoff',
    }).pressure).toBe(P_MIN);
  });

  it.each(['PH', 'PS'] as const)('keeps the low-pressure %s state on its actual saturation curve', (mode) => {
    const state = solveTx(Tt, 0.5);
    const p = Pt + 5e-10;
    const recovered = mode === 'PH' ? solvePH(p, state.enthalpy) : solvePS(p, state.entropy);
    expect(recovered.region).toBe(Region.Region4);
    expect(recovered.pressure).toBe(p);
    expect(Math.abs(recovered.temperature - saturationTemperature(p))).toBeLessThan(1e-9);
    expect(Math.abs(saturationPressure(recovered.temperature) - p)).toBeLessThanOrEqual(1e-8 * p);
  });
});
