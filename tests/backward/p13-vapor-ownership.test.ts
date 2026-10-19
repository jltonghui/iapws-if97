import { describe, expect, it } from 'vitest';
import { detectRegionHS, detectRegionPH, detectRegionPS, detectRegionPT } from '../../src/detect.js';
import { Region, solveHS, solvePH, solvePS, solvePT, solvePx, solveTx } from '../../src/index.js';
import { region2 } from '../../src/regions/region2.js';
import { saturationPressure, saturationTemperature } from '../../src/saturation.js';
import type { BasicProperties } from '../../src/types.js';
import { expectBackwardValue, expectRegion4RoundTrip } from '../helpers/backward-assertions.js';

function expectSaturatedPressureInverse(source: BasicProperties, property: 'enthalpy' | 'entropy') {
  const p = source.pressure;
  const target = source[property];
  const detected = property === 'enthalpy' ? detectRegionPH(p, target) : detectRegionPS(p, target);
  const recovered = property === 'enthalpy' ? solvePH(p, target) : solvePS(p, target);
  expect(detected).toBe(Region.Region4);
  expect(recovered.region).toBe(detected);
  expect(recovered.pressure).toBe(p);
  expectBackwardValue(recovered[property], target, property, property === 'enthalpy' ? 1e-7 : 1e-10);
  const checked = solvePx(p, recovered.quality!);
  expect(recovered.temperature).toBe(checked.temperature);
  expectBackwardValue(recovered.enthalpy, checked.enthalpy, 'enthalpy', 1e-9);
  expectBackwardValue(recovered.entropy, checked.entropy, 'entropy', 1e-12);
  expect(recovered.saturation).toEqual(checked.saturation);
  if (recovered.quality! > 0 && recovered.quality! < 1) {
    expect(recovered.cp).toBeNull();
    expect(recovered.viscosity).toBeNull();
    expect(recovered.thermalConductivity).toBeNull();
  }
  return recovered;
}

function expectHSConstraints(source: BasicProperties) {
  const recovered = solveHS(source.enthalpy, source.entropy);
  expect(recovered.region).toBe(Region.Region4);
  expect(detectRegionHS(source.enthalpy, source.entropy)).toBe(recovered.region);
  expectBackwardValue(recovered.enthalpy, source.enthalpy, 'enthalpy', 1e-7);
  expectBackwardValue(recovered.entropy, source.entropy, 'entropy', 1e-10);
  const checked = solveTx(recovered.temperature, recovered.quality!);
  expectBackwardValue(checked.enthalpy, source.enthalpy, 'enthalpy', 1e-7);
  expectBackwardValue(checked.entropy, source.entropy, 'entropy', 1e-10);
}

