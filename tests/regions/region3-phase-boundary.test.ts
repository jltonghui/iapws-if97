import { describe, expect, it } from 'vitest';
import { solvePT, solveTH, solveTS } from '../../src/index.js';
import { saturationPressure } from '../../src/saturation.js';
import { region3Volume } from '../../src/regions/region3-subregions.js';
import { expectBackwardValue } from '../helpers/backward-assertions.js';

function neighboringPressure(pressure: number, direction: -1 | 1): number {
  const bits = new DataView(new ArrayBuffer(8));
  bits.setFloat64(0, pressure);
  bits.setBigUint64(0, bits.getBigUint64(0) + BigInt(direction));
  return bits.getFloat64(0);
}

describe('Region 3 saturation phase ownership', () => {
  it.each([640, 646, 647.09, 647.094, 647.0949, 647.0959])(
    'keeps vapor below native Psat(T) and liquid on or above it at T=%s K', (T) => {
      const pressure = saturationPressure(T);
      for (const p of [neighboringPressure(pressure, -1), pressure, neighboringPressure(pressure, 1)]) {
        const expectedLiquid = p >= pressure;
        const guessDensity = 1 / region3Volume(p, T);
        const state = solvePT(p, T);
        expect(guessDensity > 322).toBe(expectedLiquid);
        expect(state.density > 322).toBe(expectedLiquid);
      }
    },
  );

  it.each([
    { p: 22.062391296446776, T: 647.09 },
    { p: 22.06346373627226, T: 647.094 },
  ])('preserves vapor when TH/TS pressure is reconstructed at T=$T K', ({ p, T }) => {
    const forward = solvePT(p, T);
    expect(forward.density).toBeLessThan(322);
    for (const recovered of [solveTH(T, forward.enthalpy), solveTS(T, forward.entropy)]) {
      const reconstructed = solvePT(recovered.pressure, T);
      expect(reconstructed.density).toBeLessThan(322);
      expectBackwardValue(reconstructed.enthalpy, forward.enthalpy, 'enthalpy');
      expectBackwardValue(reconstructed.entropy, forward.entropy, 'entropy');
    }
  });
});
