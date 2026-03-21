/**
 * iapws-if97 — IAPWS-IF97 Steam/Water Properties Library
 *
 * Public API exports.
 */
import type { BasicProperties, SteamState, SolveInput } from './types.js';
import { solve as solveAny, solvePT as solvePTInternal } from './core/solver.js';
import { normalizePublicState } from './core/public-normalization.js';
import { solvePH as solvePHInternal } from './backward/ph.js';
import { solvePS as solvePSInternal } from './backward/ps.js';
import { solveHS as solveHSInternal } from './backward/hs.js';
import { solveTH as solveTHInternal } from './backward/th.js';
import { solveTS as solveTSInternal } from './backward/ts.js';
import { solvePx as solvePxInternal, solveTx as solveTxInternal } from './saturation/two-phase.js';

function normalizeBasicState(state: BasicProperties): BasicProperties {
  return normalizePublicState(state);
}

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

export function solvePH(p: number, h: number): BasicProperties {
  return normalizeBasicState(solvePHInternal(p, h));
}

export function solvePS(p: number, s: number): BasicProperties {
  return normalizeBasicState(solvePSInternal(p, s));
}

export function solveHS(h: number, s: number): BasicProperties {
  return normalizeBasicState(solveHSInternal(h, s));
}

export function solveTH(T: number, h: number): BasicProperties {
  return normalizeBasicState(solveTHInternal(T, h));
}

export function solveTS(T: number, s: number): BasicProperties {
  return normalizeBasicState(solveTSInternal(T, s));
}

export function solvePx(p: number, x: number): BasicProperties {
  return normalizeBasicState(solvePxInternal(p, x));
}

export function solveTx(T: number, x: number): BasicProperties {
  return normalizeBasicState(solveTxInternal(T, x));
}

// Types
export type { SteamState, SolveInput } from './types.js';
export { Region, IF97Error, OutOfRangeError, ConvergenceError } from './types.js';