describe('P13 inverse saturation priority', () => {
  const p = 16.529164252621555;
  const T = 623.1522640752208;
  const h = 2563.6296772167157;
  const forward = region2(p, T);

  it.each([
    { mode: 'PH', property: 'enthalpy' },
    { mode: 'PS', property: 'entropy' },
  ] as const)('prefers saturation over an overlapping PT-owned Region 2 root through $mode', ({ property }) => {
    expect(forward.enthalpy).toBe(h);
    expect(detectRegionPT(p, T)).toBe(Region.Region2);
    expect(solvePT(p, T).region).toBe(Region.Region2);

    const recovered = expectSaturatedPressureInverse(forward, property);
    expect(recovered.quality).toBeGreaterThan(0);
    expect(recovered.quality).toBeLessThan(1);
  });

  it.each([
    { pressure: 16.52916425260458, temperature: 623.1500000000001 },
    { pressure: 16.529164252614578, temperature: 623.1500000000493 },
    { pressure: 16.529194262604577, temperature: 623.1502908954194 },
  ])('prefers saturation for an overlapping PT-owned vapor float at p=$pressure MPa', ({ pressure, temperature }) => {
    const source = solvePT(pressure, temperature);
    expect(source.region).toBe(Region.Region2);
    expect(detectRegionPT(pressure, temperature)).toBe(Region.Region2);
    expectSaturatedPressureInverse(source, 'enthalpy');
    expectSaturatedPressureInverse(source, 'entropy');
  });

  it.each([
    { mode: 'PH', property: 'enthalpy', temperature: 623.1523259451023 },
    { mode: 'PS', property: 'entropy', temperature: 623.1523871660877 },
  ] as const)('prefers saturation inside the vapor-endpoint tolerance through $mode', ({ property, temperature }) => {
    const source = solvePT(p, temperature);
    const endpoint = solvePx(p, 1);
    const delta = endpoint[property] - source[property];
    expect(source.region).toBe(Region.Region2);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(1e-9 * Math.abs(endpoint[property]));

    expect(detectRegionPT(p, temperature)).toBe(Region.Region2);
    expectSaturatedPressureInverse(source, property);
  });

  it('keeps wet steam when the matching Region 2 equation root is outside its PT domain', () => {
    const saturation = solvePx(p, 1);
    const candidate = region2(p, (623.15 + saturation.temperature) / 2);
    expect(detectRegionPT(p, candidate.temperature)).toBe(Region.Region3);
    expect(detectRegionPH(p, candidate.enthalpy)).toBe(Region.Region4);
    expect(detectRegionPS(p, candidate.entropy)).toBe(Region.Region4);

    for (const recovered of [solvePH(p, candidate.enthalpy), solvePS(p, candidate.entropy)]) {
      expect(recovered.region).toBe(Region.Region4);
      expect(recovered.temperature).toBe(saturation.temperature);
      expect(recovered.quality).toBeGreaterThan(0);
      expect(recovered.quality).toBeLessThan(1);
      expect(recovered.viscosity).toBeNull();
      expect(recovered.thermalConductivity).toBeNull();
    }
  });

  it.each([
    { offset: 1e-6, superheat: 0.001, region: Region.Region2, inverseRegion: Region.Region4 },
    { offset: 3e-4, superheat: 0.00229, region: Region.Region2, inverseRegion: Region.Region4 },
    { offset: -1e-8, superheat: 0.001, region: Region.Region2 },
    { offset: 1e-6, superheat: 0.003, region: Region.Region2 },
    { offset: 1e-3, superheat: 0.001, region: Region.Region3 },
  ])('selects PH/PS at P13+$offset MPa, Tsat+$superheat K', ({ offset, superheat, region, inverseRegion }) => {
    const pressure = saturationPressure(623.15) + offset;
    const temperature = saturationTemperature(pressure) + superheat;
    const source = solvePT(pressure, temperature);
    expect(source.region).toBe(region);
    if (inverseRegion === Region.Region4) {
      expectSaturatedPressureInverse(source, 'enthalpy');
      expectSaturatedPressureInverse(source, 'entropy');
      return;
    }
    expect(detectRegionPH(pressure, source.enthalpy)).toBe(region);
    expect(detectRegionPS(pressure, source.entropy)).toBe(region);

    for (const recovered of [solvePH(pressure, source.enthalpy), solvePS(pressure, source.entropy)]) {
      expect(recovered.region).toBe(region);
      expect(Math.abs(recovered.temperature - temperature)).toBeLessThan(1e-7);
      expect(Math.abs(recovered.pressure - pressure)).toBeLessThan(1e-9);
      expect(Math.abs(recovered.enthalpy - source.enthalpy)).toBeLessThan(1e-6);
      expect(Math.abs(recovered.entropy - source.entropy)).toBeLessThan(1e-8);
      expect(recovered.viscosity).toBeGreaterThan(0);
      expect(recovered.thermalConductivity).toBeGreaterThan(0);
      expect(solvePT(recovered.pressure, recovered.temperature).region).toBe(region);
    }
  });

  it.each([
    { pressure: p, quality: 0 },
    { pressure: p, quality: 0.5 },
    { pressure: p, quality: 1 },
    { pressure: saturationPressure(623.15) + 3e-4, quality: 0 },
    { pressure: saturationPressure(623.15) + 3e-4, quality: 0.5 },
    { pressure: saturationPressure(623.15) + 3e-4, quality: 1 },
  ])('preserves saturation at p=$pressure MPa, x=$quality', ({ pressure, quality }) => {
    const source = solvePx(pressure, quality);
    for (const recovered of [solvePH(pressure, source.enthalpy), solvePS(pressure, source.entropy)]) {
      expect(recovered.region).toBe(Region.Region4);
      expect(recovered.quality).toBeCloseTo(quality, 10);
      expect(recovered.temperature).toBe(source.temperature);
      expect(recovered.saturation).toEqual(source.saturation);
      expect(Math.abs(recovered.enthalpy - source.enthalpy)).toBeLessThan(1e-7);
      expect(Math.abs(recovered.entropy - source.entropy)).toBeLessThan(1e-10);
      if (quality === 0.5) {
        expect(recovered.viscosity).toBeNull();
        expect(recovered.thermalConductivity).toBeNull();
      } else {
        expect(recovered.cp).toBeGreaterThan(0);
        expect(recovered.viscosity).toBeGreaterThan(0);
        expect(recovered.thermalConductivity).toBeGreaterThan(0);
      }
    }
  });

  it.each([
    { mode: 'Px', value: 16.52918078176883, quality: 0.999999 },
    { mode: 'Px', value: 16.52918078176883, quality: 1 - 4.25e-5 },
    { mode: 'Tx', value: 623.1500000000001, quality: 1 - 1e-9 },
    { mode: 'Tx', value: 623.150001, quality: 1 - 1e-9 },
    { mode: 'Tx', value: 623.1501, quality: 1 - 1e-9 },
    { mode: 'Px', value: 16.52916425260458, quality: 1 - 1e-9 },
  ])('keeps near-vapor wet steam through PH/PS and validates HS for $mode=$value, x=$quality', ({ mode, value, quality }) => {
    const source = mode === 'Px' ? solvePx(value, quality) : solveTx(value, quality);
    for (const property of ['enthalpy', 'entropy'] as const) {
      const recovered = expectSaturatedPressureInverse(source, property);
      expectRegion4RoundTrip(recovered, source, { qualityTolerance: 1e-10 });
      expectBackwardValue(recovered.enthalpy, source.enthalpy, 'enthalpy', 1e-7);
      expectBackwardValue(recovered.entropy, source.entropy, 'entropy', 1e-10);
    }
    // HS can select the other valid saturation root across P13.
    expectHSConstraints(source);
  });

  it('keeps the PT-owned Region 3 vapor endpoint at its source temperature', () => {
    const source = solvePT(16.529164253868903, 623.1500000062315);
    expect(source.region).toBe(Region.Region3);
    const recovered = [solvePH(source.pressure, source.enthalpy), solvePS(source.pressure, source.entropy)];
    expect(detectRegionPH(source.pressure, source.enthalpy)).toBe(recovered[0].region);
    expect(detectRegionPS(source.pressure, source.entropy)).toBe(recovered[1].region);
    for (const state of recovered) {
      expect([Region.Region3, Region.Region4]).toContain(state.region);
      expectBackwardValue(state.temperature, source.temperature, 'temperature', 1e-7);
      expectBackwardValue(state.enthalpy, source.enthalpy, 'enthalpy', 1e-7);
      expectBackwardValue(state.entropy, source.entropy, 'entropy', 1e-10);
      if (state.region === Region.Region4) {
        expect(state.quality).toBe(1);
        expect(state.saturation).toBeDefined();
        expect(state.cp).toBeGreaterThan(0);
        expect(state.viscosity).toBeGreaterThan(0);
      }
    }
    expectHSConstraints(source);
  });

  it('keeps HS on a PT-owned root when the formulations admit another single-phase state', () => {
    const recovered = solveHS(h, forward.entropy);
    const checked = solvePT(recovered.pressure, recovered.temperature);
    expect(recovered.region).toBe(checked.region);
    expect(Math.abs(checked.enthalpy - h)).toBeLessThan(1e-7);
    expect(Math.abs(checked.entropy - forward.entropy)).toBeLessThan(1e-10);
    expect(recovered.viscosity).toBeGreaterThan(0);
    expect(recovered.thermalConductivity).toBeGreaterThan(0);
  });
});
