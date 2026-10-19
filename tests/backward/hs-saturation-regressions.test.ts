import { describe, expect, it, vi } from 'vitest';
import { Region, solve, solveBasic, solveHS, solvePT, solvePx, solveTx } from '../../src/index.js';
import { detectRegionHS } from '../../src/detect.js';
import { P_MIN } from '../../src/constants.js';
import * as region4HS from '../../src/saturation/region4-hs.js';
import { expectBackwardValue, expectRegion4RoundTrip } from '../helpers/backward-assertions.js';

describe('HS saturation coordinate regressions', () => {
  it.each([
    { T: 274, x: 3e-11 },
    { T: 288.7579852523744, x: 6.161571519404348e-11 },
  ])('retains an interior mixture when endpoint snapping violates H/S acceptance at T=$T, x=$x', ({ T, x }) => {
    const forward = solveTx(T, x);
    const h = forward.enthalpy;
    const s = forward.entropy;
    expect(detectRegionHS(h, s)).toBe(Region.Region4);

    for (const recovered of [solveHS(h, s), solve({ mode: 'HS', h, s }), solveBasic({ mode: 'HS', h, s })]) {
      expect(recovered.region).toBe(Region.Region4);
      expect(recovered.quality).toBeGreaterThan(0);
      expect(recovered.quality).toBeLessThan(1);
      expect(recovered.cp).toBeNull();
      const checked = solveTx(recovered.temperature, recovered.quality!);
      for (const property of ['enthalpy', 'entropy'] as const) {
        const tolerance = 1e-9 * Math.max(1, Math.abs(forward[property]));
        expect(Math.abs(recovered[property] - forward[property])).toBeLessThanOrEqual(tolerance);
        expect(checked[property]).toBe(recovered[property]);
      }
    }
    expect(solve({ mode: 'HS', h, s }).viscosity).toBeNull();
  });

  it.each([
    { mode: 'Tx', T: 274, x: 0 },
    { mode: 'Tx', T: 274, x: 1 },
    { mode: 'Tx', T: 273.1601, x: 0 },
    { mode: 'Tx', T: 274.15, x: 0 },
    { mode: 'Tx', T: 275, x: 0 },
    { mode: 'Px', p: 0.0006116575, x: 0 },
  ] as const)('preserves a cold exact endpoint and its transport metadata for %o', (input) => {
    const forward = solve(input);
    const recovered = solve({ mode: 'HS', h: forward.enthalpy, s: forward.entropy });
    expect(recovered.region).toBe(Region.Region4);
    expect(recovered.quality).toBe(input.x);
    expect(recovered.cp).not.toBeNull();
    expect(recovered.viscosity).not.toBeNull();
    expect(recovered.saturation).toBeDefined();
  });

  it.each([
    { p: 17.969098460653143, T: 630, x: 1, hTolerance: 1e-7, sTolerance: 1e-10 },
    { p: 16.529164252605597, T: 623.1500000000001, x: 0, hTolerance: 1e-9, sTolerance: 1e-12 },
  ])('recovers the PT-derived saturation endpoint at p=$p, T=$T', ({ p, T, x, hTolerance, sTolerance }) => {
    const forward = solvePT(p, T);
    expect(forward.region).toBe(Region.Region3);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expect(recovered.region).toBe(Region.Region4);
    expect(recovered.quality).toBe(x);
    expect(detectRegionHS(forward.enthalpy, forward.entropy)).toBe(recovered.region);
    const checked = solveTx(recovered.temperature, recovered.quality!);
    expectBackwardValue(checked.enthalpy, forward.enthalpy, 'enthalpy', hTolerance);
    expectBackwardValue(checked.entropy, forward.entropy, 'entropy', sTolerance);
  });

  it.each([0, 1e-9, 0.01, 0.25, 0.5, 0.75, 0.99, 1 - 1e-9, 1])(
    'recovers the first representable Region 3 saturation temperature at x=%s',
    (x) => {
      const view = new DataView(new ArrayBuffer(8));
      view.setFloat64(0, 623.15);
      view.setBigUint64(0, view.getBigUint64(0) + 1n);
      const forward = solveTx(view.getFloat64(0), x);
      const recovered = solveHS(forward.enthalpy, forward.entropy);
      expect(recovered.region).toBe(Region.Region4);
      const checked = solveTx(recovered.temperature, recovered.quality!);
      expectBackwardValue(checked.enthalpy, forward.enthalpy, 'enthalpy', 1e-9);
      expectBackwardValue(checked.entropy, forward.entropy, 'entropy', 1e-12);
    },
  );

  it.each([
    { p: 0.0011223963573834049, x: 0 },
    { p: 0.0011223963573834049, x: 1e-9 },
    { p: 0.001224077351868965, x: 0 },
    { p: 0.001224077351868965, x: 1e-9 },
  ])('resolves the cold endpoint HS Jacobian at p=$p, x=$x', ({ p, x }) => {
    const forward = solvePx(p, x);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expectRegion4RoundTrip(recovered, forward);
  });

  it.each([
    { p: 25.07225811600566, T: 677.15 },
    { p: 37.65664481791373, T: 725.15 },
    { p: 20, T: 623.1500001 },
  ])('validates the adjacent EOS when the HS route is wrong at p=$p, T=$T', ({ p, T }) => {
    const forward = solvePT(p, T);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expect(recovered.region).toBe(forward.region);
    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure');
    expectBackwardValue(recovered.temperature, forward.temperature, 'temperature');
    const checked = solvePT(recovered.pressure, recovered.temperature);
    expectBackwardValue(checked.enthalpy, forward.enthalpy, 'enthalpy');
    expectBackwardValue(checked.entropy, forward.entropy, 'entropy');
  });

  it('rejects a quality-clamped candidate that no longer matches H and S', () => {
    const forward = solvePT(0.0006570887062059462, 274.15);
    expect(region4HS.tryRegion4HSState(forward.enthalpy, forward.entropy)).toBeNull();
  });

  it('keeps the Region 2 initial pressure inside the backward-equation domain', () => {
    const forward = solvePT(P_MIN, 273.16);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expectBackwardValue(recovered.pressure, P_MIN, 'pressure');
    expectBackwardValue(recovered.temperature, forward.temperature, 'temperature');
  });

  it.each([
    { T: 273.26, x: 1e-9 },
    { T: 623.15, x: 0 },
    { T: 623.15, x: 0.25 },
    { T: 623.15, x: 1 },
    { T: 623.150001, x: 1 - 1e-9 },
    { T: 623.150001, x: 1 },
    { T: 646.89, x: 0.95 },
    { T: 646.91, x: 1 },
    { T: 646.9178, x: 0.99 },
    { T: 646.996, x: 0.99 },
    { T: 647.086, x: 1e-7 },
    { T: 647.094, x: 0.25 },
  ])('recovers T=$T K, x=$x through the public API', ({ T, x }) => {
    const forward = solveTx(T, x);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expectRegion4RoundTrip(recovered, forward);
    const checked = solveTx(recovered.temperature, recovered.quality!);
    expectBackwardValue(checked.enthalpy, forward.enthalpy, 'enthalpy');
    expectBackwardValue(checked.entropy, forward.entropy, 'entropy');
  });

  it('recovers a fixed near-critical high-quality HS input as Region 4', () => {
    const h = 2152.9981457100225;
    const s = 4.513425143199791;
    const recovered = solveHS(h, s);
    expect(recovered.region).toBe(Region.Region4);
    expect(recovered.quality).toBeCloseTo(0.99, 8);
    const checked = solveTx(recovered.temperature, recovered.quality!);
    expectBackwardValue(checked.enthalpy, h, 'enthalpy');
    expectBackwardValue(checked.entropy, s, 'entropy');
  });

  it('rejects the metastable Region 3 HS result when saturation recovery fails', () => {
    const saturation = vi.spyOn(region4HS, 'tryRegion4HSState').mockReturnValue(null);
    try {
      expect(() => solveHS(2152.9981457100225, 4.513425143199791))
        .toThrow(/^solveHS failed to match enthalpy:/);
    } finally {
      saturation.mockRestore();
    }
  });

  it('returns a physical state when both sides of the formula seam match H and S', () => {
    const first = solveTx(623.1499, 0.99);
    const second = solveTx(623.1504447947154, 0.9899607898341736);
    expectBackwardValue(second.enthalpy, first.enthalpy, 'enthalpy', 1e-9);
    expectBackwardValue(second.entropy, first.entropy, 'entropy', 1e-12);
    const recovered = solveHS(first.enthalpy, first.entropy);
    const checked = solveTx(recovered.temperature, recovered.quality!);
    expectBackwardValue(checked.enthalpy, first.enthalpy, 'enthalpy');
    expectBackwardValue(checked.entropy, first.entropy, 'entropy');
  });

  it('preserves the near-critical vapor endpoint and its transport properties', () => {
    const forward = solvePx(22.06399, 1);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expectRegion4RoundTrip(recovered, forward);
    expect(recovered.quality).toBe(1);
    expect(recovered.cp).not.toBeNull();
    expect(recovered.viscosity).not.toBeNull();
  });

  it.each([22.0639, 22.06399])('preserves the near-critical liquid endpoint at p=%s', (p) => {
    const forward = solvePx(p, 0);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expectRegion4RoundTrip(recovered, forward);
    expect(recovered.quality).toBe(0);
    expect(recovered.cp).not.toBeNull();
    expect(recovered.viscosity).not.toBeNull();
  });

  it.each([
    { p: 22.0639, x: 1e-7 },
    { p: 22.0639, x: 1 - 1e-7 },
    { p: 22.06399, x: 1e-7 },
    { p: 22.06399, x: 1 - 1e-7 },
  ])('keeps a near-endpoint mixture at p=$p, x=$x', ({ p, x }) => {
    const forward = solvePx(p, x);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expectRegion4RoundTrip(recovered, forward);
    expect(recovered.quality).toBeGreaterThan(0);
    expect(recovered.quality).toBeLessThan(1);
    expect(recovered.cp).toBeNull();
    expect(recovered.viscosity).toBeNull();
  });
});
