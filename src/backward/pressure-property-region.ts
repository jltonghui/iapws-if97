import * as C from '../constants.js';
import { SaturationEndpointError } from '../errors.js';
import { region1 } from '../regions/region1.js';
import { region2 } from '../regions/region2.js';
import { region5 } from '../regions/region5.js';
import { boundary23_T_to_P } from '../regions/boundaries.js';
import { saturationPressure } from '../regions/region4.js';
import { saturationEndpointsAtPressure } from '../saturation/common.js';
import { OutOfRangeError, Region } from '../types.js';
import type { BasicProperties } from '../types.js';
import { detectRegionPT, nativeB23TemperatureBracket, nativeSaturationTemperatureBracket } from '../core/region-detector.js';
import { withinClosedLowerBound } from '../core/input-validation.js';
import { findPressureSeam, type FormulationSeamResolution } from '../core/formulation-seams.js';
import { nextPositiveFloat } from '../core/floating-point.js';
import { solveRegion3PTBasic } from '../core/region3-pt.js';
import { bracketedNewton } from '../solvers/bracketed-newton.js';
import { resolveBackwardCandidates } from './candidate-resolution.js';
import { BACKWARD_PRESSURE_PROPERTY_TEMPERATURE_TOLERANCE } from './tolerances.js';

const P13 = saturationPressure(C.R2_T_MIN);
const B23_P_AT_T13 = boundary23_T_to_P(C.R2_T_MIN);

/** Resolve the native saturation/B23 intersection before choosing one inverse region. */
export function pressurePropertyBoundaryState(
  p: number,
  target: number,
  property: 'enthalpy' | 'entropy',
): BasicProperties | null {
  if (p < C.B23_P_MIN || p > B23_P_AT_T13) return null;
  const references = [region1(p, C.R2_T_MIN), region2(p, C.R2_T_MIN)];
  if (!references.some((state) => Math.abs(state[property] - target) <=
      (property === 'enthalpy' ? 0.2 : 0.0002))) return null;
  const endpoints = saturationEndpointsAtPressure(p);
  if (endpoints.liquid[property] <= target && target <= endpoints.vapor[property]) return null;

  const tolerance = 128 * Number.EPSILON * Math.max(1, Math.abs(target));
  const temperatures = new Set([
    C.R2_T_MIN,
    nextPositiveFloat(C.R2_T_MIN, -1),
    nextPositiveFloat(C.R2_T_MIN, 1),
    ...nativeSaturationTemperatureBracket(p),
  ]);
  const stateAt = (T: number): BasicProperties | null => {
    const region = detectRegionPT(p, T);
    return region === Region.Region1 ? region1(p, T)
      : region === Region.Region2 ? region2(p, T)
      : region === Region.Region3 ? solveRegion3PTBasic(p, T) : null;
  };
  return resolveBackwardCandidates([...temperatures].map((T) => () => {
    const state = stateAt(T);
    if (state === null) return null;
    if (Math.abs(state[property] - target) <= tolerance) return state;
    const slope = property === 'enthalpy' ? state.cp! : state.cp! / T;
    const temperature = T + (target - state[property]) / slope;
    if (detectRegionPT(p, temperature) !== state.region) return null;
    const corrected = stateAt(temperature);
    return corrected !== null && Math.abs(corrected[property] - target) <= tolerance ? corrected : null;
  }), [
    { label: 'pressure', expected: p, tolerance: 0 },
    { label: property, expected: target, tolerance },
  ], { solverName: property === 'enthalpy' ? 'solvePH' : 'solvePS' });
}

/** Reject proven fixed-pressure envelope violations without classifying interior gaps. */
export function assertPressurePropertyEnvelope(
  p: number,
  target: number,
  property: 'enthalpy' | 'entropy',
): void {
  const minimum = region1(p, C.T_MIN)[property];
  const maximum = (p <= C.R5_P_MAX ? region5(p, C.R5_T_MAX) : region2(p, C.R2_T_MAX))[property];
  const aboveMinimum = property === 'enthalpy'
    ? target >= minimum || isClose(target, minimum)
    : withinClosedLowerBound(target, minimum, 'entropy');
  if (!aboveMinimum || !withinClosedUpperBound(target, maximum)) {
    throw new OutOfRangeError(
      `${property === 'enthalpy' ? 'Enthalpy' : 'Entropy'} at p=${p} MPa`, target, minimum, maximum,
    );
  }
}

