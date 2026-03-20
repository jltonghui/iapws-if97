/**
 * IAPWS-IF97 Region 4: Saturation Line
 *
 * Saturation-pressure equation (Eq. 30) and saturation-temperature equation (Eq. 31)
 * Valid for: 273.15 K ≤ T ≤ 647.096 K
 *
 * Reference: IAPWS-IF97, Section 8 (Equations for Region 4)
 */

import { Tc, Pt, Pc } from '../constants.js';
import { OutOfRangeError } from '../types.js';

// ─── Saturation Line Coefficients (Table 34, IAPWS-IF97) ───────────────────

const n = [
  0, // n[0] unused (1-indexed)
  0.11670521452767e4,
  -0.72421316703206e6,
  -0.17073846940092e2,
  0.12020824702470e5,
  -0.32325550322333e7,
  0.14915108613530e2,
  -0.48232657361591e4,
  0.40511340542057e6,
  -0.23855557567849e0,
  0.65017534844798e3,
] as const;

/**
 * Saturation pressure for a given temperature.
 * Equation 30 (pp. 33) of IAPWS-IF97.
 *
 * @param T - Temperature [K], 273.15 ≤ T ≤ 647.096
 * @returns Saturation pressure [MPa]
 * @throws {OutOfRangeError} if T is outside valid range
 */
export function saturationPressure(T: number): number {
  if (T < 273.15 || T > Tc) {
    throw new OutOfRangeError('Temperature', T, 273.15, Tc);
  }

  const theta = T + n[9] / (T - n[10]);
  const A = theta * theta + n[1] * theta + n[2];
  const B = n[3] * theta * theta + n[4] * theta + n[5];
  const C = n[6] * theta * theta + n[7] * theta + n[8];

  return Math.pow(2 * C / (-B + Math.sqrt(B * B - 4 * A * C)), 4);
}

/**
 * Saturation temperature for a given pressure.
 * Equation 31 (pp. 34) of IAPWS-IF97.
 *
 * @param p - Pressure [MPa], Pt ≤ P ≤ Pc
 * @returns Saturation temperature [K]
 * @throws {OutOfRangeError} if P is outside valid range
 */
export function saturationTemperature(p: number): number {
  if (p < Pt || p > Pc) {
    throw new OutOfRangeError('Pressure', p, Pt, Pc);
  }

  const beta = Math.pow(p, 0.25);
  const E = beta * beta + n[3] * beta + n[6];
  const F = n[1] * beta * beta + n[4] * beta + n[7];
  const G = n[2] * beta * beta + n[5] * beta + n[8];
  const D = 2 * G / (-F - Math.sqrt(F * F - 4 * E * G));

  return (n[10] + D - Math.sqrt(
    Math.pow(n[10] + D, 2) - 4 * (n[9] + n[10] * D),
  )) / 2;
}
