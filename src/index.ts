/**
 * iapws-if97 — IAPWS-IF97 Steam/Water Properties Library
 *
 * Public API exports.
 */

// Core solvers
export { solvePT, solve } from './core/solver.js';
export { solvePH } from './backward/ph.js';
export { solvePS } from './backward/ps.js';
export { solveHS } from './backward/hs.js';
export { solvePx, solveTx } from './saturation/two-phase.js';

// Types
export type { SteamState, BasicProperties, SolveInput } from './types.js';
export { Region, IF97Error, OutOfRangeError, ConvergenceError } from './types.js';

// Region functions (for advanced usage)
export { region1 } from './regions/region1.js';
export { region2 } from './regions/region2.js';
export { region3ByRhoT } from './regions/region3.js';
export { saturationPressure, saturationTemperature } from './regions/region4.js';
export { region5 } from './regions/region5.js';
export { boundary23_T_to_P, boundary23_P_to_T } from './regions/boundaries.js';
export { region3Volume, region3SatVolume } from './regions/region3-subregions.js';

// Transport properties (for advanced usage)
export { viscosity, thermalConductivity, surfaceTension, dielectricConstant, ionizationConstant } from './transport/properties.js';

// Region detection
export { detectRegionPT, detectRegionPH, detectRegionPS, detectRegionHS } from './core/region-detector.js';
