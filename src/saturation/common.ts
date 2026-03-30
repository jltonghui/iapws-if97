/**
 * Saturation-line utilities.
 *
 * Computes saturated liquid / vapour endpoint properties along the
 * two-phase boundary, and provides helpers for quality interpolation
 * and two-phase mixing.
 */
import type { BasicProperties } from '../types.js';
import { IF97Error, Region } from '../types.js';
import { Pc, R2_T_MIN, RHOc, Tt } from '../constants.js';
import { region1 } from '../regions/region1.js';
import { region2 } from '../regions/region2.js';
import { region3ByRhoT } from '../regions/region3.js';
import { saturationPressure, saturationTemperature } from '../regions/region4.js';
import { region3SatVolume } from '../regions/region3-subregions.js';
import { newtonRaphson } from '../solvers/newton-raphson.js';
import {
  normalizeRegion4Pressure,
  normalizeRegion4Temperature,
} from './region4-boundaries.js';

/** Saturated liquid and vapour properties at a given saturation state. */
export interface SaturationEndpoints {
  pressure: number;
  temperature: number;
  liquid: BasicProperties;
  vapor: BasicProperties;
}

/** Tag a single-phase state as Region 4 with the given vapour quality. */
function withRegion4Metadata(state: BasicProperties, quality: number): BasicProperties {
  return { ...state, region: Region.Region4, quality };
}

/**
 * Iteratively solve for Region 3 density at saturation.
 *
 * @param p - Saturation pressure [MPa]
 * @param T - Saturation temperature [K]
 * @param x - Phase indicator: 0 = liquid, 1 = vapour
 */
function solveR3Density(p: number, T: number, x: 0 | 1): number {
  const v0 = region3SatVolume(p, T, x);
  return newtonRaphson(
    (rho) => {
      if (!Number.isFinite(rho) || rho <= 0) {
        return Number.NaN;
      }
      return region3ByRhoT(rho, T).pressure - p;
    },
    1 / v0,
  );
}

/** Clamp vapour quality to [0, 1], snapping near-zero/one values to the boundary. */
function clampQuality(x: number): number {
  if (!Number.isFinite(x)) return Number.NaN;
  if (x <= 1e-12) return 0;
  if (x >= 1 - 1e-12) return 1;
  return Math.max(0, Math.min(1, x));
}

function qualitySpanTolerance(
  liquidValue: number,
  vaporValue: number,
  mixtureValue: number,
): number {
  return 1e-12 * Math.max(1, Math.abs(liquidValue), Math.abs(vaporValue), Math.abs(mixtureValue));
}

export function rawQualityFromSaturationProperty(
  liquidValue: number,
  vaporValue: number,
  mixtureValue: number,
): number {
  if (!Number.isFinite(liquidValue) || !Number.isFinite(vaporValue) || !Number.isFinite(mixtureValue)) {
    return Number.NaN;
  }

  const span = vaporValue - liquidValue;
  if (Math.abs(span) <= qualitySpanTolerance(liquidValue, vaporValue, mixtureValue)) {
    return Number.NaN;
  }

  return (mixtureValue - liquidValue) / span;
}

/**
 * Compute saturated liquid and vapour properties at a given pressure.
 *
 * Below 623.15 K the saturation line lies in Regions 1/2; above it,
 * both phases are in Region 3 and require density iteration.
 *
 * @param p - Saturation pressure [MPa]
 */
export function saturationEndpointsAtPressure(p: number): SaturationEndpoints {
  const pressure = normalizeRegion4Pressure(p);
  const temperature = normalizeRegion4Temperature(saturationTemperature(pressure));

  if (pressure === Pc) {
    const state = region3ByRhoT(RHOc, temperature);
    return { pressure, temperature, liquid: state, vapor: state };
  }

  if (temperature > R2_T_MIN) {
    return {
      pressure,
      temperature,
      liquid: region3ByRhoT(solveR3Density(pressure, temperature, 0), temperature),
      vapor: region3ByRhoT(solveR3Density(pressure, temperature, 1), temperature),
    };
  }

  return {
    pressure,
    temperature,
    liquid: region1(pressure, temperature),
    vapor: region2(pressure, temperature),
  };
}

/**
 * Compute saturated liquid and vapour properties at a given temperature.
 * @param T - Saturation temperature [K]
 */
export function saturationEndpointsAtTemperature(T: number): SaturationEndpoints {
  const temperature = normalizeRegion4Temperature(T);
  const pressure = normalizeRegion4Pressure(saturationPressure(temperature));

  if (temperature < Tt) {
    return {
      pressure,
      temperature,
      liquid: region1(pressure, temperature),
      vapor: region2(pressure, temperature),
    };
  }

  return saturationEndpointsAtPressure(pressure);
}

/**
 * Compute vapour quality from any extensive saturation property.
 *
 * x = (mixture − liquid) / (vapour − liquid)
 *
 * @param liquidValue  - Property value at saturated liquid
 * @param vaporValue   - Property value at saturated vapour
 * @param mixtureValue - Property value of the two-phase mixture
 */
export function qualityFromSaturationProperty(
  liquidValue: number,
  vaporValue: number,
  mixtureValue: number,
): number {
  const quality = rawQualityFromSaturationProperty(liquidValue, vaporValue, mixtureValue);
  if (!Number.isFinite(quality)) {
    throw new IF97Error('Cannot determine vapor quality from degenerate saturation endpoints');
  }
  return clampQuality(quality);
}

/**
 * Linearly mix saturated liquid and vapour properties at a given quality.
 *
 * At x = 0 or x = 1 the pure endpoint is returned directly (preserving
 * cp, cv, etc.). For 0 < x < 1, single-phase-only properties are set to null.
 *
 * @param endpoints    - Saturated liquid/vapour properties
 * @param qualityInput - Vapour quality (0–1)
 */
export function mixSaturationState(
  endpoints: SaturationEndpoints,
  qualityInput: number,
): BasicProperties {
  const quality = clampQuality(qualityInput);
  if (!Number.isFinite(quality)) {
    throw new IF97Error('Region 4 quality must be finite');
  }
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
