import { describe, expect, it } from 'vitest';
import { P_MIN } from '../../src/constants.js';
import { solveHS, solvePH, solvePS, solvePT, solveTH, solveTS } from '../../src/index.js';
import { validateBackwardState } from '../../src/backward/solution-validation.js';

const propertyCases = [
  { label: 'enthalpy', expected: 3000, tolerance: 0.003 },
  { label: 'entropy', expected: 7, tolerance: 7e-6 },
  { label: 'enthalpy', expected: 0.5, tolerance: 1e-6 },
  { label: 'entropy', expected: 0.5, tolerance: 1e-6 },
  { label: 'enthalpy', expected: 0, tolerance: 1e-6 },
  { label: 'entropy', expected: 0, tolerance: 1e-6 },
  { label: 'enthalpy', expected: -0.5, tolerance: 1e-6 },
  { label: 'entropy', expected: -0.5, tolerance: 1e-6 },
] as const;

describe('backward acceptance gates', () => {
  const state = solvePT(3, 300);
  const options = { solverName: 'acceptance-gate-regression' };

  it.each(propertyCases)('accepts $label=$expected just inside its independent budget', ({ label, expected, tolerance }) => {
    for (const direction of [-1, 1]) {
      const candidate = { ...state, [label]: expected + direction * 0.999 * tolerance };
      expect(validateBackwardState(candidate, [{ label, expected }], options)).toBe(candidate);
    }
  });

  it.each(propertyCases)('rejects $label=$expected just outside its independent budget', ({ label, expected, tolerance }) => {
    for (const direction of [-1, 1]) {
      const candidate = { ...state, [label]: expected + direction * 1.001 * tolerance };
      expect(() => validateBackwardState(candidate, [{ label, expected }], options))
        .toThrow(`failed to match ${label}`);
    }
  });

  it.each(['enthalpy', 'entropy'] as const)('includes the exact $label acceptance boundary', (label) => {
    for (const direction of [-1, 1]) {
      const candidate = { ...state, [label]: direction * 1e-6 };
      expect(validateBackwardState(candidate, [{ label, expected: 0 }], options)).toBe(candidate);
    }
  });

  it.each([P_MIN, 1, 20])('checks the pressure gate at p=%s MPa without an absolute floor', (pressure) => {
    const pressureState = solvePT(pressure, 500);
    const tolerance = 1e-9 * pressure;
    const inside = { ...pressureState, pressure: pressure + 0.999 * tolerance };
    const outside = { ...pressureState, pressure: pressure + 1.001 * tolerance };
    const constraints = [{ label: 'pressure', expected: pressure }] as const;

    expect(validateBackwardState(inside, constraints, options)).toBe(inside);
    expect(() => validateBackwardState(outside, constraints, options)).toThrow('failed to match pressure');
  });
});

describe('low-pressure backward round trips', () => {
  it.each([P_MIN, P_MIN * 1.0001])('preserves 1e-9 relative pressure at p=%s MPa', (pressure) => {
    const forward = solvePT(pressure, 500);
    const recovered = [
      solvePH(pressure, forward.enthalpy),
      solvePS(pressure, forward.entropy),
      solveHS(forward.enthalpy, forward.entropy),
      solveTH(forward.temperature, forward.enthalpy),
      solveTS(forward.temperature, forward.entropy),
    ];

    for (const result of recovered) {
      expect(Math.abs(result.pressure - pressure)).toBeLessThanOrEqual(1e-9 * pressure);
    }
  });
});
