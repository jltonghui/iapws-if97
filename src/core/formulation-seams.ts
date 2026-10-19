import * as C from '../constants.js';
import type { BasicProperties } from '../types.js';
import { boundary23_T_to_P } from '../regions/boundaries.js';
import { region1 } from '../regions/region1.js';
import { region2 } from '../regions/region2.js';
import { region5 } from '../regions/region5.js';
import { saturationPressure } from '../regions/region4.js';
import { bracketedNewton } from '../solvers/bracketed-newton.js';
import { gibbsPropertyDerivatives } from './thermodynamic-derivatives.js';
import { solveRegion3PTBasic } from './region3-pt.js';
import { detectRegionPT, nativeB23TemperatureBracket } from './region-detector.js';

export type FormulationSeam = '13' | '23' | '25';

export interface FormulationSeamPair {
  seam: FormulationSeam;
  pressure: number;
  temperature: number;
  /** Equations on the lower and higher temperature sides at fixed pressure. */
  lower: BasicProperties;
  upper: BasicProperties;
  canonical: BasicProperties;
}

export interface FormulationSeamResolution {
  pair: FormulationSeamPair;
  kind: 'canonical' | 'gap' | 'overlap';
  state: BasicProperties;
  budgets: { enthalpy: number; entropy: number };
}

function pairAt(seam: FormulationSeam, p: number, T: number): FormulationSeamPair {
  const r3 = (): BasicProperties => solveRegion3PTBasic(p, T);
  const lower = seam === '13' ? region1(p, T) : seam === '23' ? r3() : region2(p, T);
  const upper = seam === '13' ? r3() : seam === '23' ? region2(p, T) : region5(p, T);
  return {
    seam, pressure: p, temperature: T,
    lower, upper, canonical: lower,
  };
}

export function formulationSeamAtPressure(p: number, seam: FormulationSeam): FormulationSeamPair | null {
  if (!Number.isFinite(p) || p < C.P_MIN || p > C.P_MAX) return null;
  if (seam === '25') return p <= C.R5_P_MAX ? pairAt(seam, p, C.R2_T_MAX) : null;
  if (p <= C.B23_P_MIN) return null;
  if (seam === '13') return p > saturationPressure(C.R2_T_MIN) ? pairAt(seam, p, C.R2_T_MIN) : null;
  const [T] = nativeB23TemperatureBracket(p);
  return T <= C.R2_T_MIN || (T < C.Tc && p >= saturationPressure(T)) ? null : pairAt(seam, p, T);
}

/** B13/B25 cannot be crossed while retaining an independently supplied temperature. */
export function formulationSeamAtTemperature(T: number): FormulationSeamPair | null {
  if (!Number.isFinite(T) || T <= C.R2_T_MIN || T >= C.B23_T_MAX) return null;
  const p = boundary23_T_to_P(T);
  return p > C.B23_P_MIN && p <= C.P_MAX &&
    (T >= C.Tc || p < saturationPressure(T)) ? pairAt('23', p, T) : null;
}

export function findPressureSeam(
  p: number,
  target: number,
  property: 'enthalpy' | 'entropy',
): FormulationSeamResolution | null {
  if (!Number.isFinite(p) || !Number.isFinite(target) || p < C.P_MIN || p > C.P_MAX) return null;
  for (const seam of ['13', '23', '25'] as const) {
    if (seam === '25' ? p > C.R5_P_MAX : p <= C.B23_P_MIN) continue;
    let reference: BasicProperties;
    if (seam === '13') {
      if (p <= saturationPressure(C.R2_T_MIN)) continue;
      reference = region1(p, C.R2_T_MIN);
    } else if (seam === '23') {
      const [T] = nativeB23TemperatureBracket(p);
      if (T < C.Tc && p >= saturationPressure(T)) continue;
      reference = region2(p, T);
    } else {
      reference = region2(p, C.R2_T_MAX);
    }
    // IF97 Table 43 consistency limits only prefilter; acceptance uses the actual EOS span.
    if (Math.abs(reference[property] - target) > (property === 'enthalpy' ? 0.2 : 0.0002)) continue;
    const pair = formulationSeamAtPressure(p, seam);
    const match = pair === null ? null : matchFixedSeam(pair, property, target);
    if (match !== null) return match;
  }
  return null;
}

function numericalAllowance(value: number): number {
  return 128 * Number.EPSILON * Math.max(1, Math.abs(value));
}

function resolution(
  pair: FormulationSeamPair,
  kind: FormulationSeamResolution['kind'],
  hsReconstruction = false,
): FormulationSeamResolution {
  return {
    pair, kind, state: pair.canonical,
    budgets: {
      enthalpy: Math.abs(pair.upper.enthalpy - pair.lower.enthalpy) +
        (hsReconstruction ? 1e-9 : numericalAllowance(pair.canonical.enthalpy)),
      entropy: Math.abs(pair.upper.entropy - pair.lower.entropy) +
        (hsReconstruction ? 1e-12 : numericalAllowance(pair.canonical.entropy)),
    },
  };
}

