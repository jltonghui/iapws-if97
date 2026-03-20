import { describe, it, expect } from 'vitest';
import { region1 } from '../../src/regions/region1.js';
import { region2 } from '../../src/regions/region2.js';
import { region5 } from '../../src/regions/region5.js';
import { saturationTemperature } from '../../src/regions/region4.js';
import { detectRegionHS } from '../../src/core/region-detector.js';
import { Region } from '../../src/types.js';
import { solveHS } from '../../src/backward/hs.js';

describe('detectRegionHS', () => {
  it('detects Region 1 from known R1 state', () => {
    const state = region1(3, 300);
    expect(detectRegionHS(state.enthalpy, state.entropy)).toBe(Region.Region1);
  });

  it('detects Region 1 from known R1 state (high P)', () => {
    const state = region1(80, 300);
    expect(detectRegionHS(state.enthalpy, state.entropy)).toBe(Region.Region1);
  });

  it('detects Region 2 from known low-P R2 state', () => {
    const state = region2(0.0035, 300);
    expect(detectRegionHS(state.enthalpy, state.entropy)).toBe(Region.Region2);
  });

  it('detects Region 2 from known high-P R2 state', () => {
    const state = region2(30, 700);
    expect(detectRegionHS(state.enthalpy, state.entropy)).toBe(Region.Region2);
  });

  it('detects Region 2 from low-P high-T state', () => {
    const state = region2(0.0035, 700);
    expect(detectRegionHS(state.enthalpy, state.entropy)).toBe(Region.Region2);
  });

  it('detects Region 4 from two-phase state at 1 MPa', () => {
    const Tsat = saturationTemperature(1);
    const liq = region1(1, Tsat);
    const vap = region2(1, Tsat);
    const h = (liq.enthalpy + vap.enthalpy) / 2;
    const s = (liq.entropy + vap.entropy) / 2;
    expect(detectRegionHS(h, s)).toBe(Region.Region4);
  });

  it('detects Region 4 from two-phase state at 0.1 MPa', () => {
    const Tsat = saturationTemperature(0.1);
    const liq = region1(0.1, Tsat);
    const vap = region2(0.1, Tsat);
    const h = liq.enthalpy * 0.7 + vap.enthalpy * 0.3;
    const s = liq.entropy * 0.7 + vap.entropy * 0.3;
    expect(detectRegionHS(h, s)).toBe(Region.Region4);
  });

  it('detects Region 5 from known R5 state', () => {
    const state = region5(0.5, 1500);
    expect(detectRegionHS(state.enthalpy, state.entropy)).toBe(Region.Region5);
  });
});

describe('solveHS backward equations', () => {
  it('R1: round-trip at T=300K, P=3MPa', () => {
    const fwd = region1(3, 300);
    const back = solveHS(fwd.enthalpy, fwd.entropy);
    expect(Math.abs(back.temperature - 300)).toBeLessThan(1);
    expect(Math.abs(back.pressure - 3)).toBeLessThan(0.5);
  });

  it('R1: round-trip at T=500K, P=3MPa', () => {
    const fwd = region1(3, 500);
    const back = solveHS(fwd.enthalpy, fwd.entropy);
    expect(Math.abs(back.temperature - 500)).toBeLessThan(1);
    expect(Math.abs(back.pressure - 3)).toBeLessThan(0.5);
  });

  it('R2: round-trip at T=300K, P=0.0035MPa', () => {
    const fwd = region2(0.0035, 300);
    const back = solveHS(fwd.enthalpy, fwd.entropy);
    expect(Math.abs(back.temperature - 300)).toBeLessThan(2);
  });

  it('R2: round-trip at T=700K, P=30MPa', () => {
    const fwd = region2(30, 700);
    const back = solveHS(fwd.enthalpy, fwd.entropy);
    expect(Math.abs(back.temperature - 700)).toBeLessThan(2);
  });

  it('R2: round-trip at T=700K, P=0.0035MPa', () => {
    const fwd = region2(0.0035, 700);
    const back = solveHS(fwd.enthalpy, fwd.entropy);
    expect(Math.abs(back.temperature - 700)).toBeLessThan(2);
  });

  it('R5: round-trip at T=1500K, P=0.5MPa', () => {
    const fwd = region5(0.5, 1500);
    const back = solveHS(fwd.enthalpy, fwd.entropy);
    expect(Math.abs(back.temperature - 1500)).toBeLessThan(5);
  });

  it('R4: two-phase at 1 MPa, x=0.5', () => {
    const Tsat = saturationTemperature(1);
    const liq = region1(1, Tsat);
    const vap = region2(1, Tsat);
    const h = (liq.enthalpy + vap.enthalpy) / 2;
    const s = (liq.entropy + vap.entropy) / 2;
    const back = solveHS(h, s);
    expect(back.region).toBe(Region.Region4);
    expect(back.quality).toBeGreaterThan(0.3);
    expect(back.quality).toBeLessThan(0.7);
  });
});
