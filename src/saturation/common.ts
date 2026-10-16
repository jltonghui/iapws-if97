/**
 * Saturation-line utilities.
 *
 * Computes saturated liquid / vapour endpoint properties along the
 * two-phase boundary, and provides helpers for quality interpolation
 * and two-phase mixing.
 */
import type { BasicProperties, SaturationEndpoints } from '../types.js';
import { IF97Error, Region } from '../types.js';
import { SaturationEndpointError } from '../errors.js';
import { Pc, Pt, R2_T_MIN, RHOc, Tt } from '../constants.js';
import { region1 } from '../regions/region1.js';
import { region2 } from '../regions/region2.js';
import { region3ByRhoT } from '../regions/region3.js';
import { saturationPressure, saturationPressurePair, saturationTemperature } from '../regions/region4.js';
import { region3SatVolume } from '../regions/region3-subregions.js';
import { solveRegion3StateAtPressure } from '../core/region3-pt.js';
import {
  normalizeRegion4Pressure,
  normalizeRegion4Temperature,
} from './region4-boundaries.js';

export type { SaturationEndpoints } from '../types.js';

const REGION12_SATURATION_PRESSURE = saturationPressure(R2_T_MIN);

/** Tag a single-phase state as Region 4 with the given vapour quality. */
function withRegion4Metadata(
  state: BasicProperties,
  quality: number,
  saturation: SaturationEndpoints,
): BasicProperties {
  return { ...state, region: Region.Region4, quality, saturation };
}

/**
 * Solve for the Region 3 saturation endpoint state.
 *
 * @param p - Saturation pressure [MPa]
 * @param T - Saturation temperature [K]
 * @param x - Phase indicator: 0 = liquid, 1 = vapour
 */
function solveR3Endpoint(p: number, T: number, x: 0 | 1, pressureLow: number): BasicProperties {
  return solveRegion3StateAtPressure(p, T, 1 / region3SatVolume(p, T, x), pressureLow);
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

function buildSaturationEndpoints(pressure: number, temperature: number): SaturationEndpoints {
  // Both caller coordinates must use the same native saturation EOS pair.
  const pressurePair = saturationPressurePair(temperature);
  const eosPressure = normalizeRegion4Pressure(pressurePair[0]);
  const pressureLow = eosPressure === pressurePair[0] ? pressurePair[1] : 0;
  let liquid: BasicProperties;
  let vapor: BasicProperties;
  if (pressure === Pc) {
    liquid = vapor = region3ByRhoT(RHOc, temperature);
  } else if (pressure > REGION12_SATURATION_PRESSURE) {
    // Inverse-temperature rounding must not change formula ownership at 623.15 K.
    const inconsistency = `Region 4 numerical inconsistency at p=${pressure} MPa, T=${temperature} K: cannot construct distinct stable liquid and vapor EOS endpoints`;
    try {
      liquid = solveR3Endpoint(eosPressure, temperature, 0, pressureLow);
      vapor = solveR3Endpoint(eosPressure, temperature, 1, pressureLow);
    } catch (error) {
      if (!(error instanceof IF97Error)) throw error;
      throw new SaturationEndpointError(`${inconsistency}: ${error.message}`);
    }
    if (!(1 / liquid.specificVolume > RHOc && 1 / vapor.specificVolume < RHOc &&
        vapor.specificVolume > liquid.specificVolume && vapor.enthalpy > liquid.enthalpy &&
        vapor.entropy > liquid.entropy && [liquid, vapor].every((state) =>
          Number.isFinite(state.pressure) && Math.abs(state.pressure - pressure) / pressure <= 1e-6 &&
          [state.cp, state.cv, state.isothermalCompressibility, state.speedOfSound]
            .every((value) => value !== null && Number.isFinite(value) && value > 0)))) {
      throw new SaturationEndpointError(inconsistency);
    }
  } else {
    liquid = region1(eosPressure, temperature);
    vapor = region2(eosPressure, temperature);
  }

  return {
    pressure,
    temperature,
    liquid: { ...liquid, pressure, temperature },
    vapor: { ...vapor, pressure, temperature },
  };
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
  let temperature = pressure === REGION12_SATURATION_PRESSURE
    ? R2_T_MIN
    : normalizeRegion4Temperature(saturationTemperature(pressure));
  if ((pressure > REGION12_SATURATION_PRESSURE && temperature <= R2_T_MIN) ||
      (pressure < REGION12_SATURATION_PRESSURE && temperature >= R2_T_MIN)) {
    // Keep a rounded derived temperature on the pressure's formula side.
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, R2_T_MIN);
    view.setBigUint64(0, view.getBigUint64(0) + (pressure > REGION12_SATURATION_PRESSURE ? 1n : -1n));
    temperature = view.getFloat64(0);
  }
  return buildSaturationEndpoints(pressure, temperature);
}

/**
 * Compute saturated liquid and vapour properties at a given temperature.
 * @param T - Saturation temperature [K]
 */
export function saturationEndpointsAtTemperature(T: number): SaturationEndpoints {
  const inputTemperature = normalizeRegion4Temperature(T);
  const pressure = normalizeRegion4Pressure(saturationPressure(inputTemperature));
  const temperature = inputTemperature >= Tt && (pressure === Pt || pressure === Pc)
    ? normalizeRegion4Temperature(saturationTemperature(pressure))
    : inputTemperature;
  return buildSaturationEndpoints(pressure, temperature);
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
    return withRegion4Metadata(liquid, 0, endpoints);
  }

  if (quality === 1) {
    return withRegion4Metadata(vapor, 1, endpoints);
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
    saturation: endpoints,
    isobaricExpansion: null,
    isothermalCompressibility: null,
  };
}
