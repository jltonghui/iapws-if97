import { describe, expect, it } from 'vitest';
import { solvePT } from '../../src/core/solver.js';
import { solveRegion3PTBasic } from '../../src/core/region3-pt.js';
import { solvePH, solvePS, solveTx } from '../../src/index.js';
import { P_MIN, Pt, Tt } from '../../src/constants.js';
import { validateBackwardState } from '../../src/backward/solution-validation.js';
import { backwardConstraintTolerance, region4SaturationPressureTolerance } from '../../src/backward/tolerances.js';
import { region1 } from '../../src/regions/region1.js';
import { region2 } from '../../src/regions/region2.js';
import { region3ByRhoT } from '../../src/regions/region3.js';
import { saturationPressure, saturationTemperature } from '../../src/regions/region4.js';
import { region5 } from '../../src/regions/region5.js';
import { IF97Error, Region } from '../../src/types.js';

describe('backward enthalpy tolerance', () => {
  it('retains native properties instead of copying constraints within tolerance', () => {
    const state = solvePT(3, 300);
    const constraints = [
      { label: 'pressure', expected: state.pressure + 1e-10 },
      { label: 'temperature', expected: state.temperature + 1e-9 },
      { label: 'enthalpy', expected: state.enthalpy + 1e-8 },
      { label: 'entropy', expected: state.entropy + 1e-10 },
    ] as const;
    const validated = validateBackwardState(state, constraints, { solverName: 'native-state-regression' });

    expect(validated).toBe(state);
    for (const constraint of constraints) {
      expect(validated[constraint.label]).not.toBe(constraint.expected);
    }
  });

  it.each([30, 66, 99, 100].flatMap((p) => (['PH', 'PS'] as const).map((mode) => ({ p, mode }))))(
    'preserves the unique Region 3 $mode root within seam tolerance at p=$p MPa', ({ p, mode }) => {
      const input = region1(p, 623.1500002);
      const property = mode === 'PH' ? 'enthalpy' : 'entropy';
      const recovered = mode === 'PH' ? solvePH(input.pressure, input.enthalpy) : solvePS(input.pressure, input.entropy);
      const region1Seam = region1(p, 623.15)[property];

      expect(input[property]).toBeGreaterThan(region1Seam);
      expect(input[property] - region1Seam).toBeLessThan(1e-9 * Math.abs(region1Seam));
      expect(input[property]).toBeGreaterThan(solveRegion3PTBasic(p, 623.15)[property]);
      expect(recovered.temperature).toBeGreaterThan(623.15);
      for (const state of [recovered, solvePT(p, recovered.temperature)]) {
        expect(state.region).toBe(Region.Region3);
        expect(Math.abs(state[property] - input[property])).toBeLessThan(mode === 'PH' ? 1e-8 : 1e-11);
      }
      const native = region3ByRhoT(1 / recovered.specificVolume, recovered.temperature);
      expect(Math.abs(native[property] - recovered[property])).toBeLessThan(mode === 'PH' ? 1e-9 : 1e-12);
    },
  );

  it('checks the enthalpy constraint again after boundary EOS recomputation', () => {
    const state = region1(99, 623.1500002);

    expect(() => validateBackwardState(state, [
      { label: 'enthalpy', expected: state.enthalpy, tolerance: 1e-8 },
    ], { solverName: 'normalized-enthalpy-regression' })).toThrow(/failed to match enthalpy/);
  });

  it('recomputes Region 2 EOS properties after normalizing its upper temperature', () => {
    const state = region2(3, 1073.1500002);

    expect(validateBackwardState(state, [], { solverName: 'normalized-region2-regression' }))
      .toEqual(region2(3, 1073.15));
  });

  it('recomputes Region 3 EOS properties after normalizing its pressure ceiling', () => {
    const expected = solveRegion3PTBasic(100, 650);
    const state = region3ByRhoT((1 / expected.specificVolume) * (1 + 1e-11), 650);
    expect(state.pressure).toBeGreaterThan(100);

    expect(validateBackwardState(state, [], { solverName: 'normalized-region3-regression' }))
      .toEqual(expected);
  });

  it('recomputes Region 5 EOS properties after normalizing its pressure and temperature ceilings', () => {
    const state = region5(50.00000002, 2273.1500002);

    expect(validateBackwardState(state, [], { solverName: 'normalized-region5-regression' }))
      .toEqual(region5(50, 2273.15));
  });

  it('uses a 1e-9 relative default tolerance for enthalpy constraints', () => {
    expect(backwardConstraintTolerance('enthalpy', 3000)).toBeCloseTo(3e-6, 12);
  });

  it('rejects enthalpy mismatches above the tightened default tolerance', () => {
    const state = solvePT(0.0035, 700);
    const drifted = { ...state, enthalpy: state.enthalpy + 1e-4 };

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

  it('rejects out-of-envelope Region 4 coordinates instead of normalizing only the outer state', () => {
    const state = solveTx(Tt, 0.5);
    const options = { solverName: 'region4-endpoint-consistency-regression' };
    expect(validateBackwardState(state, [], options)).toBe(state);

    const drifted = { ...state, pressure: P_MIN, temperature: 273.1499999 };
    expect(() => validateBackwardState(drifted, [], options))
      .toThrow(/outside the IF97 PT envelope/);
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
