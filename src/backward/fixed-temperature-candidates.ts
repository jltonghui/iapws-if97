import * as C from '../constants.js';
import { normalizePublicState } from '../core/public-normalization.js';
import { solveRegion3PTBasic } from '../core/region3-pt.js';
import { formulationSeamAtTemperature, matchFixedSeam } from '../core/formulation-seams.js';
import { boundary23_T_to_P } from '../regions/boundaries.js';
import { region1 } from '../regions/region1.js';
import { region2 } from '../regions/region2.js';
import { region5 } from '../regions/region5.js';
import {
  mixSaturationState,
  qualityFromSaturationProperty,
  saturationEndpointsAtTemperature,
} from '../saturation/common.js';
import type { BasicProperties } from '../types.js';
import { AmbiguousStateError } from '../types.js';
import { createFixedTemperatureStationaryPressureFinder } from './fixed-temperature-stationary.js';
import { solveFixedTemperaturePressure, type FixedTemperatureProperty } from './fixed-temperature-solver.js';
import { validateBackwardState } from './solution-validation.js';

/** Return the only physical TH/TS state, or null if none exists. */
export function uniqueFixedTemperatureState(
  T: number,
  target: number,
  property: FixedTemperatureProperty,
): BasicProperties | null {
  if (!Number.isFinite(T) || !Number.isFinite(target) || T < C.T_MIN || T > C.T_MAX) {
    return null;
  }

  const solverName = property === 'enthalpy' ? 'solveTH' : 'solveTS';
  const rootTolerance = property === 'enthalpy' ? 1e-9 : 1e-12;
  const candidates: BasicProperties[] = [];
  const seamPair = formulationSeamAtTemperature(T);
  const seam = seamPair === null ? null : matchFixedSeam(seamPair, property, target, 'temperature');
  const incidentCandidates = new Set<BasicProperties>();
  const stationaryPressures = createFixedTemperatureStationaryPressureFinder(T, property);
  const sameState = (first: BasicProperties, second: BasicProperties): boolean =>
    Math.abs(first.pressure - second.pressure) <= 1e-9 * Math.max(1, Math.abs(second.pressure)) &&
    Math.abs(first.specificVolume - second.specificVolume) <=
      1e-9 * Math.max(first.specificVolume, second.specificVolume);
  const add = (state: BasicProperties, incident = false): void => {
    // The same saturation endpoint or stationary point can bound two intervals.
    let existing = candidates.find((other) => sameState(other, state));
    if (existing !== undefined && incident && seam?.kind === 'overlap' &&
        state.region === seam.state.region && existing.region !== state.region) {
      candidates[candidates.indexOf(existing)] = state;
      incidentCandidates.delete(existing);
      existing = state;
    }
    if (existing === undefined) {
      candidates.push(state);
    }
    if (incident) incidentCandidates.add(existing ?? state);
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
      ...stationaryPressures(lower, upper)
        .map((p) => stateAt(p, T)),
      upper,
    ];
    const lowerIncident = seamPair !== null && lower.pressure === seamPair.pressure;
    const upperIncident = seamPair !== null && upper.pressure === seamPair.pressure;

    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const residual = current[property] - target;
      const currentIncluded = (i > 0 || includeLower) && (i < points.length - 1 || includeUpper);
      const currentMatches = Math.abs(residual) <= rootTolerance &&
        (currentIncluded || candidates.some((other) => sameState(other, current)));
      if (currentMatches && currentIncluded) {
        add(current, (i === 0 && lowerIncident) || (i === points.length - 1 && upperIncident));
      }
      if (!currentIncluded && Math.abs(residual) <= rootTolerance && !currentMatches) {
        // The closest admissible float is the endpoint of the supported pressure domain.
        const bits = new DataView(new ArrayBuffer(8));
        bits.setFloat64(0, current.pressure);
        bits.setBigUint64(0, bits.getBigUint64(0) + (i === 0 ? 1n : -1n));
        const pressure = bits.getFloat64(0);
        if (pressure > lower.pressure && pressure < upper.pressure) {
          const interior = stateAt(pressure, T);
          if (Math.abs(interior[property] - target) <= rootTolerance) {
            add(interior, (i === 0 && lowerIncident) || (i === points.length - 1 && upperIncident));
          }
        }
      }
      if (i === 0) continue;
      const previous = points[i - 1];
      const previousResidual = previous[property] - target;
      const previousIncluded = i > 1 || includeLower;
      const previousMatches = Math.abs(previousResidual) <= rootTolerance &&
        (previousIncluded || candidates.some((other) => sameState(other, previous)));
      // An excluded endpoint cannot hide a root just inside its open interval.
      if (currentMatches || previousMatches ||
          previousResidual * residual >= 0) continue;

      add(solveFixedTemperaturePressure(
        stateAt, T, target, previous.pressure, current.pressure, property, solverName,
        previousIncluded, currentIncluded,
      ), (i === 1 && lowerIncident) || (i === points.length - 1 && upperIncident));
    }
  };

  if (T > C.R5_T_MIN) {
    addInterval(region5, region5(C.P_MIN, T), region5(C.R5_P_MAX, T));
  } else if (T >= C.B23_T_MAX) {
    addInterval(region2, region2(C.P_MIN, T), region2(C.P_MAX, T));
  } else if (T >= C.Tc) {
    const p23 = Math.min(C.P_MAX, boundary23_T_to_P(T));
    addInterval(region2, region2(C.P_MIN, T), region2(p23, T), true, false);
    addInterval(solveRegion3PTBasic,
      { ...solveRegion3PTBasic(p23, T), pressure: p23 },
      solveRegion3PTBasic(C.P_MAX, T));
  } else {
    const endpoints = saturationEndpointsAtTemperature(T);
    if (T >= C.Tt &&
        target >= endpoints.liquid[property] - rootTolerance &&
        target <= endpoints.vapor[property] + rootTolerance) {
      add(mixSaturationState(endpoints, qualityFromSaturationProperty(
        endpoints.liquid[property], endpoints.vapor[property], target,
      )));
    }

    if (T <= C.R2_T_MIN) {
      addInterval(region1, region1(endpoints.pressure, T), region1(C.P_MAX, T));
      addInterval(region2, region2(C.P_MIN, T), region2(endpoints.pressure, T),
        true, false);
    } else {
      const p23 = boundary23_T_to_P(T);
      addInterval(region2, region2(C.P_MIN, T), region2(p23, T), true, false);
      // Keep the vapor and liquid Region 3 branches separate at saturation.
      addInterval(solveRegion3PTBasic,
        { ...solveRegion3PTBasic(p23, T), pressure: p23 }, endpoints.vapor);
      addInterval(solveRegion3PTBasic, endpoints.liquid, solveRegion3PTBasic(C.P_MAX, T));
    }
  }

  if (seam !== null) {
    if (seam.kind === 'canonical') {
      for (let i = candidates.length - 1; i >= 0; i--) {
        if (incidentCandidates.has(candidates[i])) candidates.splice(i, 1);
      }
      add(seam.state);
    } else if (seam.kind === 'overlap') {
      const canonical = candidates.find((state) => incidentCandidates.has(state) &&
        state.region === seam.pair.canonical.region);
      if (canonical !== undefined) {
        for (let i = candidates.length - 1; i >= 0; i--) {
          if (candidates[i] !== canonical && incidentCandidates.has(candidates[i])) candidates.splice(i, 1);
        }
      }
    } else if (candidates.length === 0) {
      add(seam.state);
    }
  }

  const validate = (state: BasicProperties): BasicProperties => validateBackwardState(state, [
    { label: 'temperature', expected: T },
    { label: property, expected: target },
  ], {
    solverName,
    expectedRegion: state.region,
    ...(seam !== null && state === seam.state ? { seam } : {}),
  });
  if (candidates.length > 1) {
    const validated = candidates.map((state) => normalizePublicState(validate(state)));
    validated.sort((first, second) => first.pressure - second.pressure);
    throw new AmbiguousStateError(T, target, property, validated);
  }
  return candidates.length === 0 ? null : validate(candidates[0]);
}
