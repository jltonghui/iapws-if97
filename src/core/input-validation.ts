import { IF97Error } from '../types.js';

export function assertFiniteNumber(parameter: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new IF97Error(`${parameter} must be a finite number`);
  }
}

// Match the machine-noise budget used when public state values are normalized.
export function withinClosedLowerBound(value: number, boundary: number): boolean {
  return value >= boundary - 8 * Number.EPSILON * Math.max(1, Math.abs(boundary));
}
