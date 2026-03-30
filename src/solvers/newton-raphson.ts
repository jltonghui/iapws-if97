/**
 * Newton-Raphson root-finding solver.
 * Finds x such that f(x) = 0, with optional analytical derivative.
 */
import { ConvergenceError } from '../types.js';

export interface NewtonRaphsonOptions {
  /** Convergence tolerance (default 1e-7) */
  tolerance?: number;
  /** Maximum iterations (default 50) */
  maxIterations?: number;
  /** Step size for numerical derivative (default 1e-4) */
  h?: number;
  /** Machine epsilon (default 2.22e-16) */
  epsilon?: number;
}

/**
 * Solve f(x) = 0 using Newton-Raphson method.
 *
 * @param f  - Function to find root of
 * @param x0 - Initial guess
 * @param fp - Optional analytical derivative f'(x)
 * @param options - Solver options
 * @returns x such that f(x) ≈ 0
 * @throws {ConvergenceError} if the iteration diverges or does not converge
 */
export function newtonRaphson(
  f: (x: number) => number,
  x0: number,
  fp?: ((x: number) => number) | null,
  options?: NewtonRaphsonOptions,
): number {
  const tol = options?.tolerance ?? 1e-7;
  const maxIter = options?.maxIterations ?? 50;
  const h = options?.h ?? 1e-4;
  const eps = options?.epsilon ?? 2.220446049250313e-16;
  const hr = 1 / h;

  let x = x0;
  for (let iter = 0; iter < maxIter; iter++) {
    const y = f(x);
    if (!Number.isFinite(y)) {
      throw new ConvergenceError('newtonRaphson', iter + 1);
    }
    if (y === 0) return x;

    let yp: number;

    if (fp) {
      yp = fp(x);
    } else {
      // 5-point numerical derivative
      const yph = f(x + h);
      const ymh = f(x - h);
      const yp2h = f(x + 2 * h);
      const ym2h = f(x - 2 * h);
      yp = ((ym2h - yp2h) + 8 * (yph - ymh)) * hr / 12;
    }

    if (!Number.isFinite(yp) || Math.abs(yp) <= eps * Math.max(1, Math.abs(y))) {
      throw new ConvergenceError('newtonRaphson', iter + 1);
    }

    const x1 = x - y / yp;
    if (!Number.isFinite(x1)) {
      throw new ConvergenceError('newtonRaphson', iter + 1);
    }
    if (Math.abs(x1 - x) <= tol * Math.max(1, Math.abs(x1))) return x1;
    x = x1;
  }

  throw new ConvergenceError('newtonRaphson', maxIter);
}
