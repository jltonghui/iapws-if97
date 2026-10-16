import * as C from '../constants.js';
import { SaturationEndpointError } from '../errors.js';
import { saturationTemperature } from '../regions/region4.js';
import { boundary23_P_to_T } from '../regions/boundaries.js';
import { region1 } from '../regions/region1.js';
import { region2 } from '../regions/region2.js';
import { region5 } from '../regions/region5.js';
import { saturationEndpointsAtPressure } from '../saturation/common.js';
import { Region } from '../types.js';
import { nativeSaturationTemperatureBracket } from '../core/region-detector.js';
import { withinClosedLowerBound } from '../core/input-validation.js';
import { findPressureSeam, type FormulationSeamResolution } from '../core/formulation-seams.js';

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
  const seam = pressurePropertySeam(p, target, property);
  if (seam !== null) return seam.state.region;
  // Preserve PH's existing lower-bound tolerance; PS absorbs only public rounding noise.
  const aboveMinimum = (minimum: number): boolean => property === 'enthalpy'
    ? minimum <= target || isClose(target, minimum)
    : withinClosedLowerBound(target, minimum);
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
    const boundary32 = region2(p, boundary23_P_to_T(p))[property];
    const boundary25 = region2(p, C.R2_T_MAX)[property];

    if (p < C.Pc) {
      try {
        const endpoints = saturationEndpointsAtPressure(p);
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

// Match public normalization's machine-noise window only at closed upper bounds.
function withinClosedUpperBound(value: number, boundary: number): boolean {
  return value <= boundary + 8 * Number.EPSILON * Math.max(1, Math.abs(boundary));
}

/** Check approximate equality with relative tolerance. */
function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}