/** Share the fixed-pressure seam policy between detectors and backward solvers. */
export function pressurePropertySeam(
  p: number,
  target: number,
  property: 'enthalpy' | 'entropy',
): FormulationSeamResolution | null {
  const match = findPressureSeam(p, target, property);
  if (match === null) return null;
  if (p >= C.Pt && p < C.Pc) {
    try {
      const endpoints = saturationEndpointsAtPressure(p);
      if (target >= endpoints.liquid[property] && target <= endpoints.vapor[property]) return null;
    } catch (error) {
      if (!(error instanceof SaturationEndpointError)) throw error;
    }
  }
  const solverName = property === 'enthalpy' ? 'solvePH' : 'solvePS';
  const constraints = [{ label: 'pressure', expected: p }, { label: property, expected: target }] as const;
  const state = resolveBackwardCandidates([
    () => match.state[property] === target ? match.state : null,
    () => pressureSeamRoot(p, target, property, match, match.pair.lower.region),
    () => pressureSeamRoot(p, target, property, match, match.pair.upper.region),
  ], constraints, { solverName, seam: match });
  const resolved = state ?? (match.kind === 'canonical'
    ? resolveBackwardCandidates([() => match.state], constraints, { solverName }) : null);
  return resolved === null ? null : resolved === match.state ? match : { ...match, kind: 'canonical', state: resolved };
}

function pressureSeamRoot(
  p: number,
  target: number,
  property: 'enthalpy' | 'entropy',
  seam: FormulationSeamResolution,
  region: Region,
): BasicProperties | null {
  let lower: number;
  let upper: number;
  let evaluate: (T: number) => BasicProperties;
  if (region === Region.Region1) {
    lower = C.T_MIN;
    upper = C.R2_T_MIN;
    evaluate = (T) => region1(p, T);
  } else if (region === Region.Region2) {
    lower = p > C.B23_P_MIN ? nativeB23TemperatureBracket(p)[1] : C.T_MIN;
    if (p < C.Pc) lower = Math.max(lower, nativeSaturationTemperatureBracket(p)[1]);
    upper = C.R2_T_MAX;
    evaluate = (T) => region2(p, T);
  } else if (region === Region.Region3) {
    lower = nextPositiveFloat(C.R2_T_MIN, 1);
    upper = nativeB23TemperatureBracket(p)[0];
    if (p < C.Pc) {
      const [liquidT, vaporT] = nativeSaturationTemperatureBracket(p);
      if (seam.pair.seam === '13') upper = Math.min(upper, liquidT);
      else lower = Math.max(lower, vaporT);
    }
    evaluate = (T) => solveRegion3PTBasic(p, T);
  } else if (region === Region.Region5) {
    lower = nextPositiveFloat(C.R5_T_MIN, 1);
    upper = C.R5_T_MAX;
    evaluate = (T) => region5(p, T);
  } else {
    return null;
  }
  if (lower > upper) return null;
  const direction = region === seam.pair.lower.region ? -1 : 1;
  const boundary = direction < 0 ? upper : lower;
  const first = evaluate(boundary);
  if (direction * (target - first[property]) < 0) return null;
  if (target === first[property]) return first;
  if (lower === upper) return null;
  const slope = property === 'enthalpy' ? first.cp! : first.cp! / boundary;
  let distance = Math.abs(target - first[property]) / slope;
  let bracket: number;
  while (true) {
    bracket = Math.max(lower, Math.min(upper, boundary + direction * distance));
    if (bracket === boundary) bracket = nextPositiveFloat(boundary, direction);
    const last = evaluate(bracket);
    if (direction * (last[property] - target) >= 0) break;
    if (bracket === lower || bracket === upper) return null;
    distance *= 2;
  }
  lower = Math.min(boundary, bracket);
  upper = Math.max(boundary, bracket);
  const temperature = bracketedNewton((T) => evaluate(T)[property] - target, lower, upper, undefined, {
    derivative: (T) => {
      const state = evaluate(T);
      return property === 'enthalpy' ? state.cp! : state.cp! / T;
    },
    tolerance: BACKWARD_PRESSURE_PROPERTY_TEMPERATURE_TOLERANCE,
    residualTolerance: 0,
  });
  return evaluate(temperature);
}

