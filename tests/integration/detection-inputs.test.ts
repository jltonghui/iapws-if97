import { describe, expect, it } from 'vitest';
import * as detect from '../../src/detect.js';

const nonFiniteValues = [NaN, Infinity, -Infinity];
const detectors = [
  { name: 'PT', run: detect.detectRegionPT, first: 3, second: 300 },
  { name: 'PH', run: detect.detectRegionPH, first: 3, second: 500 },
  { name: 'PS', run: detect.detectRegionPS, first: 3, second: 1.5 },
  { name: 'HS', run: detect.detectRegionHS, first: 2000, second: 4.5 },
  { name: 'TH', run: detect.detectRegionTH, first: 500, second: 2000 },
  { name: 'TS', run: detect.detectRegionTS, first: 500, second: 5 },
];

describe('public detector input validation', () => {
  describe.each(detectors)('$name', ({ run, first, second }) => {
    it.each(nonFiniteValues)('returns -1 when the first argument is %s', (value) => {
      expect(run(value, second)).toBe(-1);
    });

    it.each(nonFiniteValues)('returns -1 when the second argument is %s', (value) => {
      expect(run(first, value)).toBe(-1);
    });
  });

  it.each(nonFiniteValues)('rejects HS enthalpy %s before low-entropy classification', (h) => {
    expect(detect.detectRegionHS(h, 1.5)).toBe(-1);
  });
});
