/**
 * Main IF97 solve dispatcher.
 * Computes basic or full thermodynamic states.
 */
import type { BasicProperties, SteamState, SolveInput } from '../types.js';
import { Region, IF97Error, OutOfRangeError } from '../types.js';
import * as C from '../constants.js';
import { region1 } from '../regions/region1.js';
import { region2 } from '../regions/region2.js';
import { region5 } from '../regions/region5.js';
import { detectRegionPT } from './region-detector.js';
import { solveRegion3PTBasic } from './region3-pt.js';
import { assertFiniteNumber } from './input-validation.js';
import { normalizeSolveInput } from './solve-input-normalization.js';
import { viscosity, thermalConductivity, surfaceTension, dielectricConstant, ionizationConstant } from '../transport/properties.js';
import { solvePH } from '../backward/ph.js';
import { solvePS } from '../backward/ps.js';
import { solveHS } from '../backward/hs.js';
import { solveTH } from '../backward/th.js';
import { solveTS } from '../backward/ts.js';
import { solvePx, solveTx } from '../saturation/two-phase.js';

/**
 * Compute full thermodynamic state from basic properties by adding transport properties.
 */
function enrichState(basic: BasicProperties): SteamState {
  const isTwoPhaseMixture = basic.region === Region.Region4
    && basic.quality !== null
    && basic.quality > 0
    && basic.quality < 1;
  const rho = 1 / basic.specificVolume;
  const mu = isTwoPhaseMixture ? null : viscosity(basic.temperature, rho);
  const drhodP_T = basic.isothermalCompressibility === null
    ? undefined
    : rho * basic.isothermalCompressibility;
  const cp = basic.cp ?? undefined;
  const cv = basic.cv ?? undefined;
  return {
    ...basic,
    density: rho,
    viscosity: mu,
    thermalConductivity: isTwoPhaseMixture
      ? null
      : thermalConductivity(
        basic.temperature, rho,
        cp, cv, drhodP_T, mu ?? undefined,
      ),
    surfaceTension: basic.region === Region.Region4
      ? surfaceTension(basic.temperature)
      : null,
    dielectricConstant: isTwoPhaseMixture ? null : dielectricConstant(basic.temperature, rho),
    ionizationConstant: isTwoPhaseMixture ? null : ionizationConstant(basic.temperature, rho),
  };
}

/**
 * Solve for basic thermodynamic state given pressure and temperature.
 *
 * @param p - Pressure [MPa]
 * @param T - Temperature [K]
 * @returns Basic thermodynamic properties without transport
 */
function solvePTBasic(p: number, T: number): BasicProperties {
  assertFiniteNumber('Pressure', p);
  assertFiniteNumber('Temperature', T);

  if (p < C.P_MIN || p > C.P_MAX) {
    throw new OutOfRangeError('Pressure', p, C.P_MIN, C.P_MAX);
  }
  if (T < C.T_MIN || T > C.T_MAX) {
    throw new OutOfRangeError('Temperature', T, C.T_MIN, C.T_MAX);
  }
  if (T > C.R5_T_MIN && p > C.R5_P_MAX) {
    throw new OutOfRangeError('Pressure', p, C.P_MIN, C.R5_P_MAX);
  }
  if (T === C.Tc && p === C.Pc) {
    throw new IF97Error(
      `solvePT does not support the exact critical point P=${C.Pc} MPa, T=${C.Tc} K because derivative properties become singular`,
    );
  }

  const region = detectRegionPT(p, T);
  let basic: BasicProperties;

  switch (region) {
    case Region.Region1:
      basic = region1(p, T);
      break;
    case Region.Region2:
      basic = region2(p, T);
      break;
    case Region.Region3:
      basic = solveRegion3PTBasic(p, T);
      break;
    case Region.Region5:
      basic = region5(p, T);
      break;
    default:
      throw new IF97Error(`Cannot determine region for P=${p} MPa, T=${T} K`);
  }

  return basic;
}

/**
 * Solve for full thermodynamic state given pressure [MPa] and temperature [K].
 */
export function solvePT(p: number, T: number): SteamState {
  return enrichState(solvePTBasic(p, T));
}

/**
 * Compute basic thermodynamic properties from any supported input pair.
 * Accepts either shorthand or long-form input field names, without transport enrichment.
 */
export function solveBasic(input: SolveInput): BasicProperties {
  const normalized = normalizeSolveInput(input);

  switch (normalized.mode) {
    case 'PT': return solvePTBasic(normalized.p, normalized.T);
    case 'PH': return solvePH(normalized.p, normalized.h);
    case 'PS': return solvePS(normalized.p, normalized.s);
    case 'HS': return solveHS(normalized.h, normalized.s);
    case 'Px': return solvePx(normalized.p, normalized.x);
    case 'Tx': return solveTx(normalized.T, normalized.x);
    case 'TH': return solveTH(normalized.T, normalized.h);
    case 'TS': return solveTS(normalized.T, normalized.s);
    default:
      throw new IF97Error(`Unsupported solve mode: ${(input as { mode?: unknown }).mode ?? 'undefined'}`);
  }
}

/** Compute the full thermodynamic state, including transport properties. */
export function solve(input: SolveInput): SteamState {
  return enrichState(solveBasic(input));
}
