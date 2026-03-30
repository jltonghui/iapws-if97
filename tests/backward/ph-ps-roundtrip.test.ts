/**
 * Backward equation round-trip tests.
 * Strategy: compute forward (P,T → h,s), then backward (P,h → T) and verify.
 */
import { describe, it, expect } from 'vitest';
import { region1 } from '../../src/regions/region1';
import { region2 } from '../../src/regions/region2';
import { solvePT } from '../../src/core/solver.js';
import { solvePH } from '../../src/backward/ph';
import { solvePS } from '../../src/backward/ps';
import { solvePx } from '../../src/saturation/two-phase';
import { expectRegion4RoundTrip } from '../helpers/backward-assertions.js';

const TOL_T = 0.2; // K tolerance for temperature round-trip

describe('P-H Backward Round-Trip', () => {
  const cases = [
    { name: 'R1: T=300K P=3MPa', p: 3, T: 300 },
    { name: 'R1: T=500K P=3MPa', p: 3, T: 500 },
    { name: 'R2: T=300K P=0.0035MPa', p: 0.0035, T: 300 },
    { name: 'R2: T=700K P=0.0035MPa', p: 0.0035, T: 700 },
    { name: 'R2: T=700K P=30MPa', p: 30, T: 700 },
  ];

  cases.forEach(({ name, p, T }) => {
    it(name, () => {
      const fwd = p <= 4 && T <= 623.15 ? region1(p, T) : region2(p, T);
      const result = solvePH(p, fwd.enthalpy);
      expect(Math.abs(result.temperature - T)).toBeLessThan(TOL_T);
    });
  });

  it('R4 two-phase: P=1MPa, x=0.5', () => {
    const result = solvePH(1, 1800); // ~midway in two-phase
    expect(result.region).toBe(4);
    expect(result.quality).toBeGreaterThan(0);
    expect(result.quality).toBeLessThan(1);
  });

  it('R4 high-pressure: preserves a state above 623.15K', () => {
    const forward = solvePx(20, 0.4);
    const result = solvePH(20, forward.enthalpy);

    expectRegion4RoundTrip(result, forward, { specificVolumeTolerance: 1e-6 });
  });

  it('preserves the exact pressure and enthalpy inputs', () => {
    const p = 3;
    const forward = region1(p, 300);
    const result = solvePH(p, forward.enthalpy);

    expect(result.pressure).toBe(p);
    expect(result.enthalpy).toBe(forward.enthalpy);
  });

  it('throws OutOfRangeError for pressure outside the supported range', async () => {
    const { OutOfRangeError } = await import('../../src/types.js');

    expect(() => solvePH(0, 1000)).toThrow(OutOfRangeError);
    expect(() => solvePH(101, 1000)).toThrow(OutOfRangeError);
  });

  it('throws OutOfRangeError for enthalpy outside the supported range', async () => {
    const { OutOfRangeError } = await import('../../src/types.js');

    expect(() => solvePH(1, -1)).toThrow(OutOfRangeError);
    expect(() => solvePH(1, 1e9)).toThrow(OutOfRangeError);
  });
});

describe('P-S Backward Round-Trip', () => {
  const cases = [
    { name: 'R1: T=300K P=3MPa', p: 3, T: 300 },
    { name: 'R1: T=500K P=3MPa', p: 3, T: 500 },
    { name: 'R2: T=300K P=0.0035MPa', p: 0.0035, T: 300 },
    { name: 'R2: T=700K P=0.0035MPa', p: 0.0035, T: 700 },
    { name: 'R2: T=700K P=30MPa', p: 30, T: 700 },
  ];

  cases.forEach(({ name, p, T }) => {
    it(name, () => {
      const fwd = p <= 4 && T <= 623.15 ? region1(p, T) : region2(p, T);
      const result = solvePS(p, fwd.entropy);
      expect(Math.abs(result.temperature - T)).toBeLessThan(TOL_T);
    });
  });

  it('R4 two-phase: P=1MPa', () => {
    const result = solvePS(1, 4.5); // ~midway in two-phase
    expect(result.region).toBe(4);
    expect(result.quality).toBeGreaterThan(0);
    expect(result.quality).toBeLessThan(1);
  });

  it('R4 high-pressure: preserves a state above 623.15K', () => {
    const forward = solvePx(20, 0.4);
    const result = solvePS(20, forward.entropy);

    expectRegion4RoundTrip(result, forward, { specificVolumeTolerance: 1e-6 });
  });

  it('preserves the exact pressure and entropy inputs', () => {
    const p = 0.0035;
    const forward = region2(p, 700);
    const result = solvePS(p, forward.entropy);

    expect(result.pressure).toBe(p);
    expect(result.entropy).toBe(forward.entropy);
  });

  it('does not collapse near-saturation Region 3 states into Region 4', () => {
    const forward = solvePT(18, 630.1418133443477 - 1e-4);

    expect(forward.region).toBe(3);

    const fromPH = solvePH(forward.pressure, forward.enthalpy);
    const fromPS = solvePS(forward.pressure, forward.entropy);

    expect(fromPH.region).toBe(3);
    expect(fromPS.region).toBe(3);
    expect(fromPH.quality).toBeNull();
    expect(fromPS.quality).toBeNull();
  });

  it('throws OutOfRangeError for pressure outside the supported range', async () => {
    const { OutOfRangeError } = await import('../../src/types.js');

    expect(() => solvePS(0, 5)).toThrow(OutOfRangeError);
    expect(() => solvePS(101, 5)).toThrow(OutOfRangeError);
  });

  it('throws OutOfRangeError for entropy outside the supported range', async () => {
    const { OutOfRangeError } = await import('../../src/types.js');

    expect(() => solvePS(1, -1)).toThrow(OutOfRangeError);
    expect(() => solvePS(1, 1e9)).toThrow(OutOfRangeError);
  });
});
