/**
 * iapws-if97 — IAPWS-IF97 Steam/Water Properties Library
 *
 * Public API exports.
 */
import type { SteamState } from './types.js';
import { solve as solveAny } from './core/solver.js';

// Core solvers
export { solve, solveBasic, solvePT } from './core/solver.js';

export function solvePH(p: number, h: number): SteamState {
  return solveAny({ mode: 'PH', p, h });
}

export function solvePS(p: number, s: number): SteamState {
  return solveAny({ mode: 'PS', p, s });
}

export function solveHS(h: number, s: number): SteamState {
  return solveAny({ mode: 'HS', h, s });
}

export function solveTH(T: number, h: number): SteamState {
  return solveAny({ mode: 'TH', T, h });
}

export function solveTS(T: number, s: number): SteamState {
  return solveAny({ mode: 'TS', T, s });
}

export function solvePx(p: number, x: number): SteamState {
  return solveAny({ mode: 'Px', p, x });
}

export function solveTx(T: number, x: number): SteamState {
  return solveAny({ mode: 'Tx', T, x });
}

// Types
export type { BasicProperties, SaturationEndpoints, SteamState, SolveInput } from './types.js';
export { Region, IF97Error, AmbiguousStateError, OutOfRangeError, ConvergenceError } from './types.js';
