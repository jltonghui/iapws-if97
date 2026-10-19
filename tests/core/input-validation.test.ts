import { describe, expect, it } from 'vitest';
import { withinClosedLowerBound } from '../../src/core/input-validation.js';
import { nextPositiveFloat } from '../../src/core/floating-point.js';

const lowerBoundCases = [
  { property: 'enthalpy', boundary: 0, tolerance: 1e-12 },
  { property: 'entropy', boundary: 0, tolerance: 1e-14 },
  ...[-1, 1].flatMap((sign) => [
    { property: 'enthalpy' as const, boundary: sign * 512, tolerance: 1e-12 },
    { property: 'enthalpy' as const, boundary: sign * 1024, tolerance: 8 * Number.EPSILON * 1024 },
    { property: 'entropy' as const, boundary: sign * 4, tolerance: 1e-14 },
    { property: 'entropy' as const, boundary: sign * 8, tolerance: 8 * Number.EPSILON * 8 },
  ]),
  { property: 'enthalpy', boundary: 1e-12 / (8 * Number.EPSILON), tolerance: 1e-12 },
  { property: 'entropy', boundary: 1e-14 / (8 * Number.EPSILON), tolerance: 1e-14 },
] as const;

describe('closed lower-bound numerical allowance', () => {
  it.each(lowerBoundCases)(
    'includes the $property threshold at boundary=$boundary and its inside neighbor',
    ({ property, boundary, tolerance }) => {
      const threshold = boundary - tolerance;
      const inside = threshold > 0
        ? nextPositiveFloat(threshold, 1) : -nextPositiveFloat(-threshold, -1);

      expect(withinClosedLowerBound(threshold, boundary, property)).toBe(true);
      expect(withinClosedLowerBound(inside, boundary, property)).toBe(true);
    },
  );

  it.each(lowerBoundCases)(
    'rejects the $property threshold outside neighbor at boundary=$boundary',
    ({ property, boundary, tolerance }) => {
      const threshold = boundary - tolerance;
      const outside = threshold > 0
        ? nextPositiveFloat(threshold, -1) : -nextPositiveFloat(-threshold, 1);

      expect(withinClosedLowerBound(outside, boundary, property)).toBe(false);
    },
  );
});
