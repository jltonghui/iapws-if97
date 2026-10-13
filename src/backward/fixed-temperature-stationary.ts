import { RHOc, Tc } from '../constants.js';
import { COEFFICIENTS as R1_COEFFICIENTS } from '../regions/region1.js';
import { RESIDUAL_COEFFICIENTS as R2_COEFFICIENTS } from '../regions/region2.js';
import { COEFFICIENTS as R3_COEFFICIENTS, region3ByRhoT } from '../regions/region3.js';
import { RESIDUAL_COEFFICIENTS as R5_COEFFICIENTS } from '../regions/region5.js';
import { Region, type BasicProperties, type CoefficientTable } from '../types.js';
import type { FixedTemperatureProperty } from './fixed-temperature-solver.js';

function evaluate(coefficients: readonly number[], x: number): number {
  let value = 0;
  for (let i = coefficients.length - 1; i >= 0; i--) value = value * x + coefficients[i];
  return value;
}

// Derivative roots partition a polynomial into monotone intervals (Rolle's theorem).
function polynomialRoots(coefficients: number[], lower: number, upper: number): number[] {
  while (coefficients.length > 1 && coefficients[coefficients.length - 1] === 0) coefficients.pop();
  if (coefficients.length < 2) return [];
  const scale = Math.max(...coefficients.map(Math.abs));
  const normalized = coefficients.map((value) => value / scale);
  const derivative = normalized.slice(1).map((value, i) => value * (i + 1));
  const points = [lower, ...polynomialRoots(derivative, lower, upper), upper];
  const roots: number[] = [];

  for (let i = 0; i < points.length; i++) {
    let a = points[i];
    let fa = evaluate(normalized, a);
    if (fa === 0) roots.push(a);
    if (i === points.length - 1) break;
    let b = points[i + 1];
    const fb = evaluate(normalized, b);
    if (fa === 0 || fb === 0 || Math.sign(fa) === Math.sign(fb)) continue;
    for (let step = 0; step < 64; step++) {
      const midpoint = (a + b) / 2;
      if (midpoint === a || midpoint === b) break;
      const fm = evaluate(normalized, midpoint);
      if (fm === 0) { a = midpoint; b = midpoint; break; }
      if (Math.sign(fa) === Math.sign(fm)) { a = midpoint; fa = fm; }
      else b = midpoint;
    }
    roots.push((a + b) / 2);
  }
  return roots.filter((root, i) => i === 0 || root !== roots[i - 1]);
}

/** Locate isotherm extrema without a pressure grid, including closely spaced roots. */
export function fixedTemperatureStationaryPressures(
  T: number,
  region: Region,
  lowerState: BasicProperties,
  upperState: BasicProperties,
  property: FixedTemperatureProperty,
): number[] {
  let table: CoefficientTable;
  let tau: number;
  switch (region) {
    case Region.Region1: table = R1_COEFFICIENTS; tau = 1386 / T - 1.222; break;
    case Region.Region2: table = R2_COEFFICIENTS; tau = 540 / T - 0.5; break;
    case Region.Region3: table = R3_COEFFICIENTS; tau = Tc / T; break;
    case Region.Region5: table = R5_COEFFICIENTS; tau = 1000 / T; break;
    case Region.Region4: return [];
  }

  const nativeValue = (state: BasicProperties): number => region === Region.Region1
    ? 7.1 - state.pressure / 16.53
    : region === Region.Region3 ? 1 / (state.specificVolume * RHOc) : state.pressure;
  const lower = Math.min(nativeValue(lowerState), nativeValue(upperState));
  const upper = Math.max(nativeValue(lowerState), nativeValue(upperState));
  const logarithmicEntropy = property === 'entropy' && region !== Region.Region1;
  const coefficients: number[] = Array(Math.max(...table.map(([I]) => I)) +
    (logarithmicEntropy ? 1 : 0)).fill(0);
  if (logarithmicEntropy) {
    // Multiplying ds/dp (or ds/dδ) by its positive native variable clears 1/p (1/δ).
    coefficients[0] = region === Region.Region3 ? -R3_COEFFICIENTS[0][2] : -1;
  }
  for (const [I, J, N] of table) {
    if (I === 0) continue;
    // Constant nonzero factors do not affect the derivative's zeros.
    const tauDerivative = J === 0 ? 0 : J * Math.pow(tau, J - 1);
    let coefficient: number;
    if (property === 'enthalpy') {
      coefficient = region === Region.Region3
        ? N * I * (I + J) * Math.pow(tau, J)
        : N * I * tauDerivative;
    } else {
      const physicalTau = tau + (region === Region.Region1 ? 1.222 : region === Region.Region2 ? 0.5 : 0);
      coefficient = region === Region.Region3
        ? N * I * (J - 1) * Math.pow(tau, J)
        : N * I * (physicalTau * tauDerivative - Math.pow(tau, J));
    }
    coefficients[I - (logarithmicEntropy ? 0 : 1)] += coefficient;
  }

  // Scaling the native variable to [0, 1] avoids powers of pressures up to 100 MPa.
  const scaled = coefficients.map((value, i) => value * Math.pow(upper, i));
  return polynomialRoots(scaled, lower / upper, 1).map((root) => {
    const native = root * upper;
    if (region === Region.Region1) return (7.1 - native) * 16.53;
    if (region === Region.Region3) return region3ByRhoT(native * RHOc, T).pressure;
    return native;
  }).filter((pressure) => pressure > lowerState.pressure && pressure < upperState.pressure)
    .sort((a, b) => a - b);
}
