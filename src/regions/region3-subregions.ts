/**
 * Region 3 subregion dispatcher: v(P,T) backward equations.
 * Routes to correct subregion based on P and T position.
 */
import { evalSubregion } from './region3-eval.js';
import { REGION3_SUBREGIONS as R3 } from './region3-data.js';
import { b3ab, b3cd, b3ef, b3gh, b3ij, b3jk, b3mn, b3op, b3qu, b3rx, b3uv, b3wx } from './boundaries.js';
import { saturationPressure, saturationTemperature } from './region4.js';
import { IF97Error } from '../types.js';

/** Compute specific volume for Region 3 saturation boundary. x=0 liquid, x=1 vapor */
export function region3SatVolume(p: number, T: number, x: number): number {
  if (x === 0) {
    if (p < 19.00881189) return evalSubregion(R3.C, p, T);
    if (p < 21.0434) return evalSubregion(R3.S, p, T);
    if (p < 21.9316) return evalSubregion(R3.U, p, T);
    return evalSubregion(R3.Y, p, T);
  }
  if (p < 20.5) return evalSubregion(R3.T, p, T);
  if (p < 21.0434) return evalSubregion(R3.R, p, T);
  if (p < 21.9009) return evalSubregion(R3.X, p, T);
  return evalSubregion(R3.Z, p, T);
}

/** Compute specific volume for Region 3 from P and T using subregion equations. */
export function region3Volume(p: number, T: number): number {
  if (p > 40) {
    return T <= b3ab(p) ? evalSubregion(R3.A, p, T) : evalSubregion(R3.B, p, T);
  }
  if (p > 25) {
    const tcd = b3cd(p), tab = b3ab(p), tef = b3ef(p);
    if (T <= tcd) return evalSubregion(R3.C, p, T);
    if (T <= tab) return evalSubregion(R3.D, p, T);
    if (T <= tef) return evalSubregion(R3.E, p, T);
    return evalSubregion(R3.F, p, T);
  }
  if (p > 23.5) {
    const tcd = b3cd(p), tgh = b3gh(p), tef = b3ef(p), tij = b3ij(p), tjk = b3jk(p);
    if (T <= tcd) return evalSubregion(R3.C, p, T);
    if (T <= tgh) return evalSubregion(R3.G, p, T);
    if (T <= tef) return evalSubregion(R3.H, p, T);
    if (T <= tij) return evalSubregion(R3.I, p, T);
    if (T <= tjk) return evalSubregion(R3.J, p, T);
    return evalSubregion(R3.K, p, T);
  }
  if (p > 23) {
    const tcd = b3cd(p), tgh = b3gh(p), tef = b3ef(p), tij = b3ij(p), tjk = b3jk(p);
    if (T <= tcd) return evalSubregion(R3.C, p, T);
    if (T <= tgh) return evalSubregion(R3.L, p, T);
    if (T <= tef) return evalSubregion(R3.H, p, T);
    if (T <= tij) return evalSubregion(R3.I, p, T);
    if (T <= tjk) return evalSubregion(R3.J, p, T);
    return evalSubregion(R3.K, p, T);
  }
  if (p > 22.5) {
    const tcd = b3cd(p), tgh = b3gh(p), tmn = b3mn(p), tef = b3ef(p);
    const top = b3op(p), tij = b3ij(p), tjk = b3jk(p);
    if (T <= tcd) return evalSubregion(R3.C, p, T);
    if (T <= tgh) return evalSubregion(R3.L, p, T);
    if (T <= tmn) return evalSubregion(R3.M, p, T);
    if (T <= tef) return evalSubregion(R3.N, p, T);
    if (T <= top) return evalSubregion(R3.O, p, T);
    if (T <= tij) return evalSubregion(R3.P, p, T);
    if (T <= tjk) return evalSubregion(R3.J, p, T);
    return evalSubregion(R3.K, p, T);
  }

  const Tsat643 = 643.15;
  const Psat643 = saturationPressure(Tsat643);

  if (p > Psat643 && p <= 22.5) {
    const tcd = b3cd(p), tqu = b3qu(p), trx = b3rx(p), tjk = b3jk(p);
    if (T <= tcd) return evalSubregion(R3.C, p, T);
    if (T <= tqu) return evalSubregion(R3.Q, p, T);
    if (T <= trx) {
      const tef = b3ef(p), twx = b3wx(p), tuv = b3uv(p);
      if (p > 22.11) {
        if (T <= tuv) return evalSubregion(R3.U, p, T);
        if (T <= tef) return evalSubregion(R3.V, p, T);
        if (T <= twx) return evalSubregion(R3.W, p, T);
        return evalSubregion(R3.X, p, T);
      }
      if (p > 22.064) {
        if (T <= tuv) return evalSubregion(R3.U, p, T);
        if (T <= tef) return evalSubregion(R3.Y, p, T);
        if (T <= twx) return evalSubregion(R3.Z, p, T);
        return evalSubregion(R3.X, p, T);
      }
      const Tsat = saturationTemperature(p);
      if (T > Tsat) {
        if (p <= 21.90096265) return evalSubregion(R3.X, p, T);
        if (T <= twx) return evalSubregion(R3.Z, p, T);
        return evalSubregion(R3.X, p, T);
      }
      if (p <= 21.93161551) return evalSubregion(R3.U, p, T);
      if (T <= tuv) return evalSubregion(R3.U, p, T);
      return evalSubregion(R3.Y, p, T);
    }
    if (T <= tjk) return evalSubregion(R3.R, p, T);
    return evalSubregion(R3.K, p, T);
  }

  if (p > 20.5 && p <= Psat643) {
    const tcd = b3cd(p), Ts = saturationTemperature(p), tjk = b3jk(p);
    if (T <= tcd) return evalSubregion(R3.C, p, T);
    if (T <= Ts) return evalSubregion(R3.S, p, T);
    if (T <= tjk) return evalSubregion(R3.R, p, T);
    return evalSubregion(R3.K, p, T);
  }

  if (p > 19.00881189173929 && p <= 20.5) {
    const tcd = b3cd(p), Ts = saturationTemperature(p);
    if (T <= tcd) return evalSubregion(R3.C, p, T);
    if (T <= Ts) return evalSubregion(R3.S, p, T);
    return evalSubregion(R3.T, p, T);
  }

  if (p > 16.5291642526) {
    const Ts = saturationTemperature(p);
    if (T <= Ts) return evalSubregion(R3.C, p, T);
    return evalSubregion(R3.T, p, T);
  }

  throw new IF97Error('Region 3 v(P,T): pressure out of range');
}
