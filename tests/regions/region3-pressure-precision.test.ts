import { describe, expect, it } from 'vitest';
import { region3ByRhoT, region3PressureResidual } from '../../src/regions/region3.js';
import { solveRegion3StateAtPressure } from '../../src/core/region3-pt.js';

describe('Region 3 pressure precision', () => {
  // 100-digit Decimal evaluation of the exact binary64 coefficients, constants
  // and inputs, rounded once to binary64; not the published decimal literals.
  it.each([
    [500, 650, 25.583701818522627],
    [200, 650, 22.293064256610858],
    [500, 750, 78.30956391691726],
    [322, 647.096, 22.063999999951715],
    [321.61665502233404, 647.0959627047504, 22.063990000000135],
    [322.65540626086283, 647.0959627047504, 22.063990000000178],
    [321.49774842237, 647.095951, 22.063986861499632],
    [322.7391636541546, 647.095951, 22.06398686149969],
  ])('preserves pressure at rho=%s, T=%s', (rho, T, pressure) => {
    const state = region3ByRhoT(rho, T);
    expect(state.pressure).toBe(pressure);
    expect(Math.abs(state.enthalpy - state.internalEnergy - 1000 * pressure * state.specificVolume))
      .toBeLessThan(1e-9);
  });

  it('retains the residual hidden by a rounded pressure match', () => {
    const rho = 321.6166368272467;
    const T = 647.0959627047504;
    const pressure = 22.06399;

    expect(region3ByRhoT(rho, T).pressure).toBe(pressure);
    expect(region3PressureResidual(rho, T, pressure)).toBeCloseTo(-1.4167844115463939e-15, 27);
  });

  it.each([
    [327.8662860193438, 322.6554034405599],
    [322.65540626086283, 322.6554034405599],
    [322.65530626086286, 322.6554034405599],
    [322.6555062608628, 322.6554034405599],
    [316.83519291206136, 321.6166370177054],
    [321.61665502233404, 321.6166370177054],
    [321.61655502233407, 321.6166370177054],
    [321.616755022334, 321.6166370177054],
  ])('reconstructs the same stable endpoint from rho0=%s', (seed, expectedRho) => {
    const state = solveRegion3StateAtPressure(22.06399, 647.0959627047504, seed);

    expect(Math.abs(1 / state.specificVolume - expectedRho)).toBeLessThan(1e-8);
    expect(state.cp).toBeGreaterThan(0);
    expect(state.cv).toBeGreaterThan(0);
    expect(state.isothermalCompressibility).toBeGreaterThan(0);
  });
});
