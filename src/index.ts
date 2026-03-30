/**
 * iapws-if97 — IAPWS-IF97 Steam/Water Properties Library
 *
 * Public API exports.
 */
import type { SteamState, SolveInput } from './types.js';
import { solve as solveAny, solvePT as solvePTInternal } from './core/solver.js';
import { normalizePublicState } from './core/public-normalization.js';

function normalizeSteamState(state: SteamState): SteamState {
  return normalizePublicState(state);
}

// Core solvers
// Normalize only at the public package boundary so internal solver math
// keeps full raw precision during iteration and region transitions.
export function solvePT(p: number, T: number): SteamState {
  return normalizeSteamState(solvePTInternal(p, T));
}

export function solve(input: SolveInput): SteamState {
  return normalizeSteamState(solveAny(input));
}

export function solvePH(p: number, h: number): SteamState {
  return normalizeSteamState(solveAny({ mode: 'PH', p, h }));
}

export function solvePS(p: number, s: number): SteamState {
  return normalizeSteamState(solveAny({ mode: 'PS', p, s }));
}

export function solveHS(h: number, s: number): SteamState {
  return normalizeSteamState(solveAny({ mode: 'HS', h, s }));
}

export function solveTH(T: number, h: number): SteamState {
  return normalizeSteamState(solveAny({ mode: 'TH', T, h }));
}

export function solveTS(T: number, s: number): SteamState {
  return normalizeSteamState(solveAny({ mode: 'TS', T, s }));
}

export function solvePx(p: number, x: number): SteamState {
  return normalizeSteamState(solveAny({ mode: 'Px', p, x }));
}

export function solveTx(T: number, x: number): SteamState {
  return normalizeSteamState(solveAny({ mode: 'Tx', T, x }));
}

// Types
export type { SteamState, SolveInput } from './types.js';
export { Region, IF97Error, OutOfRangeError, ConvergenceError } from './types.js';
