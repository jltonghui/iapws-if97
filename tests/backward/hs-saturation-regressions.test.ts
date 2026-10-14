import { describe, expect, it } from 'vitest';
import { Region, solveHS, solvePT, solvePx, solveTx } from '../../src/index.js';
import { P_MIN } from '../../src/constants.js';
import { tryRegion4HSState } from '../../src/saturation/region4-hs.js';
import { expectBackwardValue, expectRegion4RoundTrip } from '../helpers/backward-assertions.js';

describe('HS saturation coordinate regressions', () => {
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
    expect(tryRegion4HSState(forward.enthalpy, forward.entropy)).toBeNull();
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
