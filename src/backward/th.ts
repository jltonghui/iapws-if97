/**
 * Backward equation T,H → state.
 *
 * Given temperature and specific enthalpy, determines the IAPWS-IF97 region
 * and solves for pressure using a bracketed Newton method, then returns
 * the full set of basic thermodynamic properties.
 */
import type { BasicProperties } from '../types.js';
import * as C from '../constants.js';
import { IF97Error, OutOfRangeError, Region } from '../types.js';
import { detectRegionTH } from '../core/region-detector.js';
import { solveRegion3PTBasic } from '../core/region3-pt.js';
import { region1 } from '../regions/region1.js';
import { region2 } from '../regions/region2.js';
import { region5 } from '../regions/region5.js';
import { boundary23_T_to_P } from '../regions/boundaries.js';
import { saturationPressure } from '../regions/region4.js';
import {
  mixSaturationState,
  qualityFromSaturationProperty,
  saturationEndpointsAtTemperature,
} from '../saturation/common.js';
import { solveFixedTemperaturePressure } from './fixed-temperature-solver.js';

const extractH = (s: BasicProperties) => s.enthalpy;

/**
 * Solve for full basic thermodynamic state from temperature and enthalpy.
 *
 * Detects the IAPWS-IF97 region, then inverts h(p, T) to recover pressure
 * within the appropriate bracket for that region.
 *
 * Temperatures within ±CRITICAL_T_EXCLUSION_BAND of Tc are rejected because
 * the enthalpy surface is nearly flat there, making pressure recovery unreliable.
 *
 * @param T - Temperature [K]
 * @param h - Specific enthalpy [kJ/kg]
 * @returns Basic thermodynamic properties (without transport)
 * @throws {OutOfRangeError} if T is outside [T_MIN, T_MAX]
 * @throws {IF97Error} if T is within the critical exclusion band
 */
export function solveTH(T: number, h: number): BasicProperties {
  if (T < C.T_MIN || T > C.T_MAX) {
    throw new OutOfRangeError('Temperature', T, C.T_MIN, C.T_MAX);
  }
  if (h < C.H_MIN || h > C.H_MAX) {
    throw new OutOfRangeError('Enthalpy', h, C.H_MIN, C.H_MAX);
  }
  if (Math.abs(T - C.Tc) < C.CRITICAL_T_EXCLUSION_BAND) {
    throw new IF97Error(
      `solveTH does not support temperatures within ${C.CRITICAL_T_EXCLUSION_BAND} K of the critical-point temperature Tc=${C.Tc} K; received T=${T} K`,
    );
  }

  const region = detectRegionTH(T, h);

  switch (region) {
    case Region.Region1:
      return solveFixedTemperaturePressure(
        region1, T, h,
        saturationPressure(T), C.P_MAX,
        extractH, 'solveTH',
      );
    case Region.Region2: {
      const upper = T <= C.Tc
        ? saturationPressure(T)
        : T <= C.B23_T_MAX
          ? boundary23_T_to_P(T)
          : C.P_MAX;
      return solveFixedTemperaturePressure(
        region2, T, h,
        C.P_MIN, upper,
        extractH, 'solveTH',
      );
    }
    case Region.Region3: {
      const lower = T <= C.Tc
        ? saturationPressure(T)
        : boundary23_T_to_P(T);
      return solveFixedTemperaturePressure(
        solveRegion3PTBasic, T, h,
        lower, C.P_MAX,
        extractH, 'solveTH',
      );
    }
    case Region.Region4: {
      const endpoints = saturationEndpointsAtTemperature(T);
      const x = qualityFromSaturationProperty(
        endpoints.liquid.enthalpy,
        endpoints.vapor.enthalpy,
        h,
      );
      return mixSaturationState(endpoints, x);
    }
    case Region.Region5:
      return solveFixedTemperaturePressure(
        region5, T, h,
        C.P_MIN, C.R5_P_MAX,
        extractH, 'solveTH',
      );
    default:
      throw new IF97Error(`solveTH cannot determine a valid IF97 state for T=${T} K, h=${h} kJ/kg`);
  }
}
