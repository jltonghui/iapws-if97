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
import { expectDigitsClose } from '../helpers/assertions.js';

describe('saturation quality calculation', () => {
  it('preserves midpoint quality just below the subcritical safety margin', () => {
    const temperature = Tc - REGION4_SUBCRITICAL_TEMPERATURE_MARGIN;
    const endpoints = saturationEndpointsAtTemperature(temperature);

    const enthalpyQuality = qualityFromSaturationProperty(
      endpoints.liquid.enthalpy,
      endpoints.vapor.enthalpy,
      (endpoints.liquid.enthalpy + endpoints.vapor.enthalpy) / 2,
    );
    const entropyQuality = qualityFromSaturationProperty(
      endpoints.liquid.entropy,
      endpoints.vapor.entropy,
      (endpoints.liquid.entropy + endpoints.vapor.entropy) / 2,
    );

    expectDigitsClose(enthalpyQuality, 0.5, 6);
    expectDigitsClose(entropyQuality, 0.5, 6);
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
