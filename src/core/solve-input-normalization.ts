import type { SolveInput } from '../types.js';
import { IF97Error } from '../types.js';

export type CanonicalSolveInput =
  | { mode: 'PT'; p: number; T: number }
  | { mode: 'PH'; p: number; h: number }
  | { mode: 'PS'; p: number; s: number }
  | { mode: 'HS'; h: number; s: number }
  | { mode: 'Px'; p: number; x: number }
  | { mode: 'Tx'; T: number; x: number }
  | { mode: 'TH'; T: number; h: number }
  | { mode: 'TS'; T: number; s: number };

function pickNumericAlias(
  input: Record<string, unknown>,
  shortKey: string,
  longKey: string,
  label: string,
): number {
  const shortValue = input[shortKey];
  const longValue = input[longKey];

  if (shortValue === undefined && longValue === undefined) {
    throw new IF97Error(`solve input requires '${shortKey}' or '${longKey}' for ${label}`);
  }

  if (
    shortValue !== undefined &&
    longValue !== undefined &&
    !Object.is(shortValue, longValue)
  ) {
    throw new IF97Error(
      `solve input received conflicting values for '${shortKey}' and '${longKey}'`,
    );
  }

  return (shortValue ?? longValue) as number;
}

// Normalize public solve() aliases to the canonical short-key form used internally.
export function normalizeSolveInput(input: SolveInput): CanonicalSolveInput {
  const raw = input as Record<string, unknown>;

  switch (input.mode) {
    case 'PT':
      return {
        mode: 'PT',
        p: pickNumericAlias(raw, 'p', 'pressure', 'pressure'),
        T: pickNumericAlias(raw, 'T', 'temperature', 'temperature'),
      };
    case 'PH':
      return {
        mode: 'PH',
        p: pickNumericAlias(raw, 'p', 'pressure', 'pressure'),
        h: pickNumericAlias(raw, 'h', 'enthalpy', 'enthalpy'),
      };
    case 'PS':
      return {
        mode: 'PS',
        p: pickNumericAlias(raw, 'p', 'pressure', 'pressure'),
        s: pickNumericAlias(raw, 's', 'entropy', 'entropy'),
      };
    case 'HS':
      return {
        mode: 'HS',
        h: pickNumericAlias(raw, 'h', 'enthalpy', 'enthalpy'),
        s: pickNumericAlias(raw, 's', 'entropy', 'entropy'),
      };
    case 'Px':
      return {
        mode: 'Px',
        p: pickNumericAlias(raw, 'p', 'pressure', 'pressure'),
        x: pickNumericAlias(raw, 'x', 'quality', 'quality'),
      };
    case 'Tx':
      return {
        mode: 'Tx',
        T: pickNumericAlias(raw, 'T', 'temperature', 'temperature'),
        x: pickNumericAlias(raw, 'x', 'quality', 'quality'),
      };
    case 'TH':
      return {
        mode: 'TH',
        T: pickNumericAlias(raw, 'T', 'temperature', 'temperature'),
        h: pickNumericAlias(raw, 'h', 'enthalpy', 'enthalpy'),
      };
    case 'TS':
      return {
        mode: 'TS',
        T: pickNumericAlias(raw, 'T', 'temperature', 'temperature'),
        s: pickNumericAlias(raw, 's', 'entropy', 'entropy'),
      };
    default:
      throw new IF97Error(`Unsupported solve mode: ${(input as { mode?: unknown }).mode ?? 'undefined'}`);
  }
}
