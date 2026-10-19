import { describe, expect, it } from 'vitest';
import { Pc, Tc } from '../../src/constants.js';
import { Region, solvePH, solvePS, solvePT } from '../../src/index.js';
import { region3ByRhoT } from '../../src/regions/region3.js';
import type { BasicProperties } from '../../src/types.js';

function expectStable(state: BasicProperties): void {
  expect(state.region).toBe(Region.Region3);
  for (const value of [state.cp, state.cv, state.isothermalCompressibility, state.speedOfSound]) {
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
  }
}

describe('PH Region 3 convergence just above critical pressure', () => {
  it.each([
    [22.0640000005, 2087.5468181171536, 322.0000161, 647.096000002044],
    [22.064000001, 2087.547345117154, 321.9997014, 647.0960000039079],
    [22.064000001, 2087.5468331171537, 322.0000072, 647.096000003908],
    [22.064000002, 2087.5473341171537, 321.9997079, 647.0960000076358],
  ])('recovers a stable state at p=%s, h=%s', (p, h, rho, T) => {
    const state = solvePH(p, h);

    expectStable(state);
    expect(Math.abs(state.pressure - p)).toBeLessThan(3e-12);
    expect(Math.abs(state.enthalpy - h)).toBeLessThan(3e-10);
    expect(Math.abs(1 / state.specificVolume - rho)).toBeLessThan(1e-7);
    expect(Math.abs(state.temperature - T)).toBeLessThan(1e-11);
  });
});

describe('PH/PS critical-point guards above critical pressure', () => {
  const eos = region3ByRhoT(322, Tc + 1e-8);
  const publicPT = solvePT(eos.pressure, eos.temperature);

  it.each([
    { name: 'EOS PH', source: eos, backward: () => solvePH(eos.pressure, eos.enthalpy) },
    { name: 'EOS PS', source: eos, backward: () => solvePS(eos.pressure, eos.entropy) },
    { name: 'public PT to PS', source: publicPT, backward: () => solvePS(publicPT.pressure, publicPT.entropy) },
  ])('recovers stable $name input just above Pc', ({ source, backward }) => {
    expectStable(source);
    expect(source.pressure).toBeGreaterThan(Pc);
    expectStable(solvePT(source.pressure, source.temperature));

    const recovered = backward();
    expectStable(recovered);
    for (const [property, tolerance] of [
      ['pressure', 1e-9], ['temperature', 1e-7], ['specificVolume', 1e-7],
      ['enthalpy', 1e-6], ['entropy', 1e-6],
    ] as const) {
      expect(Math.abs(recovered[property] / source[property] - 1)).toBeLessThan(tolerance);
    }
  });
});
