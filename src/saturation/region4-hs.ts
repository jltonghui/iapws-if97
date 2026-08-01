import * as C from '../constants.js';
import { bracketedNewton } from '../solvers/bracketed-newton.js';
import { dampedNewton2D } from '../solvers/damped-newton-2d.js';
import type { BasicProperties, CoefficientTable } from '../types.js';
import { IF97Error } from '../types.js';
import {
  mixSaturationState,
  rawQualityFromSaturationProperty,
  saturationEndpointsAtTemperature,
} from './common.js';
import {
  assertRegion4StateAllowed,
  clampRegion4TemperatureBelowCritical,
} from './region4-boundaries.js';

const REGION4_QUALITY_TOLERANCE = 1e-6;
const REGION4_ENDPOINT_QUALITY_SNAP_TOLERANCE = 1e-10;
/** Lower entropy limit of the SR4-04 T_sat(h,s) equation [kJ/(kg·K)].
 *  Published range of validity is s''(623.15 K) = 5.210887825 to
 *  s''(273.15 K) = 9.155759395; both reproduce exactly from Region 2 on the
 *  saturation line. Below this bound Eq. 9 is extrapolation, so the caller
 *  falls through to the general Newton path instead.
 *  Ref: IAPWS SR4-04(2014), Eq. 9. */
const REGION4_HS_BACKWARD_MIN_ENTROPY = 5.210887825;
const REGION4_HS_ENDPOINT_RESIDUAL_TOLERANCE = 1e-14;
const REGION4_HS_NEWTON_UPPER = C.Tc - C.REGION4_SUBCRITICAL_TEMPERATURE_MARGIN;
const REGION4_HS_NEAR_CRITICAL_UPPER = REGION4_HS_NEWTON_UPPER;
const REGION4_TRIPLE_POINT_ENDPOINTS = saturationEndpointsAtTemperature(C.Tt);

interface EntropyResidualEvaluation {
  residual: number;
  derivative: number;
  quality: number;
  liquidEnthalpy: number;
  vaporEnthalpy: number;
  liquidEntropy: number;
  vaporEntropy: number;
  liquidDhDT: number;
  vaporDhDT: number;
  liquidDsDT: number;
  vaporDsDT: number;
}

interface GibbsResidualEvaluation {
  residual: number;
  derivative: number;
}

const REGION4_HS_T: CoefficientTable = [
  [0,0,0.179882673606601],[0,3,-0.267507455199603],[0,12,1.16276722612600],
  [1,0,0.147545428713616],[1,1,-0.512871635973248],[1,2,0.421333567697984],
  [1,5,0.563749522189870],[2,0,0.429274443819153],[2,5,-3.35704552142140],
  [2,8,10.8890916499278],[3,0,-0.248483390456012],[3,2,0.304153221906390],
  [3,3,-0.494819763939905],[3,4,1.07551674933261],[4,0,0.0733888415457688],
  [4,1,0.0140170545411085],[5,1,-0.106110975998808],[5,2,0.0168324361811875],
  [5,4,1.25028363714877],[5,16,1013.16840309509],[6,6,-1.51791558000712],
  [6,8,52.4277865990866],[6,22,23049.5545563912],[8,1,0.0249459806365456],
  [10,20,2107964.67412137],[10,36,366836848.613065],[12,24,-144814105.365163],
  [14,1,-0.00179276373003590],[14,28,4899556021.00459],[16,12,471.262212070518],
  [16,32,-82929439019.8652],[18,14,-1715.45662263191],[18,22,3557776.82973575],
  [18,36,586062760258.436],[20,24,-12988763.5078195],[28,36,31724744937.1057],
] as const;

/** IAPWS SR4-04(2014), Eq. 9. Valid for Region 4 states at T <= 623.15 K. */
export function region4BackwardTemperatureHS(h: number, s: number): number {
  const eta = h / 2800;
  const sigma = s / 9.2;
  let theta = 0;
  for (const [I, J, n] of REGION4_HS_T) {
    theta += n * Math.pow(eta - 0.119, I) * Math.pow(sigma - 1.07, J);
  }
  return 550 * theta;
}

function normalizeEndpointQuality(quality: number): number {
  if (!Number.isFinite(quality)) {
    return Number.NaN;
  }
  if (quality < 0 && quality >= -REGION4_QUALITY_TOLERANCE) {
    return 0;
  }
  if (quality > 1 && quality <= 1 + REGION4_QUALITY_TOLERANCE) {
    return 1;
  }
  return quality;
}

function isAdmissibleQuality(quality: number): boolean {
  return Number.isFinite(quality)
    && quality >= -REGION4_QUALITY_TOLERANCE
    && quality <= 1 + REGION4_QUALITY_TOLERANCE;
}

