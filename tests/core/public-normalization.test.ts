import { describe, expect, it } from 'vitest';
import { region1 } from '../../src/regions/region1.js';
import { solve, solvePT } from '../../src/core/solver.js';
import { normalizePublicState } from '../../src/core/public-normalization.js';
import { boundary23_T_to_P } from '../../src/regions/boundaries.js';
import { saturationPressure } from '../../src/regions/region4.js';
import { Pc, Pt, Tc } from '../../src/constants.js';

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

  it('copies and normalizes saturation leaves without following nested metadata', () => {
    const state = solve({ mode: 'Px', p: 1, x: 0.5 });
    state.saturation!.liquid.enthalpy = 123.00000000000003;
    Object.assign(state.saturation!.liquid, { saturation: state.saturation });
    const normalized = normalizePublicState(state);

    expect(normalized.saturation).not.toBe(state.saturation);
    expect(normalized.saturation!.liquid).not.toBe(state.saturation!.liquid);
    expect(normalized.saturation!.vapor).not.toBe(state.saturation!.vapor);
    expect(normalized.saturation!.liquid.enthalpy).toBe(123);
    expect(normalized.saturation!.liquid).not.toHaveProperty('saturation');
    expect(() => JSON.stringify(normalized)).not.toThrow();
    state.saturation!.liquid.enthalpy = -1;
    expect(normalized.saturation!.liquid.enthalpy).toBe(123);
  });

  it.each([-1n, 0n, 1n])('keeps endpoint coordinates aligned at a %s ULP offset from 623.15 K', (offset) => {
    const bits = new BigUint64Array(new Float64Array([623.15]).buffer);
    bits[0] += offset;
    const temperature = new Float64Array(bits.buffer)[0];
    const state = solve({ mode: 'Tx', T: temperature, x: 0.5 });
    const normalized = normalizePublicState(state);

    expect(normalized.saturation!.liquid.region).toBe(temperature <= 623.15 ? 1 : 3);
    expect(normalized.saturation!.vapor.region).toBe(temperature <= 623.15 ? 2 : 3);
    for (const endpoint of [normalized.saturation!, normalized.saturation!.liquid, normalized.saturation!.vapor]) {
      expect(endpoint.pressure).toBe(normalized.pressure);
      expect(endpoint.temperature).toBe(normalized.temperature);
    }
  });

  it.each([Pt, 22.06399])('keeps saturation coordinates and valid leaves at p=%s MPa', (pressure) => {
    const normalized = normalizePublicState(solve({ mode: 'Px', p: pressure, x: 0.5 }));

    for (const endpoint of [normalized.saturation!, normalized.saturation!.liquid, normalized.saturation!.vapor]) {
      expect(endpoint.pressure).toBe(normalized.pressure);
      expect(endpoint.temperature).toBe(normalized.temperature);
    }
    expect(normalized.saturation!.vapor.enthalpy).toBeGreaterThan(normalized.saturation!.liquid.enthalpy);
  });

  it('keeps single-phase return shapes free of saturation metadata', () => {
    const state = normalizePublicState(solvePT(3, 300));

    expect(state).not.toHaveProperty('saturation');
  });
});
