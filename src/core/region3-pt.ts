/**
 * Region 3 P,T → BasicProperties solver.
 *
 * Region 3 is formulated as f(ρ, T), so a pressure target requires
 * iterating on density. This module provides that inversion.
 */
import type { BasicProperties } from '../types.js';
import * as C from '../constants.js';
import { IF97Error } from '../types.js';
import { region3ByRhoT } from '../regions/region3.js';
import { region3Volume } from '../regions/region3-subregions.js';
import { newtonRaphson } from '../solvers/newton-raphson.js';

/**
 * Solve for the Region 3 state at a target pressure and temperature.
 *
 * Newton-Raphson on p(ρ, T) − p_target = 0 using the analytic derivative
 * (∂p/∂ρ)_T = 1 / (ρ κ_T).
 *
 * @param p    - Target pressure [MPa]
 * @param T    - Temperature [K]
 * @param rho0 - Initial density guess [kg/m³]
 * @returns Basic thermodynamic properties at the converged density
 */
export function solveRegion3StateAtPressure(
  p: number,
  T: number,
  rho0: number,
): BasicProperties {
  // Keyed by ρ, so the residual and its derivative at the same point share one
  // equation evaluation regardless of the order the solver calls them in.
  let cachedRho = Number.NaN;
  let cachedState: BasicProperties | null = null;
  const stateAt = (rho: number): BasicProperties => {
    if (rho !== cachedRho || cachedState === null) {
      cachedRho = rho;
      cachedState = region3ByRhoT(rho, T);
    }
    return cachedState;
  };

  const rho = newtonRaphson(
    (rhoGuess) => {
      if (!Number.isFinite(rhoGuess) || rhoGuess <= 0) {
        return Number.NaN;
      }
      return stateAt(rhoGuess).pressure - p;
    },
    rho0,
    (rhoGuess) => {
      if (!Number.isFinite(rhoGuess) || rhoGuess <= 0) {
        return Number.NaN;
      }
      const kappa = stateAt(rhoGuess).isothermalCompressibility;
      return kappa === null ? Number.NaN : 1 / (rhoGuess * kappa);
    },
  );

  return stateAt(rho);
}

/**
 * Compute Region 3 basic properties from pressure and temperature.
 *
 * Uses the IAPWS-IF97 sub-region volume correlations for an initial density
 * guess, then refines with Newton-Raphson on p(ρ, T) − p_target = 0.
 *
 * @param p - Pressure [MPa]
 * @param T - Temperature [K]
 * @returns Basic thermodynamic properties for the Region 3 state
 * @throws {IF97Error} if the density solve does not converge
 */
export function solveRegion3PTBasic(p: number, T: number): BasicProperties {
  if (p === C.Pc && T === C.Tc) {
    return region3ByRhoT(C.RHOc, T);
  }

  const state = solveRegion3StateAtPressure(p, T, 1 / region3Volume(p, T));
  const relErr = Math.abs(state.pressure - p) / p;
  if (relErr > 1e-6) {
    throw new IF97Error(
      `solveRegion3PTBasic: density solve did not converge — target P=${p} MPa, got P=${state.pressure.toFixed(6)} MPa (relErr=${relErr.toExponential(2)})`,
    );
  }
  return state;
}
