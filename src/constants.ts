/**
 * IAPWS-IF97 Constants
 *
 * Physical constants, critical point properties, and range limits
 * for the IAPWS Industrial Formulation 1997.
 */

// ─── Fundamental Constants ──────────────────────────────────────────────────

/** Specific gas constant for water [kJ/(kg·K)].
 *  IAPWS-IF97, §2 (Table 1). Fixed value for IF97 internal consistency;
 *  differs from the IAPWS-95 / CODATA value. */
export const R = 0.461526;

// ─── Critical Point ─────────────────────────────────────────────────────────

/** Critical temperature [K] */
export const Tc = 647.096;

/** Temperature exclusion half-band around the critical point [K] */
export const CRITICAL_T_EXCLUSION_BAND = 1e-3;

/** Region 4 endpoint snap tolerance for temperatures [K] */
export const REGION4_TEMPERATURE_TOLERANCE = 1e-9;

/** Safety margin used when clamping Region 4 temperatures below Tc [K] */
export const REGION4_SUBCRITICAL_TEMPERATURE_MARGIN = 1e-8;

/** Critical pressure [MPa] */
export const Pc = 22.064;

/** Region 4 endpoint snap tolerance for pressures [MPa] */
export const REGION4_PRESSURE_TOLERANCE = 1e-9;

/** Tolerance for identifying the critical h-s endpoint in Region 4 */
export const REGION4_CRITICAL_HS_TOLERANCE = 1e-6;

/** Residual tolerance for Region 4 h-s temperature inversion */
export const REGION4_HS_RESIDUAL_TOLERANCE = 1e-10;

/** Scan resolution used when bracketing Region 4 h-s temperature roots */
export const REGION4_HS_BRACKET_SEGMENTS = 256;

/** Critical density [kg/m³] */
export const RHOc = 322;

// ─── Triple Point ───────────────────────────────────────────────────────────

/** Triple point pressure [MPa] */
export const Pt = 0.000611657;

/** Triple point temperature [K] */
export const Tt = 273.16;

// ─── Overall Validity Ranges ────────────────────────────────────────────────

/** Minimum pressure [MPa].
 *  Derived: Psat(T_MIN) = Psat(273.15 K) via Eq. 30. Below the triple-point
 *  pressure Pt because T_MIN (0 °C) < Tt (0.01 °C). */
export const P_MIN = 0.000611212677444;

/** Maximum pressure [MPa] */
export const P_MAX = 100.0;

/** Minimum temperature [K] (273.15 K = 0 °C) */
export const T_MIN = 273.15;

/** Maximum temperature [K] (2273.15 K = 2000 °C) */
export const T_MAX = 2273.15;

/** Minimum specific entropy [kJ/(kg·K)] */
export const S_MIN = -0.00015454959194;

/** Maximum specific entropy [kJ/(kg·K)] */
export const S_MAX = 13.904956083429227;

/** Minimum specific enthalpy [kJ/kg] */
export const H_MIN = -0.041587825987;

/** Maximum specific enthalpy [kJ/kg] */
export const H_MAX = 7376.980263598506;

// ─── Region 2 Boundaries ───────────────────────────────────────────────────

/** Region 2 minimum temperature for high-P subregions [K] (623.15 K = 350 °C) */
export const R2_T_MIN = 623.15;

/** Region 2 maximum temperature for backward eqs [K] (1073.15 K = 800 °C) */
export const R2_T_MAX = 1073.15;

/** Region 2 subregion boundary entropy [kJ/(kg·K)].
 *  Divides R2a from R2b/R2c in the h-s plane.
 *  Ref: IAPWS Supplementary Release on Backward Equations for Region 2, §6.3 */
export const R2_S_CRT = 5.85;

/** Region 2 subregion boundary pressure [MPa].
 *  Divides R2a from R2b/R2c.
 *  Ref: IAPWS Supplementary Release on Backward Equations for Region 2, §6.3 */
export const R2_P_CRT = 4.0;

// ─── Region 2-3 Boundary ───────────────────────────────────────────────────

/** B23 minimum pressure [MPa] */
export const B23_P_MIN = 16.5291642526;

/** B23 maximum temperature [K] */
export const B23_T_MAX = 863.15;

// ─── Region 3 Boundaries ───────────────────────────────────────────────────

/** Region 3 minimum temperature [K] */
export const R3_T_MIN = 623.15;

/** Region 3 critical entropy [kJ/(kg·K)] */
export const R3_S_CRT = 4.41202148223476;

/** Region 3 critical enthalpy [kJ/kg] */
export const R3_H_CRT = 2087.5468451171537;

// ─── Region 5 Boundaries ───────────────────────────────────────────────────

/** Region 5 minimum temperature [K] */
export const R5_T_MIN = 1073.15;

/** Region 5 maximum pressure [MPa] */
export const R5_P_MAX = 50;

/** Region 5 maximum temperature [K] */
export const R5_T_MAX = 2273.15;

// ─── B23 Curve Extrema (Entropy / Enthalpy) ────────────────────────────────
//
// These are the GLOBAL EXTREMA along the B23 boundary curve, NOT values at
// the curve endpoints. Entropy has a minimum at T ≈ 777 K and a maximum at
// T ≈ 644 K. Enthalpy is monotonic: min at the low-T endpoint (623.15 K),
// max at the high-T endpoint (863.15 K).
//
// Ref: Computed from Region 2 properties evaluated along B23(T) for
//      T ∈ [623.15, 863.15] K.

/** Minimum entropy along the B23 curve [kJ/(kg·K)], at T ≈ 777 K */
export const B23_S_CURVE_MIN = 5.048096828;

/** Maximum entropy along the B23 curve [kJ/(kg·K)], at T ≈ 644 K */
export const B23_S_CURVE_MAX = 5.260578707;

/** Minimum enthalpy along the B23 curve [kJ/kg], at T = 623.15 K (currently unused) */
export const B23_H_CURVE_MIN = 2563.592004;

/** Maximum enthalpy along the B23 curve [kJ/kg], at T = 863.15 K (currently unused) */
export const B23_H_CURVE_MAX = 2812.942061;
