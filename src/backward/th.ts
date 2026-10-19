/**
 * Backward equation T,H → state.
 *
 * Returns a state only when temperature and enthalpy determine it uniquely.
 */
import type { BasicProperties } from '../types.js';
import * as C from '../constants.js';
import { IF97Error, OutOfRangeError } from '../types.js';
import { assertFiniteNumber, withinClosedLowerBound } from '../core/input-validation.js';
import { uniqueFixedTemperatureState } from './fixed-temperature-candidates.js';

/**
 * Solve for full basic thermodynamic state from temperature and enthalpy.
 *
 * Searches every valid isotherm branch and rejects ambiguous inputs.
 *
 * Temperatures within ±CRITICAL_T_EXCLUSION_BAND of Tc are rejected because
 * the enthalpy surface is nearly flat there, making pressure recovery unreliable.
 *
 * @param T - Temperature [K]
 * @param h - Specific enthalpy [kJ/kg]
 * @returns Basic thermodynamic properties (without transport)
 * @throws {OutOfRangeError} if T is outside [T_MIN, T_MAX]
 * @throws {IF97Error} if T is within the critical exclusion band
 * @throws {AmbiguousStateError} if multiple physical states match T and h
 */
export function solveTH(T: number, h: number): BasicProperties {
  assertFiniteNumber('Temperature', T);
  assertFiniteNumber('Enthalpy', h);

  if (T < C.T_MIN || T > C.T_MAX) {
    throw new OutOfRangeError('Temperature', T, C.T_MIN, C.T_MAX);
  }
  if (!withinClosedLowerBound(h, C.H_MIN, 'enthalpy') || h > C.H_MAX) {
    throw new OutOfRangeError('Enthalpy', h, C.H_MIN, C.H_MAX);
  }
  if (Math.abs(T - C.Tc) < C.CRITICAL_T_EXCLUSION_BAND) {
    throw new IF97Error(
      `solveTH does not support temperatures within ${C.CRITICAL_T_EXCLUSION_BAND} K of the critical-point temperature Tc=${C.Tc} K; received T=${T} K`,
    );
  }

  const state = uniqueFixedTemperatureState(T, h, 'enthalpy');
  if (state === null) {
    throw new IF97Error(`solveTH cannot determine a valid IF97 state for T=${T} K, h=${h} kJ/kg`);
  }
  return state;
}
