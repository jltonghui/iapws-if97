/**
 * IAPWS-IF97 Two-Phase Saturation Solvers
 *
 * Compute thermodynamic state given pressure+quality (solvePx)
 * or temperature+quality (solveTx).
 *
 * Reference: IAPWS-IF97, Region 4 (Saturation Line)
 */

import type { BasicProperties } from '../types.js';
import { OutOfRangeError } from '../types.js';
import { Pc, Tc, Pt, T_MIN } from '../constants.js';
import { saturationPressure } from '../regions/region4.js';
import { mixSaturationState, saturationEndpointsAtPressure } from './common.js';

// ─── solvePx ────────────────────────────────────────────────────────────────

/**
 * Solve for thermodynamic state given pressure and vapour quality.
 * @param p - Pressure [MPa], Pt <= p <= Pc
 * @param x - Vapour quality [0, 1]
 */
export function solvePx(p: number, x: number): BasicProperties {
  if (x < 0 || x > 1) {
    throw new OutOfRangeError('Quality', x, 0, 1);
  }
  if (p < Pt || p > Pc) {
    throw new OutOfRangeError('Pressure', p, Pt, Pc);
  }

  return mixSaturationState(saturationEndpointsAtPressure(p), x);
}

// ─── solveTx ────────────────────────────────────────────────────────────────

/**
 * Solve for thermodynamic state given temperature and vapour quality.
 * @param T - Temperature [K], T_MIN <= T <= Tc
 * @param x - Vapour quality [0, 1]
 */
export function solveTx(T: number, x: number): BasicProperties {
  if (x < 0 || x > 1) {
    throw new OutOfRangeError('Quality', x, 0, 1);
  }
  if (T < T_MIN || T > Tc) {
    throw new OutOfRangeError('Temperature', T, T_MIN, Tc);
  }

  const p = saturationPressure(T);
  return solvePx(p, x);
}
