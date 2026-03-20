/**
 * IAPWS-IF97 Core Types & Interfaces
 *
 * Type definitions for the IAPWS Industrial Formulation 1997
 * for the Thermodynamic Properties of Water and Steam.
 */

// ─── Region Enum ────────────────────────────────────────────────────────────

/** IAPWS-IF97 thermodynamic regions */
export enum Region {
  /** Subcooled liquid (compressed water) */
  Region1 = 1,
  /** Superheated steam */
  Region2 = 2,
  /** Supercritical fluid */
  Region3 = 3,
  /** Two-phase (wet steam / saturation line) */
  Region4 = 4,
  /** High-temperature steam (T > 1073.15 K) */
  Region5 = 5,
}

// ─── Steam State ────────────────────────────────────────────────────────────

/**
 * Complete thermodynamic state of water/steam.
 * All properties use SI-based units consistent with IAPWS-IF97.
 */
export interface SteamState {
  /** IAPWS-IF97 region (1–5) */
  region: Region;
  /** Pressure [MPa] */
  pressure: number;
  /** Temperature [K] */
  temperature: number;
  /** Specific volume [m³/kg] */
  specificVolume: number;
  /** Density [kg/m³] */
  density: number;
  /** Specific internal energy [kJ/kg] */
  internalEnergy: number;
  /** Specific entropy [kJ/(kg·K)] */
  entropy: number;
  /** Specific enthalpy [kJ/kg] */
  enthalpy: number;
  /** Isobaric heat capacity [kJ/(kg·K)] */
  cp: number | null;
  /** Isochoric heat capacity [kJ/(kg·K)] */
  cv: number | null;
  /** Speed of sound [m/s] */
  speedOfSound: number | null;
  /** Vapour quality (0–1), only defined in Region 4 */
  quality: number | null;

  // ── Transport Properties ──────────────────────────────────────────────

  /** Dynamic viscosity [Pa·s] */
  viscosity: number;
  /** Thermal conductivity [W/(m·K)] */
  thermalConductivity: number;
  /** Surface tension [N/m], only meaningful at saturation */
  surfaceTension: number | null;
  /** Static dielectric constant [dimensionless] */
  dielectricConstant: number;
  /** Ionization constant pKw [dimensionless] */
  ionizationConstant: number;

  // ── Derivative Properties ─────────────────────────────────────────────

  /** Isobaric cubic expansion coefficient [1/K] */
  isobaricExpansion: number | null;
  /** Isothermal compressibility [1/MPa] */
  isothermalCompressibility: number | null;
}

// ─── Basic Thermodynamic Properties (without transport) ─────────────────────

/**
 * Core thermodynamic properties computed from a region's fundamental equation.
 * Does not include transport properties (viscosity, conductivity, etc.)
 */
export interface BasicProperties {
  region: Region;
  pressure: number;
  temperature: number;
  specificVolume: number;
  internalEnergy: number;
  entropy: number;
  enthalpy: number;
  cp: number | null;
  cv: number | null;
  speedOfSound: number | null;
  quality: number | null;
  isobaricExpansion: number | null;
  isothermalCompressibility: number | null;
}

// ─── Input Modes ────────────────────────────────────────────────────────────

/** Supported thermodynamic input combinations */
export type InputMode = 'PT' | 'PH' | 'PS' | 'HS' | 'Px' | 'Tx';

/** Input for pressure-temperature calculation */
export interface PTInput {
  mode: 'PT';
  /** Pressure [MPa] */
  p: number;
  /** Temperature [K] */
  T: number;
}

/** Input for pressure-enthalpy calculation */
export interface PHInput {
  mode: 'PH';
  /** Pressure [MPa] */
  p: number;
  /** Specific enthalpy [kJ/kg] */
  h: number;
}

/** Input for pressure-entropy calculation */
export interface PSInput {
  mode: 'PS';
  /** Pressure [MPa] */
  p: number;
  /** Specific entropy [kJ/(kg·K)] */
  s: number;
}

/** Input for enthalpy-entropy calculation */
export interface HSInput {
  mode: 'HS';
  /** Specific enthalpy [kJ/kg] */
  h: number;
  /** Specific entropy [kJ/(kg·K)] */
  s: number;
}

/** Input for pressure-quality (saturation) calculation */
export interface PxInput {
  mode: 'Px';
  /** Pressure [MPa] */
  p: number;
  /** Vapour quality (0–1) */
  x: number;
}

/** Input for temperature-quality (saturation) calculation */
export interface TxInput {
  mode: 'Tx';
  /** Temperature [K] */
  T: number;
  /** Vapour quality (0–1) */
  x: number;
}

/** Union of all valid inputs */
export type SolveInput = PTInput | PHInput | PSInput | HSInput | PxInput | TxInput;

// ─── Coefficient Table ──────────────────────────────────────────────────────

/**
 * Typed coefficient table for IAPWS polynomial evaluations.
 * Each entry is [I, J, N] where:
 *   - I = pressure exponent
 *   - J = temperature exponent
 *   - N = coefficient value
 */
export type CoefficientTable = readonly (readonly [number, number, number])[];

// ─── Errors ─────────────────────────────────────────────────────────────────

/** Base error class for all IF97 calculation errors */
export class IF97Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IF97Error';
  }
}

/** Thrown when input values are outside IAPWS-IF97 valid ranges */
export class OutOfRangeError extends IF97Error {
  constructor(
    public readonly parameter: string,
    public readonly value: number,
    public readonly min: number,
    public readonly max: number,
  ) {
    super(
      `${parameter} = ${value} is out of range [${min}, ${max}]`,
    );
    this.name = 'OutOfRangeError';
  }
}

/** Thrown when a numerical solver fails to converge */
export class ConvergenceError extends IF97Error {
  constructor(
    public readonly solver: string,
    public readonly iterations: number,
  ) {
    super(`${solver} failed to converge after ${iterations} iterations`);
    this.name = 'ConvergenceError';
  }
}
