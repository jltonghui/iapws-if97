import { expect } from 'vitest';
import type { BasicProperties } from '../../src/types.js';
import { Region } from '../../src/types.js';
import {
  BACKWARD_REGION4_QUALITY_TOLERANCE,
  backwardConstraintTolerance,
  backwardSpecificVolumeTolerance,
  type BackwardToleranceLabel,
} from '../../src/backward/tolerances.js';

const TEST_TOLERANCE_FLOOR: Record<BackwardToleranceLabel, number> = {
  pressure: 5e-7,
  temperature: 5e-7,
  enthalpy: 5e-7,
  entropy: 5e-7,
};

export function expectBackwardValue(
  actual: number,
  expected: number,
  label: BackwardToleranceLabel,
  tolerance?: number,
): void {
  const effectiveTolerance = tolerance ?? Math.max(
    backwardConstraintTolerance(label, expected),
    TEST_TOLERANCE_FLOOR[label],
  );
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    effectiveTolerance,
  );
}

export function expectSpecificVolume(
  actual: number,
  expected: number,
  tolerance?: number,
): void {
  const effectiveTolerance = tolerance ?? Math.max(
    backwardSpecificVolumeTolerance(expected),
    5e-7,
  );
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(
    effectiveTolerance,
  );
}

export function expectRegion4RoundTrip(
  actual: BasicProperties,
  expected: BasicProperties,
  options?: {
    pressureTolerance?: number;
    temperatureTolerance?: number;
    qualityTolerance?: number;
    specificVolumeTolerance?: number;
  },
): void {
  expect(actual.region).toBe(Region.Region4);
  expectBackwardValue(actual.pressure, expected.pressure, 'pressure', options?.pressureTolerance);
  expectBackwardValue(actual.temperature, expected.temperature, 'temperature', options?.temperatureTolerance);
  expect(Math.abs((actual.quality ?? Number.NaN) - (expected.quality ?? Number.NaN))).toBeLessThanOrEqual(
    options?.qualityTolerance ?? Math.max(BACKWARD_REGION4_QUALITY_TOLERANCE, 5e-7),
  );

  if (options?.specificVolumeTolerance !== undefined) {
    expectSpecificVolume(actual.specificVolume, expected.specificVolume, options.specificVolumeTolerance);
  }
}
