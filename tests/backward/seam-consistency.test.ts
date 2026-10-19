import { describe, expect, it } from 'vitest';
import {
  AmbiguousStateError, IF97Error, Region, solve, solveBasic,
  solveHS, solvePH, solvePS, solvePT, solveTH, solveTS,
  type BasicProperties, type SolveInput,
} from '../../src/index.js';
import {
  detectRegionHS, detectRegionPH, detectRegionPS, detectRegionPT, detectRegionTH, detectRegionTS,
} from '../../src/detect.js';
import { boundary23_P_to_T, boundary23_T_to_P } from '../../src/boundaries.js';
import { P_MIN } from '../../src/constants.js';
import { solveRegion3PTBasic } from '../../src/core/region3-pt.js';
import { formulationSeamAtPressure } from '../../src/core/formulation-seams.js';
import { region1 } from '../../src/regions/region1.js';
import { region2 } from '../../src/regions/region2.js';
import { region5 } from '../../src/regions/region5.js';

function adjacent(value: number, direction: -1 | 1): number {
  const bits = new BigUint64Array(new Float64Array([value]).buffer);
  bits[0] += BigInt(direction);
  return new Float64Array(bits.buffer)[0];
}

function expectEOS(state: BasicProperties): void {
  const reconstructed = solvePT(state.pressure, state.temperature);
  expect(reconstructed.region).toBe(state.region);
  expect(Math.abs(reconstructed.enthalpy - state.enthalpy)).toBeLessThan(1e-7);
  expect(Math.abs(reconstructed.entropy - state.entropy)).toBeLessThan(1e-10);
}

function expectLocalResidual(
  state: BasicProperties, targets: Partial<Pick<BasicProperties, 'enthalpy' | 'entropy'>>,
  first: BasicProperties, second: BasicProperties,
): void {
  for (const property of ['enthalpy', 'entropy'] as const) {
    const target = targets[property];
    if (target !== undefined) {
      const tolerance = property === 'enthalpy' ? 1e-7 : 1e-10;
      expect(Math.abs(state[property] - target)).toBeLessThanOrEqual(Math.abs(first[property] - second[property]) + tolerance);
    }
  }
  expectEOS(state);
}

