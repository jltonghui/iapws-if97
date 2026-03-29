import { describe, expect, it } from 'vitest';
import {
  b3ab,
  b3cd,
  b3ef,
  b3gh,
  b3ij,
  b3jk,
  b3mn,
  b3op,
  b3qu,
  b3rx,
  b3uv,
  b3wx,
  boundary23_P_to_T,
  boundary23_T_to_P,
} from '../../src/regions/boundaries.js';
import { expectDigitsClose } from '../assertions.js';

describe('region boundary utilities', () => {
  it('B23 pressure/temperature transforms are approximately inverse on the boundary', () => {
    const temperature = 650;
    const pressure = boundary23_T_to_P(temperature);

    expectDigitsClose(boundary23_P_to_T(pressure), temperature, 9);
  });

  it('evaluates Region 3 subregion boundaries to finite temperatures', () => {
    const values = [
      b3ab(25),
      b3cd(25),
      b3ef(25),
      b3gh(25),
      b3ij(25),
      b3jk(25),
      b3mn(25),
      b3op(25),
      b3qu(25),
      b3rx(25),
      b3uv(25),
      b3wx(25),
    ];

    for (const value of values) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(500);
      expect(value).toBeLessThan(800);
    }
  });
});
