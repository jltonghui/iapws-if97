import { describe, expect, it } from 'vitest';
import { region1 } from '../../src/regions/region1.js';
import { solve, solvePT } from '../../src/core/solver.js';
import { normalizePublicState } from '../../src/core/public-normalization.js';
import { boundary23_T_to_P } from '../../src/regions/boundaries.js';
import { saturationPressure } from '../../src/regions/region4.js';
import { Pc, Tc } from '../../src/constants.js';

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

  it('preserves PT coordinates when decimal snapping would cross B23', () => {
    const T = 695.15;
    const bits = new BigUint64Array(new Float64Array([T]).buffer);
    bits[0] += 4n;
    const state = solvePT(boundary23_T_to_P(T), new Float64Array(bits.buffer)[0]);
    const normalized = normalizePublicState(state);
    const reconstructed = solvePT(normalized.pressure, normalized.temperature);
    expect(reconstructed.region).toBe(state.region);
    expect(reconstructed.enthalpy).toBe(state.enthalpy);
  });

  it('preserves PT coordinates when decimal snapping would change the Region 3 phase', () => {
    const T = 640;
    const bits = new BigUint64Array(new Float64Array([T]).buffer);
    bits[0] += 1n;
    const state = solvePT(saturationPressure(T), new Float64Array(bits.buffer)[0]);
    const normalized = normalizePublicState(state);
    const reconstructed = solvePT(normalized.pressure, normalized.temperature);
    expect(reconstructed.specificVolume).toBe(state.specificVolume);
    expect(reconstructed.enthalpy).toBe(state.enthalpy);
  });

  it('preserves the Region 3 saturation equation above 623.15 K', () => {
    const bits = new BigUint64Array(new Float64Array([623.15]).buffer);
    bits[0] += 1n;
    const state = solve({ mode: 'Tx', T: new Float64Array(bits.buffer)[0], x: 0.5 });
    const normalized = normalizePublicState(state);
    const reconstructed = solve({ mode: 'Tx', T: normalized.temperature, x: 0.5 });
    expect(reconstructed.enthalpy).toBe(state.enthalpy);
    expect(reconstructed.entropy).toBe(state.entropy);
  });

  it.each(['pressure', 'temperature'] as const)('keeps a finite state beside the critical point reconstructible after normalizing %s', (coordinate) => {
    const bits = new BigUint64Array(new Float64Array([coordinate === 'pressure' ? Pc : Tc]).buffer);
    bits[0] += 1n;
    const value = new Float64Array(bits.buffer)[0];
    const state = solvePT(coordinate === 'pressure' ? value : Pc, coordinate === 'temperature' ? value : Tc);
    const normalized = normalizePublicState(state);
    expect(() => solvePT(normalized.pressure, normalized.temperature)).not.toThrow();
  });
});
