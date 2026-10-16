import { describe, expect, it } from 'vitest';
import { P_MIN, R2_T_MAX, R5_T_MAX } from '../../src/constants.js';
import { detectRegionPH, detectRegionPS } from '../../src/detect.js';
import { Region, solve, solvePH, solvePS, solvePT, type SteamState } from '../../src/index.js';
import { region2 } from '../../src/regions/region2.js';
import { region5 } from '../../src/regions/region5.js';
import { expectBackwardValue } from '../helpers/backward-assertions.js';

const modes = [
  {
    name: 'PH', property: 'enthalpy', detect: detectRegionPH, backward: solvePH,
    unified: (p: number, value: number) => solve({ mode: 'PH', p, h: value }),
    upperExcess: 0.01, smallExcess: 1e-6, overlapPressures: [1],
    reportedGaps: [{ p: 30, value: 4020.25 }, { p: 50, value: 3926.0 }],
  },
  {
    name: 'PS', property: 'entropy', detect: detectRegionPS, backward: solvePS,
    unified: (p: number, value: number) => solve({ mode: 'PS', p, s: value }),
    upperExcess: 1e-5, smallExcess: 1e-9, overlapPressures: [1, 30],
    reportedGaps: [{ p: 50, value: 6.522649849940206 }],
  },
] as const;

function expectReconstruction(
  recovered: SteamState,
  p: number,
  value: number,
  property: 'enthalpy' | 'entropy',
  region: Region,
): void {
  const tolerance = property === 'enthalpy' ? 1e-8 : 1e-10;
  expect(recovered.region).toBe(region);
  expectBackwardValue(recovered.pressure, p, 'pressure');
  expectBackwardValue(recovered[property], value, property, tolerance);
  const reconstructed = solvePT(recovered.pressure, recovered.temperature);
  expect(reconstructed.region).toBe(region);
  expectBackwardValue(reconstructed[property], value, property, tolerance);
}