export function matchFixedSeam(
  pair: FormulationSeamPair,
  property: 'enthalpy' | 'entropy',
  target: number,
  coordinate: 'pressure' | 'temperature' = 'pressure',
): FormulationSeamResolution | null {
  if (coordinate === 'temperature' && pair.seam !== '23') return null;
  if (pair.seam === '23' && pair.pressure === C.P_MAX) {
    const corner = region2(C.P_MAX, C.B23_T_MAX);
    // The exact PT corner is R2, above the native quadratic's last R3 float.
    if (target === corner[property]) return resolution({ ...pair, canonical: corner }, 'canonical');
  }
  const lower = pair.lower[property];
  const upper = pair.upper[property];
  if (!Number.isFinite(target) || target < Math.min(lower, upper) || target > Math.max(lower, upper)) return null;
  if (target === pair.canonical[property]) return resolution(pair, 'canonical');
  const interior = coordinate === 'temperature'
    ? region2(nextFloat(pair.pressure, -1), pair.temperature)
    : pair.seam === '13' ? solveRegion3PTBasic(pair.pressure, nextFloat(pair.temperature, 1))
    : pair.seam === '23' ? region2(pair.pressure, nextFloat(pair.temperature, 1))
    : region5(pair.pressure, nextFloat(pair.temperature, 1));
  // EOS rounding can put the first admissible float inside the endpoint's gap.
  if (coordinate === 'pressure' && detectRegionPT(interior.pressure, interior.temperature) === interior.region &&
      Math.abs(interior[property] - target) <= (property === 'enthalpy' ? 1e-9 : 1e-12)) {
    return resolution({ ...pair, canonical: interior }, 'canonical');
  }
  if (coordinate === 'temperature') {
    if (interior[property] === target) return null;
    const first = gibbsPropertyDerivatives(pair.lower);
    const second = gibbsPropertyDerivatives(pair.upper);
    const derivative = property === 'enthalpy' ? 'dhDp' : 'dsDp';
    if (first[derivative] >= 0 || second[derivative] >= 0) return null;
  }
  return resolution(pair, upper > lower ? 'gap' : 'overlap');
}

function tangent(pair: FormulationSeamPair, state: BasicProperties): readonly [number, number] {
  const derivatives = gibbsPropertyDerivatives(state);
  if (pair.seam !== '23') return [derivatives.dhDp, derivatives.dsDp];
  // Derivative of the native quadratic B23 pressure boundary.
  const dpDT = -1.1671859879975 + 2 * 0.0010192970039326 * pair.temperature;
  return [
    derivatives.dhDT + derivatives.dhDp * dpDT,
    derivatives.dsDT + derivatives.dsDp * dpDT,
  ];
}

interface HSSeamDomain {
  seam: FormulationSeam;
  nodes: number[];
  minimumEntropy: number;
  maximumEntropy: number;
  minimumEnthalpy: number;
  maximumEnthalpy: number;
}

let hsDomains: HSSeamDomain[] | undefined;

function nextFloat(value: number, direction: 1 | -1): number {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + BigInt(direction));
  return view.getFloat64(0);
}

function b23LowerTemperature(): number {
  let lower = C.R2_T_MIN;
  let upper = C.Tc;
  while (true) {
    const middle = (lower + upper) / 2;
    if (middle === lower || middle === upper) return upper;
    if (boundary23_T_to_P(middle) < saturationPressure(middle)) upper = middle;
    else lower = middle;
  }
}

function pairAtParameter(seam: FormulationSeam, parameter: number): FormulationSeamPair {
  return seam === '23'
    ? pairAt(seam, boundary23_T_to_P(parameter), parameter)
    : pairAt(seam, parameter, seam === '13' ? C.R2_T_MIN : C.R2_T_MAX);
}

function hsSeamDomains(): HSSeamDomain[] {
  if (hsDomains !== undefined) return hsDomains;
  hsDomains = (['13', '23', '25'] as const).map((seam) => {
    const lower = seam === '25' ? C.P_MIN : seam === '13'
      ? nextFloat(saturationPressure(C.R2_T_MIN), 1) : b23LowerTemperature();
    const upper = seam === '25' ? C.R5_P_MAX : seam === '13'
      ? C.P_MAX : nativeB23TemperatureBracket(C.P_MAX)[0];
    const nodes = [lower, upper];
    {
      // Partition both equations at their folds before inverting either property.
      for (const side of ['lower', 'upper'] as const) {
        for (const propertyIndex of [0, 1] as const) {
          let previous = lower;
          const first = pairAtParameter(seam, previous);
          let previousDerivative = tangent(first, first[side])[propertyIndex];
          for (let i = 1; i <= 16; i++) {
            const current = lower + (upper - lower) * i / 16;
            const pair = pairAtParameter(seam, current);
            const currentDerivative = tangent(pair, pair[side])[propertyIndex];
            if (previousDerivative * currentDerivative < 0) {
              nodes.push(bracketedNewton((q) => {
                const at = pairAtParameter(seam, q);
                return tangent(at, at[side])[propertyIndex];
              }, previous, current, undefined, { tolerance: 1e-13 }));
            }
            previous = current;
            previousDerivative = currentDerivative;
          }
        }
      }
    }
    nodes.sort((a, b) => a - b);
    const states = nodes.flatMap((q) => {
      const pair = pairAtParameter(seam, q);
      return [pair.lower, pair.upper];
    });
    return {
      seam, nodes,
      minimumEntropy: Math.min(...states.map((state) => state.entropy)),
      maximumEntropy: Math.max(...states.map((state) => state.entropy)),
      minimumEnthalpy: Math.min(...states.map((state) => state.enthalpy)),
      maximumEnthalpy: Math.max(...states.map((state) => state.enthalpy)),
    };
  });
  return hsDomains;
}