describe('formulation seam consistency', () => {
  it.each(['PH', 'PS'] as const)('preserves the saturated vapor endpoint at the 623.15 K corner in %s', (mode) => {
    const forward = solvePT(16.52916425260358, 623.15);
    expect(forward.region).toBe(Region.Region2);
    const detected = mode === 'PH'
      ? detectRegionPH(forward.pressure, forward.enthalpy)
      : detectRegionPS(forward.pressure, forward.entropy);
    expect(detected).toBe(Region.Region4);
    const state = mode === 'PH'
      ? solvePH(forward.pressure, forward.enthalpy)
      : solvePS(forward.pressure, forward.entropy);
    expect(state.region).toBe(Region.Region4);
    expect(state.quality).toBe(1);
    expect(state.pressure).toBe(forward.pressure);
    if (mode === 'PH') expect(Math.abs(state.enthalpy - forward.enthalpy)).toBeLessThan(1e-7);
    else expect(Math.abs(state.entropy - forward.entropy)).toBeLessThan(1e-10);
    const vapor = region2(state.pressure, state.temperature);
    expect(Math.abs(state.enthalpy - vapor.enthalpy)).toBeLessThan(1e-7);
    expect(Math.abs(state.entropy - vapor.entropy)).toBeLessThan(1e-10);
  });

  it.each([650, 660, 700, 750, 800, 850])('resolves B23 numerical overlaps and gaps at T=%s K', (T) => {
    const p = boundary23_T_to_P(T);
    const r2 = region2(p, T);
    const r3 = solveRegion3PTBasic(p, T);
    const h = (r2.enthalpy + r3.enthalpy) / 2;
    const s = (r2.entropy + r3.entropy) / 2;
    const fromTH = solveTH(T, h);
    const fromTS = solveTS(T, s);
    const fromPH = solvePH(p, h);
    const fromPS = solvePS(p, s);
    const fromHS = solveHS(h, s);

    for (const state of [fromTH, fromTS, fromPH, fromPS, fromHS]) {
      expect(state.region).toBe(Region.Region3);
    }
    for (const state of [fromTH, fromPH]) expectLocalResidual(state, { enthalpy: h }, r2, r3);
    for (const state of [fromTS, fromPS]) expectLocalResidual(state, { entropy: s }, r2, r3);
    expectLocalResidual(fromHS, { enthalpy: h, entropy: s }, r2, r3);
    expect(fromTH.temperature).toBe(T);
    expect(fromTS.temperature).toBe(T);
    expect(Math.abs(fromPH.pressure - p)).toBeLessThanOrEqual(1e-9 * p);
    expect(Math.abs(fromPS.pressure - p)).toBeLessThanOrEqual(1e-9 * p);
    if (r3.enthalpy > r2.enthalpy) {
      expect(Math.abs(fromTH.enthalpy - h)).toBeLessThan(1e-8);
      expect(Math.abs(fromPH.enthalpy - h)).toBeLessThan(1e-8);
      expect(Math.abs(fromTS.entropy - s)).toBeLessThan(1e-11);
      expect(Math.abs(fromPS.entropy - s)).toBeLessThan(1e-11);
    } else {
      expect(fromTH.pressure).toBe(p);
      expect(fromTS.pressure).toBe(p);
      expect(Math.abs(fromPH.temperature - T)).toBeLessThan(1e-8);
      expect(Math.abs(fromPS.temperature - T)).toBeLessThan(1e-8);
      expect(Math.abs(fromHS.pressure - boundary23_T_to_P(fromHS.temperature))).toBeLessThan(1e-8);
    }
    expect(detectRegionTH(T, h)).toBe(fromTH.region);
    expect(detectRegionTS(T, s)).toBe(fromTS.region);
    expect(detectRegionPH(p, h)).toBe(fromPH.region);
    expect(detectRegionPS(p, s)).toBe(fromPS.region);
    expect(detectRegionHS(h, s)).toBe(fromHS.region);
  });

  it('returns the real B23 EOS state for the reported PH gap input', () => {
    const state = solvePH(30, 2611.8);
    expect(state.region).toBe(Region.Region3);
    expect(state.pressure).toBe(30);
    expect(Math.abs(state.temperature - boundary23_P_to_T(30))).toBeLessThan(1e-8);
    expect(state.enthalpy).not.toBe(2611.8);
    expect(Math.abs(state.enthalpy - 2611.8)).toBeLessThan(0.122);
    expectEOS(state);
  });

  it.each([
    { seam: 'B23', mode: 'PH', p: 60.25318929969272, T: 785.751452358067, target: 2659.4364744850222, region: Region.Region2 },
    { seam: 'B13', mode: 'PH', p: 16.529164252685465, T: 623.1500000000015, target: 1670.8888842641024, region: Region.Region3 },
    { seam: 'B13', mode: 'PS', p: 16.529164252685465, T: 623.1500000000015, target: 3.778323558769775, region: Region.Region3 },
  ])('recovers the available $seam $mode root above the seam', ({ mode, p, T, target, region }) => {
    const property = mode === 'PH' ? 'enthalpy' : 'entropy';
    const tolerance = mode === 'PH' ? 1e-9 : 1e-12;
    const forward = solvePT(p, T);
    expect(forward.region).toBe(region);
    expect(Math.abs(forward[property] - target)).toBeLessThanOrEqual(tolerance);
    const recovered = mode === 'PH' ? solvePH(p, target) : solvePS(p, target);
    expect(recovered.pressure).toBe(p);
    for (const state of [recovered, solvePT(p, recovered.temperature)]) {
      expect(state.region).toBe(region);
      expect(Math.abs(state[property] - target)).toBeLessThanOrEqual(tolerance);
    }
    expectEOS(recovered);
    expect(mode === 'PH' ? detectRegionPH(p, target) : detectRegionPS(p, target)).toBe(region);
  });

  it('recovers the available Region 5 HS root above the 1073.15 K seam', () => {
    const h = 3947.8943977281956, s = 6.584737010570348;
    const forward = solvePT(45.316819982352996, 1073.1500000000103);
    expect(forward.region).toBe(Region.Region5);
    expect(Math.abs(forward.enthalpy - h)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(forward.entropy - s)).toBeLessThanOrEqual(1e-12);
    const recovered = solveHS(h, s);
    for (const state of [recovered, solvePT(recovered.pressure, recovered.temperature)]) {
      expect(state.region).toBe(Region.Region5);
      expect(Math.abs(state.enthalpy - h)).toBeLessThanOrEqual(1e-9);
      expect(Math.abs(state.entropy - s)).toBeLessThanOrEqual(1e-12);
    }
    expectEOS(recovered);
    expect(detectRegionHS(h, s)).toBe(Region.Region5);
  });

  it('preserves Region 1 ownership when HS round-trips the 623.15 K seam', () => {
    const forward = solvePT(66, 623.15);
    for (const state of [solvePH(66, forward.enthalpy), solvePS(66, forward.entropy),
      solveHS(forward.enthalpy, forward.entropy)]) {
      expect(state.region).toBe(Region.Region1);
      expect(Math.abs(state.pressure - 66)).toBeLessThan(1e-6);
      expect(Math.abs(state.temperature - 623.15)).toBeLessThan(1e-7);
      expectEOS(state);
    }
  });

  it.each([30, 50])('resolves coupled Region 2/5 seam residuals at p=%s MPa', (p) => {
    const T = 1073.15;
    const r2 = region2(p, T);
    const r5 = region5(p, T);
    const h = (r2.enthalpy + r5.enthalpy) / 2;
    const s = (r2.entropy + r5.entropy) / 2;
    const fromPH = solvePH(p, h);
    const fromPS = solvePS(p, s);
    const fromHS = solveHS(h, s);
    const fromTH = solveTH(T, h), fromTS = solveTS(T, s);
    for (const state of [fromPH, fromPS, fromHS, fromTH, fromTS]) {
      expect(state.region).toBe(Region.Region2);
    }
    for (const state of [fromPH, fromTH]) expectLocalResidual(state, { enthalpy: h }, r2, r5);
    for (const state of [fromPS, fromTS]) expectLocalResidual(state, { entropy: s }, r2, r5);
    expectLocalResidual(fromHS, { enthalpy: h, entropy: s }, r2, r5);
    expect(fromPH.temperature).toBe(T);
    expect(fromPH.enthalpy).not.toBe(h);
    expect(fromHS.temperature).toBe(T);
    if (p === 50) {
      expect(fromPS.temperature).toBe(T);
      expect(fromPS.entropy).not.toBe(s);
    } else {
      expect(fromPS.temperature).toBeLessThan(T);
      expect(Math.abs(fromPS.entropy - s)).toBeLessThan(1e-11);
    }
    expect(detectRegionPH(p, h)).toBe(Region.Region2);
    expect(detectRegionPS(p, s)).toBe(Region.Region2);
    expect(detectRegionHS(h, s)).toBe(Region.Region2);
  });

  it.each(['PH', 'PS', 'HS', 'TH', 'TS'] as const)('shares seam results through named, unified, and basic %s entry points', (mode) => {
    const T = 700, p = boundary23_T_to_P(T);
    const r2 = region2(p, T), r3 = solveRegion3PTBasic(p, T);
    const h = (r2.enthalpy + r3.enthalpy) / 2;
    const s = (r2.entropy + r3.entropy) / 2;
    const inputs: Record<typeof mode, SolveInput> = {
      PH: { mode: 'PH', p, h }, PS: { mode: 'PS', p, s }, HS: { mode: 'HS', h, s },
      TH: { mode: 'TH', T, h }, TS: { mode: 'TS', T, s },
    };
    const direct = {
      PH: () => solvePH(p, h), PS: () => solvePS(p, s), HS: () => solveHS(h, s),
      TH: () => solveTH(T, h), TS: () => solveTS(T, s),
    }[mode]();
    const unified = solve(inputs[mode]);
    const basic = solveBasic(inputs[mode]);
    expect(unified).toEqual(direct);
    for (const key of ['region', 'pressure', 'temperature', 'enthalpy', 'entropy', 'specificVolume'] as const) {
      expect(basic[key]).toBe(direct[key]);
    }
    expectEOS(basic);
  });

  it('keeps exact floating-point B23 endpoint roots on their real side', () => {
    for (const T of [700, 850]) {
      const p = adjacent(boundary23_T_to_P(T), -1);
      const forward = solvePT(p, T);
      for (const state of [solveTH(T, forward.enthalpy), solveTS(T, forward.entropy)]) {
        expect(state.region).toBe(Region.Region2);
        expect(state.pressure).toBeLessThan(boundary23_T_to_P(T));
        expectEOS(state);
      }
    }
  });

  it('keeps PT seam ownership and does not extend Region 5 above 50 MPa', () => {
    expect(detectRegionPT(66, 623.15)).toBe(Region.Region1);
    expect(detectRegionPT(boundary23_T_to_P(700), 700)).toBe(Region.Region3);
    expect(detectRegionPT(50, 1073.15)).toBe(Region.Region2);
    const p = adjacent(50, 1);
    const h = (region2(p, 1073.15).enthalpy + region5(p, 1073.15).enthalpy) / 2;
    const s = (region2(p, 1073.15).entropy + region5(p, 1073.15).entropy) / 2;
    expect(detectRegionPH(p, h)).toBe(-1);
    expect(detectRegionPS(p, s)).toBe(-1);
    expect(() => solvePH(p, h)).toThrow(IF97Error);
    expect(() => solvePS(p, s)).toThrow(IF97Error);
  });

  it.each([
    ...[16.53, 20, 22, 30, 50, 80].map((p) => ({ seam: '13', p, fraction: 1 })),
    { seam: '13', p: 99.999, fraction: 0.9 },
    { seam: '13', p: 100, fraction: 0.5 },
    { seam: '13', p: 100, fraction: 1 },
    { seam: '23', p: 30, fraction: 1 },
    { seam: '23', p: 66, fraction: 1 },
    { seam: '23', p: 99.999, fraction: 0.9 },
    { seam: '23', p: 100, fraction: 0.5 },
    { seam: '25', p: P_MIN, fraction: 1 },
    { seam: '25', p: 1, fraction: 0.5 },
    { seam: '25', p: 30, fraction: 0.5 },
    { seam: '25', p: 50, fraction: 1 },
  ])('keeps HS detection and recovery consistent at B$seam, p=$p MPa, fraction=$fraction', ({ seam, p, fraction }) => {
    const T = seam === '13' ? 623.15 : seam === '23' ? formulationSeamAtPressure(p, '23')!.temperature : 1073.15;
    const lower = seam === '13' ? region1(p, T) : seam === '23' ? solveRegion3PTBasic(p, T) : region2(p, T);
    const upper = seam === '13' ? solveRegion3PTBasic(p, T) : seam === '23' ? region2(p, T) : region5(p, T);
    const h = lower.enthalpy + fraction * (upper.enthalpy - lower.enthalpy);
    const entropy = lower.entropy + fraction * (upper.entropy - lower.entropy);
    const detected = detectRegionHS(h, entropy);
    const recovered = solveHS(h, entropy);
    expect(detected).toBe(recovered.region);
    expectLocalResidual(recovered, { enthalpy: h, entropy }, lower, upper);
  });

  it('retains genuine ambiguity between two roots in one formulation region', () => {
    const h = solvePT(6.506932487320858, 523.15).enthalpy + 1e-6;
    const s = solvePT(18.91573061865241, 273.155).entropy - 1e-7;
    expect(() => solveTH(523.15, h)).toThrow(AmbiguousStateError);
    expect(() => solveTS(273.155, s)).toThrow(AmbiguousStateError);
    expect(() => detectRegionTH(523.15, h)).toThrow(AmbiguousStateError);
    expect(() => detectRegionTS(273.155, s)).toThrow(AmbiguousStateError);
  });
});
