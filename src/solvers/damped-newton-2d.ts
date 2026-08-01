/** Damped Newton solver for two coupled nonlinear equations. */
import { ConvergenceError, IF97Error } from '../types.js';

export type Vector2 = readonly [number, number];

export interface Newton2DEvaluation {
  residual: Vector2;
  jacobian: readonly [Vector2, Vector2];
}

export interface DampedNewton2DOptions {
  tolerance?: number;
  maxIterations?: number;
  maxBacktracks?: number;
  isValid?: (point: Vector2) => boolean;
}

function maxNorm([a, b]: Vector2): number {
  return Math.max(Math.abs(a), Math.abs(b));
}

function isFiniteEvaluation(value: Newton2DEvaluation): boolean {
  return value.residual.every(Number.isFinite) &&
    value.jacobian.every((row) => row.every(Number.isFinite));
}

export function dampedNewton2D(
  evaluate: (point: Vector2) => Newton2DEvaluation,
  initial: Vector2,
  options?: DampedNewton2DOptions,
): [number, number] {
  const tolerance = options?.tolerance ?? 1e-10;
  const maxIterations = options?.maxIterations ?? 20;
  const maxBacktracks = options?.maxBacktracks ?? 20;
  const isValid = (point: Vector2): boolean =>
    point.every(Number.isFinite) && (options?.isValid?.(point) ?? true);

  const tryEvaluate = (point: Vector2): Newton2DEvaluation | null => {
    if (!isValid(point)) return null;
    try {
      const value = evaluate(point);
      return isFiniteEvaluation(value) ? value : null;
    } catch (error) {
      if (error instanceof IF97Error) return null;
      throw error;
    }
  };

  let point: [number, number] = [...initial];
  let value = tryEvaluate(point);
  if (value === null) throw new ConvergenceError('dampedNewton2D', 1);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const norm = maxNorm(value.residual);
    if (norm <= tolerance) return point;

    const [[a, b], [c, d]] = value.jacobian;
    const determinant = a * d - b * c;
    const determinantScale = Math.abs(a * d) + Math.abs(b * c);
    if (!Number.isFinite(determinant) || determinantScale === 0 ||
        Math.abs(determinant) <= Number.EPSILON * determinantScale) {
      throw new ConvergenceError('dampedNewton2D', iteration + 1);
    }

    const [r1, r2] = value.residual;
    const step: Vector2 = [
      (d * r1 - b * r2) / determinant,
      (a * r2 - c * r1) / determinant,
    ];

    let damping = 1;
    let accepted = false;
    for (let backtrack = 0; backtrack <= maxBacktracks; backtrack += 1) {
      const candidate: [number, number] = [
        point[0] - damping * step[0],
        point[1] - damping * step[1],
      ];
      const candidateValue = tryEvaluate(candidate);
      if (candidateValue !== null && maxNorm(candidateValue.residual) < norm) {
        point = candidate;
        value = candidateValue;
        accepted = true;
        break;
      }
      damping /= 2;
    }

    if (!accepted) throw new ConvergenceError('dampedNewton2D', iteration + 1);
  }

  throw new ConvergenceError('dampedNewton2D', maxIterations);
}
