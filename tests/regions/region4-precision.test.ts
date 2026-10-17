import { describe, expect, it } from 'vitest';
import { region3PressureResidual } from '../../src/regions/region3.js';
import { saturationPressure, saturationPressurePair, saturationTemperature } from '../../src/regions/region4.js';
import { P_MIN, Pc, Pt, T_MIN, Tc, Tt } from '../../src/constants.js';

describe('Region 4 equation precision', () => {
  it.each([273.15000000000003, 273.15002, 273.16001, 273.16002])('retains native pressure near a lower endpoint at T=%s', (T) => {
    expect(saturationPressure(T)).toBe(saturationPressurePair(T)[0]);
  });

  it.each([[T_MIN, P_MIN], [Tt, Pt], [Tc, Pc]])('maps the exact endpoint T=%s, p=%s in both directions', (T, p) => {
    expect(saturationPressure(T)).toBe(p);
    expect(saturationTemperature(p)).toBe(T);
  });

  it('keeps the measured native triple-point fit gap monotone', () => {
    const bits = new BigUint64Array(new Float64Array([Tt]).buffer);
    bits[0] -= 1n;
    const lower = new Float64Array(bits.buffer)[0];
    bits[0] += 2n;
    const upper = new Float64Array(bits.buffer)[0];
    expect(saturationPressurePair(Tt)[0]).toBe(0.0006116570000106673);
    expect(saturationPressurePair(lower)[0]).toBeGreaterThan(Pt);
    expect(saturationPressure(lower)).toBe(Pt);
    expect(saturationPressure(upper)).toBeGreaterThan(Pt);
    expect(saturationTemperature((Pt + saturationPressurePair(Tt)[0]) / 2)).toBe(Tt);
  });

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