function endpointQuality(
  qualityFromEnthalpy: number,
  qualityFromEntropy: number,
): 0 | 1 | null {
  if (Math.abs(qualityFromEnthalpy) <= REGION4_ENDPOINT_QUALITY_SNAP_TOLERANCE &&
      Math.abs(qualityFromEntropy) <= REGION4_ENDPOINT_QUALITY_SNAP_TOLERANCE) {
    return 0;
  }
  if (Math.abs(qualityFromEnthalpy - 1) <= REGION4_ENDPOINT_QUALITY_SNAP_TOLERANCE &&
      Math.abs(qualityFromEntropy - 1) <= REGION4_ENDPOINT_QUALITY_SNAP_TOLERANCE) {
    return 1;
  }
  return null;
}

function entropyResidualEvaluation(
  h: number,
  s: number,
  temperatureGuess: number,
): EntropyResidualEvaluation {
  const endpoints = saturationEndpointsAtTemperature(
    clampRegion4TemperatureBelowCritical(temperatureGuess),
  );
  const T = endpoints.temperature;
  const { liquid, vapor } = endpoints;
  const quality = rawQualityFromSaturationProperty(
    liquid.enthalpy,
    vapor.enthalpy,
    h,
  );

  if (!Number.isFinite(quality)) {
    return {
      residual: Number.NaN,
      derivative: Number.NaN,
      quality,
      liquidEnthalpy: liquid.enthalpy,
      vaporEnthalpy: vapor.enthalpy,
      liquidEntropy: liquid.entropy,
      vaporEntropy: vapor.entropy,
      liquidDhDT: Number.NaN,
      vaporDhDT: Number.NaN,
      liquidDsDT: Number.NaN,
      vaporDsDT: Number.NaN,
    };
  }

  const deltaH = vapor.enthalpy - liquid.enthalpy;
  const deltaS = vapor.entropy - liquid.entropy;
  const deltaV = vapor.specificVolume - liquid.specificVolume;
  const pressureDerivative = deltaS / (1000 * deltaV);
  const phaseDerivatives = (state: BasicProperties): readonly [number, number] => {
    const cp = state.cp ?? Number.NaN;
    const alpha = state.isobaricExpansion ?? Number.NaN;
    return [
      cp + 1000 * state.specificVolume * (1 - T * alpha) * pressureDerivative,
      cp / T - 1000 * state.specificVolume * alpha * pressureDerivative,
    ];
  };
  const [liquidDhDT, liquidDsDT] = phaseDerivatives(liquid);
  const [vaporDhDT, vaporDsDT] = phaseDerivatives(vapor);
  const qualityDerivative = -(
    liquidDhDT + quality * (vaporDhDT - liquidDhDT)
  ) / deltaH;

  return {
    residual: liquid.entropy * (1 - quality) + vapor.entropy * quality - s,
    derivative: liquidDsDT + quality * (vaporDsDT - liquidDsDT) + qualityDerivative * deltaS,
    quality,
    liquidEnthalpy: liquid.enthalpy,
    vaporEnthalpy: vapor.enthalpy,
    liquidEntropy: liquid.entropy,
    vaporEntropy: vapor.entropy,
    liquidDhDT,
    vaporDhDT,
    liquidDsDT,
    vaporDsDT,
  };
}

function entropyResidual(h: number, s: number, temperatureGuess: number): number {
  return entropyResidualEvaluation(h, s, temperatureGuess).residual;
}

function gibbsResidualEvaluation(
  h: number,
  s: number,
  temperatureGuess: number,
): GibbsResidualEvaluation {
  const endpoints = saturationEndpointsAtTemperature(
    clampRegion4TemperatureBelowCritical(temperatureGuess),
  );
  const T = endpoints.temperature;
  const { liquid, vapor } = endpoints;
  const deltaS = vapor.entropy - liquid.entropy;
  const deltaV = vapor.specificVolume - liquid.specificVolume;
  const pressureDerivative = deltaS / (1000 * deltaV);

  return {
    residual: liquid.enthalpy - T * liquid.entropy + T * s - h,
    derivative: 1000 * liquid.specificVolume * pressureDerivative - liquid.entropy + s,
  };
}

