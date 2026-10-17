import { describe, expect, it } from 'vitest';
import * as root from '../../src/index.js';
import * as transport from '../../src/transport.js';
import * as regions from '../../src/regions.js';
import * as saturation from '../../src/saturation.js';
import * as boundaries from '../../src/boundaries.js';
import * as detect from '../../src/detect.js';
import { region1 } from '../../src/regions/region1.js';
import { solve as solveInternal } from '../../src/core/solver.js';

describe('public API surface', () => {
  it('keeps the root export focused on main solver APIs', () => {
    expect(Object.keys(root).sort()).toEqual([
      'AmbiguousStateError',
      'ConvergenceError',
      'IF97Error',
      'OutOfRangeError',
      'Region',
      'solve',
      'solveBasic',
      'solveHS',
      'solvePH',
      'solvePS',
      'solvePT',
      'solvePx',
      'solveTH',
      'solveTS',
      'solveTx',
    ]);
  });

  it('exposes transport helpers from the transport subpath', () => {
    expect(Object.keys(transport).sort()).toEqual([
      'dielectricConstant',
      'ionizationConstant',
      'surfaceTension',
      'thermalConductivity',
      'viscosity',
    ]);
  });

  it('exposes region primitives from the regions subpath', () => {
    expect(Object.keys(regions).sort()).toEqual([
      'region1',
      'region2',
      'region3ByRhoT',
      'region5',
    ]);
  });

  it('exposes saturation helpers from the saturation subpath', () => {
    expect(Object.keys(saturation).sort()).toEqual([
      'saturationPressure',
      'saturationTemperature',
    ]);
  });

  it('exposes boundary helpers from the boundaries subpath', () => {
    expect(Object.keys(boundaries).sort()).toEqual([
      'boundary23_P_to_T',
      'boundary23_T_to_P',
      'region3SatVolume',
      'region3Volume',
    ]);
  });

  it('exposes region detection helpers from the detect subpath', () => {
    expect(Object.keys(detect).sort()).toEqual([
      'detectRegionHS',
      'detectRegionPH',
      'detectRegionPS',
      'detectRegionPT',
      'detectRegionTH',
      'detectRegionTS',
    ]);
  });
});

describe('public API native outputs', () => {
  it('documents the public Region 3 primitive contract by rejecting non-positive density inputs', () => {
    expect(() => regions.region3ByRhoT(0, 650)).toThrow(root.IF97Error);
    expect(() => regions.region3ByRhoT(-1, 650)).toThrow(root.IF97Error);
  });

  it('preserves the computed temperature through solve()', () => {
    const forward = root.solvePT(3, 300);
    const backward = root.solve({ mode: 'PH', p: 3, h: forward.enthalpy });

    expect(backward.temperature).toBe(solveInternal({ mode: 'PH', p: 3, h: forward.enthalpy }).temperature);
    expect(backward.temperature).not.toBe(300);
    expect(backward.enthalpy).toBe(region1(backward.pressure, backward.temperature).enthalpy);
  });

  it('preserves the computed temperature through direct solvePH()', () => {
    const forward = root.solvePT(3, 300);
    const backward = root.solvePH(3, forward.enthalpy);

    expect(backward.temperature).toBe(solveInternal({ mode: 'PH', p: 3, h: forward.enthalpy }).temperature);
    expect(backward.temperature).not.toBe(300);
    expect(backward.enthalpy).toBe(region1(backward.pressure, backward.temperature).enthalpy);
  });

  it('preserves supplied coordinates within one ULP of a simple decimal', () => {
    const temperature = 300.00000000000006;
    const state = root.solvePT(3, temperature);

    expect(state.temperature).toBe(temperature);
    expect(state.enthalpy).toBe(region1(3, temperature).enthalpy);
    expect(state.density).toBe(1 / state.specificVolume);
  });

  it('builds independent saturation leaves for each solve', () => {
    const first = root.solvePx(1, 0.5);
    const second = root.solvePx(1, 0.5);
    expect(first.saturation!.liquid).not.toBe(second.saturation!.liquid);
    expect(first.saturation!.vapor).not.toBe(second.saturation!.vapor);
    expect(first.saturation!.liquid).not.toHaveProperty('saturation');
    expect(first.saturation!.vapor).not.toHaveProperty('saturation');
    expect(first.density).toBe(1 / first.specificVolume);
  });

  it('keeps a near-critical PH result on its native density-temperature EOS', () => {
    const forward = root.solvePT(22.064, 647.09599);
    const backward = root.solvePH(forward.pressure, forward.enthalpy);
    const native = regions.region3ByRhoT(backward.density, backward.temperature);
    const reconstructed = root.solvePT(backward.pressure, backward.temperature);

    expect(Math.abs(backward.pressure - native.pressure)).toBeLessThan(1e-12);
    expect(Math.abs(backward.enthalpy - native.enthalpy)).toBeLessThan(1e-9);
    expect(Math.abs(backward.entropy - native.entropy)).toBeLessThan(1e-12);
    expect(Math.abs(backward.enthalpy - reconstructed.enthalpy)).toBeLessThan(1e-8);
    expect(Math.abs(backward.enthalpy - forward.enthalpy)).toBeLessThan(1e-8);
  });

  it('keeps direct saturation solvers aligned with unified solve() transport fields', () => {
    const direct = root.solvePx(1, 0.5);
    const unified = root.solve({ mode: 'Px', p: 1, x: 0.5 });

    expect(direct.viscosity).toBeNull();
    expect(direct.thermalConductivity).toBeNull();
    expect(direct.surfaceTension).toBe(unified.surfaceTension);
    expect(direct.dielectricConstant).toBeNull();
    expect(direct.ionizationConstant).toBeNull();
  });

  it('keeps direct backward solvers aligned with unified solve() return shape', () => {
    const forward = root.solvePT(3, 300);
    const direct = root.solvePH(3, forward.enthalpy);
    const unified = root.solve({ mode: 'PH', p: 3, h: forward.enthalpy });

    expect(direct.viscosity).toBe(unified.viscosity);
    expect(direct.thermalConductivity).toBe(unified.thermalConductivity);
    expect(direct.surfaceTension).toBe(unified.surfaceTension);
    expect(direct.dielectricConstant).toBe(unified.dielectricConstant);
    expect(direct.ionizationConstant).toBe(unified.ionizationConstant);
  });

  it('rejects non-finite inputs across direct public solver exports', () => {
    const forward = root.solvePT(3, 300);

    expect(() => root.solvePT(Number.NaN, 300)).toThrow(root.IF97Error);
    expect(() => root.solvePH(3, Number.POSITIVE_INFINITY)).toThrow(root.IF97Error);
    expect(() => root.solvePS(Number.NaN, forward.entropy)).toThrow(root.IF97Error);
    expect(() => root.solveHS(forward.enthalpy, Number.NaN)).toThrow(root.IF97Error);
    expect(() => root.solveTH(Number.NaN, forward.enthalpy)).toThrow(root.IF97Error);
    expect(() => root.solveTS(forward.temperature, Number.NEGATIVE_INFINITY)).toThrow(root.IF97Error);
    expect(() => root.solvePx(1, Number.NaN)).toThrow(root.IF97Error);
    expect(() => root.solveTx(400, Number.NaN)).toThrow(root.IF97Error);
  });
});
