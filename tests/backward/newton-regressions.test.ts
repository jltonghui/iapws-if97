import { describe, expect, it } from 'vitest';
import { Pc, Tc } from '../../src/constants.js';
import { solveHS, solvePH, solvePS, solvePT, type SteamState } from '../../src/index.js';
import { saturationTemperature } from '../../src/regions/region4.js';
import { Region } from '../../src/types.js';

function expectRelative(actual: number, expected: number, tolerance = 1e-7): void {
  expect(Math.abs((actual - expected) / expected)).toBeLessThan(tolerance);
}

function expectPHPSRoundTrip(forward: SteamState): void {
  const fromPH = solvePH(forward.pressure, forward.enthalpy);
  const fromPS = solvePS(forward.pressure, forward.entropy);

  for (const backward of [fromPH, fromPS]) {
    expect(backward.region).toBe(forward.region);
    expectRelative(backward.temperature, forward.temperature);
    expectRelative(backward.specificVolume, forward.specificVolume);
  }
  expectRelative(fromPH.entropy, forward.entropy);
  expectRelative(fromPS.enthalpy, forward.enthalpy);
}

describe('analytic backward Newton regressions', () => {
  it.each([
    { name: 'Region 3 liquid side of saturation', p: 20, T: saturationTemperature(20) - 1e-4 },
    { name: 'Region 3 vapor side of saturation', p: 20, T: saturationTemperature(20) + 1e-4 },
    { name: 'Region 3 near the critical point', p: Pc + 1e-6, T: Tc },
    { name: 'Region 3 just above the Region 1 boundary', p: 20, T: 623.15 + 1e-7 },
    { name: 'Region 3 exact pressure ceiling', p: 100, T: 700 },
  ])('$name round-trips through PH and PS', ({ p, T }) => {
    const forward = solvePT(p, T);
    expect(forward.region).toBe(Region.Region3);
    expectPHPSRoundTrip(forward);
  });

  it.each([
    { name: 'exact pressure ceiling', p: 100, T: 700 },
    { name: 'pressure ceiling near saturation at 646 K', p: 100, T: 646 },
    { name: 'pressure ceiling near saturation at 647 K', p: 100, T: 647 },
    { name: 'high-enthalpy low-entropy state', p: 80, T: 660 },
  ])('Region 3 $name round-trips through HS', ({ p, T }) => {
    const forward = solvePT(p, T);
    const backward = solveHS(forward.enthalpy, forward.entropy);

    expect(backward.region).toBe(Region.Region3);
    expectRelative(backward.pressure, forward.pressure);
    expectRelative(backward.temperature, forward.temperature);
    expectRelative(backward.specificVolume, forward.specificVolume);
  });

  it.each([
    { name: 'Region 1 near its upper corner', p: 99.9, T: 623, region: Region.Region1 },
    { name: 'Region 2 near its upper corner', p: 99.9, T: 1073, region: Region.Region2 },
    { name: 'Region 5 near its upper corner', p: 0.0007, T: 2273, region: Region.Region5 },
  ])('$name round-trips through the analytic 1D polish', ({ p, T, region }) => {
    const forward = solvePT(p, T);
    expect(forward.region).toBe(region);
    expectPHPSRoundTrip(forward);
  });

  it.each([
    { name: 'Region 5 just above its lower boundary', p: 25, T: 1073.151 },
    { name: 'Region 5 in the Region 2/5 seam overlap at 4 MPa', p: 4, T: 1073.151 },
    { name: 'Region 5 in the Region 2/5 seam overlap at 10 MPa', p: 10, T: 1073.151 },
    { name: 'Region 5 in the Region 2/5 seam overlap at 20 MPa', p: 20, T: 1073.151 },
    { name: 'Region 5 one microkelvin above its lower boundary', p: 0.001, T: 1073.15 + 1e-6 },
    { name: 'Region 5 exact upper temperature boundary', p: 0.001, T: 2273.15 },
  ])('$name round-trips through HS', ({ p, T }) => {
    const forward = solvePT(p, T);
    const backward = solveHS(forward.enthalpy, forward.entropy);

    expect(backward.region).toBe(Region.Region5);
    expectRelative(backward.pressure, forward.pressure);
    expectRelative(backward.temperature, forward.temperature);
  });

  it.each([1, 4, 10, 20, 30, 100])('keeps p=%s MPa at T=1073.15 K in Region 2', (p) => {
    const forward = solvePT(p, 1073.15);
    const backward = solveHS(forward.enthalpy, forward.entropy);

    expect(forward.region).toBe(Region.Region2);
    expect(backward.region).toBe(Region.Region2);
    expectRelative(backward.pressure, p);
    expectRelative(backward.temperature, 1073.15);
  });

  it.each([4, 10, 20])('keeps p=%s MPa just below the Region 2/5 seam in Region 2', (p) => {
    const forward = solvePT(p, 1073.149);
    const backward = solveHS(forward.enthalpy, forward.entropy);

    expect(forward.region).toBe(Region.Region2);
    expect(backward.region).toBe(Region.Region2);
    expectRelative(backward.pressure, p);
    expectRelative(backward.temperature, 1073.149);
  });
});
