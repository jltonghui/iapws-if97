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

  const v0 = region3Volume(p, T);
  const rho = newtonRaphson(
    (rhoGuess) => region3ByRhoT(rhoGuess, T).pressure - p,
    1 / v0,
  );

  const state = region3ByRhoT(rho, T);
  const relErr = Math.abs(state.pressure - p) / p;
  if (relErr > 1e-6) {
    throw new IF97Error(
      `solveRegion3PTBasic: density solve did not converge — target P=${p} MPa, got P=${state.pressure.toFixed(6)} MPa (relErr=${relErr.toExponential(2)})`,
    );
  }
  return state;
}
