/**
 * Public low-level saturation helper exports.
 *
 * These functions expose the mathematical Region 4 boundary relations.
 * They normalize values near Pt/Pc/Tt/Tc, but they are not state constructors:
 * high-level solvers such as solvePx/solveTx apply stricter triple-point and
 * critical-point rules.
 */

export { saturationPressure, saturationTemperature } from './regions/region4.js';
