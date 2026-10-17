import { describe, expect, it } from 'vitest';
import { IF97Error, Region, solvePT, solvePx, solveTH, solveTx } from '../../src/index.js';
import { Pt, Tt } from '../../src/constants.js';
import { saturationPressure, saturationTemperature } from '../../src/saturation.js';
import { region1, region2 } from '../../src/regions.js';
import { saturationEndpointsAtPressure } from '../../src/saturation/common.js';
import { expectBackwardValue } from '../helpers/backward-assertions.js';

function adjacentFloat(value: number, direction: -1 | 1): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + BigInt(direction));
  return view.getFloat64(0);
}

describe('saturation primary coordinates', () => {
  it('keeps the vapor phase above the native triple-point saturation curve', () => {
    expect(solvePT(0.0006116572, 273.16001).region).toBe(Region.Region2);
  });

  it.each([273.16002, adjacentFloat(Tt, 1)])('retains a caller temperature above the triple point at T=%s', (T) => {
    const state = solveTx(T, 0.5);
    const p = saturationPressure(T);
    expect(state.temperature).toBe(T);
    expect(state.pressure).toBe(p);
    expect(state.pressure).toBeGreaterThan(Pt);
    const liquid = region1(p, T);
    const vapor = region2(p, T);
    expectBackwardValue(state.enthalpy, (liquid.enthalpy + vapor.enthalpy) / 2, 'enthalpy', 1e-9);
    expectBackwardValue(state.entropy, (liquid.entropy + vapor.entropy) / 2, 'entropy', 1e-12);
    expect(state.saturation!.temperature).toBe(T);
  });

  it.each([Pt + 2e-10, adjacentFloat(Pt, 1)])('retains pressure above the triple point at p=%s', (p) => {
    const state = solvePx(p, 0.5);
    expect(state.pressure).toBe(p);
    expect(state.temperature).toBeGreaterThanOrEqual(Tt);
    expect(state.saturation!.pressure).toBe(p);
    const eosPressure = saturationPressure(state.temperature);
    const liquid = region1(eosPressure, state.temperature);
    const vapor = region2(eosPressure, state.temperature);
    expectBackwardValue(state.enthalpy, (liquid.enthalpy + vapor.enthalpy) / 2, 'enthalpy', 1e-9);
    expectBackwardValue(state.entropy, (liquid.entropy + vapor.entropy) / 2, 'entropy', 1e-12);
  });

  it('absorbs only outward floating-point residue at the triple-point state bounds', () => {
    expect(solvePx(adjacentFloat(Pt, -1), 0.5).pressure).toBe(Pt);
    expect(solveTx(adjacentFloat(Tt, -1), 0.5).temperature).toBe(Tt);
    expect(() => solvePx(Pt - 1e-12, 0.5)).toThrow(/outside|range/i);
    expect(() => solveTx(Tt - 1e-6, 0.5)).toThrow(/outside|range/i);
  });

  it.each([0, 0.5, 1])('keeps the Region 1/2 saturation seam at x=%s', (x) => {
    const T = 623.15;
    const p = saturationPressure(T);
    const state = solveTx(T, x);
    const fromPressure = solvePx(state.pressure, x);
    const liquid = region1(p, T);
    const vapor = region2(p, T);

    expect(state.temperature).toBe(T);
    expect(state.pressure).toBe(p);
    expect(fromPressure.temperature).toBe(T);
    expectBackwardValue(state.enthalpy, liquid.enthalpy * (1 - x) + vapor.enthalpy * x, 'enthalpy');
    expectBackwardValue(fromPressure.enthalpy, state.enthalpy, 'enthalpy');
    expectBackwardValue(fromPressure.entropy, state.entropy, 'entropy');
  });

  it.each([-1, 1] as const)('keeps the formula side for an adjacent seam pressure (%s)', (direction) => {
    const p = adjacentFloat(saturationPressure(623.15), direction);
    for (const x of [0, 0.5, 1]) {
      const fromPressure = solvePx(p, x);
      const fromTemperature = solveTx(fromPressure.temperature, x);
      expect(fromPressure.pressure).toBe(p);
      expect(Math.sign(saturationEndpointsAtPressure(p).temperature - 623.15)).toBe(direction);
      expectBackwardValue(fromPressure.enthalpy, fromTemperature.enthalpy, 'enthalpy');
      expectBackwardValue(fromPressure.entropy, fromTemperature.entropy, 'entropy');
    }
  });

  it.each([0, 0.5, 1])('retains the caller temperature through Region 3 at x=%s', (x) => {
    const T = 644.3665401459854;
    const state = solveTx(T, x);

    expect(state.temperature).toBe(T);
    expect(state.pressure).toBe(saturationPressure(T));
    if (x === 0) {
      const fromTH = solveTH(state.temperature, state.enthalpy);
      expect(fromTH.region).toBe(Region.Region4);
      expect(fromTH.quality).toBe(0);
    }
  });

  it.each([0, 0.5, 1])('retains pressure near the critical point at x=%s', (x) => {
    const p = 22.06399;
    const state = solvePx(p, x);
    const repeated = solvePx(state.pressure, x);

    expect(state.pressure).toBe(p);
    expect(state.temperature).toBe(saturationTemperature(p));
    expect(repeated.pressure).toBe(p);
    expect(repeated.enthalpy).toBe(state.enthalpy);
  });

  it.each([0, 0.5, 1])('rejects inconsistent liquid/vapor EOS endpoints at x=%s', (x) => {
    const p = 22.0639999;
    for (const solve of [
      () => solvePx(p, x),
      () => solveTx(saturationTemperature(p), x),
    ]) {
      expect(solve).toThrow(IF97Error);
      expect(solve).toThrow(/numerical.*inconsisten/i);
    }
  });

  it('keeps valid near-critical liquid/vapor EOS endpoints distinct', () => {
    const liquid = solvePx(22.06399, 0);
    const vapor = solvePx(22.06399, 1);
    expect(vapor.specificVolume).toBeGreaterThan(liquid.specificVolume);
    expect(vapor.enthalpy).toBeGreaterThan(liquid.enthalpy);
    expect(vapor.entropy).toBeGreaterThan(liquid.entropy);
  });
});
