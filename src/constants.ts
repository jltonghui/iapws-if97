/**
 * IAPWS-IF97 Constants
 *
 * Physical constants, critical point properties, and range limits
 * for the IAPWS Industrial Formulation 1997.
 */

// ─── Fundamental Constants ──────────────────────────────────────────────────

/** Specific gas constant for water [kJ/(kg·K)] */
export const R = 0.461526;

// ─── Critical Point ─────────────────────────────────────────────────────────

/** Critical temperature [K] */
export const Tc = 647.096;

/** Critical pressure [MPa] */
export const Pc = 22.064;

/** Critical density [kg/m³] */
export const RHOc = 322;

// ─── Triple Point ───────────────────────────────────────────────────────────

/** Triple point pressure [MPa] */
export const Pt = 0.000611657;

// ─── Overall Validity Ranges ────────────────────────────────────────────────

/** Minimum pressure [MPa] */
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
export const S_MAX = 8.668866265157533;

/** Minimum specific enthalpy [kJ/kg] */
export const H_MIN = -0.041587825987;

/** Maximum specific enthalpy [kJ/kg] */
export const H_MAX = 7365.802234015646;

// ─── Region 2 Boundaries ───────────────────────────────────────────────────

/** Region 2 minimum temperature for high-P subregions [K] (623.15 K = 350 °C) */
export const R2_T_MIN = 623.15;

/** Region 2 maximum temperature for backward eqs [K] (1073.15 K = 800 °C) */
export const R2_T_MAX = 1073.15;

/** Region 2 critical entropy boundary [kJ/(kg·K)] */
export const R2_S_CRT = 5.85;

/** Region 2 critical pressure boundary [MPa] */
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

// ─── B23 Entropy/Enthalpy Boundaries ────────────────────────────────────────

/** B23 minimum entropy [kJ/(kg·K)] */
export const B23_S_MIN = 5.048096828;

/** B23 maximum entropy [kJ/(kg·K)] */
export const B23_S_MAX = 5.260578707;

/** B23 minimum enthalpy [kJ/kg] */
export const B23_H_MIN = 2563.592004;

/** B23 maximum enthalpy [kJ/kg] */
export const B23_H_MAX = 2812.942061;
