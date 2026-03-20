/**
 * IAPWS-IF97 Region 1: Subcooled Liquid
 *
 * Basic equation for the specific Gibbs free energy γ(π,τ)
 * Valid for: 273.15 K ≤ T ≤ 623.15 K, Psat(T) ≤ P ≤ 100 MPa
 *
 * Reference: IAPWS-IF97, Section 5 (Equations for Region 1)
 */

import { R } from '../constants.js';
import type { BasicProperties, CoefficientTable } from '../types.js';
import { Region } from '../types.js';

// ─── Coefficient Table (Table 2, IAPWS-IF97) ───────────────────────────────

const COEFFICIENTS: CoefficientTable = [
  [0, -2, 0.14632971213167],
  [0, -1, -0.84548187169114],
  [0, 0, -3.756360367204],
  [0, 1, 3.3855169168385],
  [0, 2, -0.95791963387872],
  [0, 3, 0.15772038513228],
  [0, 4, -0.016616417199501],
  [0, 5, 8.1214629983568e-4],
  [1, -9, 2.8319080123804e-4],
  [1, -7, -6.0706301565874e-4],
  [1, -1, -0.018990068218419],
  [1, 0, -0.032529748770505],
  [1, 1, -0.021841717175414],
  [1, 3, -5.283835796993e-5],
  [2, -3, -4.7184321073267e-4],
  [2, 0, -3.0001780793026e-4],
  [2, 1, 4.7661393906987e-5],
  [2, 3, -4.4141845330846e-6],
  [2, 17, -7.2694996297594e-16],
  [3, -4, -3.1679644845054e-5],
  [3, 0, -2.8270797985312e-6],
  [3, 6, -8.5205128120103e-10],
  [4, -5, -2.2425281908e-6],
  [4, -2, -6.5171222895601e-7],
  [4, 10, -1.4341729937924e-13],
  [5, -8, -4.0516996860117e-7],
  [8, -11, -1.2734301741641e-9],
  [8, -6, -1.7424871230634e-10],
  [21, -29, -6.8762131295531e-19],
  [23, -31, 1.4478307828521e-20],
  [29, -38, 2.6335781662795e-23],
  [30, -39, -1.1947622640071e-23],
  [31, -40, 1.8228094581404e-24],
  [32, -41, -9.3537087292458e-26],
] as const;

// Reduction constants for Region 1
const PI_STAR = 16.53;  // P* [MPa]
const TAU_STAR = 1386.0; // T* [K]

/**
 * Compute Region 1 thermodynamic properties from pressure and temperature.
 *
 * @param p - Pressure [MPa]
 * @param T - Temperature [K]
 * @returns Basic thermodynamic properties
 */
export function region1(p: number, T: number): BasicProperties {
  const pi = p / PI_STAR;
  const tau = TAU_STAR / T;

  // Reduced Gibbs free energy and its derivatives
  let g = 0;
  let g_pi = 0;
  let g_pipi = 0;
  let g_tau = 0;
  let g_tautau = 0;
  let g_pitau = 0;

  for (const [I, J, N] of COEFFICIENTS) {
    const piTerm = Math.pow(7.1 - pi, I);
    const tauTerm = Math.pow(tau - 1.222, J);

    g += N * piTerm * tauTerm;
    g_pi += -N * I * Math.pow(7.1 - pi, I - 1) * tauTerm;
    g_pipi += N * I * (I - 1) * Math.pow(7.1 - pi, I - 2) * tauTerm;
    g_tau += N * piTerm * J * Math.pow(tau - 1.222, J - 1);
    g_tautau += N * piTerm * J * (J - 1) * Math.pow(tau - 1.222, J - 2);
    g_pitau += -N * I * Math.pow(7.1 - pi, I - 1) * J * Math.pow(tau - 1.222, J - 1);
  }

  return {
    region: Region.Region1,
    pressure: p,
    temperature: T,
    specificVolume: R * T * pi * g_pi / (1000 * p),
    internalEnergy: R * T * (tau * g_tau - pi * g_pi),
    entropy: R * (tau * g_tau - g),
    enthalpy: R * T * tau * g_tau,
    cp: R * (-tau * tau * g_tautau),
    cv: R * (-tau * tau * g_tautau + Math.pow(g_pi - tau * g_pitau, 2) / g_pipi),
    speedOfSound: Math.sqrt(
      1000 * R * T * g_pi * g_pi /
      (Math.pow(g_pi - tau * g_pitau, 2) / (tau * tau * g_tautau) - g_pipi),
    ),
    quality: null,
    isobaricExpansion: (1 - tau * g_pitau / g_pi) / T,
    isothermalCompressibility: -pi * g_pipi / g_pi / p,
  };
}
