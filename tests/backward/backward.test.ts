/**
 * Backward equation round-trip tests.
 * Strategy: compute forward (P,T → h,s), then backward (P,h → T) and verify.
 */
import { describe, it, expect } from 'vitest';
import { region1 } from '../../src/regions/region1';
import { region2 } from '../../src/regions/region2';
import { solvePH } from '../../src/backward/ph';
import { solvePS } from '../../src/backward/ps';

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
});
