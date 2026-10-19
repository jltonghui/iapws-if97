import { describe, expect, it } from 'vitest';
import { nextPositiveFloat } from '../../src/core/floating-point.js';

describe('adjacent positive IEEE-754 values', () => {
  it.each([1, 2, 1024])('accounts for the ULP change at the power of two %s', (value) => {
    expect(nextPositiveFloat(value, 1)).toBe(value + value * Number.EPSILON);
    expect(nextPositiveFloat(value, -1)).toBe(value - value * Number.EPSILON / 2);
  });

  it.each([0.000611212677444, 22.064, 300, 623.15, 647.096])('returns to %s after stepping in both directions', (value) => {
    const lower = nextPositiveFloat(value, -1);
    const upper = nextPositiveFloat(value, 1);

    expect(lower).toBeLessThan(value);
    expect(upper).toBeGreaterThan(value);
    expect(nextPositiveFloat(lower, 1)).toBe(value);
    expect(nextPositiveFloat(upper, -1)).toBe(value);
  });

  it('handles the positive finite extremes', () => {
    expect(nextPositiveFloat(Number.MIN_VALUE, -1)).toBe(0);
    expect(nextPositiveFloat(Number.MIN_VALUE, 1)).toBe(2 * Number.MIN_VALUE);
    expect(nextPositiveFloat(Number.MAX_VALUE, -1)).toBe(Number.MAX_VALUE - 2 ** 971);
    expect(nextPositiveFloat(Number.MAX_VALUE, 1)).toBe(Infinity);
  });
});
