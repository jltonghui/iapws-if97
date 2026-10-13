/**
 * Shared helper for T,H and T,S backward solvers.
 *
 * Solves for pressure at fixed temperature by matching a target property
 * (enthalpy or entropy) using a bracketed Newton method.
 */
import type { BasicProperties } from '../types.js';
import { IF97Error, Region } from '../types.js';
import { region3ByRhoT } from '../regions/region3.js';
import { bracketedNewton } from '../solvers/bracketed-newton.js';
import { gibbsPropertyDerivatives, helmholtzPropertyDerivatives } from './thermodynamic-derivatives.js';

/** Property being inverted against pressure at fixed temperature. */
export type FixedTemperatureProperty = 'enthalpy' | 'entropy';

function propertyValue(state: BasicProperties, property: FixedTemperatureProperty): number {
  return property === 'enthalpy' ? state.enthalpy : state.entropy;
}

/**
 * (∂h/∂p)_T = 1000·v(1 − Tα) or (∂s/∂p)_T = −1000·v·α, both per MPa.
 *
 * These are Maxwell-relation identities, so they hold for the Helmholtz-based
 * Region 3 states as well as the Gibbs-based regions. Returns NaN when a state
 * carries no cp/α, which makes the caller fall back to a bisection step.
 */
function pressureDerivative(
  state: BasicProperties,
  property: FixedTemperatureProperty,
): number {
  const derivatives = gibbsPropertyDerivatives(state);
  return property === 'enthalpy' ? derivatives.dhDp : derivatives.dsDp;
}

/**
 * Solve for pressure at fixed temperature by matching a target property value.
 *
 * Evaluates the region equation at the bracket endpoints first (short-circuit
 * if either already matches), then runs a bracketed Newton iteration driven by
 * the analytic pressure derivative (density derivative for Region 3 entropy).
 *
 * @param evaluator  - Region-specific equation returning BasicProperties from (p, T)
 * @param T          - Fixed temperature [K]
 * @param target     - Target property value (enthalpy or entropy)
 * @param lower      - Lower pressure bracket [MPa]
 * @param upper      - Upper pressure bracket [MPa]
 * @param property   - Which property `target` represents
 * @param solverName - Label used in error messages
 */
export function solveFixedTemperaturePressure(
  evaluator: (p: number, T: number) => BasicProperties,
  T: number,
  target: number,
  lower: number,
  upper: number,
  property: FixedTemperatureProperty,
  solverName: string,
): BasicProperties {
  const lowerState = evaluator(lower, T);
  const upperState = evaluator(upper, T);
  const useDensity = lowerState.region === Region.Region3 && property === 'entropy';
  // Density bounds keep Region 3 entropy iteration on the same saturation branch.
  const lowerBound = useDensity ? 1 / lowerState.specificVolume : lower;
  const upperBound = useDensity ? 1 / upperState.specificVolume : upper;

  // Keyed by p or ρ, so the residual and its derivative at the same point share one
  // equation evaluation regardless of the order the solver calls them in.
  let cachedInput = Number.NaN;
  let cachedState: BasicProperties | null = null;
  const stateAt = (input: number): BasicProperties => {
    if (input !== cachedInput || cachedState === null) {
      cachedInput = input;
      cachedState = useDensity ? region3ByRhoT(input, T) : evaluator(input, T);
    }
    return cachedState;
  };

  const rootTolerance = property === 'enthalpy' ? 1e-9 : 1e-12;
  if (Math.abs(propertyValue(lowerState, property) - target) <= rootTolerance) return lowerState;
  if (Math.abs(propertyValue(upperState, property) - target) <= rootTolerance) return upperState;

  const root = bracketedNewton(
    (input) => propertyValue(stateAt(input), property) - target,
    lowerBound,
    upperBound,
    (lowerBound + upperBound) / 2,
    {
      derivative: (input) => {
        if (useDensity) {
          return helmholtzPropertyDerivatives(stateAt(input), input).dsDrho;
        }
        return pressureDerivative(stateAt(input), property);
      },
      // Near-critical properties need a tighter bracket before termination.
      tolerance: 1e-12,
    },
  );

  const state = stateAt(root);
  if (!Number.isFinite(state.pressure)) {
    throw new IF97Error(`${solverName} failed to recover a valid pressure`);
  }
  return state;
}
