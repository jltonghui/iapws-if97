/**
 * Newton-Raphson root-finding solver.
 * Finds x such that f(x) = 0, with optional analytical derivative.
 */

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

    if (Math.abs(yp) <= eps * Math.abs(y)) return x;

    const x1 = x - y / yp;
    if (Math.abs(x1 - x) <= tol * Math.abs(x1)) return x1;
    x = x1;
  }
  return x;
}
