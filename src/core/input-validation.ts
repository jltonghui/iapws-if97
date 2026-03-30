import { IF97Error } from '../types.js';

export function assertFiniteNumber(parameter: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new IF97Error(`${parameter} must be a finite number`);
  }
}
