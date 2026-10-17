import * as C from '../constants.js';
import { detectRegionPT, nativeB23TemperatureBracket, nativeSaturationTemperatureBracket } from '../core/region-detector.js';
import { solveRegion3PTBasic } from '../core/region3-pt.js';
import type { FormulationSeamResolution } from '../core/formulation-seams.js';
import { region2 } from '../regions/region2.js';
import { region1 } from '../regions/region1.js';
import { saturationPressure } from '../regions/region4.js';
import type { BasicProperties } from '../types.js';
import { IF97Error, Region } from '../types.js';
import { RegionMismatchError } from '../errors.js';
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
  seam?: FormulationSeamResolution;
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
  let pressure = state.pressure < C.P_MIN &&
      C.P_MIN - state.pressure <= backwardConstraintTolerance('pressure', C.P_MIN)
    ? C.P_MIN
    : state.pressure;
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

function normalizeB23State(state: BasicProperties): BasicProperties {
  if ((state.region !== Region.Region2 && state.region !== Region.Region3) ||
      state.pressure <= C.B23_P_MIN || state.pressure > C.P_MAX ||
      state.temperature <= C.R2_T_MIN || state.temperature >= C.B23_T_MAX ||
      detectRegionPT(state.pressure, state.temperature) === state.region) {
    return state;
  }

  const [lower, upper] = nativeB23TemperatureBracket(state.pressure);
  const temperature = state.region === Region.Region3 ? lower : upper;
  if (Math.abs(temperature - state.temperature) > boundaryTolerance(temperature, state.temperature)) {
    return state;
  }

  return state.region === Region.Region3
    ? solveRegion3PTBasic(state.pressure, temperature)
    : region2(state.pressure, temperature);
}

function normalizeRegion3LowerState(state: BasicProperties): BasicProperties {
  if (state.region !== Region.Region3 || !(state.temperature <= C.R2_T_MIN) ||
      C.R2_T_MIN - state.temperature > boundaryTolerance(state.temperature, C.R2_T_MIN)) return state;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, C.R2_T_MIN);
  view.setBigUint64(0, view.getBigUint64(0) + 1n);
  return solveRegion3PTBasic(state.pressure, view.getFloat64(0));
}

function normalizeSaturationState(state: BasicProperties): BasicProperties {
  if ((state.region !== Region.Region1 && state.region !== Region.Region2) ||
      state.pressure > saturationPressure(C.R2_T_MIN) ||
      state.temperature < C.T_MIN || state.temperature > C.R2_T_MIN ||
      detectRegionPT(state.pressure, state.temperature) === state.region) {
    return state;
  }
  const [liquidT, vaporT] = nativeSaturationTemperatureBracket(state.pressure);
  const temperature = state.region === Region.Region1 ? liquidT : vaporT;
  if (Math.abs(temperature - state.temperature) > boundaryTolerance(temperature, state.temperature)) {
    return state;
  }
  return state.region === Region.Region1
    ? region1(state.pressure, temperature)
    : region2(state.pressure, temperature);
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

  if (state.region === Region.Region3 &&
      ![state.cp, state.cv, state.isothermalCompressibility, state.speedOfSound]
        .every((value) => value !== null && Number.isFinite(value) && value > 0)) {
    throw new IF97Error(
      `${solverName}: Region 3 numerical inconsistency at p=${state.pressure} MPa, T=${state.temperature} K: cannot construct a stable EOS state`,
    );
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
    throw new RegionMismatchError(solverName, detectedRegion, state.region);
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

export function validateBackwardState(
  state: BasicProperties,
  constraints: readonly BackwardConstraint[],
  options: BackwardValidationOptions,
): BasicProperties {
  const seam = options.seam;
  if (seam !== undefined && state !== seam.state) {
    throw new IF97Error(`${options.solverName} supplied an unrelated formulation seam state`);
  }
  const checkedConstraints = seam?.kind === 'gap'
    ? constraints.map((constraint) => constraint.label === 'enthalpy' || constraint.label === 'entropy'
      ? { ...constraint, tolerance: seam.budgets[constraint.label] }
      : constraint)
    : constraints;
  validateConstraints(state, checkedConstraints, options.solverName);
  const computed = normalizeComputedPT(state);
  const normalized = constraints.some(({ label }) => label === 'temperature')
    ? computed
    : normalizeSaturationState(normalizeB23State(normalizeRegion3LowerState(computed)));
  validateBasicEnvelope(normalized, options.solverName);
  validateRegionConsistency(normalized, options.solverName, options.expectedRegion);
  validateConstraints(normalized, checkedConstraints, options.solverName);
  return normalized;
}

export function validateRegion3PTReconstruction(state: BasicProperties, solverName: string): BasicProperties {
  return validateBackwardState(
    solveRegion3PTBasic(state.pressure, state.temperature),
    [
      { label: 'pressure', expected: state.pressure },
      { label: 'temperature', expected: state.temperature },
      { label: 'enthalpy', expected: state.enthalpy },
      { label: 'entropy', expected: state.entropy },
    ],
    { solverName, expectedRegion: Region.Region3 },
  );
}
