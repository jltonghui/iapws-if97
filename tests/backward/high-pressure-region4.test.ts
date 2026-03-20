import { describe, expect, it } from 'vitest';
import { solveHS } from '../../src/backward/hs.js';
import { solvePH } from '../../src/backward/ph.js';
import { solvePS } from '../../src/backward/ps.js';
import { solvePx } from '../../src/saturation/two-phase.js';
import { Region } from '../../src/types.js';

describe('high-pressure Region 4 backward solvers', () => {
  it('solvePH preserves a Region 4 state above 623.15 K', () => {
    const forward = solvePx(20, 0.4);
    const backward = solvePH(20, forward.enthalpy);

    expect(backward.region).toBe(Region.Region4);
    expect(backward.temperature).toBeCloseTo(forward.temperature, 6);
    expect(backward.quality).toBeCloseTo(forward.quality!, 6);
    expect(backward.specificVolume).toBeCloseTo(forward.specificVolume, 6);
  });

  it('solvePS preserves a Region 4 state above 623.15 K', () => {
    const forward = solvePx(20, 0.4);
    const backward = solvePS(20, forward.entropy);

    expect(backward.region).toBe(Region.Region4);
    expect(backward.temperature).toBeCloseTo(forward.temperature, 6);
    expect(backward.quality).toBeCloseTo(forward.quality!, 6);
    expect(backward.specificVolume).toBeCloseTo(forward.specificVolume, 6);
  });

  it('solveHS preserves a high-pressure Region 4 state', () => {
    const forward = solvePx(20, 0.4);
    const backward = solveHS(forward.enthalpy, forward.entropy);

    expect(backward.region).toBe(Region.Region4);
    expect(backward.pressure).toBeCloseTo(forward.pressure, 5);
    expect(backward.temperature).toBeCloseTo(forward.temperature, 5);
    expect(backward.quality).toBeCloseTo(forward.quality!, 5);
    expect(backward.specificVolume).toBeCloseTo(forward.specificVolume, 5);
  });
});
