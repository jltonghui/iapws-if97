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

export function normalizePublicState<T extends PublicState>(state: T): T {
  const normalized = { ...state } as unknown as Record<string, number | null>;

  for (const [key, value] of Object.entries(state)) {
    // Preserve enum/null fields exactly; only normalize exposed numeric outputs.
    if (key === 'region' || value === null || typeof value !== 'number') {
      continue;
    }
    normalized[key] = snapSimpleDecimal(value);
  }

  return normalized as unknown as T;
}
