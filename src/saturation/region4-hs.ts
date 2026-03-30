import * as C from '../constants.js';
import { bracketedNewton } from '../solvers/bracketed-newton.js';
import type { BasicProperties } from '../types.js';
import {
  mixSaturationState,
  rawQualityFromSaturationProperty,
  saturationEndpointsAtTemperature,
} from './common.js';
import {
  assertRegion4StateAllowed,
  clampRegion4TemperatureBelowCritical,
} from './region4-boundaries.js';

const REGION4_QUALITY_TOLERANCE = 1e-6;
type SaturationPhase = 'liquid' | 'vapor';

function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function normalizeEndpointQuality(quality: number): number {
  if (!Number.isFinite(quality)) {
    return Number.NaN;
  }
  if (Math.abs(quality) <= REGION4_QUALITY_TOLERANCE) {
    return 0;
  }
  if (Math.abs(quality - 1) <= REGION4_QUALITY_TOLERANCE) {
    return 1;
  }
  return quality;
}

function isAdmissibleQuality(quality: number): boolean {
  return Number.isFinite(quality)
    && quality >= -REGION4_QUALITY_TOLERANCE
    && quality <= 1 + REGION4_QUALITY_TOLERANCE;
}

function entropyResidual(h: number, s: number, temperatureGuess: number): number {
  const endpoints = saturationEndpointsAtTemperature(
    clampRegion4TemperatureBelowCritical(temperatureGuess),
  );
  const quality = rawQualityFromSaturationProperty(
    endpoints.liquid.enthalpy,
    endpoints.vapor.enthalpy,
    h,
  );

  if (!Number.isFinite(quality)) {
    return Number.NaN;
  }

  return endpoints.liquid.entropy * (1 - quality) + endpoints.vapor.entropy * quality - s;
}

function finalizeRegion4HSState(
  h: number,
  s: number,
  temperature: number,
): BasicProperties | null {
  const endpoints = saturationEndpointsAtTemperature(temperature);
  const qualityFromEnthalpy = rawQualityFromSaturationProperty(
    endpoints.liquid.enthalpy,
    endpoints.vapor.enthalpy,
    h,
  );
  const qualityFromEntropy = rawQualityFromSaturationProperty(
    endpoints.liquid.entropy,
    endpoints.vapor.entropy,
    s,
  );
  const normalizedQualityFromEnthalpy = normalizeEndpointQuality(qualityFromEnthalpy);
  const normalizedQualityFromEntropy = normalizeEndpointQuality(qualityFromEntropy);

  if (!isAdmissibleQuality(normalizedQualityFromEnthalpy) || !isAdmissibleQuality(normalizedQualityFromEntropy)) {
    return null;
  }

  if (Math.abs(normalizedQualityFromEnthalpy - normalizedQualityFromEntropy) > REGION4_QUALITY_TOLERANCE) {
    return null;
  }

  if (Math.abs(entropyResidual(h, s, temperature)) > C.REGION4_HS_RESIDUAL_TOLERANCE) {
    return null;
  }

  try {
    assertRegion4StateAllowed(endpoints.pressure, endpoints.temperature, 'Region4HS');
  } catch {
    return null;
  }

  return mixSaturationState(endpoints, normalizedQualityFromEnthalpy);
}

function endpointStateForPhase(
  h: number,
  s: number,
  temperature: number,
  phase: SaturationPhase,
): BasicProperties | null {
  let endpoints;
  try {
    endpoints = saturationEndpointsAtTemperature(temperature);
  } catch {
    return null;
  }
  const endpoint = endpoints[phase];

  if (!isClose(endpoint.enthalpy, h) || !isClose(endpoint.entropy, s)) {
    return null;
  }

  try {
    assertRegion4StateAllowed(endpoints.pressure, endpoints.temperature, 'Region4HS');
  } catch {
    return null;
  }

  return mixSaturationState(endpoints, phase === 'liquid' ? 0 : 1);
}

