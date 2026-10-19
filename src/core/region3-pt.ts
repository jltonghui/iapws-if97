/**
 * Region 3 P,T → BasicProperties solver.
 *
 * Region 3 is formulated as f(ρ, T), so a pressure target requires
 * iterating on density. This module provides that inversion.
 */
import type { BasicProperties } from '../types.js';
import * as C from '../constants.js';
import { IF97Error } from '../types.js';
import { region3ByRhoT, region3PressureResidual } from '../regions/region3.js';
import { region3Volume } from '../regions/region3-subregions.js';
import { saturationPressure, saturationPressurePair } from '../regions/region4.js';
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
  pressureLow = 0,
): BasicProperties {
  // Cache full EOS properties for the density derivative and final state.
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
      return region3PressureResidual(rhoGuess, T, p, pressureLow);
    },
    rho0,
    (rhoGuess) => {
      if (!Number.isFinite(rhoGuess) || rhoGuess <= 0) {
        return Number.NaN;
      }
      const kappa = stateAt(rhoGuess).isothermalCompressibility;
      return kappa === null ? Number.NaN : 1 / (rhoGuess * kappa);
    },
    { tolerance: 1e-12 },
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

  const saturation = T < C.Tc ? saturationPressure(T) : null;
  const pressurePair = p === saturation ? saturationPressurePair(T) : null;
  const pressureLow = pressurePair?.[0] === p ? pressurePair[1] : 0;
  const state = solveRegion3StateAtPressure(p, T, 1 / region3Volume(p, T), pressureLow);
  const relErr = Math.abs(state.pressure - p) / p;
  if (relErr > 1e-12) {
    throw new IF97Error(
      `solveRegion3PTBasic: density solve did not converge — target P=${p} MPa, got P=${state.pressure.toFixed(6)} MPa (relErr=${relErr.toExponential(2)})`,
    );
  }
  const rho = 1 / state.specificVolume;
  const liquid = saturation !== null && p >= saturation;
  if ((T < C.Tc && (liquid ? rho <= C.RHOc : rho >= C.RHOc)) ||
      ![state.cp, state.cv, state.isothermalCompressibility, state.speedOfSound]
        .every((value) => value !== null && Number.isFinite(value) && value > 0)) {
    throw new IF97Error(
      `Region 3 numerical inconsistency at p=${p} MPa, T=${T} K: cannot construct the requested stable ${T < C.Tc ? liquid ? 'liquid' : 'vapor' : 'single-phase'} EOS branch`,
    );
  }
  return { ...state, pressure: p };
}
