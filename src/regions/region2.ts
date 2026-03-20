/**
 * IAPWS-IF97 Region 2: Superheated Steam
 *
 * Basic equation for the specific Gibbs free energy γ(π,τ) = γ°(π,τ) + γʳ(π,τ)
 * Valid for: 273.15 K ≤ T ≤ 623.15 K at Psat(T), and T ≤ 1073.15 K at P ≤ 100 MPa
 *
 * Reference: IAPWS-IF97, Section 6 (Equations for Region 2)
 */

import { R } from '../constants.js';
import type { BasicProperties, CoefficientTable } from '../types.js';
import { Region } from '../types.js';

// ─── Ideal Part Coefficients (Table 10) ─────────────────────────────────────

/** γ° coefficients: [_, J, N] (I is implicit for ideal part) */
const IDEAL_COEFFICIENTS: readonly (readonly [number, number])[] = [
  [0, -9.6927686500217],
  [1, 10.086655968018],
  [-5, -0.005608791128302],
  [-4, 0.071452738081455],
  [-3, -0.40710498223928],
  [-2, 1.4240819171444],
  [-1, -4.383951131945],
  [2, -0.28408632460772],
  [3, 0.021268463753307],
] as const;

// ─── Residual Part Coefficients (Table 11) ──────────────────────────────────

const RESIDUAL_COEFFICIENTS: CoefficientTable = [
  [1, 0, -1.7731742473213e-3],
  [1, 1, -0.017834862292358],
  [1, 2, -0.045996013696365],
  [1, 3, -0.057581259083432],
  [1, 6, -0.05032527872793],
  [2, 1, -3.3032641670203e-5],
  [2, 2, -1.8948987516315e-4],
  [2, 4, -3.9392777243355e-3],
  [2, 7, -0.043797295650573],
  [2, 36, -2.6674547914087e-5],
  [3, 0, 2.0481737692309e-8],
  [3, 1, 4.3870667284435e-7],
  [3, 3, -3.227767723857e-5],
  [3, 6, -1.5033924542148e-3],
  [3, 35, -0.040668253562649],
  [4, 1, -7.8847309559367e-10],
  [4, 2, 1.2790717852285e-8],
  [4, 3, 4.8225372718507e-7],
  [5, 7, 2.2922076337661e-6],
  [6, 3, -1.6714766451061e-11],
  [6, 16, -2.1171472321355e-3],
  [6, 35, -23.895741934104],
  [7, 0, -5.905956432427e-18],
  [7, 11, -1.2621808899101e-6],
  [7, 25, -0.038946842435739],
  [8, 8, 1.1256211360459e-11],
  [8, 36, -8.2311340897998],
  [9, 13, 1.9809712802088e-8],
  [10, 4, 1.0406965210174e-19],
  [10, 10, -1.0234747095929e-13],
  [10, 14, -1.0018179379511e-9],
  [16, 29, -8.0882908646985e-11],
  [16, 50, 0.10693031879409],
  [18, 57, -0.33662250574171],
  [20, 20, 8.9185845355421e-25],
  [20, 35, 3.0629316876232e-13],
  [20, 48, -4.2002467698208e-6],
  [21, 21, -5.9056029685639e-26],
  [22, 53, 3.7826947613457e-6],
  [23, 39, -1.2768608934681e-15],
  [24, 26, 7.3087610595061e-29],
  [24, 40, 5.5414715350778e-17],
  [24, 58, -9.436970724121e-7],
] as const;

/**
 * Compute Region 2 thermodynamic properties from pressure and temperature.
 *
 * @param p - Pressure [MPa]
 * @param T - Temperature [K]
 * @returns Basic thermodynamic properties
 */
export function region2(p: number, T: number): BasicProperties {
  const pi = p;
  const tau = 540.0 / T;

  // ── Ideal part derivatives ──
  let gi = Math.log(pi);
  let gi_pi = 1 / pi;
  // gi_pipi = -1/(pi*pi) — not needed for Region 2 properties
  let gi_tau = 0;
  let gi_tautau = 0;

  for (const [J, N] of IDEAL_COEFFICIENTS) {
    gi += N * Math.pow(tau, J);
    gi_tau += N * J * Math.pow(tau, J - 1);
    gi_tautau += N * J * (J - 1) * Math.pow(tau, J - 2);
  }

  // ── Residual part derivatives ──
  let gr = 0;
  let gr_pi = 0;
  let gr_pipi = 0;
  let gr_tau = 0;
  let gr_tautau = 0;
  let gr_pitau = 0;

  for (const [I, J, N] of RESIDUAL_COEFFICIENTS) {
    const piPow = Math.pow(pi, I);
    const tauShift = tau - 0.5;
    const tauPow = Math.pow(tauShift, J);

    gr += N * piPow * tauPow;
    gr_pi += N * I * Math.pow(pi, I - 1) * tauPow;
    gr_pipi += N * I * (I - 1) * Math.pow(pi, I - 2) * tauPow;
    gr_tau += N * piPow * J * Math.pow(tauShift, J - 1);
    gr_tautau += N * piPow * J * (J - 1) * Math.pow(tauShift, J - 2);
    gr_pitau += N * I * Math.pow(pi, I - 1) * J * Math.pow(tauShift, J - 1);
  }

  const gp = gi_pi + gr_pi;
  const gt = gi_tau + gr_tau;
  const gtt = gi_tautau + gr_tautau;

  return {
    region: Region.Region2,
    pressure: p,
    temperature: T,
    specificVolume: (R * T / (1000 * p)) * pi * gp,
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