function endpointEnthalpyResidual(
  h: number,
  temperatureGuess: number,
  phase: SaturationPhase,
): number {
  let endpoints;
  try {
    endpoints = saturationEndpointsAtTemperature(
      clampRegion4TemperatureBelowCritical(temperatureGuess),
    );
  } catch {
    return Number.NaN;
  }
  return endpoints[phase].enthalpy - h;
}

function tryRegion4HSEndpointState(
  h: number,
  s: number,
): BasicProperties | null {
  const lower = C.Tt;
  const upper = clampRegion4TemperatureBelowCritical(C.Tc);

  for (const phase of ['liquid', 'vapor'] as const) {
    const lowerState = endpointStateForPhase(h, s, lower, phase);
    if (lowerState !== null) {
      return lowerState;
    }

    const upperState = endpointStateForPhase(h, s, upper, phase);
    if (upperState !== null) {
      return upperState;
    }

    let previousTemperature = lower;
    let previousResidual = endpointEnthalpyResidual(h, lower, phase);

    for (let i = 1; i <= C.REGION4_HS_BRACKET_SEGMENTS; i++) {
      const temperature = lower + (upper - lower) * (i / C.REGION4_HS_BRACKET_SEGMENTS);
      const residual = endpointEnthalpyResidual(h, temperature, phase);

      if (!Number.isFinite(previousResidual) || !Number.isFinite(residual)) {
        previousTemperature = temperature;
        previousResidual = residual;
        continue;
      }

      if (isClose(previousResidual, 0)) {
        return endpointStateForPhase(h, s, previousTemperature, phase);
      }

      if (isClose(residual, 0)) {
        return endpointStateForPhase(h, s, temperature, phase);
      }

      if (previousResidual * residual < 0) {
        const root = bracketedNewton(
          (candidateTemperature) => endpointEnthalpyResidual(h, candidateTemperature, phase),
          previousTemperature,
          temperature,
          (previousTemperature + temperature) / 2,
          { tolerance: C.REGION4_HS_RESIDUAL_TOLERANCE },
        );
        return endpointStateForPhase(h, s, root, phase);
      }

      previousTemperature = temperature;
      previousResidual = residual;
    }
  }

  return null;
}

export function tryRegion4HSState(h: number, s: number): BasicProperties | null {
  const endpointState = tryRegion4HSEndpointState(h, s);
  if (endpointState !== null) {
    return endpointState;
  }

  const lower = C.Tt;
  const upper = clampRegion4TemperatureBelowCritical(C.Tc);
  const lowerState = finalizeRegion4HSState(h, s, lower);
  if (lowerState !== null) {
    return lowerState;
  }

  const upperState = finalizeRegion4HSState(h, s, upper);
  if (upperState !== null) {
    return upperState;
  }

  let previousTemperature = lower;
  let previousResidual = entropyResidual(h, s, lower);

  for (let i = 1; i <= C.REGION4_HS_BRACKET_SEGMENTS; i++) {
    const temperature = lower + (upper - lower) * (i / C.REGION4_HS_BRACKET_SEGMENTS);
    const residual = entropyResidual(h, s, temperature);

    if (!Number.isFinite(previousResidual) || !Number.isFinite(residual)) {
      previousTemperature = temperature;
      previousResidual = residual;
      continue;
    }

    if (isClose(previousResidual, 0)) {
      return finalizeRegion4HSState(h, s, previousTemperature);
    }

    if (isClose(residual, 0)) {
      return finalizeRegion4HSState(h, s, temperature);
    }

    if (previousResidual * residual < 0) {
      const root = bracketedNewton(
        (candidateTemperature) => entropyResidual(h, s, candidateTemperature),
        previousTemperature,
        temperature,
        (previousTemperature + temperature) / 2,
        { tolerance: C.REGION4_HS_RESIDUAL_TOLERANCE },
      );
      return finalizeRegion4HSState(h, s, root);
    }

    previousTemperature = temperature;
    previousResidual = residual;
  }

  return null;
}
