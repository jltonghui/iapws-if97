/**
 * IAPWS-IF97 Backward Equations: H-S -> P, T
 *
 * Given specific enthalpy and entropy, compute pressure and temperature.
 * Uses backward P(h,s) equations for initial guesses + damped Newton refinement.
 *
 * Reference: IAPWS-IF97 Supplementary Release on Backward Equations p(h,s)
 */

import type { BasicProperties } from '../types.js';
import { Region, IF97Error, OutOfRangeError } from '../types.js';
import { RegionMismatchError } from '../errors.js';
import * as C from '../constants.js';
import { assertFiniteNumber, withinClosedLowerBound } from '../core/input-validation.js';
import { classifyRegionHS, type HSClassificationCandidate } from './hs-region.js';
import { solveHSInRegion } from './hs-state.js';
import { assertCriticalRegion4HSInput } from '../saturation/region4-boundaries.js';

/**
 * Solve for thermodynamic state given H and S.
 * @param h - Specific enthalpy [kJ/kg]
 * @param s - Specific entropy [kJ/(kg·K)]
 */
export function solveHS(h: number, s: number): BasicProperties {
  assertFiniteNumber('Enthalpy', h);
  assertFiniteNumber('Entropy', s);

  if (!withinClosedLowerBound(h, C.H_MIN, 'enthalpy') || h > C.H_MAX) {
    throw new OutOfRangeError('Enthalpy', h, C.H_MIN, C.H_MAX);
  }
  if (!withinClosedLowerBound(s, C.S_MIN, 'entropy') || s > C.S_MAX) {
    throw new OutOfRangeError('Entropy', s, C.S_MIN, C.S_MAX);
  }
  assertCriticalRegion4HSInput(h, s, 'solveHS');

  const candidate: HSClassificationCandidate = {};
  const region = classifyRegionHS(h, s, candidate);
  if (candidate.state !== undefined) return candidate.state;
  try {
    return solveHSInRegion(h, s, region);
  } catch (error) {
    if (!(error instanceof RegionMismatchError) || error.solverName !== 'solveHS' ||
        error.expectedRegion !== region) throw error;
    const adjacent = error.actualRegion;
    if (!(adjacent === Region.Region3 && (region === Region.Region1 || region === Region.Region2)) &&
        !(region === Region.Region3 && (adjacent === Region.Region1 || adjacent === Region.Region2))) {
      throw error;
    }
    try {
      return solveHSInRegion(h, s, adjacent);
    } catch (alternateError) {
      if (!(alternateError instanceof IF97Error)) throw alternateError;
      throw error;
    }
  }
}
