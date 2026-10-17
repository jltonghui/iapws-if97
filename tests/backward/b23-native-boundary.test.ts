import { describe, expect, it } from 'vitest';
import { Region, solvePH, solvePS, solvePT } from '../../src/index.js';
import { detectRegionPH, detectRegionPS, detectRegionPT } from '../../src/detect.js';
import { boundary23_P_to_T, boundary23_T_to_P } from '../../src/boundaries.js';
import { formulationSeamAtPressure } from '../../src/core/formulation-seams.js';
import { nativeB23TemperatureBracket } from '../../src/core/region-detector.js';
import { B23_P_MIN, B23_T_MAX, P_MAX, R2_T_MIN } from '../../src/constants.js';

const pressure = 25.880006423848304;
const sliverTemperature = 680.8715189873833;
const modes = [
  { mode: 'PH', property: 'enthalpy', detect: detectRegionPH, backward: solvePH },
  { mode: 'PS', property: 'entropy', detect: detectRegionPS, backward: solvePS },
] as const;

function nextFloat(value: number): number {
  const bits = new BigUint64Array(new Float64Array([value]).buffer);
  bits[0] += 1n;
  return new Float64Array(bits.buffer)[0];
}

describe('native B23 pressure ownership', () => {
  it.each([pressure, ...[650, 700, 850].map(boundary23_T_to_P), P_MAX])(
    'shares the closed Region 3 and open Region 2 bracket at p=%s MPa', (p) => {
      const [lower, upper] = nativeB23TemperatureBracket(p);
      expect(upper).toBe(nextFloat(lower));
      expect(boundary23_T_to_P(lower)).toBeLessThanOrEqual(p);
      expect(boundary23_T_to_P(upper)).toBeGreaterThan(p);
      expect(detectRegionPT(p, lower)).toBe(Region.Region3);
      expect(detectRegionPT(p, upper)).toBe(Region.Region2);
      expect(formulationSeamAtPressure(p, '23')!.temperature).toBe(lower);
    },
  );

  it('preserves the lower B23 corner and its temperature clamp', () => {
    const [lower, upper] = nativeB23TemperatureBracket(B23_P_MIN);
    expect(lower).toBe(R2_T_MIN);
    expect(upper).toBe(nextFloat(R2_T_MIN));
    expect(detectRegionPT(B23_P_MIN, lower)).toBe(Region.Region2);
    expect(detectRegionPT(B23_P_MIN, upper)).toBe(Region.Region2);
    expect(detectRegionPT(boundary23_T_to_P(R2_T_MIN), R2_T_MIN)).toBe(Region.Region1);
    expect(formulationSeamAtPressure(B23_P_MIN, '23')).toBeNull();
  });

  it.each(modes)('preserves the Region 2 corner at 100 MPa in $mode', ({ property, detect, backward }) => {
    const forward = solvePT(P_MAX, B23_T_MAX);
    expect(forward.region).toBe(Region.Region2);
    expect(detect(P_MAX, forward[property])).toBe(Region.Region2);
    const recovered = backward(P_MAX, forward[property]);
    expect(recovered.region).toBe(Region.Region2);
    expect(recovered.temperature).toBe(B23_T_MAX);
  });

  it('recovers the reported PH state at the first admissible Region 2 temperature', () => {
    const forward = solvePT(pressure, 680.8715189873418);
    expect(forward.region).toBe(Region.Region2);
    expect(forward.enthalpy).toBe(2620.8772284856736);
    const recovered = solvePH(pressure, 2620.8772284856736);
    expect(recovered.region).toBe(Region.Region2);
    expect(detectRegionPT(recovered.pressure, recovered.temperature)).toBe(Region.Region2);
    expect(Math.abs(recovered.temperature - forward.temperature)).toBeLessThan(1e-8);
  });

  it.each(modes)('detects the Region 2 state between native and published B23 in $mode', ({ property, detect }) => {
    const forward = solvePT(pressure, sliverTemperature);
    expect(forward.region).toBe(Region.Region2);
    expect(pressure).toBeLessThan(boundary23_T_to_P(sliverTemperature));
    expect(sliverTemperature).toBeLessThan(boundary23_P_to_T(pressure));
    expect(detect(pressure, forward[property])).toBe(Region.Region2);
  });

  it.each(modes)('recovers the Region 2 state between native and published B23 in $mode', ({ property, backward }) => {
    const forward = solvePT(pressure, sliverTemperature);
    const recovered = backward(pressure, forward[property]);
    expect(recovered.region).toBe(Region.Region2);
    expect(detectRegionPT(recovered.pressure, recovered.temperature)).toBe(Region.Region2);
    expect(Math.abs(recovered.temperature - sliverTemperature)).toBeLessThan(1e-8);
    const reconstructed = solvePT(recovered.pressure, recovered.temperature);
    expect(Math.abs(reconstructed[property] - forward[property])).toBeLessThan(property === 'enthalpy' ? 1e-7 : 1e-10);
  });
});
