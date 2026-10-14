/**
 * IAPWS-IF97 Region 4: Saturation Line
 *
 * Saturation-pressure equation (Eq. 30) and saturation-temperature equation (Eq. 31)
 * Valid for: 273.15 K ≤ T ≤ 647.096 K
 *
 * Reference: IAPWS-IF97, Section 8 (Equations for Region 4)
 */

import { Tc, Pc, P_MIN } from '../constants.js';
import { OutOfRangeError } from '../types.js';
import {
  addExtended, divideExtended, multiplyExtended, sqrtExtended, subtractExtended,
} from '../solvers/extended-arithmetic.js';
import {
  normalizeRegion4Pressure,
  normalizeRegion4Temperature,
} from '../saturation/region4-boundaries.js';

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
  return normalizeRegion4Pressure(saturationPressurePair(T)[0]);
}

/** Internal unrounded target: near criticality, one pressure ULP changes endpoint density. */
export function saturationPressurePair(T: number): readonly [number, number] {
  if (T < 273.15 || T > Tc) {
    throw new OutOfRangeError('Temperature', T, 273.15, Tc);
  }

  const theta = addExtended([T, 0], divideExtended([n[9], 0], subtractExtended([T, 0], [n[10], 0])));
  const thetaSquared = multiplyExtended(theta, theta);
  const A = addExtended(addExtended(thetaSquared, multiplyExtended([n[1], 0], theta)), [n[2], 0]);
  const B = addExtended(addExtended(multiplyExtended([n[3], 0], thetaSquared), multiplyExtended([n[4], 0], theta)), [n[5], 0]);
  const C = addExtended(addExtended(multiplyExtended([n[6], 0], thetaSquared), multiplyExtended([n[7], 0], theta)), [n[8], 0]);
  const discriminant = subtractExtended(
    multiplyExtended(B, B), multiplyExtended(multiplyExtended([4, 0], A), C),
  );
  const root = divideExtended(
    multiplyExtended([2, 0], C),
    addExtended([-B[0], -B[1]], sqrtExtended(discriminant)),
  );
  const squared = multiplyExtended(root, root);
  return multiplyExtended(squared, squared);
}

/**
 * Saturation temperature for a given pressure.
 * Equation 31 (pp. 34) of IAPWS-IF97.
 *
 * @param p - Pressure [MPa], P_MIN ≤ P ≤ Pc
 *            (P_MIN = Psat(273.15 K), the lower pressure bound matching
 *            saturationPressure's lower temperature bound per IAPWS-IF97 §8)
 * @returns Saturation temperature [K]
 * @throws {OutOfRangeError} if P is outside valid range
 */
export function saturationTemperature(p: number): number {
  if (p < P_MIN || p > Pc) {
    throw new OutOfRangeError('Pressure', p, P_MIN, Pc);
  }

  const beta = sqrtExtended(sqrtExtended([p, 0]));
  const betaSquared = multiplyExtended(beta, beta);
  const E = addExtended(addExtended(betaSquared, multiplyExtended([n[3], 0], beta)), [n[6], 0]);
  const F = addExtended(addExtended(multiplyExtended([n[1], 0], betaSquared), multiplyExtended([n[4], 0], beta)), [n[7], 0]);
  const G = addExtended(addExtended(multiplyExtended([n[2], 0], betaSquared), multiplyExtended([n[5], 0], beta)), [n[8], 0]);
  const discriminant = subtractExtended(
    multiplyExtended(F, F), multiplyExtended(multiplyExtended([4, 0], E), G),
  );
  const D = divideExtended(
    multiplyExtended([2, 0], G),
    subtractExtended([-F[0], -F[1]], sqrtExtended(discriminant)),
  );
  const difference = subtractExtended([n[10], 0], D);
  const temperature = divideExtended(
    subtractExtended(addExtended([n[10], 0], D), sqrtExtended(
      subtractExtended(multiplyExtended(difference, difference), [4 * n[9], 0]),
    )),
    [2, 0],
  );
  return normalizeRegion4Temperature(temperature[0]);
}
