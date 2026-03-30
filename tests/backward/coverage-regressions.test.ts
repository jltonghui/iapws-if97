import { describe, expect, it } from 'vitest';
import { solvePT } from '../../src/core/solver.js';
import { solvePH } from '../../src/backward/ph.js';
import { solvePS } from '../../src/backward/ps.js';
import { solveHS } from '../../src/backward/hs.js';
import { saturationEndpointsAtPressure } from '../../src/saturation/common.js';
import { Pc, R3_H_CRT, R3_S_CRT } from '../../src/constants.js';
import { IF97Error, Region } from '../../src/types.js';
import { expectBackwardValue } from '../helpers/backward-assertions.js';

describe('backward solver coverage regressions', () => {
  it('covers Region 3 round trips for PH and PS', () => {
    const forward = solvePT(25, 650);

    const fromPH = solvePH(forward.pressure, forward.enthalpy);
    const fromPS = solvePS(forward.pressure, forward.entropy);

    expect(fromPH.region).toBe(Region.Region3);
    expectBackwardValue(fromPH.temperature, forward.temperature, 'temperature', 5e-4);
    expectBackwardValue(fromPH.pressure, forward.pressure, 'pressure', 5e-4);

    expect(fromPS.region).toBe(Region.Region3);
    expectBackwardValue(fromPS.temperature, forward.temperature, 'temperature', 5e-4);
    expectBackwardValue(fromPS.pressure, forward.pressure, 'pressure', 5e-4);
  });

  it('covers Region 5 round trips for PH, PS, and HS', () => {
    const forward = solvePT(30, 1500);

    const fromPH = solvePH(forward.pressure, forward.enthalpy);
    const fromPS = solvePS(forward.pressure, forward.entropy);
    const fromHS = solveHS(forward.enthalpy, forward.entropy);

    expect(fromPH.region).toBe(Region.Region5);
    expectBackwardValue(fromPH.temperature, forward.temperature, 'temperature', 5e-4);

    expect(fromPS.region).toBe(Region.Region5);
    expectBackwardValue(fromPS.temperature, forward.temperature, 'temperature', 5e-4);

    expect(fromHS.region).toBe(Region.Region5);
    expectBackwardValue(fromHS.temperature, forward.temperature, 'temperature', 5e-4);
    expectBackwardValue(fromHS.pressure, forward.pressure, 'pressure', 5e-4);
  });
});

describe('backward solver validity guards', () => {
  it('solvePH routes a former false Region 4 match into the correct Region 3 solution', () => {
    const state = solvePH(19.996756568756535, 1783.583958931849);

    expect(state.region).toBe(Region.Region3);
    expect(state.quality).toBeNull();
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

  it('solvePH rejects the critical-point saturation endpoint', () => {
    expect(() => solvePH(Pc, R3_H_CRT)).toThrow(IF97Error);
    expect(() => solvePH(Pc, R3_H_CRT)).toThrow(/critical/i);
  });

  it('solvePS rejects the critical-point saturation endpoint', () => {
    expect(() => solvePS(Pc, R3_S_CRT)).toThrow(IF97Error);
    expect(() => solvePS(Pc, R3_S_CRT)).toThrow(/critical/i);
  });

  it('solvePH rejects near-critical pressure inputs that snap to the critical saturation endpoint', () => {
    const endpoints = saturationEndpointsAtPressure(Pc - 1e-10);
    const h = (endpoints.liquid.enthalpy + endpoints.vapor.enthalpy) / 2;

    expect(() => solvePH(Pc - 1e-10, h)).toThrow(IF97Error);
    expect(() => solvePH(Pc - 1e-10, h)).toThrow(/critical/i);
  });

  it('solvePS rejects near-critical pressure inputs that snap to the critical saturation endpoint', () => {
    const endpoints = saturationEndpointsAtPressure(Pc - 1e-10);
    const s = (endpoints.liquid.entropy + endpoints.vapor.entropy) / 2;

    expect(() => solvePS(Pc - 1e-10, s)).toThrow(IF97Error);
    expect(() => solvePS(Pc - 1e-10, s)).toThrow(/critical/i);
  });

  it('solveHS rejects the critical point instead of returning a Region 3 state', () => {
    expect(() => solveHS(R3_H_CRT, R3_S_CRT)).toThrow(IF97Error);
    expect(() => solveHS(R3_H_CRT, R3_S_CRT)).toThrow(/critical/i);
  });
});
