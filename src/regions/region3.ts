/**
 * IAPWS-IF97 Region 3: Supercritical Fluid
 *
 * Basic equation for the specific Helmholtz free energy φ(δ,τ)
 * Valid for: 623.15 K ≤ T ≤ T_B23(P), P_B23(T) ≤ P ≤ 100 MPa
 *
 * Reference: IAPWS-IF97, Section 7 (Equations for Region 3)
 */

import { R } from '../constants.js';
import type { BasicProperties, CoefficientTable } from '../types.js';
import { Region } from '../types.js';

// ─── Coefficient Table (Table 30, IAPWS-IF97) ──────────────────────────────

const COEFFICIENTS: CoefficientTable = [
  // Entry 0 is the coefficient n₁ for the logarithmic term n₁·ln(δ).
  // It shares the [I=0, J=0] shape with entry 1 but is handled separately
  // in the evaluation loop (index 0 = ln term, indices 1+ = polynomial).
  [0, 0, 1.0658070028513],
  [0, 0, -0.15732845290239e2],
  [0, 1, 0.20944396974307e2],
  [0, 2, -0.76867707878716e1],
  [0, 7, 0.26185947787954e1],
  [0, 10, -0.28080781148620e1],
  [0, 12, 0.12053369696517e1],
  [0, 23, -0.84566812812502e-2],
  [1, 2, -0.12654315477714e1],
  [1, 6, -0.11524407806681e1],
  [1, 15, 0.88521043984318],
  [1, 17, -0.64207765181607],
  [2, 0, 0.38493460186671],
  [2, 2, -0.85214708824206],
  [2, 6, 0.48972281541877e1],
  [2, 7, -0.30502617256965e1],
  [2, 22, 0.39420536879154e-1],
  [2, 26, 0.12558408424308],
  [3, 0, -0.27999329698710],
  [3, 2, 0.13899799569460e1],
  [3, 4, -0.20189915023570e1],
  [3, 16, -0.82147637173963e-2],
  [3, 26, -0.47596035734923],
  [4, 0, 0.43984074473500e-1],
  [4, 2, -0.44476435428739],
  [4, 4, 0.90572070719733],
  [4, 26, 0.70522450087967],
  [5, 1, 0.10770512626332],
  [5, 3, -0.32913623258954],
  [5, 26, -0.50871062041158],
  [6, 0, -0.22175400873096e-1],
  [6, 2, 0.94260751665092e-1],
  [6, 26, 0.16436278447961],
  [7, 2, -0.13503372241348e-1],
  [8, 26, -0.14834345352472e-1],
  [9, 2, 0.57922953628084e-3],
  [9, 26, 0.32308904703711e-2],
  [10, 0, 0.80964802996215e-4],
  [10, 1, -0.16557679795037e-3],
  [11, 26, -0.44923899061815e-4],
] as const;

// Reduction constants for Region 3
const RHO_STAR = 322; // ρ* [kg/m³] (critical density)
const T_STAR = 647.096; // T* [K] (critical temperature)

/**
 * Compute Region 3 thermodynamic properties from density and temperature.
 *
 * @param rho - Density [kg/m³]
 * @param T   - Temperature [K]
 * @returns Basic thermodynamic properties
 */
export function region3ByRhoT(rho: number, T: number): BasicProperties {
  const delta = rho / RHO_STAR;
  const tau = T_STAR / T;
  const v = 1 / rho;

  // First entry is the logarithmic term: n₁ · ln(δ)
  const n1 = COEFFICIENTS[0][2];
  let phi = n1 * Math.log(delta);
  let phi_delta = n1 / delta;
  let phi_deltadelta = -n1 / (delta * delta);
  let phi_tau = 0;
  let phi_tautau = 0;
  let phi_deltatau = 0;

  // Sum from i = 1 (skip index 0 which is the ln term)
  for (let idx = 1; idx < COEFFICIENTS.length; idx++) {
    const [I, J, N] = COEFFICIENTS[idx];
    const deltaPow = Math.pow(delta, I);
    const tauPow = Math.pow(tau, J);

    phi += N * deltaPow * tauPow;
    phi_delta += N * I * Math.pow(delta, I - 1) * tauPow;
    phi_deltadelta += N * I * (I - 1) * Math.pow(delta, I - 2) * tauPow;
    phi_tau += N * deltaPow * J * Math.pow(tau, J - 1);
    phi_tautau += N * deltaPow * J * (J - 1) * Math.pow(tau, J - 2);
    phi_deltatau += N * I * Math.pow(delta, I - 1) * J * Math.pow(tau, J - 1);
  }

  return {
    region: Region.Region3,
    pressure: rho * R * T * delta * phi_delta / 1000,
    temperature: T,
    specificVolume: v,
    internalEnergy: R * T * tau * phi_tau,
    entropy: R * (tau * phi_tau - phi),
    enthalpy: R * T * (tau * phi_tau + delta * phi_delta),
    cp: R * (
      -tau * tau * phi_tautau +
      Math.pow(delta * phi_delta - delta * tau * phi_deltatau, 2) /
      (2 * delta * phi_delta + delta * delta * phi_deltadelta)
    ),
    cv: R * (-tau * tau * phi_tautau),
    speedOfSound: Math.sqrt(
      1000 * R * T * (
        2 * delta * phi_delta +
        delta * delta * phi_deltadelta -
        Math.pow(delta * phi_delta - delta * tau * phi_deltatau, 2) /
        (tau * tau * phi_tautau)
      ),
    ),
    quality: null,
    isobaricExpansion: (phi_delta - tau * phi_deltatau) /
      (2 * phi_delta + delta * phi_deltadelta) / T,
    isothermalCompressibility: 1 /
      (2 * delta * phi_delta + delta * delta * phi_deltadelta) /
      rho / R / T * 1000,
  };
}
