import * as C from '../constants.js';
import { SaturationEndpointError } from '../errors.js';
import { saturationTemperature } from '../regions/region4.js';
import { region1 } from '../regions/region1.js';
import { region2 } from '../regions/region2.js';
import { region5 } from '../regions/region5.js';
import { saturationEndpointsAtPressure } from '../saturation/common.js';
import { OutOfRangeError, Region } from '../types.js';
import { detectRegionPT, nativeB23TemperatureBracket, nativeSaturationTemperatureBracket } from '../core/region-detector.js';
import { withinClosedLowerBound } from '../core/input-validation.js';
import { findPressureSeam, type FormulationSeamResolution } from '../core/formulation-seams.js';

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
  return match;
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
  // Preserve PH's existing lower-bound tolerance; PS absorbs EOS rounding noise.
  const aboveMinimum = (minimum: number): boolean => property === 'enthalpy'
    ? minimum <= target || isClose(target, minimum)
    : withinClosedLowerBound(target, minimum, 'entropy');
  if (p >= C.P_MIN && p <= C.B23_P_MIN) {
    if (p >= C.Pt) {
      const endpoints = saturationEndpointsAtPressure(p);
      if (isClose(target, endpoints.liquid[property]) || isClose(target, endpoints.vapor[property])) {
        return Region.Region4;
      }
    }
    const Tsat = saturationTemperature(p);
    const [liquidT, vaporT] = p < C.Pt ? nativeSaturationTemperatureBracket(p) : [Tsat, Tsat];
    const lower = region1(p, C.T_MIN)[property];
    const boundary14 = region1(p, liquidT)[property];
    const boundary24 = region2(p, vaporT)[property];
    const boundary25 = region2(p, C.R2_T_MAX)[property];

    if (aboveMinimum(lower) && target <= boundary14) return Region.Region1;
    if (p >= C.Pt && boundary14 < target && target < boundary24) return Region.Region4;
    if (boundary24 <= target && withinClosedUpperBound(target, boundary25)) return Region.Region2;
    if (p <= C.R5_P_MAX && region5(p, C.R5_T_MIN)[property] < target &&
        withinClosedUpperBound(target, region5(p, C.R5_T_MAX)[property])) return Region.Region5;
  } else if (p > C.B23_P_MIN && p <= C.P_MAX) {
    const lower = region1(p, C.T_MIN)[property];
    const boundary13 = region1(p, C.R2_T_MIN)[property];
    const [, region2T] = nativeB23TemperatureBracket(p);
    const boundary32 = region2(p, region2T)[property];
    const boundary25 = region2(p, C.R2_T_MAX)[property];

    if (p < C.Pc) {
      try {
        const endpoints = saturationEndpointsAtPressure(p);
        // Native B23 cancellation can shift its first Region 2 float by a few ULPs.
        const roundoff = 128 * Number.EPSILON * Math.max(1, Math.abs(target));
        if (target !== endpoints.liquid[property] && target !== endpoints.vapor[property] &&
            boundary32 <= target + roundoff && target < endpoints.vapor[property]) {
          // Near P13, the Region 3 saturation span can contain a PT-owned Region 2 root.
          const [, vaporT] = nativeSaturationTemperatureBracket(p);
          const T = Math.max(region2T, vaporT);
          if (detectRegionPT(p, T) === Region.Region2 && region2(p, T)[property] <= target + roundoff) return Region.Region2;
        }
        if (isClose(target, endpoints.liquid[property]) || isClose(target, endpoints.vapor[property]) ||
            (endpoints.liquid[property] < target && target < endpoints.vapor[property])) {
          return Region.Region4;
        }
      } catch (error) {
        if (!(error instanceof SaturationEndpointError) ||
            (target > boundary13 && target < boundary32)) throw error;
      }
    }

    if (aboveMinimum(lower) && (target <= boundary13 || isClose(target, boundary13))) return Region.Region1;
    if (boundary32 <= target && withinClosedUpperBound(target, boundary25)) return Region.Region2;
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
