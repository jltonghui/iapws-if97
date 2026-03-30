import { describe, expect, it } from 'vitest';
import { sumNormalizedResiduals } from '../../src/backward/objective-normalization.js';
import { backwardConstraintTolerance } from '../../src/backward/tolerances.js';

describe('sumNormalizedResiduals', () => {
  it('gives equal weight to misses that are each one tolerance wide', () => {
    const pressureExpected = 20;
    const enthalpyExpected = 2000;
    const pressureTolerance = 1e-5 * Math.max(1, Math.abs(pressureExpected));
    const enthalpyTolerance = backwardConstraintTolerance('enthalpy', enthalpyExpected);

    const score = sumNormalizedResiduals([
      {
        actual: pressureExpected + pressureTolerance,
        expected: pressureExpected,
        tolerance: pressureTolerance,
      },
      {
        actual: enthalpyExpected + enthalpyTolerance,
        expected: enthalpyExpected,
        tolerance: enthalpyTolerance,
      },
    ]);

    expect(score).toBeCloseTo(2, 9);
  });

  it('preserves the intended pressure-to-entropy balance for PS objectives', () => {
    const pressureExpected = 20;
    const entropyExpected = 4.5;
    const pressureTolerance = 1e-5 * Math.max(1, Math.abs(pressureExpected));
    const entropyTolerance = backwardConstraintTolerance('entropy', entropyExpected);

    const pressureOnlyScore = sumNormalizedResiduals([
      {
        actual: pressureExpected + pressureTolerance,
        expected: pressureExpected,
        tolerance: pressureTolerance,
      },
      {
        actual: entropyExpected,
        expected: entropyExpected,
        tolerance: entropyTolerance,
      },
    ]);

    const entropyOnlyScore = sumNormalizedResiduals([
      {
        actual: pressureExpected,
        expected: pressureExpected,
        tolerance: pressureTolerance,
      },
      {
        actual: entropyExpected + entropyTolerance,
        expected: entropyExpected,
        tolerance: entropyTolerance,
      },
    ]);

    expect(pressureOnlyScore).toBeCloseTo(1, 9);
    expect(entropyOnlyScore).toBeCloseTo(1, 9);
  });
});