/** Detect region for P-H inputs. */
export function detectRegionPH(p: number, h: number): Region | -1 {
  return detectRegionPressureProperty(p, h, 'enthalpy');
}

/** Detect region for P-S inputs. */
export function detectRegionPS(p: number, s: number): Region | -1 {
  return detectRegionPressureProperty(p, s, 'entropy');
}

function detectRegionPressureProperty(
  p: number,
  target: number,
  property: 'enthalpy' | 'entropy',
): Region | -1 {
  if (!Number.isFinite(p) || !Number.isFinite(target)) return -1;
  const seam = pressurePropertySeam(p, target, property);
  if (seam !== null) return seam.state.region;
  const boundary = pressurePropertyBoundaryState(p, target, property);
  if (boundary !== null) return boundary.region;
  // Preserve PH's existing lower-bound tolerance; PS absorbs EOS rounding noise.
  const aboveMinimum = (minimum: number): boolean => property === 'enthalpy'
    ? minimum <= target || isClose(target, minimum)
    : withinClosedLowerBound(target, minimum, 'entropy');
  if (p >= C.P_MIN && p <= P13) {
    const endpoints = p >= C.Pt ? saturationEndpointsAtPressure(p) : null;
    if (endpoints !== null && endpoints.liquid[property] <= target && target <= endpoints.vapor[property]) {
      return Region.Region4;
    }
    const [liquidT, vaporT] = endpoints === null ? nativeSaturationTemperatureBracket(p)
      : [endpoints.temperature, endpoints.temperature];
    const lower = region1(p, C.T_MIN)[property];
    const boundary14 = endpoints?.liquid[property] ?? region1(p, liquidT)[property];
    const boundary24 = endpoints?.vapor[property] ?? region2(p, vaporT)[property];
    const boundary25 = region2(p, C.R2_T_MAX)[property];

    if (aboveMinimum(lower) && target <= boundary14) return Region.Region1;
    if (withinClosedLowerBound(target, boundary24, property) && withinClosedUpperBound(target, boundary25)) return Region.Region2;
    if (p <= C.R5_P_MAX && region5(p, C.R5_T_MIN)[property] < target &&
        withinClosedUpperBound(target, region5(p, C.R5_T_MAX)[property])) return Region.Region5;
  } else if (p > P13 && p <= C.P_MAX) {
    const lower = region1(p, C.T_MIN)[property];
    const boundary13 = region1(p, C.R2_T_MIN)[property];
    const [, region2T] = nativeB23TemperatureBracket(p);
    const boundary32 = region2(p, region2T)[property];
    const boundary25 = region2(p, C.R2_T_MAX)[property];

    if (p < C.Pc) {
      try {
        const endpoints = saturationEndpointsAtPressure(p);
        if (endpoints.liquid[property] <= target && target <= endpoints.vapor[property]) {
          return Region.Region4;
        }
      } catch (error) {
        if (!(error instanceof SaturationEndpointError) ||
            (target > boundary13 && target < boundary32)) throw error;
      }
    }

    if (aboveMinimum(lower) && target <= boundary13) return Region.Region1;
    if (withinClosedLowerBound(target, boundary32, property) && withinClosedUpperBound(target, boundary25)) return Region.Region2;
    if (p <= C.R5_P_MAX && region5(p, C.R5_T_MIN)[property] < target &&
        withinClosedUpperBound(target, region5(p, C.R5_T_MAX)[property])) return Region.Region5;
    if (p < C.Pc) {
      const endpoints = saturationEndpointsAtPressure(p);
      const liquid = endpoints.liquid[property];
      const vapor = endpoints.vapor[property];

      if (boundary13 < target && target < liquid) return Region.Region3;
      if (liquid < target && target < vapor) return Region.Region4;
      if (vapor < target && target < boundary32) return Region.Region3;
    } else if (boundary13 < target && target < boundary32) {
      return Region.Region3;
    }
  }
  return -1;
}

// Accept floating-point residue only at closed upper bounds.
function withinClosedUpperBound(value: number, boundary: number): boolean {
  return value <= boundary + 8 * Number.EPSILON * Math.max(1, Math.abs(boundary));
}

/** Check approximate equality with relative tolerance. */
function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}
