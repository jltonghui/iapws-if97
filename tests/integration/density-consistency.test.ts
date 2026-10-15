import { describe, expect, it } from 'vitest';
import * as api from '../../src/index.js';
import type { SolveInput, SteamState } from '../../src/index.js';
import { solve as solveRaw } from '../../src/core/solver.js';
import { normalizePublicState } from '../../src/core/public-normalization.js';
import { region1, region2 } from '../../src/regions.js';

const liquid = region1(3, 300);
const vapor = region2(3, 700);

describe('public density consistency', () => {
  it.each([
    { x: 0.0045169174984844, volumeSnaps: true },
    { x: 0.004537660598538098, volumeSnaps: false },
  ])('preserves the reciprocal when volumeSnaps=$volumeSnaps', ({ x, volumeSnaps }) => {
    const input = { mode: 'Px', p: 1, x } as const;
    const raw = solveRaw(input);
    const state = api.solvePx(1, x);

    expect(raw.density).toBe(1 / raw.specificVolume);
    expect(state.density).toBe(1 / state.specificVolume);
    if (volumeSnaps) {
      expect(raw.specificVolume).not.toBe(state.specificVolume);
      expect(state.specificVolume).toBe(0.002);
      expect(state.density).toBe(500);
    } else {
      expect(state.specificVolume).toBe(raw.specificVolume);
      expect(state.density).toBe(raw.density);
    }
    expect(normalizePublicState(state)).toEqual(state);

    const basic = api.solveBasic(input);
    expect(basic.specificVolume).toBe(state.specificVolume);
    expect(basic).not.toHaveProperty('density');
    for (const endpoint of [state.saturation!.liquid, state.saturation!.vapor]) {
      expect(endpoint).not.toHaveProperty('density');
    }
  });

  const cases: { input: SolveInput; direct: () => SteamState }[] = [
    { input: { mode: 'PT', p: 3, T: 300 }, direct: () => api.solvePT(3, 300) },
    { input: { mode: 'PH', p: 3, h: liquid.enthalpy }, direct: () => api.solvePH(3, liquid.enthalpy) },
    { input: { mode: 'PS', p: 3, s: liquid.entropy }, direct: () => api.solvePS(3, liquid.entropy) },
    { input: { mode: 'HS', h: liquid.enthalpy, s: liquid.entropy }, direct: () => api.solveHS(liquid.enthalpy, liquid.entropy) },
    { input: { mode: 'TH', T: 700, h: vapor.enthalpy }, direct: () => api.solveTH(700, vapor.enthalpy) },
    { input: { mode: 'TS', T: 700, s: vapor.entropy }, direct: () => api.solveTS(700, vapor.entropy) },
    { input: { mode: 'Px', p: 20, x: 0.5 }, direct: () => api.solvePx(20, 0.5) },
    { input: { mode: 'Tx', T: 640, x: 0.5 }, direct: () => api.solveTx(640, 0.5) },
  ];

  it.each(cases)('keeps $input.mode direct, unified, and basic results consistent', ({ input, direct }) => {
    const state = api.solve(input);
    const directState = direct();

    expect(state.density).toBe(1 / state.specificVolume);
    expect(directState.density).toBe(1 / directState.specificVolume);
    expect(directState).toEqual(state);
    expect(api.solveBasic(input).specificVolume).toBe(state.specificVolume);
    expect(normalizePublicState(state)).toEqual(state);
  });
});
