import type { BasicProperties } from '../types.js';
import { Region } from '../types.js';
import { Pc, R2_T_MIN, RHOc } from '../constants.js';
import { region1 } from '../regions/region1.js';
import { region2 } from '../regions/region2.js';
import { region3ByRhoT } from '../regions/region3.js';
import { saturationPressure, saturationTemperature } from '../regions/region4.js';
import { region3SatVolume } from '../regions/region3-subregions.js';
import { newtonRaphson } from '../solvers/newton-raphson.js';

export interface SaturationEndpoints {
  pressure: number;
  temperature: number;
  liquid: BasicProperties;
  vapor: BasicProperties;
}

function withRegion4Metadata(state: BasicProperties, quality: number): BasicProperties {
  return { ...state, region: Region.Region4, quality };
}

function solveR3Density(p: number, T: number, x: 0 | 1): number {
  const v0 = region3SatVolume(p, T, x);
  return newtonRaphson(
    (rho) => region3ByRhoT(rho, T).pressure - p,
    1 / v0,
  );
}

function clampQuality(x: number): number {
  if (x <= 0 && x > -1e-12) return 0;
  if (x >= 1 && x < 1 + 1e-12) return 1;
  return Math.max(0, Math.min(1, x));
}

export function saturationEndpointsAtPressure(p: number): SaturationEndpoints {
  const temperature = saturationTemperature(p);

  if (Math.abs(p - Pc) < 1e-10) {
    const state = region3ByRhoT(RHOc, temperature);
    return { pressure: p, temperature, liquid: state, vapor: state };
  }

  if (temperature > R2_T_MIN) {
    return {
      pressure: p,
      temperature,
      liquid: region3ByRhoT(solveR3Density(p, temperature, 0), temperature),
      vapor: region3ByRhoT(solveR3Density(p, temperature, 1), temperature),
    };
  }

  return {
    pressure: p,
    temperature,
    liquid: region1(p, temperature),
    vapor: region2(p, temperature),
  };
}

export function saturationEndpointsAtTemperature(T: number): SaturationEndpoints {
  return saturationEndpointsAtPressure(saturationPressure(T));
}

export function qualityFromSaturationProperty(
  liquidValue: number,
  vaporValue: number,
  mixtureValue: number,
): number {
  return clampQuality((mixtureValue - liquidValue) / (vaporValue - liquidValue));
}

export function mixSaturationState(
  endpoints: SaturationEndpoints,
  qualityInput: number,
): BasicProperties {
  const quality = clampQuality(qualityInput);
  const { liquid, vapor, pressure, temperature } = endpoints;

  if (quality === 0) {
    return withRegion4Metadata(liquid, 0);
  }

  if (quality === 1) {
    return withRegion4Metadata(vapor, 1);
  }

  return {
    region: Region.Region4,
    pressure,
    temperature,
    specificVolume: liquid.specificVolume * (1 - quality) + vapor.specificVolume * quality,
    internalEnergy: liquid.internalEnergy * (1 - quality) + vapor.internalEnergy * quality,
    entropy: liquid.entropy * (1 - quality) + vapor.entropy * quality,
    enthalpy: liquid.enthalpy * (1 - quality) + vapor.enthalpy * quality,
    cp: null,
    cv: null,
    speedOfSound: null,
    quality,
    isobaricExpansion: null,
    isothermalCompressibility: null,
  };
}
