/**
 * Backward equation T,S → state.
 *
 * Returns a state only when temperature and entropy determine it uniquely.
 */
import type { BasicProperties } from '../types.js';
import * as C from '../constants.js';
import { IF97Error, OutOfRangeError } from '../types.js';
import { assertFiniteNumber } from '../core/input-validation.js';
import { uniqueFixedTemperatureState } from './fixed-temperature-candidates.js';

/**
 * Solve for full basic thermodynamic state from temperature and entropy.
 *
 * Searches every valid isotherm branch and rejects ambiguous inputs.
 *
 * Temperatures within ±CRITICAL_T_EXCLUSION_BAND of Tc are rejected because
 * the entropy surface is nearly flat there, making pressure recovery unreliable.
 *
 * @param T - Temperature [K]
 * @param s - Specific entropy [kJ/(kg·K)]
 * @returns Basic thermodynamic properties (without transport)
 * @throws {OutOfRangeError} if T is outside [T_MIN, T_MAX]
 * @throws {IF97Error} if T is within the critical exclusion band
 * @throws {AmbiguousStateError} if multiple physical states match T and s
 */
export function solveTS(T: number, s: number): BasicProperties {
  assertFiniteNumber('Temperature', T);
  assertFiniteNumber('Entropy', s);

  if (T < C.T_MIN || T > C.T_MAX) {
    throw new OutOfRangeError('Temperature', T, C.T_MIN, C.T_MAX);
  }
  if (s < C.S_MIN || s > C.S_MAX) {
    throw new OutOfRangeError('Entropy', s, C.S_MIN, C.S_MAX);
  }
  if (Math.abs(T - C.Tc) < C.CRITICAL_T_EXCLUSION_BAND) {
    throw new IF97Error(
      `solveTS does not support temperatures within ${C.CRITICAL_T_EXCLUSION_BAND} K of the critical-point temperature Tc=${C.Tc} K; received T=${T} K`,
    );
  }

  const state = uniqueFixedTemperatureState(T, s, 'entropy');
  if (state === null) {
    throw new IF97Error(`solveTS cannot determine a valid IF97 state for T=${T} K, s=${s} kJ/(kg·K)`);
  }
  return state;
}
