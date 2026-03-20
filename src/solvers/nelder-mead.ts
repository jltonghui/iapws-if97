/**
 * Nelder-Mead (downhill simplex) minimizer.
 * Minimizes f(x) where x is an array of numbers.
 */

export interface NelderMeadOptions {
  maxIterations?: number;
  nonZeroDelta?: number;
  zeroDelta?: number;
  minErrorDelta?: number;
  minTolerance?: number;
  rho?: number;
  chi?: number;
  psi?: number;
  sigma?: number;
}

export interface NelderMeadResult {
  x: number[];
  fx: number;
}

export function nelderMead(f: (x: number[]) => number, x0: number[], opts?: NelderMeadOptions): NelderMeadResult {
  const maxIter = opts?.maxIterations ?? x0.length * 200;
  const nonZeroDelta = opts?.nonZeroDelta ?? 1.05;
  const zeroDelta = opts?.zeroDelta ?? 0.001;
  const minErrDelta = opts?.minErrorDelta ?? 1e-11;
  const minTol = opts?.minTolerance ?? 1e-11;
  const rho = opts?.rho ?? 1;
  const chi = opts?.chi ?? 2;
  const psi = opts?.psi ?? -0.5;
  const sigma = opts?.sigma ?? 0.5;

  const N = x0.length;

  type Vertex = number[] & { fx: number };
  const simplex: Vertex[] = new Array(N + 1);

  // Initialize simplex
  const v0 = [...x0] as Vertex;
  v0.fx = f(x0);
  simplex[0] = v0;

  for (let i = 0; i < N; i++) {
    const pt = [...x0] as Vertex;
    pt[i] = pt[i] ? pt[i] * nonZeroDelta : zeroDelta;
    pt.fx = f(pt);
    simplex[i + 1] = pt;
  }

  const sortOrder = (a: Vertex, b: Vertex) => a.fx - b.fx;

  function weightedSum(ret: number[], w1: number, v1: number[], w2: number, v2: number[]): number[] {
    for (let j = 0; j < ret.length; j++) {
      ret[j] = w1 * v1[j] + w2 * v2[j];
    }
    return ret;
  }

  const centroid = [...x0];
  const reflected = [...x0] as Vertex;
  const contracted = [...x0] as Vertex;
  const expanded = [...x0] as Vertex;

  function updateSimplex(value: Vertex) {
    for (let i = 0; i < N; i++) simplex[N][i] = value[i];
    simplex[N].fx = value.fx;
  }

  for (let iter = 0; iter < maxIter; iter++) {
    simplex.sort(sortOrder);

    let maxDiff = 0;
    for (let i = 0; i < N; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(simplex[0][i] - simplex[1][i]));
    }
    if (Math.abs(simplex[0].fx - simplex[N].fx) < minErrDelta && maxDiff < minTol) break;

    for (let i = 0; i < N; i++) {
      centroid[i] = 0;
      for (let j = 0; j < N; j++) centroid[i] += simplex[j][i];
      centroid[i] /= N;
    }

    const worst = simplex[N];
    weightedSum(reflected, 1 + rho, centroid, -rho, worst);
    reflected.fx = f(reflected);

    if (reflected.fx < simplex[0].fx) {
      weightedSum(expanded, 1 + chi, centroid, -chi, worst);
      expanded.fx = f(expanded);
      updateSimplex(expanded.fx < reflected.fx ? expanded : reflected);
    } else if (reflected.fx >= simplex[N - 1].fx) {
      let shouldReduce = false;
      if (reflected.fx > worst.fx) {
        weightedSum(contracted, 1 + psi, centroid, -psi, worst);
        contracted.fx = f(contracted);
        if (contracted.fx < worst.fx) updateSimplex(contracted);
        else shouldReduce = true;
      } else {
        weightedSum(contracted, 1 - psi * rho, centroid, psi * rho, worst);
        contracted.fx = f(contracted);
        if (contracted.fx < reflected.fx) updateSimplex(contracted);
        else shouldReduce = true;
      }
      if (shouldReduce) {
        if (sigma >= 1) break;
        for (let i = 1; i < simplex.length; i++) {
          weightedSum(simplex[i], 1 - sigma, simplex[0], sigma, simplex[i]);
          simplex[i].fx = f(simplex[i]);
        }
      }
    } else {
      updateSimplex(reflected);
    }
  }

  simplex.sort(sortOrder);
  return { fx: simplex[0].fx, x: simplex[0].slice(0, N) };
}
