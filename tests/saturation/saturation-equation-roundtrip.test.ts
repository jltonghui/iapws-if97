import { describe, it, expect } from 'vitest';
import { saturationPressure, saturationTemperature } from '../../src/regions/region4.js';
import { T_MIN, Tt, Tc } from '../../src/constants.js';

describe('saturation equation roundtrip', () => {
  it.each([
    { label: 'T_MIN (273.15 K)', T: T_MIN },
    { label: 'Tt (273.16 K)',    T: Tt },
    { label: '373.15 K',         T: 373.15 },
    { label: '500 K',            T: 500 },
    { label: '623.15 K',         T: 623.15 },
    { label: 'near Tc',          T: Tc - 1e-6 },
  ])('Tsat(Psat($label)) ≈ $label', ({ T }) => {
    const p = saturationPressure(T);
    const Tback = saturationTemperature(p);
    expect(Math.abs(Tback - T)).toBeLessThan(1e-8);
  });
});