function tryRegion4HSGibbsState(h: number, s: number): BasicProperties | null {
  let cachedTemperature = Number.NaN;
  let cachedEvaluation: GibbsResidualEvaluation | null = null;
  const evaluate = (temperature: number): GibbsResidualEvaluation => {
    const stableTemperature = Math.round(
      temperature / C.REGION4_TEMPERATURE_TOLERANCE,
    ) * C.REGION4_TEMPERATURE_TOLERANCE;
    if (stableTemperature !== cachedTemperature || cachedEvaluation === null) {
      cachedTemperature = stableTemperature;
      cachedEvaluation = gibbsResidualEvaluation(h, s, stableTemperature);
    }
    return cachedEvaluation;
  };

  if (h < 10 && s < 0.1) {
    let temperature = C.Tt;
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const value = entropyResidualEvaluation(h, s, temperature);
      if (Math.abs(value.residual) <= REGION4_HS_ENDPOINT_RESIDUAL_TOLERANCE) {
        const state = finalizeRegion4HSState(h, s, temperature);
        if (state !== null) return state;
      }
      if (!Number.isFinite(value.derivative) || value.derivative === 0) break;
      const candidate = temperature - value.residual / value.derivative;
      if (!(candidate >= C.Tt && candidate <= C.Tt + 0.1)) break;
      temperature = Math.round(
        candidate / C.REGION4_TEMPERATURE_TOLERANCE,
      ) * C.REGION4_TEMPERATURE_TOLERANCE;
    }
  }

  if (Math.abs(h - C.R3_H_CRT) >= 10 || Math.abs(s - C.R3_S_CRT) >= 0.1) {
    return null;
  }

  const initialTemperature = C.Tc - 1e-4;
  try {
    const initialState = finalizeRegion4HSState(h, s, initialTemperature);
    if (initialState !== null) return initialState;

    const root = bracketedNewton(
      (T) => evaluate(T).residual,
      C.Tc - C.CRITICAL_T_EXCLUSION_BAND,
      REGION4_HS_NEAR_CRITICAL_UPPER,
      initialTemperature,
      {
        tolerance: C.REGION4_HS_RESIDUAL_TOLERANCE,
        derivative: (T) => evaluate(T).derivative,
      },
    );
    const stableRoot = Math.round(
      root / C.REGION4_TEMPERATURE_TOLERANCE,
    ) * C.REGION4_TEMPERATURE_TOLERANCE;
    return finalizeRegion4HSState(h, s, stableRoot);
  } catch (error) {
    if (!(error instanceof IF97Error)) throw error;
  }

  return null;
}

function tryRegion4HSNewtonState(h: number, s: number): BasicProperties | null {
  // h/s carries units of K and, because IF97 zeroes h and s at the triple-point
  // liquid, approximates the mean temperature of heat addition from that state —
  // close enough to land inside the dome for most inputs. It is clamped to the
  // saturation range and backed by fixed seeds spanning Tt to just below Tc.
  const seeds = [h / s, 300, 400, 500, 580, 630, 645];
  const tried = new Set<number>();
  const hScale = Math.max(1, Math.abs(h));
  const sScale = Math.max(1, Math.abs(s));

  for (const rawSeed of seeds) {
    const seed = Math.max(C.Tt, Math.min(REGION4_HS_NEWTON_UPPER, rawSeed));
    if (!Number.isFinite(seed) || tried.has(seed)) continue;
    tried.add(seed);

    try {
      const initialValue = entropyResidualEvaluation(h, s, seed);
      if (!Number.isFinite(initialValue.quality)) continue;
      const [temperature, quality] = dampedNewton2D(([T, x]) => {
        const value = entropyResidualEvaluation(h, s, T);
        const deltaH = value.vaporEnthalpy - value.liquidEnthalpy;
        const deltaS = value.vaporEntropy - value.liquidEntropy;
        return {
          residual: [
            (value.liquidEnthalpy * (1 - x) + value.vaporEnthalpy * x - h) / hScale,
            (value.liquidEntropy * (1 - x) + value.vaporEntropy * x - s) / sScale,
          ],
          jacobian: [
            [
              (value.liquidDhDT * (1 - x) + value.vaporDhDT * x) / hScale,
              deltaH / hScale,
            ],
            [
              (value.liquidDsDT * (1 - x) + value.vaporDsDT * x) / sScale,
              deltaS / sScale,
            ],
          ],
        };
      }, [seed, initialValue.quality], {
        tolerance: 1e-12,
        maxIterations: 30,
        isValid: ([T]) => T >= C.Tt && T <= REGION4_HS_NEWTON_UPPER,
      });

      if (isAdmissibleQuality(quality)) {
        const stableTemperature = Math.round(
          temperature / C.REGION4_TEMPERATURE_TOLERANCE,
        ) * C.REGION4_TEMPERATURE_TOLERANCE;
        const state = finalizeRegion4HSState(h, s, stableTemperature);
        if (state !== null) return state;
      }
    } catch (error) {
      if (!(error instanceof IF97Error)) throw error;
    }
  }

  return null;
}

