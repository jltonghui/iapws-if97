import type { FormulationSeamResolution } from '../core/formulation-seams.js';
import { NumericalStateError, RegionMismatchError } from '../errors.js';
import { IF97Error, Region, type BasicProperties } from '../types.js';
import {
  backwardCandidateError,
  normalizeBackwardState,
  validateBackwardState,
  type BackwardConstraint,
} from './solution-validation.js';

/** Exhaust nearby roots before applying inverse seam and saturation ownership. */
export function resolveBackwardCandidates(
  attempts: readonly (() => BasicProperties | null)[],
  constraints: readonly BackwardConstraint[],
  options: { solverName: string; seam?: FormulationSeamResolution },
): BasicProperties | null {
  const candidates: BasicProperties[] = [];
  let failure: IF97Error | null = null;
  for (const attempt of attempts) {
    try {
      let state = attempt();
      if (state !== null) {
        let error = backwardCandidateError(state, constraints, options);
        if (error instanceof RegionMismatchError) {
          state = normalizeBackwardState(state, constraints, options.solverName);
          error = backwardCandidateError(state, constraints, options);
        }
        if (error === null) candidates.push(state);
        else if (error instanceof NumericalStateError) failure ??= error;
      }
    } catch (error) {
      if (!(error instanceof IF97Error)) throw error;
      if (!(error instanceof RegionMismatchError)) failure ??= error;
    }
  }
  const saturated = candidates.find(({ region }) => region === Region.Region4);
  const owned = candidates.find(({ region }) => region === options.seam?.pair.canonical.region);
  if (candidates.length > 0) return saturated ?? owned ?? candidates[0];
  if (failure !== null) throw failure;
  if (options.seam !== undefined && options.seam.kind === 'gap') {
    return validateBackwardState(options.seam.state, constraints, options);
  }
  return null;
}
