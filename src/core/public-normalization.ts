import type { BasicProperties, SteamState } from '../types.js';

// Only snap values that are effectively simple decimals plus machine-noise.
const SIMPLE_DECIMAL_PLACES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const SNAP_ULPS = 8;

type PublicState = BasicProperties | SteamState;

function snapSimpleDecimal(value: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }

  for (const decimals of SIMPLE_DECIMAL_PLACES) {
    const factor = 10 ** decimals;
    const candidate = Math.round(value * factor) / factor;
    // Scale the acceptance window with magnitude so we only absorb
    // binary floating-point residue, not meaningful engineering deltas.
    const tolerance = SNAP_ULPS * Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(candidate));

    if (Math.abs(value - candidate) <= tolerance) {
      return Object.is(candidate, -0) ? 0 : candidate;
    }
  }

  return Object.is(value, -0) ? 0 : value;
}

function normalizeNullableNumber(value: number | null): number | null {
  return value === null ? null : snapSimpleDecimal(value);
}

function normalizeBasicProperties(state: BasicProperties): BasicProperties {
  return {
    region: state.region,
    pressure: snapSimpleDecimal(state.pressure),
    temperature: snapSimpleDecimal(state.temperature),
    specificVolume: snapSimpleDecimal(state.specificVolume),
    internalEnergy: snapSimpleDecimal(state.internalEnergy),
    entropy: snapSimpleDecimal(state.entropy),
    enthalpy: snapSimpleDecimal(state.enthalpy),
    cp: normalizeNullableNumber(state.cp),
    cv: normalizeNullableNumber(state.cv),
    speedOfSound: normalizeNullableNumber(state.speedOfSound),
    quality: normalizeNullableNumber(state.quality),
    isobaricExpansion: normalizeNullableNumber(state.isobaricExpansion),
    isothermalCompressibility: normalizeNullableNumber(state.isothermalCompressibility),
  };
}

function normalizeSteamState(state: SteamState): SteamState {
  return {
    ...normalizeBasicProperties(state),
    density: snapSimpleDecimal(state.density),
    viscosity: normalizeNullableNumber(state.viscosity),
    thermalConductivity: normalizeNullableNumber(state.thermalConductivity),
    surfaceTension: normalizeNullableNumber(state.surfaceTension),
    dielectricConstant: normalizeNullableNumber(state.dielectricConstant),
    ionizationConstant: normalizeNullableNumber(state.ionizationConstant),
  };
}

export function normalizePublicState(state: SteamState): SteamState;
export function normalizePublicState(state: BasicProperties): BasicProperties;
export function normalizePublicState(state: PublicState): PublicState {
  return 'density' in state ? normalizeSteamState(state) : normalizeBasicProperties(state);
}
