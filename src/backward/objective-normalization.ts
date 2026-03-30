export interface NormalizedResidual {
  actual: number;
  expected: number;
  tolerance: number;
}

export function sumNormalizedResiduals(terms: readonly NormalizedResidual[]): number {
  let sum = 0;

  for (const term of terms) {
    sum += Math.abs(term.actual - term.expected) / term.tolerance;
  }

  return sum;
}
