/** Region detection for P-T inputs. */
import * as C from '../constants.js';
import { saturationPressure } from '../regions/region4.js';
import { boundary23_T_to_P } from '../regions/boundaries.js';
import { Region } from '../types.js';

/**
 * Detect the IAPWS-IF97 region for given P and T.
 * @returns Region number (1–5) or -1 if out of range
 */
export function detectRegionPT(p: number, T: number): Region | -1 {
  if (T > C.R5_T_MIN && T <= C.R5_T_MAX && p >= C.P_MIN && p <= C.R5_P_MAX) {
    return Region.Region5;
  }
  if (p >= C.P_MIN && p <= C.B23_P_MIN) {
    if (T >= C.T_MIN && T <= C.R2_T_MIN) {
      return p >= saturationPressure(T) ? Region.Region1 : Region.Region2;
    }
    if (T > C.R2_T_MIN && T <= C.R2_T_MAX) return Region.Region2;
  } else if (p > C.B23_P_MIN && p <= C.P_MAX) {
    if (T >= C.T_MIN && T <= C.R2_T_MIN) {
      return p >= saturationPressure(T) ? Region.Region1 : Region.Region2;
    }
    if (T > C.R2_T_MIN && T < C.B23_T_MAX &&
        ((T < C.Tc && p >= saturationPressure(T)) || p >= boundary23_T_to_P(T))) return Region.Region3;
    if (T > C.R2_T_MIN && T <= C.R2_T_MAX) return Region.Region2;
  }
  return -1;
}

export function nativeSaturationTemperatureBracket(p: number): readonly [number, number] {
  let lower = C.T_MIN;
  let upper = C.R2_T_MIN;
  while (true) {
    const middle = (lower + upper) / 2;
    if (middle === lower || middle === upper) break;
    if (saturationPressure(middle) <= p) lower = middle;
    else upper = middle;
  }
  return [lower, upper];
}

/** Invert the native B23 boundary; rounded Eq. (6) cannot determine PT ownership. */
export function nativeB23TemperatureBracket(p: number): readonly [number, number] {
  let lower = C.R2_T_MIN;
  let upper = C.B23_T_MAX;
  while (true) {
    const middle = (lower + upper) / 2;
    if (middle === lower || middle === upper) break;
    if (boundary23_T_to_P(middle) <= p) lower = middle;
    else upper = middle;
  }
  return [lower, upper];
}
