import { IF97Error } from '../types.js';

export function assertFiniteNumber(parameter: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new IF97Error(`${parameter} must be a finite number`);
  }
}

// shortcut: EOS cancellation floors are empirical; remeasure if the EOS evaluation changes.
export function withinClosedLowerBound(
  value: number,
  boundary: number,
  property: 'enthalpy' | 'entropy',
): boolean {
  const floor = property === 'enthalpy' ? 1e-12 : 1e-14;
  return value >= boundary - Math.max(floor, 8 * Number.EPSILON * Math.max(1, Math.abs(boundary)));
}
