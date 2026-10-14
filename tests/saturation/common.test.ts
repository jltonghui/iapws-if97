import { describe, expect, it } from 'vitest';
import {
  qualityFromSaturationProperty,
  saturationEndpointsAtPressure,
  saturationEndpointsAtTemperature,
} from '../../src/saturation/common.js';
import {
  Pc,
  REGION4_SUBCRITICAL_TEMPERATURE_MARGIN,
  Tc,
} from '../../src/constants.js';
import { IF97Error } from '../../src/types.js';

describe('saturation quality calculation', () => {
  it('recovers midpoint quality from a valid near-critical pair', () => {
    const endpoints = saturationEndpointsAtPressure(22.06399);

    for (const property of ['enthalpy', 'entropy'] as const) {
      const liquid = endpoints.liquid[property];
      const vapor = endpoints.vapor[property];
      const midpoint = (liquid + vapor) / 2;
      expect(qualityFromSaturationProperty(liquid, vapor, midpoint)).toBeCloseTo(0.5, 10);
    }
  });

  it('rejects nonphysical EOS phases just below the subcritical safety margin', () => {
    const temperature = Tc - REGION4_SUBCRITICAL_TEMPERATURE_MARGIN;
    expect(() => saturationEndpointsAtTemperature(temperature)).toThrow(IF97Error);
    expect(() => saturationEndpointsAtTemperature(temperature)).toThrow(/numerical.*inconsisten/i);
  });

  it('throws when temperature-side normalization collapses saturation endpoints at the critical point', () => {
    const endpoints = saturationEndpointsAtTemperature(Tc - 2e-9);

    expect(endpoints.pressure).toBe(Pc);
    expect(endpoints.liquid.enthalpy).toBe(endpoints.vapor.enthalpy);

    expect(() =>
      qualityFromSaturationProperty(
        endpoints.liquid.enthalpy,
        endpoints.vapor.enthalpy,
        endpoints.liquid.enthalpy,
      ),
    ).toThrow(IF97Error);
  });

  it('throws when pressure-side normalization collapses saturation endpoints at the critical point', () => {
    const endpoints = saturationEndpointsAtPressure(Pc - 1e-10);

    expect(endpoints.pressure).toBe(Pc);
    expect(endpoints.liquid.enthalpy).toBe(endpoints.vapor.enthalpy);

    expect(() =>
      qualityFromSaturationProperty(
        endpoints.liquid.enthalpy,
        endpoints.vapor.enthalpy,
        endpoints.liquid.enthalpy,
      ),
    ).toThrow(IF97Error);
  });
});
