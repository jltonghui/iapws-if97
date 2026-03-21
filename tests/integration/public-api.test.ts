import { describe, expect, it } from 'vitest';
import * as root from '../../src/index.js';
import * as transport from '../../src/transport.js';
import * as regions from '../../src/regions.js';
import * as saturation from '../../src/saturation.js';
import * as boundaries from '../../src/boundaries.js';
import * as detect from '../../src/detect.js';

describe('public API surface', () => {
  it('keeps the root export focused on main solver APIs', () => {
    expect(Object.keys(root).sort()).toEqual([
      'ConvergenceError',
      'IF97Error',
      'OutOfRangeError',
      'Region',
      'solve',
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
