import type { BasicProperties } from '../types.js';

export interface GibbsPropertyDerivatives {
  dhDp: number;
  dhDT: number;
  dsDp: number;
  dsDT: number;
}

export interface HelmholtzPropertyDerivatives {
  dpDrho: number;
  dpDT: number;
  dhDrho: number;
  dhDT: number;
  dsDrho: number;
  dsDT: number;
}

export function gibbsPropertyDerivatives(state: BasicProperties): GibbsPropertyDerivatives {
  const cp = state.cp ?? Number.NaN;
  const alpha = state.isobaricExpansion ?? Number.NaN;
  const v = state.specificVolume;
  const T = state.temperature;

  return {
    dhDp: 1000 * v * (1 - T * alpha),
    dhDT: cp,
    dsDp: -1000 * v * alpha,
    dsDT: cp / T,
  };
}

export function helmholtzPropertyDerivatives(
  state: BasicProperties,
  rho: number,
): HelmholtzPropertyDerivatives {
  const cv = state.cv ?? Number.NaN;
  const alpha = state.isobaricExpansion ?? Number.NaN;
  const kappa = state.isothermalCompressibility ?? Number.NaN;
  const T = state.temperature;
  const rhoSquaredKappa = rho * rho * kappa;

  return {
    dpDrho: 1 / (rho * kappa),
    dpDT: alpha / kappa,
    dhDrho: 1000 * (1 - T * alpha) / rhoSquaredKappa,
    dhDT: cv + 1000 * alpha / (rho * kappa),
    dsDrho: -1000 * alpha / rhoSquaredKappa,
    dsDT: cv / T,
  };
}
