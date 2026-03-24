import { describe, expect, it } from 'vitest';
import { solvePT } from '../../src/core/solver.js';
import { solvePH } from '../../src/backward/ph.js';
import { solvePS } from '../../src/backward/ps.js';
import { solveHS } from '../../src/backward/hs.js';
import { solvePx, solveTx } from '../../src/saturation/two-phase.js';
import { IF97Error, OutOfRangeError, Region } from '../../src/types.js';

describe('backward solver coverage regressions', () => {
  it('covers Region 3 round trips for PH and PS', () => {
    const forward = solvePT(25, 650);

    const fromPH = solvePH(forward.pressure, forward.enthalpy);
    const fromPS = solvePS(forward.pressure, forward.entropy);

    expect(fromPH.region).toBe(Region.Region3);
    expect(fromPH.temperature).toBeCloseTo(forward.temperature, 3);
    expect(fromPH.pressure).toBeCloseTo(forward.pressure, 3);

    expect(fromPS.region).toBe(Region.Region3);
    expect(fromPS.temperature).toBeCloseTo(forward.temperature, 3);
    expect(fromPS.pressure).toBeCloseTo(forward.pressure, 3);
  });

  it('covers Region 5 round trips for PH, PS, and HS', () => {
    const forward = solvePT(30, 1500);

    const fromPH = solvePH(forward.pressure, forward.enthalpy);
    const fromPS = solvePS(forward.pressure, forward.entropy);
    const fromHS = solveHS(forward.enthalpy, forward.entropy);

    expect(fromPH.region).toBe(Region.Region5);
    expect(fromPH.temperature).toBeCloseTo(forward.temperature, 3);

    expect(fromPS.region).toBe(Region.Region5);
    expect(fromPS.temperature).toBeCloseTo(forward.temperature, 3);

    expect(fromHS.region).toBe(Region.Region5);
    expect(fromHS.temperature).toBeCloseTo(forward.temperature, 3);
    expect(fromHS.pressure).toBeCloseTo(forward.pressure, 3);
  });
});

describe('two-phase input guards', () => {
  it('rejects out-of-range quality and temperature inputs', () => {
    expect(() => solvePx(1, -0.01)).toThrow(OutOfRangeError);
    expect(() => solvePx(1, 1.01)).toThrow(OutOfRangeError);
    expect(() => solveTx(200, 0.5)).toThrow(OutOfRangeError);
    expect(() => solveTx(700, 1.5)).toThrow(OutOfRangeError);
  });
});

describe('backward solver validity guards', () => {
  it('solvePH rejects a false Region 4 endpoint match', () => {
    expect(() => solvePH(19.996756568756535, 1783.583958931849)).toThrow(IF97Error);
  });

  it('solvePH rejects a false Region 5 state above the IF97 temperature ceiling', () => {
    expect(() => solvePH(38.09426710643904, 7375.591808802688)).toThrow(IF97Error);
  });

  it('solvePS rejects a false Region 2 state outside the IF97 PT envelope', () => {
    expect(() => solvePS(71.99643178391858, 5.870236071132793)).toThrow(IF97Error);
  });

  it('solvePS rejects a false Region 5 state above the IF97 temperature ceiling', () => {
    expect(() => solvePS(33.914565781003844, 9.410102343702885)).toThrow(IF97Error);
  });
});
