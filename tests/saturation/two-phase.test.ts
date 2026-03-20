import { describe, it, expect } from 'vitest';
import { solvePx, solveTx } from '../../src/saturation/two-phase.js';
import { region1 } from '../../src/regions/region1.js';
import { region2 } from '../../src/regions/region2.js';
import { saturationTemperature } from '../../src/regions/region4.js';
import { Region } from '../../src/types.js';

describe('solvePx', () => {
  it('x=0 gives saturated liquid (subcritical)', () => {
    const state = solvePx(1, 0);
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(0);
    const Tsat = saturationTemperature(1);
    const liq = region1(1, Tsat);
    expect(state.enthalpy).toBeCloseTo(liq.enthalpy, 3);
  });

  it('x=1 gives saturated vapour (subcritical)', () => {
    const state = solvePx(1, 1);
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(1);
    const Tsat = saturationTemperature(1);
    const vap = region2(1, Tsat);
    expect(state.enthalpy).toBeCloseTo(vap.enthalpy, 3);
  });

  it('x=0.5 gives mixture properties', () => {
    const state = solvePx(1, 0.5);
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(0.5);
    const Tsat = saturationTemperature(1);
    const liq = region1(1, Tsat);
    const vap = region2(1, Tsat);
    expect(state.enthalpy).toBeCloseTo((liq.enthalpy + vap.enthalpy) / 2, 3);
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
});
