/**
 * IAPWS Transport Properties
 *
 * - Viscosity (IAPWS 2008)
 * - Thermal Conductivity (IAPWS 2011)
 * - Surface Tension (IAPWS 2014)
 * - Dielectric Constant (IAPWS 1997)
 * - Ionization Constant (IAPWS 2007)
 */

import { Tc, Pc, RHOc } from '../constants.js';

// ─── Viscosity (IAPWS 2008) ─────────────────────────────────────────────────

const MU0_H = [1.67752, 2.20462, 0.6366564, -0.241605];
const MU1_H = [
  5.20094e-1, 8.50895e-2, -1.08374, -2.89555e-1, 0, 0,
  2.22531e-1, 9.99115e-1, 1.88797, 1.26613, 0, 1.20573e-1,
  -2.81378e-1, -9.06851e-1, -7.72479e-1, -4.89837e-1, -2.5704e-1, 0,
  1.61913e-1, 2.57399e-1, 0, 0, 0, 0,
  -3.25372e-2, 0, 0, 6.98452e-2, 0, 0,
  0, 0, 0, 0, 8.72102e-3, 0,
  0, 0, 0, -4.35673e-3, 0, -5.93264e-4,
];

/**
 * Dynamic viscosity of water/steam [Pa·s]
 * @param T   Temperature [K]
 * @param rho Density [kg/m³]
 */
export function viscosity(T: number, rho: number): number {
  const That = T / Tc;
  const rhat = rho / RHOc;

  // μ₀ — dilute gas contribution
  let sum0 = 0;
  for (let i = 0; i < 4; i++) sum0 += MU0_H[i] / Math.pow(That, i);
  const mu0 = 100 * Math.sqrt(That) / sum0;

  // μ₁ — finite-density contribution
  let mu1sum = 0;
  for (let j = 0; j < 6; j++) {
    const x = Math.pow(1 / That - 1, j);
    let y = 0;
    for (let z = 0; z < 7; z++) {
      y += MU1_H[z * 6 + j] * Math.pow(rhat - 1, z);
    }
    mu1sum += x * y;
  }
  const mu1 = Math.exp(rhat * mu1sum);

  // μ₂ — critical enhancement
  // Per IAPWS 2008, μ₂ is negligible except extremely close to the critical point
  // (within ~1 K and ~1 MPa). The original reference library also omits it.
  // Keeping μ₂ = 1 (no enhancement) for practical use.
  const mu2 = 1;

  return mu0 * mu1 * mu2 / 1e6; // Convert μPa·s to Pa·s
}

// ─── Thermal Conductivity (IAPWS 2011) ──────────────────────────────────────

const K0_L = [2.443221e-3, 1.323095e-2, 6.770357e-3, -3.454586e-3, 4.096266e-4];
const K1_L = [
  1.60397357, -0.646013523, 0.111443906, 0.102997357, -0.0504123634, 0.00609859258,
  2.33771842, -2.78843778, 1.53616167, -0.463045512, 0.0832827019, -0.00719201245,
  2.19650529, -4.54580785, 3.55777244, -1.40944978, 0.275418278, -0.0205938816,
  -1.21051378, 1.60812989, -0.621178141, 0.0716373224, 0, 0,
  -2.720337, 4.57586331, -3.18369245, 1.1168348, -0.19268305, 0.012913842,
];

// Reference compressibility piecewise polynomial coefficients for λ₂ (IAPWS 2011)
const DRHO_REF_COEFFS: [number, number[]][] = [
  [0.310559006, [6.53786807199516, -5.61149954923348, 3.39624167361325, -2.27492629730878, 10.2631854662709, 1.97815050331519]],
  [0.776397516, [6.52717759281799, -6.30816983387575, 8.08379285492595, -9.82240510197603, 12.1358413791395, -5.54349664571295]],
  [1.242236025, [5.35500529896124, -3.96415689925446, 8.91990208918795, -12.0338729505790, 9.19494865194302, -2.16866274479712]],
  [1.863354037, [1.55225959906681, 0.464621290821181, 8.93237374861479, -11.0321960061126, 6.16780999933360, -0.965458722086812]],
  [Infinity, [1.11999926419994, 0.595748562571649, 9.88952565078920, -10.3255051147040, 4.66861294457414, -0.503243546373828]],
];

/** Specific gas constant for water [kJ/(kg·K)] */
const R_WATER = 0.46151805;

/**
 * Thermal conductivity of water/steam [W/(m·K)]
 *
 * When optional thermodynamic state parameters are provided, the full IAPWS 2011
 * critical enhancement (λ₂) is computed. Otherwise λ₂ = 0 (backward compatible).
 *
 * @param T   Temperature [K]
 * @param rho Density [kg/m³]
 * @param cp  Isobaric heat capacity [kJ/(kg·K)] (optional)
 * @param cv  Isochoric heat capacity [kJ/(kg·K)] (optional)
 * @param drhodP_T  Isothermal density derivative ∂ρ/∂P|_T [kg/m³/MPa] (optional)
 * @param mu  Dynamic viscosity [Pa·s] (optional)
 */
export function thermalConductivity(
  T: number, rho: number,
  cp?: number, cv?: number, drhodP_T?: number, mu?: number,
): number {
  const That = T / Tc;
  const rhat = rho / RHOc;

  // λ₀
  let sum0 = 0;
  for (let i = 0; i < 5; i++) sum0 += K0_L[i] / Math.pow(That, i);
  const k0 = Math.sqrt(That) / sum0;

  // λ₁
  let k1sum = 0;
  for (let j = 0; j < 5; j++) {
    const x = Math.pow(1 / That - 1, j);
    let y = 0;
    for (let z = 0; z < 6; z++) y += K1_L[j * 6 + z] * Math.pow(rhat - 1, z);
    k1sum += x * y;
  }
  const k1 = Math.exp(rhat * k1sum);

  // λ₂ — critical enhancement (IAPWS 2011)
  let k2 = 0;
  if (cp !== undefined && cv !== undefined && drhodP_T !== undefined && mu !== undefined) {
    k2 = computeK2(That, rhat, cp, cv, drhodP_T, mu);
  }

  return (k0 * k1 + k2) / 1000; // Convert mW/(m·K) to W/(m·K)
}

