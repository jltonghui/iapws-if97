import { expect } from 'vitest';
import type { BasicProperties } from '../../src/types.js';
import { Region } from '../../src/types.js';

type BackwardToleranceLabel = 'pressure' | 'temperature' | 'enthalpy' | 'entropy';

// Keep test budgets independent of the production acceptance policy.
const TEST_RELATIVE_TOLERANCE: Record<BackwardToleranceLabel, number> = {
  pressure: 1e-9,
  temperature: 1e-9,
  enthalpy: 1e-6,
  entropy: 1e-6,
};

const TEST_ABSOLUTE_TOLERANCE: Record<BackwardToleranceLabel, number> = {
  pressure: 0,
  temperature: 5e-7,
  enthalpy: 1e-6,
  entropy: 1e-6,
};

export function expectBackwardValue(
  actual: number,
  expected: number,
  label: BackwardToleranceLabel,
  tolerance?: number,
): void {
  const effectiveTolerance = tolerance ?? Math.max(
    TEST_RELATIVE_TOLERANCE[label] * Math.abs(expected),
    TEST_ABSOLUTE_TOLERANCE[label],
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
  const effectiveTolerance = tolerance ?? 1e-6 * Math.max(1, Math.abs(expected));
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
    options?.qualityTolerance ?? 1e-6,
  );

  if (options?.specificVolumeTolerance !== undefined) {
    expectSpecificVolume(actual.specificVolume, expected.specificVolume, options.specificVolumeTolerance);
  }
}