function finalizeRegion4HSState(
  h: number,
  s: number,
  temperature: number,
): BasicProperties | null {
  const endpoints = saturationEndpointsAtTemperature(temperature);
  const qualityFromEnthalpy = rawQualityFromSaturationProperty(
    endpoints.liquid.enthalpy,
    endpoints.vapor.enthalpy,
    h,
  );
  const qualityFromEntropy = rawQualityFromSaturationProperty(
    endpoints.liquid.entropy,
    endpoints.vapor.entropy,
    s,
  );
  const normalizedQualityFromEnthalpy = normalizeEndpointQuality(qualityFromEnthalpy);
  const normalizedQualityFromEntropy = normalizeEndpointQuality(qualityFromEntropy);

  if (!isAdmissibleQuality(normalizedQualityFromEnthalpy) || !isAdmissibleQuality(normalizedQualityFromEntropy)) {
    return null;
  }

  if (Math.abs(normalizedQualityFromEnthalpy - normalizedQualityFromEntropy) > REGION4_QUALITY_TOLERANCE) {
    return null;
  }

  const mixedEntropy = endpoints.liquid.entropy * (1 - qualityFromEnthalpy) +
    endpoints.vapor.entropy * qualityFromEnthalpy;
  if (Math.abs(mixedEntropy - s) > C.REGION4_HS_RESIDUAL_TOLERANCE) {
    return null;
  }

  try {
    assertRegion4StateAllowed(endpoints.pressure, endpoints.temperature, 'Region4HS');
  } catch {
    return null;
  }

  const exactEndpointQuality = endpointQuality(qualityFromEnthalpy, qualityFromEntropy);
  return mixSaturationState(
    endpoints,
    exactEndpointQuality ?? normalizedQualityFromEnthalpy,
  );
}

function isTriplePointHS(h: number, s: number): boolean {
  const { liquid, vapor } = REGION4_TRIPLE_POINT_ENDPOINTS;
  const quality = rawQualityFromSaturationProperty(
    liquid.entropy,
    vapor.entropy,
    s,
  );
  if (quality < 0 || quality > 1) return false;

  const expectedH = liquid.enthalpy * (1 - quality) + vapor.enthalpy * quality;
  return Math.abs(expectedH - h) <= C.REGION4_HS_RESIDUAL_TOLERANCE;
}

function tryRegion4HSBackwardState(h: number, s: number): BasicProperties | null {
  if (s < REGION4_HS_BACKWARD_MIN_ENTROPY) return null;

  const lower = C.Tt;
  const upper = C.R2_T_MIN;
  const rawSeed = region4BackwardTemperatureHS(h, s);
  if (!Number.isFinite(rawSeed) || rawSeed < lower - 0.1 || rawSeed > upper + 0.1) {
    return null;
  }

  const seed = Math.max(lower, Math.min(upper, rawSeed));
  const seedState = finalizeRegion4HSState(h, s, seed);
  if (seedState !== null) return seedState;

  let radius = 0.01;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const bracketLower = Math.max(lower, seed - radius);
    const bracketUpper = Math.min(upper, seed + radius);
    const lowerResidual = entropyResidual(h, s, bracketLower);
    const upperResidual = entropyResidual(h, s, bracketUpper);

    if (Number.isFinite(lowerResidual) && Number.isFinite(upperResidual) &&
        lowerResidual * upperResidual <= 0) {
      let cachedTemperature = Number.NaN;
      let cachedEvaluation = { residual: Number.NaN, derivative: Number.NaN };
      const evaluate = (candidateTemperature: number): typeof cachedEvaluation => {
        if (candidateTemperature !== cachedTemperature) {
          cachedTemperature = candidateTemperature;
          cachedEvaluation = entropyResidualEvaluation(h, s, candidateTemperature);
        }
        return cachedEvaluation;
      };
      const root = bracketedNewton(
        (candidateTemperature) => evaluate(candidateTemperature).residual,
        bracketLower,
        bracketUpper,
        seed,
        {
          tolerance: C.REGION4_HS_RESIDUAL_TOLERANCE,
          derivative: (candidateTemperature) => evaluate(candidateTemperature).derivative,
        },
      );
      return finalizeRegion4HSState(h, s, root);
    }

    if (bracketLower === lower && bracketUpper === upper) break;
    radius *= 2;
  }

  return null;
}

export function tryRegion4HSState(h: number, s: number): BasicProperties | null {
  if (isTriplePointHS(h, s)) {
    const triplePointState = finalizeRegion4HSState(h, s, C.Tt);
    if (triplePointState !== null) return triplePointState;
  }

  const backwardState = tryRegion4HSBackwardState(h, s);
  if (backwardState !== null) return backwardState;

  const gibbsState = tryRegion4HSGibbsState(h, s);
  if (gibbsState !== null) return gibbsState;

  const newtonState = tryRegion4HSNewtonState(h, s);
  if (newtonState !== null) return newtonState;

  return null;
}
