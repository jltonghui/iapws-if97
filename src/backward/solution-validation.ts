import * as C from '../constants.js';
import { detectRegionPT } from '../core/region-detector.js';
import { saturationPressure } from '../regions/region4.js';
import type { BasicProperties } from '../types.js';
import { IF97Error, Region } from '../types.js';
import {
  backwardConstraintTolerance,
  region4SaturationPressureTolerance,
} from './tolerances.js';

export interface BackwardConstraint {
  label: 'pressure' | 'temperature' | 'enthalpy' | 'entropy';
  expected: number;
  tolerance?: number;
}

export interface BackwardValidationOptions {
  solverName: string;
  expectedRegion?: Region;
}

function propertyValue(state: BasicProperties, label: BackwardConstraint['label']): number {
  switch (label) {
    case 'pressure':
      return state.pressure;
    case 'temperature':
      return state.temperature;
    case 'enthalpy':
      return state.enthalpy;
    case 'entropy':
      return state.entropy;
    default:
      return Number.NaN;
  }
}

function boundaryTolerance(value: number, boundary: number): number {
  return 1e-9 * Math.max(1, Math.abs(value), Math.abs(boundary));
}

function snapUpFromBelow(value: number, boundary: number): number {
  return value < boundary && boundary - value <= boundaryTolerance(value, boundary)
    ? boundary
    : value;
}

function snapDownFromAbove(value: number, boundary: number): number {
  return value > boundary && value - boundary <= boundaryTolerance(value, boundary)
    ? boundary
    : value;
}

function normalizeComputedPT(state: BasicProperties): BasicProperties {
  let pressure = snapUpFromBelow(state.pressure, C.P_MIN);
  pressure = snapDownFromAbove(
    pressure,
    state.region === Region.Region5 ? C.R5_P_MAX : C.P_MAX,
  );

  let temperature = snapUpFromBelow(state.temperature, C.T_MIN);
  if (state.region === Region.Region1) {
    temperature = snapDownFromAbove(temperature, C.R2_T_MIN);
  } else if (state.region === Region.Region2) {
    temperature = snapDownFromAbove(temperature, C.R2_T_MAX);
  }
  temperature = snapDownFromAbove(temperature, C.T_MAX);

  return pressure === state.pressure && temperature === state.temperature
    ? state
    : { ...state, pressure, temperature };
}

function validateBasicEnvelope(state: BasicProperties, solverName: string): void {
  if (!Number.isFinite(state.pressure) || !Number.isFinite(state.temperature) ||
      !Number.isFinite(state.specificVolume) || state.specificVolume <= 0) {
    throw new IF97Error(`${solverName} produced an invalid thermodynamic state`);
  }

  if (state.pressure < C.P_MIN || state.pressure > C.P_MAX ||
      state.temperature < C.T_MIN || state.temperature > C.T_MAX) {
    throw new IF97Error(`${solverName} produced a state outside the IF97 PT envelope`);
  }
}

function validateRegionConsistency(
  state: BasicProperties,
  solverName: string,
  expectedRegion?: Region,
): void {
  if (expectedRegion !== undefined && state.region !== expectedRegion) {
    throw new IF97Error(`${solverName} returned Region ${state.region}, expected Region ${expectedRegion}`);
  }

  if (state.region === Region.Region4) {
    if (state.quality === null || !Number.isFinite(state.quality) || state.quality < 0 || state.quality > 1) {
      throw new IF97Error(`${solverName} produced an invalid Region 4 quality`);
    }

    const psat = saturationPressure(state.temperature);
    const pTolerance = region4SaturationPressureTolerance(state.pressure);
    if (Math.abs(psat - state.pressure) > pTolerance) {
      throw new IF97Error(`${solverName} produced a Region 4 state off the saturation curve`);
    }
    return;
  }

  const detectedRegion = detectRegionPT(state.pressure, state.temperature);
  if (detectedRegion !== state.region) {
    throw new IF97Error(
      `${solverName} produced a PT state in Region ${detectedRegion}, not Region ${state.region}`,
    );
  }
}

function validateConstraints(
  state: BasicProperties,
  constraints: readonly BackwardConstraint[],
  solverName: string,
): void {
  for (const constraint of constraints) {
    const actual = propertyValue(state, constraint.label);
    const tolerance = constraint.tolerance ?? backwardConstraintTolerance(constraint.label, constraint.expected);
    if (Math.abs(actual - constraint.expected) > tolerance) {
      throw new IF97Error(
        `${solverName} failed to match ${constraint.label}: expected ${constraint.expected}, got ${actual}`,
      );
    }
  }
}

function withExactConstraints(
  state: BasicProperties,
  constraints: readonly BackwardConstraint[],
): BasicProperties {
  const normalized = { ...state };

  for (const constraint of constraints) {
    switch (constraint.label) {
      case 'pressure':
        normalized.pressure = Object.is(constraint.expected, -0) ? 0 : constraint.expected;
        break;
      case 'temperature':
        normalized.temperature = Object.is(constraint.expected, -0) ? 0 : constraint.expected;
        break;
      case 'enthalpy':
        normalized.enthalpy = Object.is(constraint.expected, -0) ? 0 : constraint.expected;
        break;
      case 'entropy':
        normalized.entropy = Object.is(constraint.expected, -0) ? 0 : constraint.expected;
        break;
    }
  }

  return normalized;
}

export function validateBackwardState(
  state: BasicProperties,
  constraints: readonly BackwardConstraint[],
  options: BackwardValidationOptions,
): BasicProperties {
  const normalized = normalizeComputedPT(state);
  validateBasicEnvelope(normalized, options.solverName);
  validateRegionConsistency(normalized, options.solverName, options.expectedRegion);
  validateConstraints(normalized, constraints, options.solverName);
  return withExactConstraints(normalized, constraints);
}
