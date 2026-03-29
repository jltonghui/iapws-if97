/**
 * Backward equation T,S → state.
 *
 * Given temperature and specific entropy, determines the IAPWS-IF97 region
 * and solves for pressure using a bracketed Newton method, then returns
 * the full set of basic thermodynamic properties.
 */
import type { BasicProperties } from '../types.js';
import * as C from '../constants.js';
import { IF97Error, OutOfRangeError, Region } from '../types.js';
import { detectRegionTS } from '../core/region-detector.js';
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
import { assertRegion4StateAllowed } from '../saturation/region4-boundaries.js';
import { solveFixedTemperaturePressure } from './fixed-temperature-solver.js';
import { validateBackwardState } from './solution-validation.js';

const extractS = (s: BasicProperties) => s.entropy;

/**
 * Solve for full basic thermodynamic state from temperature and entropy.
 *
 * Detects the IAPWS-IF97 region, then inverts s(p, T) to recover pressure
 * within the appropriate bracket for that region.
 *
 * Temperatures within ±CRITICAL_T_EXCLUSION_BAND of Tc are rejected because
 * the entropy surface is nearly flat there, making pressure recovery unreliable.
 *
 * @param T - Temperature [K]
 * @param s - Specific entropy [kJ/(kg·K)]
 * @returns Basic thermodynamic properties (without transport)
 * @throws {OutOfRangeError} if T is outside [T_MIN, T_MAX]
 * @throws {IF97Error} if T is within the critical exclusion band
 */
export function solveTS(T: number, s: number): BasicProperties {
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

  const region = detectRegionTS(T, s);

  switch (region) {
    case Region.Region1:
      return validateBackwardState(solveFixedTemperaturePressure(
        region1, T, s,
        saturationPressure(T), C.P_MAX,
        extractS, 'solveTS',
      ), [
        { label: 'temperature', expected: T },
        { label: 'entropy', expected: s },
      ], {
        solverName: 'solveTS',
        expectedRegion: Region.Region1,
      });
    case Region.Region2: {
      const upper = T <= C.Tc
        ? saturationPressure(T)
        : T <= C.B23_T_MAX
          ? boundary23_T_to_P(T)
          : C.P_MAX;
      return validateBackwardState(solveFixedTemperaturePressure(
        region2, T, s,
        C.P_MIN, upper,
        extractS, 'solveTS',
      ), [
        { label: 'temperature', expected: T },
        { label: 'entropy', expected: s },
      ], {
        solverName: 'solveTS',
        expectedRegion: Region.Region2,
      });
    }
    case Region.Region3: {
      const lower = T <= C.Tc
        ? saturationPressure(T)
        : boundary23_T_to_P(T);
      return validateBackwardState(solveFixedTemperaturePressure(
        solveRegion3PTBasic, T, s,
        lower, C.P_MAX,
        extractS, 'solveTS',
      ), [
        { label: 'temperature', expected: T },
        { label: 'entropy', expected: s },
      ], {
        solverName: 'solveTS',
        expectedRegion: Region.Region3,
      });
    }
    case Region.Region4: {
      const endpoints = saturationEndpointsAtTemperature(T);
      assertRegion4StateAllowed(endpoints.pressure, endpoints.temperature, 'solveTS');
      const x = qualityFromSaturationProperty(
        endpoints.liquid.entropy,
        endpoints.vapor.entropy,
        s,
      );
      return validateBackwardState(
        mixSaturationState(endpoints, x),
        [
          { label: 'temperature', expected: T },
          { label: 'entropy', expected: s },
        ],
        { solverName: 'solveTS', expectedRegion: Region.Region4 },
      );
    }
    case Region.Region5:
      return validateBackwardState(solveFixedTemperaturePressure(
        region5, T, s,
        C.P_MIN, C.R5_P_MAX,
        extractS, 'solveTS',
      ), [
        { label: 'temperature', expected: T },
        { label: 'entropy', expected: s },
      ], {
        solverName: 'solveTS',
        expectedRegion: Region.Region5,
      });
    default:
      throw new IF97Error(`solveTS cannot determine a valid IF97 state for T=${T} K, s=${s} kJ/(kg·K)`);
  }
}
