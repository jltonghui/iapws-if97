/**
 * Bracketed Newton solver.
 *
 * A hybrid root-finder that combines Newton-Raphson steps with bisection
 * fallback. The bracket [lower, upper] is maintained so that f(a) and f(b)
 * have opposite signs, guaranteeing convergence even when the Newton step
 * would overshoot or the derivative estimate is poor.
 */
import { ConvergenceError, IF97Error } from '../types.js';

/** Configuration for the bracketed Newton solver. */
export interface BracketedNewtonOptions {
  /** Convergence tolerance on |f(x)| (default 1e-9) */
  tolerance?: number;
  /** Maximum number of iterations (default 100) */
  maxIterations?: number;
  /** Relative step size for central-difference derivative (default 1e-6) */
  derivativeStep?: number;
}

/**
 * Central-difference numerical derivative, returning null if the step
 * would leave the bracket [lower, upper].
 */
function numericalDerivative(
  f: (x: number) => number,
  x: number,
  lower: number,
  upper: number,
  step: number,
): number | null {
  if (x - step < lower || x + step > upper) {
    return null;
  }

  return (f(x + step) - f(x - step)) / (2 * step);
}

/**
 * Find a root of f(x) = 0 within the bracket [lower, upper].
 *
 * Each iteration attempts a Newton step using a central-difference derivative.
 * If the Newton candidate falls outside the current bracket or the derivative
 * is unavailable, a bisection step is used instead.
 *
 * @param f            - Continuous function whose root is sought
 * @param lower        - Lower bound of the bracket
 * @param upper        - Upper bound of the bracket
 * @param initialGuess - Optional starting point (must lie within bracket)
 * @param options      - Solver configuration
 * @returns The root x such that |f(x)| ≤ tolerance
 * @throws {ConvergenceError} if the bracket signs are the same or max iterations exceeded
 */
export function bracketedNewton(
  f: (x: number) => number,
  lower: number,
  upper: number,
  initialGuess?: number,
  options?: BracketedNewtonOptions,
): number {
  const tolerance = options?.tolerance ?? 1e-9;
  const maxIterations = options?.maxIterations ?? 100;
  const derivativeStep = options?.derivativeStep ?? 1e-6;

  let a = Math.min(lower, upper);
  let b = Math.max(lower, upper);
  let fa = f(a);
  let fb = f(b);

  if (Math.abs(fa) <= tolerance) return a;
  if (Math.abs(fb) <= tolerance) return b;
  if (fa * fb > 0) {
    throw new IF97Error(
      `bracketedNewton: f(${a}) and f(${b}) have the same sign (${fa.toExponential(3)}, ${fb.toExponential(3)}); bracket does not contain a root`,
    );
  }

  let x = initialGuess ?? (a + b) / 2;
  if (!(x > a && x < b)) {
    x = (a + b) / 2;
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    const fx = f(x);
    if (Math.abs(fx) <= tolerance) {
      return x;
    }

    if (fa * fx < 0) {
      b = x;
      fb = fx;
    } else {
      a = x;
      fa = fx;
    }

    const midpoint = (a + b) / 2;
    if (Math.abs(b - a) <= tolerance * Math.max(1, Math.abs(midpoint))) {
      return midpoint;
    }

    const step = Math.min(derivativeStep * Math.max(1, Math.abs(x)), (b - a) / 4);
    const derivative = step > 0
      ? numericalDerivative(f, x, a, b, step)
      : null;

    const newtonCandidate = derivative === null || !Number.isFinite(derivative) || derivative === 0
      ? NaN
      : x - fx / derivative;

    x = Number.isFinite(newtonCandidate) && newtonCandidate > a && newtonCandidate < b
      ? newtonCandidate
      : midpoint;
  }

  throw new ConvergenceError('bracketedNewton', maxIterations);
}
