import * as C from '../constants.js';
import { solveRegion3PTBasic } from '../core/region3-pt.js';
import { boundary23_P_to_T, boundary23_T_to_P } from '../regions/boundaries.js';
import { region1 } from '../regions/region1.js';
import { region2 } from '../regions/region2.js';
import { saturationTemperature } from '../regions/region4.js';
import { region5 } from '../regions/region5.js';
import {
  mixSaturationState,
  qualityFromSaturationProperty,
  saturationEndpointsAtTemperature,
} from '../saturation/common.js';
import type { BasicProperties } from '../types.js';
import { AmbiguousStateError } from '../types.js';
import { enthalpyStationaryPressures } from './enthalpy-stationary.js';
import { solveFixedTemperaturePressure } from './fixed-temperature-solver.js';

const ENTHALPY_ROOT_TOLERANCE = 1e-9;

/** Return the only physical TH state, or null if none exists. */
export function uniqueTHState(T: number, h: number): BasicProperties | null {
  if (!Number.isFinite(T) || !Number.isFinite(h) || T < C.T_MIN || T > C.T_MAX) {
    return null;
  }

  const candidates: BasicProperties[] = [];
  const add = (state: BasicProperties): void => {
    // The same saturation endpoint or stationary point can bound two intervals.
    if (!candidates.some((other) =>
      Math.abs(other.pressure - state.pressure) <= 1e-9 * Math.max(1, Math.abs(state.pressure)) &&
      Math.abs(other.specificVolume - state.specificVolume) <=
        1e-9 * Math.max(other.specificVolume, state.specificVolume)
    )) {
      candidates.push(state);
    }
  };

  const addInterval = (
    evaluator: (p: number, T: number) => BasicProperties,
    lower: BasicProperties,
    upper: BasicProperties,
    includeLower = true,
    includeUpper = true,
  ): void => {
    if (upper.pressure < lower.pressure ||
        ((!includeLower || !includeUpper) && upper.pressure === lower.pressure)) return;
    const stateAt = (p: number, temperature: number): BasicProperties => {
      if (p === lower.pressure) return lower;
      if (p === upper.pressure) return upper;
      return evaluator(p, temperature);
    };
    const points = [
      lower,
      ...enthalpyStationaryPressures(T, lower.region, lower, upper)
        .map((p) => stateAt(p, T)),
      upper,
    ];

    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const residual = current.enthalpy - h;
      if (Math.abs(residual) <= ENTHALPY_ROOT_TOLERANCE) {
        if ((i > 0 || includeLower) && (i < points.length - 1 || includeUpper)) add(current);
      }
      if (i === 0) continue;
      const previous = points[i - 1];
      const previousResidual = previous.enthalpy - h;
      if (Math.abs(residual) <= ENTHALPY_ROOT_TOLERANCE ||
          Math.abs(previousResidual) <= ENTHALPY_ROOT_TOLERANCE ||
          previousResidual * residual >= 0) continue;

      add(solveFixedTemperaturePressure(
        stateAt, T, h, previous.pressure, current.pressure, 'enthalpy', 'solveTH',
      ));
    }
  };

  if (T > C.R5_T_MIN) {
    addInterval(region5, region5(C.P_MIN, T), region5(C.R5_P_MAX, T));
  } else if (T >= C.B23_T_MAX) {
    addInterval(region2, region2(C.P_MIN, T), region2(C.P_MAX, T));
  } else if (T >= C.Tc) {
    const p23 = Math.min(C.P_MAX, boundary23_T_to_P(T));
    const boundaryInRegion3 = T < boundary23_P_to_T(p23);
    addInterval(region2, region2(C.P_MIN, T), region2(p23, T), true, !boundaryInRegion3);
    addInterval(solveRegion3PTBasic,
      { ...solveRegion3PTBasic(p23, T), pressure: p23 },
      solveRegion3PTBasic(C.P_MAX, T), boundaryInRegion3);
  } else {
    const endpoints = saturationEndpointsAtTemperature(T);
    if (T >= C.Tt &&
        h >= endpoints.liquid.enthalpy - ENTHALPY_ROOT_TOLERANCE &&
        h <= endpoints.vapor.enthalpy + ENTHALPY_ROOT_TOLERANCE) {
      add(mixSaturationState(endpoints, qualityFromSaturationProperty(
        endpoints.liquid.enthalpy, endpoints.vapor.enthalpy, h,
      )));
    }

    if (T <= C.R2_T_MIN) {
      const boundaryInLiquid = T <= saturationTemperature(endpoints.pressure);
      addInterval(region1, region1(endpoints.pressure, T), region1(C.P_MAX, T), boundaryInLiquid);
      addInterval(region2, region2(C.P_MIN, T), region2(endpoints.pressure, T),
        true, T < C.Tt && !boundaryInLiquid);
    } else {
      const p23 = boundary23_T_to_P(T);
      const boundaryInRegion3 = T < boundary23_P_to_T(p23);
      addInterval(region2, region2(C.P_MIN, T), region2(p23, T), true, !boundaryInRegion3);
      // Keep the vapor and liquid Region 3 branches separate at saturation.
      addInterval(solveRegion3PTBasic,
        { ...solveRegion3PTBasic(p23, T), pressure: p23 }, endpoints.vapor, boundaryInRegion3);
      addInterval(solveRegion3PTBasic, endpoints.liquid, solveRegion3PTBasic(C.P_MAX, T));
    }
  }

  if (candidates.length > 1) {
    throw new AmbiguousStateError(T, h);
  }
  return candidates[0] ?? null;
}
