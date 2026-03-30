import { expect } from 'vitest';

export function expectDigitsClose(
  actual: number,
  expected: number,
  digits: number,
): void {
  const tolerance = 0.5 * 10 ** (-digits);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

export function expectRelativeClose(
  actual: number,
  expected: number,
  tolerance = 1e-6,
): void {
  const error = expected === 0 ? Math.abs(actual) : Math.abs((actual - expected) / expected);
  expect(error).toBeLessThan(tolerance);
}
