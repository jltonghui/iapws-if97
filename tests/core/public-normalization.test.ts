import { describe, expect, it } from 'vitest';
import { region1 } from '../../src/regions/region1.js';
import { solve } from '../../src/core/solver.js';
import { normalizePublicState } from '../../src/core/public-normalization.js';

describe('normalizePublicState', () => {
  it('normalizes BasicProperties numeric fields without changing region metadata', () => {
    const state = region1(3, 300);
    const normalized = normalizePublicState({
      ...state,
      pressure: 3.0000000000000004,
      temperature: 300.00000000000006,
    });

    expect(normalized.region).toBe(state.region);
    expect(normalized.pressure).toBe(3);
    expect(normalized.temperature).toBe(300);
  });

  it('normalizes SteamState transport fields while preserving null transport values', () => {
    const state = solve({ mode: 'Px', p: 1, x: 0.5 });
    const normalized = normalizePublicState({
      ...state,
      pressure: 1.0000000000000002,
      surfaceTension: 0.042 + Number.EPSILON,
    });

    expect(normalized.region).toBe(state.region);
    expect(normalized.pressure).toBe(1);
    expect(normalized.surfaceTension).toBe(0.042);
    expect(normalized.viscosity).toBeNull();
    expect(normalized.thermalConductivity).toBeNull();
    expect(normalized.dielectricConstant).toBeNull();
    expect(normalized.ionizationConstant).toBeNull();
  });
});
