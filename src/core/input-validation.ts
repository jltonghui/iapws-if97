import { IF97Error } from '../types.js';

export function assertFiniteNumber(parameter: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new IF97Error(`${parameter} must be a finite number`);
  }
}

// Accept floating-point residue at a closed lower bound.
export function withinClosedLowerBound(value: number, boundary: number): boolean {
  return value >= boundary - 8 * Number.EPSILON * Math.max(1, Math.abs(boundary));
}
