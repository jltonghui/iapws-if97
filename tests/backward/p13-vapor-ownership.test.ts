import { describe, expect, it } from 'vitest';
import { detectRegionPH, detectRegionPS, detectRegionPT } from '../../src/detect.js';
import { Region, solveHS, solvePH, solvePS, solvePT, solvePx } from '../../src/index.js';
import { region2 } from '../../src/regions/region2.js';
import { saturationPressure, saturationTemperature } from '../../src/saturation.js';

describe('P13 superheated-vapor boundary ownership', () => {
  const p = 16.529164252621555;
  const T = 623.1522640752208;
  const h = 2563.6296772167157;
  const forward = region2(p, T);

  it.each([
    { mode: 'PH', backward: () => solvePH(p, h) },
    { mode: 'PS', backward: () => solvePS(p, forward.entropy) },
  ])('keeps the PT-owned Region 2 state through $mode', ({ backward }) => {
    expect(forward.enthalpy).toBe(h);
    expect(detectRegionPT(p, T)).toBe(Region.Region2);
    expect(solvePT(p, T).region).toBe(Region.Region2);

    const recovered = backward();
    expect(recovered.region).toBe(Region.Region2);
    expect(Math.abs(recovered.temperature - T)).toBeLessThan(1e-7);
    expect(Math.abs(recovered.pressure - p)).toBeLessThan(1e-7);
    expect(Math.abs(recovered.enthalpy - h)).toBeLessThan(1e-6);
    expect(Math.abs(recovered.entropy - forward.entropy)).toBeLessThan(1e-8);
    expect(recovered.viscosity).toBeGreaterThan(0);
    expect(recovered.thermalConductivity).toBeGreaterThan(0);
  });

  it.each([
    { pressure: 16.52916425260458, temperature: 623.1500000000001 },
    { pressure: 16.529164252614578, temperature: 623.1500000000493 },
    { pressure: 16.529194262604577, temperature: 623.1502908954194 },
  ])('recovers a PT-owned vapor float at p=$pressure MPa', ({ pressure, temperature }) => {
    const source = solvePT(pressure, temperature);
    expect(source.region).toBe(Region.Region2);
    expect(detectRegionPH(pressure, source.enthalpy)).toBe(Region.Region2);
    expect(detectRegionPS(pressure, source.entropy)).toBe(Region.Region2);
    for (const recovered of [solvePH(pressure, source.enthalpy), solvePS(pressure, source.entropy)]) {
      expect(recovered.region).toBe(Region.Region2);
      expect(detectRegionPT(recovered.pressure, recovered.temperature)).toBe(Region.Region2);
      expect(Math.abs(recovered.enthalpy - source.enthalpy)).toBeLessThan(1e-7);
      expect(Math.abs(recovered.entropy - source.entropy)).toBeLessThan(1e-10);
    }
  });

  it.each([
    { mode: 'PH', property: 'enthalpy', temperature: 623.1523259451023 },
    { mode: 'PS', property: 'entropy', temperature: 623.1523871660877 },
  ] as const)('keeps an owned $mode root inside the former vapor-endpoint tolerance', ({ mode, property, temperature }) => {
    const source = solvePT(p, temperature);
    const endpoint = solvePx(p, 1);
    const delta = endpoint[property] - source[property];
    expect(source.region).toBe(Region.Region2);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(1e-9 * Math.abs(endpoint[property]));

    const detected = mode === 'PH' ? detectRegionPH(p, source.enthalpy) : detectRegionPS(p, source.entropy);
    const recovered = mode === 'PH' ? solvePH(p, source.enthalpy) : solvePS(p, source.entropy);
    expect(detected).toBe(Region.Region2);
    expect(recovered.region).toBe(Region.Region2);
    expect(Math.abs(recovered.temperature - temperature)).toBeLessThan(1e-7);
    expect(Math.abs(recovered[property] - source[property])).toBeLessThan(property === 'enthalpy' ? 1e-7 : 1e-10);
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
    { offset: 1e-6, superheat: 0.001, region: Region.Region2 },
    { offset: 3e-4, superheat: 0.00229, region: Region.Region2 },
    { offset: -1e-8, superheat: 0.001, region: Region.Region2 },
    { offset: 1e-6, superheat: 0.003, region: Region.Region2 },
    { offset: 1e-3, superheat: 0.001, region: Region.Region3 },
  ])('round-trips PH/PS at P13+$offset MPa, Tsat+$superheat K', ({ offset, superheat, region }) => {
    const pressure = saturationPressure(623.15) + offset;
    const temperature = saturationTemperature(pressure) + superheat;
    const source = solvePT(pressure, temperature);
    expect(source.region).toBe(region);
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
      expect(Math.abs(recovered.enthalpy - source.enthalpy)).toBeLessThan(1e-7);
      expect(Math.abs(recovered.entropy - source.entropy)).toBeLessThan(1e-10);
      if (quality === 0.5) {
        expect(recovered.viscosity).toBeNull();
        expect(recovered.thermalConductivity).toBeNull();
      } else {
        expect(recovered.viscosity).toBeGreaterThan(0);
        expect(recovered.thermalConductivity).toBeGreaterThan(0);
      }
    }
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
