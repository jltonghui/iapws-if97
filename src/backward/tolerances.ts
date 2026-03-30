export type BackwardToleranceLabel = 'pressure' | 'temperature' | 'enthalpy' | 'entropy';

export const BACKWARD_REGION4_QUALITY_TOLERANCE = 1e-6;

export function backwardConstraintTolerance(
  label: BackwardToleranceLabel,
  expected: number,
): number {
  switch (label) {
    case 'pressure':
    case 'temperature':
      return 1e-9 * Math.max(1, Math.abs(expected));
    case 'enthalpy':
      return 1e-6 * Math.max(1, Math.abs(expected));
    case 'entropy':
      return 1e-6 * Math.max(1, Math.abs(expected));
    default:
      return 1e-9;
  }
}

export function region4SaturationPressureTolerance(pressure: number): number {
  return 1e-8 * Math.max(1, Math.abs(pressure));
}

export function backwardSpecificVolumeTolerance(expected: number): number {
  return 1e-6 * Math.max(1, Math.abs(expected));
}
