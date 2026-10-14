import { describe, expect, it } from 'vitest';
import { region3PressureResidual } from '../../src/regions/region3.js';
import { saturationPressure, saturationPressurePair, saturationTemperature } from '../../src/regions/region4.js';

describe('Region 4 equation precision', () => {
  // 100-digit references use the exact binary64 coefficient and input values.
  // These interior points do not use the existing triple/critical endpoint snaps.
  it.each([
    [300, 0.003536589413013015],
    [400, 0.24575318630408363],
    [500, 2.6388977562732214],
    [623.1499999999999, 16.529164252604552],
    [623.15, 16.529164252604577],
    [623.1500000000001, 16.5291642526046],
    [647.0959627047504, 22.063990000000285],
  ])('preserves pressure at T=%s', (T, pressure) => {
    expect(saturationPressure(T)).toBe(pressure);
  });

  it.each([
    [1, 453.0356323914668],
    [10, 584.1494879985275],
    [22.054, 647.0586869754504],
    [22.063, 647.0922704042492],
    [22.06399, 647.0959627047494],
  ])('preserves temperature at p=%s', (pressure, T) => {
    expect(saturationTemperature(pressure)).toBe(T);
  });

  it('keeps the saturation pressure increasing across adjacent seam temperatures', () => {
    const lower = saturationPressure(623.1499999999999);
    const seam = saturationPressure(623.15);
    const upper = saturationPressure(623.1500000000001);

    expect(lower).toBeLessThan(seam);
    expect(seam).toBeLessThan(upper);
  });

  it('retains the unrounded saturation pressure target for a near-critical density', () => {
    const T = 647.0959627047494;
    const rho = 321.61667538665296;
    const [pressure, low] = saturationPressurePair(T);

    expect(pressure).toBe(saturationPressure(T));
    expect(low).toBeCloseTo(4.0582543633141201e-16, 29);
    expect(Math.abs(region3PressureResidual(rho, T, pressure))).toBeGreaterThan(4e-16);
    expect(Math.abs(region3PressureResidual(rho, T, pressure, low))).toBeLessThan(2e-22);
  });
});