/**
 * Compute the critical enhancement term λ₂ [mW/(m·K)] per IAPWS 2011.
 */
function computeK2(
  That: number, rhat: number,
  cp: number, cv: number, drhodP_T: number, mu: number,
): number {
  // Reference compressibility from piecewise polynomial
  let ai: number[] = DRHO_REF_COEFFS[DRHO_REF_COEFFS.length - 1][1];
  for (const [threshold, coeffs] of DRHO_REF_COEFFS) {
    if (rhat <= threshold) { ai = coeffs; break; }
  }
  let tempD = 0;
  for (let i = 0; i < 6; i++) tempD += ai[i] * Math.pow(rhat, i);
  const drho_ref = (1 / tempD) * (RHOc / Pc); // [kg/m³/MPa]

  // Compressibility difference
  let DeltaX = rhat * (Pc / RHOc * drhodP_T - Pc / RHOc * drho_ref * 1.5 / That);
  if (DeltaX < 0) DeltaX = 0;

  // Correlation length ξ [nm]
  const X = 0.13 * Math.pow(DeltaX / 0.06, 0.63 / 1.239);

  // qD·ξ
  const Y = X / 0.4;

  let Z: number;
  if (Y < 1.2e-7) {
    Z = 0;
  } else {
    const kappa = cp / cv;
    Z = 2 / (Math.PI * Y) * (
      ((1 - 1 / kappa) * Math.atan(Y) + Y / kappa)
      - (1 - Math.exp(-1 / (1 / Y + Y * Y / (3 * rhat * rhat))))
    );
  }

  // Viscosity in μPa·s (mu is in Pa·s)
  const mu_uPas = mu * 1e6;

  // λ₂ in mW/(m·K)
  return 177.8514 * rhat * (cp / R_WATER) * That / mu_uPas * Z;
}

// ─── Surface Tension (IAPWS 2014) ───────────────────────────────────────────

/**
 * Surface tension of water [N/m]
 * Returns null outside the IAPWS validity range.
 * @param T Temperature [K], valid for 273.15 ≤ T ≤ 647.096
 */
export function surfaceTension(T: number): number | null {
  if (T < 273.15 || T > Tc) {
    return null;
  }
  const tau = 1 - T / Tc;
  return 235.8e-3 * Math.pow(tau, 1.256) * (1 - 0.625 * tau);
}

// ─── Dielectric Constant (IAPWS 1997) ───────────────────────────────────────

const DC_Nh = [0.978224486826, -0.957771379375, 0.237511794148, 0.714692244396,
  -0.298217036956, -0.108863472196, 0.0949327488264, -0.00980469816509,
  0.16516763497e-4, 0.937359795772e-4, -0.12317921872e-9];
const DC_Ih = [1, 1, 1, 2, 3, 3, 4, 5, 6, 7, 10];
const DC_Jh = [0.25, 1, 2.5, 1.5, 1.5, 2.5, 2, 2, 5, 0.5, 10];

/**
 * Static dielectric constant [dimensionless]
 * @param T   Temperature [K]
 * @param rho Density [kg/m³]
 */
export function dielectricConstant(T: number, rho: number): number {
  const MW = 0.018015268;
  const rhoM = rho / MW;
  const rhoRc = rhoM / (RHOc / MW);
  const alpha = 1.636e-40;
  const Na = 6.0221367e23;
  const mu = 6.138e-30;
  const eps0 = 1 / (4e-7 * Math.PI * 299792458 ** 2);
  const k = 1.380658e-23;

  let g = 0;
  for (let i = 0; i < 11; i++) {
    g += DC_Nh[i] * Math.pow(rhoRc, DC_Ih[i]) * Math.pow(Tc / T, DC_Jh[i]);
  }
  g = 1 + g + 0.00196096504426 * rhoRc * Math.pow(T / 228 - 1, -1.2);

  const A = Na * mu * mu * rhoM * g / (eps0 * k * T);
  const B = Na * alpha * rhoM / (3 * eps0);

  return (1 + A + 5 * B + Math.sqrt(9 + 2*A + 18*B + A*A + 10*A*B + 9*B*B)) / (4 - 4*B);
}

// ─── Ionization Constant (IAPWS 2024) ───────────────────────────────────────

function log10(x: number): number { return Math.log(x) / Math.LN10; }

/**
 * Ionization constant pKw [dimensionless]
 * @param T   Temperature [K]
 * @param rho Density [kg/m³]
 */
export function ionizationConstant(T: number, rho: number): number {
  const density = rho / 1000;
  const n = 6;
  const molarMass = 18.015268;
  const pKwG = 0.61415 + 48251.33 / T - 67707.93 / (T * T) + 10102100 / (T * T * T);
  const Z = density * Math.exp(
    -0.702132
    + 8681.05 / T
    - 24145.1 * Math.pow(density, 2 / 3) / (T * T),
  );
  const beta = 0.813876 - 51.4471 / T - 0.469920 * density;

  return -2 * n * (
    log10(1 + Z)
    - Z / (Z + 1) * density * beta
  ) + pKwG + 2 * log10(molarMass / 1000);
}
