/**
 * IAPWS-IF97 Region 5: High-Temperature Steam
 *
 * Basic equation for the specific Gibbs free energy γ(π,τ) = γ°(π,τ) + γʳ(π,τ)
 * Valid for: 1073.15 K < T ≤ 2273.15 K, P ≤ 50 MPa
 *
 * Reference: IAPWS-IF97, Section 9 (Equations for Region 5)
 */

import { R } from '../constants.js';
import type { BasicProperties, CoefficientTable } from '../types.js';
import { Region } from '../types.js';

// ─── Ideal Part Coefficients (Table 37) ─────────────────────────────────────

const IDEAL_COEFFICIENTS: readonly (readonly [number, number])[] = [
  [0, -13.179983674201],
  [1, 6.8540841634434],
  [-3, -0.024805148933466],
  [-2, 0.36901534980333],
  [-1, -3.1161318213925],
  [2, -0.32961626538917],
] as const;

// ─── Residual Part Coefficients (Table 38) ──────────────────────────────────

const RESIDUAL_COEFFICIENTS: CoefficientTable = [
  [1, 1, 1.5736404855259e-3],
  [1, 2, 9.0153761673944e-4],
  [1, 3, -5.0270077677648e-3],
  [2, 3, 2.2440037409485e-6],
  [2, 9, -4.1163275453471e-6],
  [3, 7, 3.7919454822955e-8],
] as const;

/**
 * Compute Region 5 thermodynamic properties from pressure and temperature.
 *
 * @param p - Pressure [MPa]
 * @param T - Temperature [K]
 * @returns Basic thermodynamic properties
 */
export function region5(p: number, T: number): BasicProperties {
  const pi = p;
  const tau = 1000 / T;

  // ── Ideal part ──
  let gi = Math.log(pi);
  let gi_pi = 1 / pi;
  // gi_pipi = -1/(pi*pi) — not needed for Region 5 properties
  let gi_tau = 0;
  let gi_tautau = 0;

  for (const [J, N] of IDEAL_COEFFICIENTS) {
    gi += N * Math.pow(tau, J);
    gi_tau += N * J * Math.pow(tau, J - 1);
    gi_tautau += N * J * (J - 1) * Math.pow(tau, J - 2);
  }

  // ── Residual part ──
  let gr = 0;
  let gr_pi = 0;
  let gr_pipi = 0;
  let gr_tau = 0;
  let gr_tautau = 0;
  let gr_pitau = 0;

  for (const [I, J, N] of RESIDUAL_COEFFICIENTS) {
    const piPow = Math.pow(pi, I);
    const tauPow = Math.pow(tau, J);

    gr += N * piPow * tauPow;
    gr_pi += N * I * Math.pow(pi, I - 1) * tauPow;
    gr_pipi += N * I * (I - 1) * Math.pow(pi, I - 2) * tauPow;
    gr_tau += N * piPow * J * Math.pow(tau, J - 1);
    gr_tautau += N * piPow * J * (J - 1) * Math.pow(tau, J - 2);
    gr_pitau += N * I * Math.pow(pi, I - 1) * J * Math.pow(tau, J - 1);
  }

  const gp = gi_pi + gr_pi;
  const gt = gi_tau + gr_tau;
  const gtt = gi_tautau + gr_tautau;

  return {
    region: Region.Region5,
    pressure: p,
    temperature: T,
    specificVolume: R * T * pi * gp / (1000 * p),
    internalEnergy: R * T * (tau * gt - pi * gp),
    entropy: R * (tau * gt - (gi + gr)),
    enthalpy: R * T * tau * gt,
    cp: -R * tau * tau * gtt,
    cv: R * (
      -tau * tau * gtt -
      Math.pow(1 + pi * gr_pi - tau * pi * gr_pitau, 2) /
      (1 - pi * pi * gr_pipi)
    ),
    speedOfSound: Math.sqrt(
      1000 * R * T *
      (1 + 2 * pi * gr_pi + pi * pi * gr_pi * gr_pi) /
      (
        (1 - pi * pi * gr_pipi) +
        Math.pow(1 + pi * gr_pi - tau * pi * gr_pitau, 2) /
        (tau * tau * gtt)
      ),
    ),
    quality: null,
    isobaricExpansion: (1 + pi * gr_pi - tau * pi * gr_pitau) / (1 + pi * gr_pi) / T,
    isothermalCompressibility: (1 - pi * pi * gr_pipi) / (1 + pi * gr_pi) / p,
  };
}