/** Locate both constraints on one bounded ribbon between independently fitted EOS. */
export function findHSSeam(h: number, s: number): FormulationSeamResolution | null {
  if (!Number.isFinite(h) || !Number.isFinite(s)) return null;
  const corner = region2(C.P_MAX, C.B23_T_MAX);
  if (h === corner.enthalpy && s === corner.entropy) {
    return resolution({ ...formulationSeamAtPressure(C.P_MAX, '23')!, canonical: corner }, 'canonical');
  }
  for (const domain of hsSeamDomains()) {
    const entropyNoise = numericalAllowance(s);
    const enthalpyNoise = numericalAllowance(h);
    if (h < domain.minimumEnthalpy - enthalpyNoise || h > domain.maximumEnthalpy + enthalpyNoise) continue;
    if (s < domain.minimumEntropy - entropyNoise || s > domain.maximumEntropy + entropyNoise) continue;
    const cache = new Map<number, FormulationSeamPair>();
    const at = (q: number): FormulationSeamPair => {
      let pair = cache.get(q);
      if (pair === undefined) {
        pair = pairAtParameter(domain.seam, q);
        cache.set(q, pair);
      }
      return pair;
    };
    const bounds = [...domain.nodes];
    for (let i = 1; i < domain.nodes.length; i++) {
      const lower = domain.nodes[i - 1];
      const upper = domain.nodes[i];
      for (const side of ['lower', 'upper'] as const) {
        const first = at(lower)[side].entropy - s;
        const last = at(upper)[side].entropy - s;
        if (first * last < 0) {
          bounds.push(bracketedNewton((q) => at(q)[side].entropy - s, lower, upper, undefined, {
            derivative: (q) => { const pair = at(q); return tangent(pair, pair[side])[1]; },
            tolerance: 1e-13,
          }));
        }
      }
    }
    bounds.sort((a, b) => a - b);
    const hScale = Math.max(1, Math.abs(h));
    const sScale = Math.max(1, Math.abs(s));
    const crossResidual = (q: number): number => {
      const pair = at(q);
      const dh = (pair.upper.enthalpy - pair.lower.enthalpy) / hScale;
      const ds = (pair.upper.entropy - pair.lower.entropy) / sScale;
      const length = Math.hypot(dh, ds);
      return length === 0 ? (pair.lower.entropy - s) / sScale
        : ((h - pair.lower.enthalpy) / hScale * ds - (s - pair.lower.entropy) / sScale * dh) / length;
    };
    const matchAt = (q: number): FormulationSeamResolution | null => {
      const pair = at(q);
      const dh = pair.upper.enthalpy - pair.lower.enthalpy;
      const ds = pair.upper.entropy - pair.lower.entropy;
      const scaledH = dh / hScale;
      const scaledS = ds / sScale;
      const squareLength = scaledH * scaledH + scaledS * scaledS;
      const fraction = squareLength === 0 ? 0 : Math.max(0, Math.min(1,
        (((h - pair.lower.enthalpy) / hScale) * scaledH +
          ((s - pair.lower.entropy) / sScale) * scaledS) / squareLength));
      // Region 3 density inversion introduces cancellation beyond machine-noise in h/s.
      if (Math.abs(pair.lower.enthalpy + fraction * dh - h) > 1e-9 ||
          Math.abs(pair.lower.entropy + fraction * ds - s) > 1e-12) return null;
      if (Math.abs(pair.canonical.enthalpy - h) <= numericalAllowance(h) &&
          Math.abs(pair.canonical.entropy - s) <= numericalAllowance(s)) return resolution(pair, 'canonical');
      const direction = tangent(pair, pair.lower);
      return resolution(pair, direction[0] * ds - direction[1] * dh > 0 ? 'gap' : 'overlap', true);
    };
    for (let i = 0; i < bounds.length; i++) {
      const exact = matchAt(bounds[i]);
      if (exact !== null) return exact;
      if (i === 0 || bounds[i] === bounds[i - 1]) continue;
      const lower = bounds[i - 1];
      const upper = bounds[i];
      const middle = at((lower + upper) / 2);
      if (s < Math.min(middle.lower.entropy, middle.upper.entropy) - entropyNoise ||
          s > Math.max(middle.lower.entropy, middle.upper.entropy) + entropyNoise) continue;
      if (crossResidual(lower) * crossResidual(upper) >= 0) continue;
      const root = bracketedNewton(crossResidual, lower, upper, undefined, { tolerance: 4 * Number.EPSILON });
      const match = matchAt(root);
      if (match !== null) return match;
    }
  }
  return null;
}
