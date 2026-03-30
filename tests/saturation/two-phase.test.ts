import { describe, it, expect } from 'vitest';
import { solvePx, solveTx } from '../../src/saturation/two-phase.js';
import { region1 } from '../../src/regions/region1.js';
import { region2 } from '../../src/regions/region2.js';
import { saturationPressure, saturationTemperature } from '../../src/regions/region4.js';
import { Pc, Pt, Tc, Tt } from '../../src/constants.js';
import { IF97Error, OutOfRangeError, Region } from '../../src/types.js';
import { expectDigitsClose } from '../helpers/assertions.js';

describe('solvePx', () => {
  it('x=0 gives saturated liquid (subcritical)', () => {
    const state = solvePx(1, 0);
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(0);
    const Tsat = saturationTemperature(1);
    const liq = region1(1, Tsat);
    expectDigitsClose(state.enthalpy, liq.enthalpy, 3);
  });

  it('x=1 gives saturated vapour (subcritical)', () => {
    const state = solvePx(1, 1);
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(1);
    const Tsat = saturationTemperature(1);
    const vap = region2(1, Tsat);
    expectDigitsClose(state.enthalpy, vap.enthalpy, 3);
  });

  it('x=0.5 gives mixture properties', () => {
    const state = solvePx(1, 0.5);
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(0.5);
    const Tsat = saturationTemperature(1);
    const liq = region1(1, Tsat);
    const vap = region2(1, Tsat);
    expectDigitsClose(state.enthalpy, (liq.enthalpy + vap.enthalpy) / 2, 3);
  });

  it('high-P x=0 gives R3 saturated liquid', () => {
    const state = solvePx(20, 0);
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(0);
    expect(state.specificVolume).toBeGreaterThan(0);
  });

  it('high-P x=1 gives R3 saturated vapour', () => {
    const state = solvePx(20, 1);
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(1);
    expect(state.specificVolume).toBeGreaterThan(0);
  });

  it('high-P x=0.5 gives R3 mixture', () => {
    const state = solvePx(20, 0.5);
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(0.5);
    expect(state.cp).toBeNull();
    expect(state.cv).toBeNull();
    expect(state.speedOfSound).toBeNull();
    expect(state.isobaricExpansion).toBeNull();
    expect(state.isothermalCompressibility).toBeNull();
  });

  it('accepts the triple-point pressure endpoints', () => {
    const liquid = solvePx(Pt, 0);
    const vapor = solvePx(Pt, 1);

    expect(liquid.region).toBe(Region.Region4);
    expect(liquid.quality).toBe(0);
    expect(liquid.temperature).toBe(Tt);

    expect(vapor.region).toBe(Region.Region4);
    expect(vapor.quality).toBe(1);
    expect(vapor.temperature).toBe(Tt);
  });

  it.each([0, 0.5, 1])('rejects the critical-point pressure at x=%s', (x) => {
    expect(() => solvePx(Pc, x)).toThrow(IF97Error);
    expect(() => solvePx(Pc, x)).toThrow(/critical/i);
  });

  it('rejects out-of-range quality inputs', () => {
    expect(() => solvePx(1, -0.01)).toThrow(OutOfRangeError);
    expect(() => solvePx(1, 1.01)).toThrow(OutOfRangeError);
  });
});

describe('solveTx', () => {
  it('T=373.15K x=0.5 gives mixture', () => {
    const state = solveTx(373.15, 0.5);
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(0.5);
  });

  it('T=300K x=0 gives saturated liquid', () => {
    const state = solveTx(300, 0);
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(0);
  });

  it('T=300K x=1 gives saturated vapour', () => {
    const state = solveTx(300, 1);
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(1);
  });

  it('accepts the true triple-point temperature endpoints', () => {
    const liquid = solveTx(Tt, 0);
    const vapor = solveTx(Tt, 1);

    expect(liquid.region).toBe(Region.Region4);
    expect(liquid.pressure).toBe(Pt);
    expect(liquid.quality).toBe(0);

    expect(vapor.region).toBe(Region.Region4);
    expect(vapor.pressure).toBe(Pt);
    expect(vapor.quality).toBe(1);
  });

  it.each([0, 0.5, 1])('rejects the critical-point temperature at x=%s', (x) => {
    expect(() => solveTx(Tc, x)).toThrow(IF97Error);
    expect(() => solveTx(Tc, x)).toThrow(/critical/i);
  });

  it('rejects the 273.15 K extrapolation boundary as a state input', () => {
    expect(() => solveTx(273.15, 0.5)).toThrow(OutOfRangeError);
  });

  it('rejects out-of-range temperature and quality inputs', () => {
    expect(() => solveTx(200, 0.5)).toThrow(OutOfRangeError);
    expect(() => solveTx(700, 1.5)).toThrow(OutOfRangeError);
  });
});

describe('region4 endpoint normalization', () => {
  it('normalizes saturation pressure at the critical temperature', () => {
    expect(saturationPressure(Tc)).toBe(Pc);
  });

  it('normalizes saturation temperature at the triple-point pressure', () => {
    expect(saturationTemperature(Pt)).toBe(Tt);
  });
});