describe.each(modes)('Region 2/5 $name boundaries', ({
  property, detect, backward, unified, upperExcess, smallExcess, overlapPressures, reportedGaps,
}) => {
  it.each<{ p: number; value: number }>(reportedGaps)('snaps the reported numerical seam gap at p=$p MPa', ({ p, value }) => {
    expect(value).toBeGreaterThan(region2(p, R2_T_MAX)[property]);
    expect(value).toBeLessThan(region5(p, R2_T_MAX)[property]);
    expect(detect(p, value)).toBe(Region.Region2);
    for (const run of [backward, unified]) {
      const recovered = run(p, value);
      expect(recovered.temperature).toBe(R2_T_MAX);
      expectReconstruction(recovered, p, region2(p, R2_T_MAX)[property], property, Region.Region2);
    }
  });

  it('snaps the native numerical seam gap in the low-pressure detector branch', () => {
    const p = 0.001;
    const upper = region2(p, R2_T_MAX)[property];
    const lower = region5(p, R2_T_MAX)[property];
    expect(lower).toBeGreaterThan(upper);
    const value = (lower + upper) / 2;
    expect(detect(p, value)).toBe(Region.Region2);
    expectReconstruction(backward(p, value), p, upper, property, Region.Region2);
  });

  it.each([0.001, 50])('maps the open Region 5 endpoint to the owned Region 2 seam at p=%s MPa', (p) => {
    const value = region5(p, R2_T_MAX)[property];
    expect(value).toBeGreaterThan(region2(p, R2_T_MAX)[property]);
    expect(detect(p, value)).toBe(Region.Region2);
    expectReconstruction(backward(p, value), p, region2(p, R2_T_MAX)[property], property, Region.Region2);
  });

  it('rejects an arbitrarily large input in the detector', () => {
    expect(detect(1, 1e9)).toBe(-1);
  });

  it.each([1, 30, 50])('rejects input above the local Region 5 Tmax at p=%s MPa', (p) => {
    const value = region5(p, R5_T_MAX)[property] + upperExcess;
    expect(detect(p, value)).toBe(-1);
    expect(() => backward(p, value)).toThrow(/^Cannot determine region for /);
  });

  it('rejects meaningful excess above Region 5 Tmax despite temperature snapping tolerance', () => {
    const value = region5(50, R5_T_MAX)[property] + smallExcess;
    expect(detect(50, value)).toBe(-1);
    expect(() => backward(50, value)).toThrow(/^Cannot determine region for /);
  });

  it('snaps a small input residual inside the local numerical seam gap', () => {
    const value = region2(50, R2_T_MAX)[property] + smallExcess;
    expect(value).toBeLessThan(region5(50, R2_T_MAX)[property]);
    expect(detect(50, value)).toBe(Region.Region2);
    expectReconstruction(backward(50, value), 50, region2(50, R2_T_MAX)[property], property, Region.Region2);
  });

  it.each([55.3, 100])('uses the Region 2 ceiling above 50 MPa at p=%s MPa', (p) => {
    const value = region2(p, R2_T_MAX)[property] + upperExcess;
    expect(detect(p, value)).toBe(-1);
    expect(() => backward(p, value)).toThrow(/^Cannot determine region for /);
  });

  it.each(overlapPressures)('preserves Region 2 priority in the seam overlap at p=%s MPa', (p) => {
    const upper = region2(p, R2_T_MAX)[property];
    const lower = region5(p, R2_T_MAX)[property];
    expect(lower).toBeLessThan(upper);
    const value = (lower + upper) / 2;
    expect(detect(p, value)).toBe(Region.Region2);
    const recovered = backward(p, value);
    expect(recovered.temperature).toBeLessThanOrEqual(R2_T_MAX);
    expectReconstruction(recovered, p, value, property, Region.Region2);
  });

  it.each([46.8, 55.3, 58.9, 70.3, 91.7])('round-trips the public closed Region 2 seam at p=%s MPa', (p) => {
    const forward = solvePT(p, R2_T_MAX);
    expect(detect(p, forward[property])).toBe(Region.Region2);
    const recovered = backward(p, forward[property]);
    expectBackwardValue(recovered.temperature, R2_T_MAX, 'temperature');
    expectReconstruction(recovered, p, forward[property], property, Region.Region2);
  });

  it.each([P_MIN, 1, 11.1, 30, 39.9, 50])('round-trips the public closed Region 5 Tmax at p=%s MPa', (p) => {
    const forward = solvePT(p, R5_T_MAX);
    expect(detect(p, forward[property])).toBe(Region.Region5);
    const recovered = backward(p, forward[property]);
    expectBackwardValue(recovered.temperature, R5_T_MAX, 'temperature');
    expectReconstruction(recovered, p, forward[property], property, Region.Region5);
  });

  it.each([0.001, 50])('recovers a state 10 nanokelvin above the open Region 5 boundary at p=%s MPa', (p) => {
    const forward = solvePT(p, R2_T_MAX + 1e-8);
    const recovered = backward(p, forward[property]);
    expect(recovered.temperature).toBeGreaterThan(R2_T_MAX);
    expectBackwardValue(recovered.temperature, forward.temperature, 'temperature');
    expectReconstruction(recovered, p, forward[property], property, Region.Region5);
  });

  it.each([
    { p: 46.8, T: R2_T_MAX, region: Region.Region2 },
    { p: 39.9, T: R5_T_MAX, region: Region.Region5 },
  ])('round-trips the public endpoint through unified solve at p=$p MPa, T=$T K', ({ p, T, region }) => {
    const forward = solvePT(p, T);
    const recovered = unified(p, forward[property]);
    expectBackwardValue(recovered.temperature, T, 'temperature');
    expectReconstruction(recovered, p, forward[property], property, region);
  });
});

it('recovers PH at the next representable Region 5 temperature above the seam', () => {
  const bits = new BigUint64Array(new Float64Array([R2_T_MAX]).buffer);
  bits[0] += 1n;
  const forward = solvePT(50, new Float64Array(bits.buffer)[0]);
  const recovered = solvePH(50, forward.enthalpy);
  expect(recovered.temperature).toBeGreaterThan(R2_T_MAX);
  expectReconstruction(recovered, 50, forward.enthalpy, 'enthalpy', Region.Region5);
});
