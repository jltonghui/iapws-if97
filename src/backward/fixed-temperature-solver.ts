/**
 * Shared helper for T,H and T,S backward solvers.
 *
 * Solves for pressure at fixed temperature by matching a target property
 * (enthalpy or entropy) using a bracketed Newton method.
 */
import type { BasicProperties } from '../types.js';
import { IF97Error } from '../types.js';
import { bracketedNewton } from '../solvers/bracketed-newton.js';
import { gibbsPropertyDerivatives } from './thermodynamic-derivatives.js';

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
 * the analytic pressure derivative.
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
  // Keyed by p, so the residual and its derivative at the same point share one
  // equation evaluation regardless of the order the solver calls them in.
  let cachedPressure = Number.NaN;
  let cachedState: BasicProperties | null = null;
  const stateAt = (p: number): BasicProperties => {
    if (p !== cachedPressure || cachedState === null) {
      cachedPressure = p;
      cachedState = evaluator(p, T);
    }
    return cachedState;
  };

  const lowerState = evaluator(lower, T);
  const upperState = evaluator(upper, T);

  if (Math.abs(propertyValue(lowerState, property) - target) <= 1e-9) return lowerState;
  if (Math.abs(propertyValue(upperState, property) - target) <= 1e-9) return upperState;

  const pressure = bracketedNewton(
    (p) => propertyValue(stateAt(p), property) - target,
    lower,
    upper,
    (lower + upper) / 2,
    { derivative: (p) => pressureDerivative(stateAt(p), property) },
  );

  const state = stateAt(pressure);
  if (!Number.isFinite(state.pressure)) {
    throw new IF97Error(`${solverName} failed to recover a valid pressure`);
  }
  return state;
}
