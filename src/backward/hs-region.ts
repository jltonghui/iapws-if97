import * as C from '../constants.js';
import { createFixedTemperatureStationaryPressureFinder } from './fixed-temperature-stationary.js';
import { solveHSInRegion, solveHSSeam } from './hs-state.js';
import { helmholtzPropertyDerivatives } from '../core/thermodynamic-derivatives.js';
import { boundary23_T_to_P } from '../regions/boundaries.js';
import { region1 } from '../regions/region1.js';
import { region2 } from '../regions/region2.js';
import { region3ByRhoT } from '../regions/region3.js';
import { region5 } from '../regions/region5.js';
import { saturationEndpointsAtTemperature, type SaturationEndpoints } from '../saturation/common.js';
import { tryRegion4HSState } from '../saturation/region4-hs.js';
import type { BasicProperties, CoefficientTable } from '../types.js';
import { IF97Error, OutOfRangeError, Region } from '../types.js';
import { bracketedNewton } from '../solvers/bracketed-newton.js';
import { solveRegion3PTBasic } from '../core/region3-pt.js';
import { findHSSeam } from '../core/formulation-seams.js';
import { withinClosedLowerBound } from '../core/input-validation.js';

/** Check approximate equality with relative tolerance. */
function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

// ─── H-S Boundary Helper Functions ──────────────────────────────────────────
// From IAPWS Supplementary Release on backward equations p(h,s)

/**
 * Saturated liquid enthalpy boundary for Region 1 (Eq. 3).
 * h'_1(s)
 */
export function h1Sat(s: number): number {
  const TABLE: CoefficientTable = [
    [0,14,0.332171191705237],[0,36,6.11217706323496e-4],[1,3,-8.82092478906822],
    [1,16,-0.45562819254325],[2,0,-2.63483840850452e-5],[2,5,-22.3949661148062],
    [3,4,-4.28398660164013],[3,36,-0.616679338856916],[4,4,-14.6823031104040],
    [4,16,284.523138727299],[4,24,-113.398503195444],[5,18,1156.71380760859],
    [5,24,395.551267359325],[7,1,-1.54891257229285],[8,4,19.4486637751291],
    [12,2,-3.57915139457043],[12,4,-3.35369414148819],[14,1,-0.66442679633246],
    [14,22,32332.1885383934],[16,10,3317.66744667084],[20,12,-22350.1257931087],
    [20,28,5739538.75852936],[22,8,173.226193407919],[24,3,-0.0363968822121321],
    [28,0,8.34596332878346e-7],[32,6,5.03611916682674],[32,8,65.5444787064505],
  ] as const;
  const sig = s / 3.8;
  let h = 0;
  for (const [I, J, N] of TABLE) {
    h += N * Math.pow(sig - 1.09, I) * Math.pow(sig + 0.0000366, J);
  }
  return 1700 * h;
}

/**
 * Region 1 upper enthalpy bound at 100 MPa for a given entropy.
 * This closes the low-entropy infeasible gap where using the global
 * Region 1 enthalpy maximum would admit impossible h-s pairs.
 */
function h1UpperBoundAtPmax(s: number): number {
  let cachedTemperature = Number.NaN;
  let cachedState: BasicProperties | null = null;
  const stateAt = (T: number): BasicProperties => {
    if (T !== cachedTemperature || cachedState === null) {
      cachedTemperature = T;
      cachedState = region1(C.P_MAX, T);
    }
    return cachedState;
  };
  const temperature = bracketedNewton(
    (T) => stateAt(T).entropy - s,
    C.T_MIN,
    C.R2_T_MIN,
    350,
    { derivative: (T) => (stateAt(T).cp ?? Number.NaN) / T, tolerance: 1e-12 },
  );
  return stateAt(temperature).enthalpy;
}

/**
 * Region 1 / Region 3 boundary enthalpy (Eq. 1, B13).
 * h_13(s)
 */
export function h13Boundary(s: number): number {
  const TABLE: CoefficientTable = [
    [0,0,0.913965547600543],[1,-2,-0.0000430944856041991],[1,2,60.3235694765419],
    [3,-12,1.17518273082168e-18],[5,-4,0.220000904781292],[6,-3,-69.0815545851641],
  ] as const;
  const sig = s / 3.8;
  let h = 0;
  for (const [I, J, N] of TABLE) {
    h += N * Math.pow(sig - 0.884, I) * Math.pow(sig - 0.864, J);
  }
  return 1700 * h;
}

/**
 * Region 3a / Region 4 saturation boundary (Eq. 4).
 * h'_3a(s)
 */
export function h3aSat(s: number): number {
  const TABLE: CoefficientTable = [
    [0,1,0.822673364673336],[0,4,0.181977213534479],[0,10,-0.0112000260313624],
    [0,16,-7.46778287048033e-4],[2,1,-0.179046263257381],[3,36,0.0424220110836657],
    [4,3,-0.341355823438768],[4,16,-2.09881740853565],[5,20,-8.22477343323596],
    [5,36,-4.99684082076008],[6,4,0.191413958471069],[7,2,0.0581062241093136],
    [7,28,-1655.05498701029],[7,32,1588.70443421201],[10,14,-85.0623535172818],
    [10,32,-31771.4386511207],[10,36,-94589.0406632871],[32,0,-1.3927384708869e-6],
    [32,6,0.63105253224098],
  ] as const;
  const sig = s / 3.8;
  let h = 0;
  for (const [I, J, N] of TABLE) {
    h += N * Math.pow(sig - 1.09, I) * Math.pow(sig + 0.0000366, J);
  }
  return 1700 * h;
}

/**
 * Region 2ab / Region 4 saturation boundary (Eq. 5).
 * h"_2ab(s)
 */
export function h2abSat(s: number): number {
  const TABLE: CoefficientTable = [
    [1,8,-524.581170928788],[1,24,-9269472.18142218],[2,4,-237.385107491666],
    [2,32,2.10770155812776e10],[4,1,-23.9494562010986],[4,2,221.802480294197],
    [7,7,-5104725.33393438],[8,5,1249813.96109147],[8,12,2.00008436996201e9],
    [10,1,-815.158509791035],[12,0,-157.612685637523],[12,7,-1.14200422332791e10],
    [18,10,6.62364680776872e15],[20,12,-2.27622818296144e18],[24,32,-1.71048081348406e31],
    [28,8,6.60788766938091e15],[28,12,1.66320055886021e22],[28,20,-2.18003784381501e29],
    [28,22,-7.87276140295618e29],[28,24,1.51062329700346e31],[32,2,7.95732170300541e6],
    [32,7,1.31957647355347e15],[32,12,-3.2509706829914e23],[32,14,-4.18600611419248e25],
    [32,24,2.97478906557467e34],[36,10,-9.53588761745473e19],[36,12,1.66957699620939e24],
    [36,20,-1.75407764869978e32],[36,22,3.47581490626396e34],[36,28,-7.10971318427851e38],
  ] as const;
  const sig1 = s / 5.21;
  const sig2 = s / 9.2;
  let h = 0;
  for (const [I, J, N] of TABLE) {
    h += N * Math.pow(1 / sig1 - 0.513, I) * Math.pow(sig2 - 0.524, J);
  }
  return 2800 * Math.exp(h);
}

/**
 * Region 2c / Region 3b saturation boundary (Eq. 6).
 * h"_2c3b(s)
 */
export function h2c3bSat(s: number): number {
  const TABLE: CoefficientTable = [
    [0,0,1.04351280732769],[0,3,-2.27807912708513],[0,4,1.80535256723202],
    [1,0,0.420440834792042],[1,12,-1.0572124483466e5],[5,36,4.36911607493884e24],
    [6,12,-3.28032702839753e11],[7,16,-6.7868676080427e15],[8,2,7.43957464645363e3],
    [8,20,-3.56896445355761e19],[12,32,1.67590585186801e31],[16,36,-3.55028625419105e37],
    [22,2,3.96611982166538e11],[22,32,-4.14716268484468e40],[24,7,3.59080103867382e18],
    [36,20,-1.16994334851995e40],
  ] as const;
  const sig = s / 5.9;
  let h = 0;
  for (const [I, J, N] of TABLE) {
    h += N * Math.pow(sig - 1.02, I) * Math.pow(sig - 0.726, J);
  }
  return 2800 * h * h * h * h;
}

/**
 * Region 2/3 boundary temperature from h,s (Eq. 8).
 * T_B23(h,s)
 */
export function tB23hs(h: number, s: number): number {
  const TABLE: CoefficientTable = [
    [-12,10,6.2909626082981e-4],[-10,8,-8.23453502583165e-4],[-8,3,5.15446951519474e-8],
    [-4,4,-1.17565945784945],[-3,3,3.48519684726192],[-2,-6,-5.07837382408313e-12],
    [-2,2,-2.84637670005479],[-2,3,-2.36092263939673],[-2,4,6.01492324973779],
    [0,0,1.48039650824546],[1,-3,3.60075182221907e-4],[1,-2,-1.26700045009952e-2],
    [1,10,-1.22184332521413e6],[3,-2,1.49276502463272e-1],[3,-1,6.98733471798484e-1],
    [5,-5,-2.52207040114321e-2],[6,-6,1.47151930985213e-2],[6,-3,-1.08618917681849],
    [8,-8,-9.36875039816322e-4],[8,-2,8.19877897570217e1],[8,-1,-1.82041861521835e2],
    [12,-12,2.61907376402688e-6],[12,-1,-2.91626417025961e4],[14,-12,1.40660774926165e-5],
    [14,1,7.83237062349385e6],
  ] as const;
  const mu = h / 3000;
  const sig = s / 5.3;
  let T = 0;
  for (const [I, J, N] of TABLE) {
    T += N * Math.pow(mu - 0.727, I) * Math.pow(sig - 0.864, J);
  }
  return 900 * T;
}

/**
 * Backward equation P(h,s) for Region 2c (used for R2/R3 discrimination).
 */
export function backward2cPhs(h: number, s: number): number {
  const TABLE: CoefficientTable = [
    [0,0,0.112225607199012],[0,1,-3.39005953606712],[0,2,-32.0503911730094],
    [0,3,-197.5973051049],[0,4,-407.693861553446],[0,8,13294.3775222331],
    [1,0,1.70846839774007],[1,2,37.3694198142245],[1,5,3581.44365815434],
    [1,8,423014.446424664],[1,14,-751071025.760063],[2,2,52.3446127607898],
    [2,3,-228.351290812417],[2,7,-960652.417056937],[2,10,-80705929.2526074],
    [2,18,1626980172256.69],[3,0,0.772465073604171],[3,5,46392.9973837746],
    [3,8,-13731788.5134128],[3,16,1704703926305.12],[3,18,-25110462818730.8],
    [4,18,31774883083552.0],[5,1,53.8685623675312],[5,4,-55308.9094625169],
    [5,6,-1028615.22421405],[5,14,2042494187562.34],[6,8,273918446.626977],
    [6,18,-2.63963146312685e15],[10,7,-1078908541.08088],[12,7,-29649262098.0124],
    [16,10,-1.11754907323424e15],
  ] as const;
  const mu = h / 3500;
  const sig = s / 5.9;
  let P = 0;
  for (const [I, J, N] of TABLE) {
    P += N * Math.pow(mu - 0.7, I) * Math.pow(sig - 1.1, J);
  }
  return 100 * P * P * P * P;
}

const HS_R1_PMAX_623 = region1(C.P_MAX, C.R2_T_MIN);
const HS_R1_PMIN_TMIN = region1(C.P_MIN, C.T_MIN);
const HS_R1_TMIN_SMAX = region1(createFixedTemperatureStationaryPressureFinder(C.T_MIN, 'entropy')(
  HS_R1_PMIN_TMIN, region1(C.P_MAX, C.T_MIN),
)[0], C.T_MIN);
const HS_R3_PMAX_623 = solveRegion3PTBasic(C.P_MAX, C.R2_T_MIN);
const HS_R1_B23_MIN = region1(C.B23_P_MIN, C.R2_T_MIN);
const HS_R2_PMAX_TMAX = region2(C.P_MAX, C.R2_T_MAX);
const HS_R2_PMIN_TMAX = region2(C.P_MIN, C.R2_T_MAX);
const HS_R2_PMIN_TMIN = region2(C.P_MIN, C.T_MIN);
const HS_R2_B23_MIN = region2(C.B23_P_MIN, C.R2_T_MIN);
const HS_R2_B23_MAX = region2(C.P_MAX, C.B23_T_MAX);
const HS_R2_R5_PMAX = region2(C.R5_P_MAX, C.R2_T_MAX);
const HS_R5_LOWER = region5(C.R5_P_MAX, C.R5_T_MIN);
const HS_R5_PMIN_TMIN = region5(C.P_MIN, C.R5_T_MIN);
const HS_R5_UPPER = region5(C.P_MIN, C.R5_T_MAX);
const HS_R5_PMAX_TMAX = region5(C.R5_P_MAX, C.R5_T_MAX);
const HS_TRIPLE_POINT_ENDPOINTS = saturationEndpointsAtTemperature(C.Tt);
const HS_TRIPLE_LIQUID = HS_TRIPLE_POINT_ENDPOINTS.liquid;
const HS_TRIPLE_VAPOR = HS_TRIPLE_POINT_ENDPOINTS.vapor;
const HS_S13 = HS_R1_PMAX_623.entropy;
const HS_S13S = HS_R1_B23_MIN.entropy;
const HS_S_TP_MAX = HS_R2_PMAX_TMAX.entropy;
const HS_S2AB = region2(C.R2_P_CRT, C.R2_T_MAX).entropy;
const HS_R25_SEAM_RELATIVE_TOLERANCE = 1e-10;
const HS_BOUNDARY_ENTROPY_TOLERANCE = 1e-12;
// Covers the 0.0073 kJ/kg maximum boundary-equation error reported by IAPWS.
const HS_SATURATION_BOUNDARY_CONFIRMATION_BAND = 0.01;
const HS_SATURATION_BOUNDARY_ENTHALPY_TOLERANCE = 1e-8;
const HS_SATURATION_INVERSION_UPPER_T = C.Tc - C.REGION4_SUBCRITICAL_TEMPERATURE_MARGIN;

function h23UpperBoundAtEntropy(s: number): number {
  const isobar = s <= HS_S_TP_MAX;
  // Region 2 supplies the higher reachable branch in the native B23 overlap.
  const region3 = s < HS_R2_B23_MAX.entropy;
  const lower = isobar ? region3 ? C.R2_T_MIN : C.B23_T_MAX : C.P_MIN;
  const upper = isobar ? region3 ? C.B23_T_MAX : C.R2_T_MAX : C.P_MAX;
  let cachedValue = Number.NaN;
  let cachedState: BasicProperties | null = null;
  const stateAt = (value: number): BasicProperties => {
    if (value !== cachedValue || cachedState === null) {
      cachedValue = value;
      cachedState = region3
        ? solveRegion3PTBasic(C.P_MAX, value)
        : region2(isobar ? C.P_MAX : value, isobar ? value : C.R2_T_MAX);
    }
    return cachedState;
  };
  const boundary = hsBoundaryAtEntropy(s, lower, upper, isobar, stateAt);
  return boundary.enthalpy + boundary.tolerance;
}

function hsBoundaryAtEntropy(
  s: number,
  lower: number,
  upper: number,
  isobar: boolean,
  stateAt: (value: number) => BasicProperties,
): { enthalpy: number; tolerance: number } {
  const entropyTolerance = HS_BOUNDARY_ENTROPY_TOLERANCE;
  const value = bracketedNewton(
    (candidate) => stateAt(candidate).entropy - s,
    lower,
    upper,
    undefined,
    {
      tolerance: entropyTolerance,
      derivative: (candidate) => {
        const state = stateAt(candidate);
        return isobar
          ? (state.cp ?? Number.NaN) / state.temperature
          : -1000 * state.specificVolume * (state.isobaricExpansion ?? Number.NaN);
      },
    },
  );
  const state = stateAt(value);
  const slope = Math.abs(isobar
    ? state.temperature
    : state.temperature - 1 / (state.isobaricExpansion ?? Number.NaN));
  // Propagate inversion precision and floating-point residue through dh/ds.
  const tolerance = slope * Math.max(entropyTolerance, Math.abs(state.entropy - s)) + 8 * Number.EPSILON * (
    Math.max(1, Math.abs(state.enthalpy)) + slope * Math.max(1, Math.abs(s))
  );
  return { enthalpy: state.enthalpy, tolerance };
}

function inRegion3LowerHSEnvelope(h: number, s: number): boolean {
  if (s < HS_R3_PMAX_623.entropy || s >= HS_S13) return false;

  // Independent Region 1/3 fits leave a narrow R3 entropy slice below HS_S13.
  const upperRho = 1 / HS_R3_PMAX_623.specificVolume;
  const lowerStateAt = (rho: number): BasicProperties => rho === upperRho
    ? HS_R3_PMAX_623
    : region3ByRhoT(rho, C.R2_T_MIN);
  const rho = bracketedNewton(
    (candidate) => lowerStateAt(candidate).entropy - s,
    1 / HS_R1_PMAX_623.specificVolume,
    upperRho,
    undefined,
    {
      tolerance: 1e-12,
      derivative: (candidate) => helmholtzPropertyDerivatives(
        lowerStateAt(candidate), candidate,
      ).dsDrho,
    },
  );
  const hLower = lowerStateAt(rho).enthalpy;
  const temperature = bracketedNewton(
    (T) => solveRegion3PTBasic(C.P_MAX, T).entropy - s,
    C.R2_T_MIN,
    C.B23_T_MAX,
    C.R2_T_MIN,
    {
      tolerance: 1e-12,
      derivative: (T) => (solveRegion3PTBasic(C.P_MAX, T).cp ?? Number.NaN) / T,
    },
  );
  const hUpper = solveRegion3PTBasic(C.P_MAX, temperature).enthalpy;
  return h > hLower && (h <= hUpper || isClose(h, hUpper));
}

function hSatLow(s: number): number {
  return HS_TRIPLE_LIQUID.enthalpy +
    (s - HS_TRIPLE_LIQUID.entropy) /
    (HS_TRIPLE_VAPOR.entropy - HS_TRIPLE_LIQUID.entropy) *
    (HS_TRIPLE_VAPOR.enthalpy - HS_TRIPLE_LIQUID.enthalpy);
}

type SaturationPhase = 'liquid' | 'vapor';

function phaseState(endpoints: SaturationEndpoints, phase: SaturationPhase): BasicProperties {
  return phase === 'liquid' ? endpoints.liquid : endpoints.vapor;
}

/**
 * Invert one saturation endpoint's monotone entropy curve without scanning.
 * The Clapeyron relation supplies dp_sat/dT, and the Gibbs Maxwell relation
 * supplies the endpoint derivative along that curve.
 */
function saturationBoundaryEnthalpyAtEntropy(
  s: number,
  phase: SaturationPhase,
): { enthalpy: number; exact: boolean } | null {
  let lower = C.Tt;
  let upper = HS_SATURATION_INVERSION_UPPER_T;
  const tripleEntropy = phaseState(HS_TRIPLE_POINT_ENDPOINTS, phase).entropy;
  const criticalEntropy = C.R3_S_CRT;
  const fraction = phase === 'liquid'
    ? (s - tripleEntropy) / (criticalEntropy - tripleEntropy)
    : (tripleEntropy - s) / (tripleEntropy - criticalEntropy);
  const boundedFraction = Math.max(0, Math.min(1, fraction));
  let temperature = lower + boundedFraction * (upper - lower);

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const endpoints = saturationEndpointsAtTemperature(temperature);
    const state = phaseState(endpoints, phase);
    const residual = state.entropy - s;
    if (Math.abs(residual) <= 1e-12 * Math.max(1, Math.abs(s))) {
      return { enthalpy: state.enthalpy, exact: true };
    }

    const residualIncreasesWithTemperature = phase === 'liquid';
    if ((residual < 0) === residualIncreasesWithTemperature) lower = temperature;
    else upper = temperature;
    if (upper - lower <= 10 * C.REGION4_TEMPERATURE_TOLERANCE) {
      // The 623.15 K formula seam can close the bracket without an entropy root.
      return { enthalpy: state.enthalpy, exact: false };
    }

    const entropySpan = endpoints.vapor.entropy - endpoints.liquid.entropy;
    const volumeSpan = endpoints.vapor.specificVolume - endpoints.liquid.specificVolume;
    const dpSatDT = entropySpan / (1000 * volumeSpan);
    const cp = state.cp;
    const alpha = state.isobaricExpansion;
    const derivative = cp === null || alpha === null
      ? Number.NaN
      : cp / temperature - 1000 * state.specificVolume * alpha * dpSatDT;
    const candidate = temperature - residual / derivative;
    temperature = Number.isFinite(candidate) && candidate > lower && candidate < upper
      ? candidate
      : (lower + upper) / 2;
  }

  return null;
}

/** Replace the supplementary polynomial only in its narrow error band. */
function refinedSaturationBoundaryEnthalpy(
  h: number,
  s: number,
  approximateBoundaryH: number,
): { enthalpy: number; exact: boolean } {
  if (Math.abs(h - approximateBoundaryH) > HS_SATURATION_BOUNDARY_CONFIRMATION_BAND) {
    return { enthalpy: approximateBoundaryH, exact: false };
  }

  const phase: SaturationPhase = s <= C.R3_S_CRT ? 'liquid' : 'vapor';
  let boundary: { enthalpy: number; exact: boolean } | null;
  try {
    boundary = saturationBoundaryEnthalpyAtEntropy(s, phase);
  } catch (error) {
    if (error instanceof IF97Error) return { enthalpy: approximateBoundaryH, exact: false };
    throw error;
  }
  return boundary === null
    ? { enthalpy: approximateBoundaryH, exact: false }
    : { enthalpy: boundary.enthalpy + HS_SATURATION_BOUNDARY_ENTHALPY_TOLERANCE, exact: boundary.exact };
}

function confirmedRegion4BoundaryState(
  h: number,
  s: number,
  approximateBoundaryH: number,
): boolean | null {
  if (Math.abs(h - approximateBoundaryH) > HS_SATURATION_BOUNDARY_CONFIRMATION_BAND) {
    return null;
  }
  try {
    return tryRegion4HSState(h, s) !== null;
  } catch (error) {
    if (error instanceof IF97Error) return false;
    throw error;
  }
}

function r2R5BoundaryEnthalpy(
  s: number,
  lowEntropy: number,
  highEntropy: number,
  stateAtPressure: (p: number) => BasicProperties,
): number | null {
  if (s < lowEntropy || s > highEntropy) return null;

  let lower = C.P_MIN;
  let upper = C.R5_P_MAX;
  const fraction = (highEntropy - s) / (highEntropy - lowEntropy);
  let p = Math.exp(Math.log(lower) + fraction * (Math.log(upper) - Math.log(lower)));

  for (let iteration = 0; iteration < 12; iteration += 1) {
    const state = stateAtPressure(p);
    const residual = state.entropy - s;
    if (Math.abs(residual) <= 1e-12 * Math.max(1, Math.abs(s))) {
      return state.enthalpy;
    }

    if (residual > 0) lower = p;
    else upper = p;

    const alpha = state.isobaricExpansion;
    const derivative = alpha === null ? Number.NaN : -1000 * state.specificVolume * alpha;
    const candidate = p - residual / derivative;
    p = Number.isFinite(candidate) && candidate > lower && candidate < upper
      ? candidate
      : (lower + upper) / 2;
  }

  return stateAtPressure(p).enthalpy;
}

function classifyRegion5HS(h: number, s: number): Region.Region5 | -1 | null {
  if (!(HS_R5_LOWER.entropy < s && s <= HS_R5_UPPER.entropy)) {
    return null;
  }

  const region2BoundaryH = r2R5BoundaryEnthalpy(
    s,
    HS_R2_R5_PMAX.entropy,
    HS_R2_PMIN_TMAX.entropy,
    (p) => region2(p, C.R2_T_MAX),
  );
  const region5BoundaryH = r2R5BoundaryEnthalpy(
    s,
    HS_R5_LOWER.entropy,
    HS_R5_PMIN_TMIN.entropy,
    (p) => region5(p, C.R5_T_MIN),
  );

  const checkedRegion5 = (): Region.Region5 | null => {
    const isobar = s <= HS_R5_PMAX_TMAX.entropy;
    const upper = hsBoundaryAtEntropy(
      s,
      isobar ? C.R5_T_MIN : C.P_MIN,
      isobar ? C.R5_T_MAX : C.R5_P_MAX,
      isobar,
      (value) => region5(isobar ? C.R5_P_MAX : value, isobar ? value : C.R5_T_MAX),
    );
    const maximum = upper.enthalpy + upper.tolerance;
    if (h > maximum && region2BoundaryH !== null &&
        h <= region2BoundaryH + HS_R25_SEAM_RELATIVE_TOLERANCE * Math.max(1, Math.abs(region2BoundaryH))) {
      return null;
    }
    const lower = region5BoundaryH === null
      ? hsBoundaryAtEntropy(s, C.R5_T_MIN, C.R5_T_MAX, true, (T) => region5(C.P_MIN, T))
      : null;
    const minimum = lower === null ? region5BoundaryH! : lower.enthalpy - lower.tolerance;
    if (h > maximum || (lower !== null && h < minimum)) {
      throw new OutOfRangeError(`Enthalpy in Region 5 at s=${s}`, h, minimum, maximum);
    }
    return Region.Region5;
  };

  if (region2BoundaryH === null) {
    return region5BoundaryH === null || h > region5BoundaryH
      ? checkedRegion5()
      : null;
  }
  if (region5BoundaryH === null) {
    return h > region2BoundaryH ? checkedRegion5() : null;
  }

  const tolerance = HS_R25_SEAM_RELATIVE_TOLERANCE * Math.max(
    1,
    Math.abs(h),
    Math.abs(region2BoundaryH),
    Math.abs(region5BoundaryH),
  );
  if (region5BoundaryH > region2BoundaryH + tolerance) {
    if (h > region5BoundaryH) return checkedRegion5();
    if (h > region2BoundaryH + tolerance) return -1;
    return null;
  }

  if (region2BoundaryH > region5BoundaryH + tolerance) {
    if (h > region2BoundaryH + tolerance) return checkedRegion5();
    if (h <= region5BoundaryH + tolerance) return null;

    // The independently fitted Region 2 and 5 equations overlap slightly at
    // 1073.15 K. H-S is non-unique there; choose the branch nearest its seam.
    return h <= (region2BoundaryH + region5BoundaryH) / 2
      ? checkedRegion5()
      : null;
  }

  return h > region2BoundaryH + tolerance ? checkedRegion5() : null;
}

/** Share HS classification, throwing range errors only for proven envelope violations. */
export function classifyRegionHS(h: number, s: number): Region | -1 {
  const seam = findHSSeam(h, s);
  if (seam !== null) {
    try {
      return solveHSSeam(h, s, seam).region;
    } catch (error) {
      if (!(error instanceof IF97Error)) throw error;
      return -1;
    }
  }
  // Move both inverse roots inside the forbidden gap before accounting for near-tangent roundoff.
  const gapEntropy = s + 4 * HS_BOUNDARY_ENTROPY_TOLERANCE;
  if (s >= HS_R1_PMIN_TMIN.entropy && gapEntropy < HS_R1_TMIN_SMAX.entropy) {
    const left = hsBoundaryAtEntropy(
      gapEntropy, C.P_MIN, HS_R1_TMIN_SMAX.pressure, false, (p) => region1(p, C.T_MIN),
    );
    const leftMaximum = left.enthalpy + left.tolerance;
    if (h > leftMaximum) {
      const right = hsBoundaryAtEntropy(
        gapEntropy, HS_R1_TMIN_SMAX.pressure, C.P_MAX, false, (p) => region1(p, C.T_MIN),
      );
      const rightMinimum = right.enthalpy - right.tolerance;
      if (h < rightMinimum) {
        const error = h - leftMaximum <= rightMinimum - h
          ? new OutOfRangeError(`Enthalpy on the low-pressure branch at s=${s}`, h, C.H_MIN, leftMaximum)
          : new OutOfRangeError(`Enthalpy on the high-pressure branch at s=${s}`, h, rightMinimum, h1UpperBoundAtPmax(s));
        error.message += `; forbidden enthalpy interval (${leftMaximum}, ${rightMinimum}) at T=${C.T_MIN} K`;
        throw error;
      }
    }
  }
  if (withinClosedLowerBound(s, C.S_MIN, 'entropy') && s < HS_TRIPLE_LIQUID.entropy) {
    const hmax = h1UpperBoundAtPmax(s);
    if (s < HS_R1_PMIN_TMIN.entropy) {
      const lower = hsBoundaryAtEntropy(s, C.P_MIN, C.P_MAX, false, (p) => region1(p, C.T_MIN));
      if (h < lower.enthalpy - lower.tolerance) {
        throw new OutOfRangeError(`Enthalpy at s=${s}`, h, lower.enthalpy - lower.tolerance, hmax);
      }
    }
    if (h > hmax && !isClose(h, hmax)) {
      throw new OutOfRangeError(`Enthalpy upper envelope at s=${s}`, h, C.H_MIN, hmax);
    }
    return withinClosedLowerBound(h, C.H_MIN, 'enthalpy') && (h <= hmax || isClose(h, hmax)) ? Region.Region1 : -1;
  }

  if (s >= HS_TRIPLE_LIQUID.entropy && s <= HS_TRIPLE_VAPOR.entropy &&
      isClose(h, hSatLow(s)) && confirmedRegion4BoundaryState(h, s, hSatLow(s)) === true) {
    return Region.Region4;
  }

  if (s >= HS_TRIPLE_LIQUID.entropy && s <= HS_TRIPLE_VAPOR.entropy) {
    const lower = hSatLow(s);
    const hmin = lower - C.Tt * 1e-12 - 8 * Number.EPSILON * Math.max(1, Math.abs(lower));
    if (h < hmin) {
      throw new OutOfRangeError(`Enthalpy lower envelope at s=${s}`, h, hmin, C.H_MAX);
    }
  }

  const highTemperatureRegion = classifyRegion5HS(h, s);
  if (highTemperatureRegion !== null) return highTemperatureRegion;

  if (s >= HS_R2_PMIN_TMIN.entropy && s <= HS_R2_PMIN_TMAX.entropy) {
    const lower = hsBoundaryAtEntropy(s, C.T_MIN, C.R2_T_MAX, true, (T) => region2(C.P_MIN, T));
    if (h < lower.enthalpy - lower.tolerance) {
      throw new OutOfRangeError(`Enthalpy lower envelope at s=${s}`, h, lower.enthalpy - lower.tolerance, C.H_MAX);
    }
  }

  if (s > HS_S13 && s <= HS_R2_PMIN_TMAX.entropy) {
    let hmax = h23UpperBoundAtEntropy(s);
    if (s >= Math.max(HS_R2_R5_PMAX.entropy, HS_R5_LOWER.entropy) &&
        s <= Math.min(HS_R2_PMIN_TMAX.entropy, HS_R5_PMIN_TMIN.entropy) &&
        HS_R5_LOWER.enthalpy < h && h <= HS_R5_UPPER.enthalpy) {
      // Preserve the existing Region 2/5 seam comparison window and branch choice.
      hmax += HS_R25_SEAM_RELATIVE_TOLERANCE * Math.max(1, Math.abs(hmax));
    }
    if (h > hmax) {
      throw new OutOfRangeError(`Enthalpy upper envelope at s=${s}`, h, C.H_MIN, hmax);
    }
  }

  // Zone 1: smin <= s <= s13 (Region 1 / Region 4)
  if (s >= HS_TRIPLE_LIQUID.entropy && s <= HS_S13) {
    const hmin = hSatLow(s);
    const approximateHs = h1Sat(s);
    const boundary = refinedSaturationBoundaryEnthalpy(h, s, approximateHs);
    const hs = boundary.enthalpy;
    const hmax = h1UpperBoundAtPmax(s);
    if (h > hmax && !isClose(h, hmax) && !inRegion3LowerHSEnvelope(h, s)) {
      throw new OutOfRangeError(`Enthalpy upper envelope at s=${s}`, h, C.H_MIN, hmax);
    }
    const confirmedRegion4 = boundary.exact && h > hs
      ? false
      : confirmedRegion4BoundaryState(h, s, approximateHs);

    if (confirmedRegion4 === true) return Region.Region4;
    if (confirmedRegion4 === false && h >= hmin && (h <= hmax || isClose(h, hmax))) return Region.Region1;

    if (h >= hmin && h <= hs) return Region.Region4;
    if (h >= hs && (h <= hmax || isClose(h, hmax))) return Region.Region1;
    if (inRegion3LowerHSEnvelope(h, s)) return Region.Region3;
  }

  // Zone 2: s13 < s <= s13s (Region 1 / Region 3 / Region 4)
  else if (s > HS_S13 && s <= HS_S13S) {
    const hmin = hSatLow(s);
    const approximateHs = h1Sat(s);
    const boundary = refinedSaturationBoundaryEnthalpy(h, s, approximateHs);
    const hs = boundary.enthalpy;
    const h13 = h13Boundary(s);
    const confirmedRegion4 = boundary.exact && h > hs
      ? false
      : confirmedRegion4BoundaryState(h, s, approximateHs);

    if (confirmedRegion4 === true) return Region.Region4;
    if (confirmedRegion4 === false && h >= hmin) {
      return h < h13 ? Region.Region1 : Region.Region3;
    }

    if (h >= hmin && h <= hs) return Region.Region4;
    if (h >= hs && h < h13) return Region.Region1;
    if (h >= h13) return Region.Region3;
  }

  // Zone 3: s13s < s <= R3_CRT_S (Region 3 / Region 4)
  else if (s > HS_S13S && s <= C.R3_S_CRT) {
    const hmin = hSatLow(s);
    const hs = h3aSat(s);
    const confirmedRegion4 = confirmedRegion4BoundaryState(h, s, hs);

    if (confirmedRegion4 === true) return Region.Region4;
    if (confirmedRegion4 === false && h >= hmin) return Region.Region3;

    if (h >= hmin && h <= hs) return Region.Region4;
    if (h >= hs) return Region.Region3;
  }

  // Zone 4: R3_CRT_S < s < B23_S_CURVE_MIN (Region 3 / Region 4)
  else if (s > C.R3_S_CRT && s < C.B23_S_CURVE_MIN) {
    const hmin = hSatLow(s);
    const hs = h2c3bSat(s);
    const confirmedRegion4 = confirmedRegion4BoundaryState(h, s, hs);

    if (confirmedRegion4 === true) return Region.Region4;
    if (confirmedRegion4 === false && h >= hmin) return Region.Region3;

    if (h >= hmin && h <= hs) return Region.Region4;
    if (h >= hs) return Region.Region3;
  }

  // Zone 5: B23_S_CURVE_MIN <= s < B23_S_CURVE_MAX (Region 2 / Region 3 / Region 4)
  else if (s >= C.B23_S_CURVE_MIN && s < C.B23_S_CURVE_MAX) {
    const hmin = hSatLow(s);
    const approximateHs = h2c3bSat(s);
    const hs = refinedSaturationBoundaryEnthalpy(h, s, approximateHs).enthalpy;
    const h23max = HS_R2_B23_MAX.enthalpy;
    const h23min = HS_R2_B23_MIN.enthalpy;

    const confirmedRegion4 = confirmedRegion4BoundaryState(h, s, approximateHs);
    if (confirmedRegion4 === true) return Region.Region4;
    if (confirmedRegion4 === false && h >= hmin) {
      for (const region of [Region.Region2, Region.Region3]) {
        try {
          return solveHSInRegion(h, s, region).region;
        } catch (error) {
          if (!(error instanceof IF97Error)) throw error;
        }
      }
    }
    if (hmin <= h && h <= hs) return Region.Region4;
    if (hs <= h && h < h23min) return Region.Region3;
    if (h23min <= h && h < h23max) {
      // Discriminate R2 vs R3 using B23 boundary
      const Tb23 = Math.max(C.R2_T_MIN, Math.min(tB23hs(h, s), C.B23_T_MAX));
      const Pb23 = boundary23_T_to_P(Tb23);
      const Phs = backward2cPhs(h, s);
      if (Phs <= Pb23) return Region.Region2;
      return Region.Region3;
    }
    if (h23max <= h) return Region.Region2;
  }

  // Zone 6: B23_S_CURVE_MAX <= s < R2_S_CRT (Region 2 / Region 4)
  else if (s >= C.B23_S_CURVE_MAX && s < C.R2_S_CRT) {
    const hmin = hSatLow(s);
    const hs = refinedSaturationBoundaryEnthalpy(h, s, h2c3bSat(s)).enthalpy;

    if (hmin <= h && h <= hs) return Region.Region4;
    if (hs <= h) return Region.Region2;
  }

  // Zone 7: R2_S_CRT <= s < sTPmax (Region 2 / Region 4, use h2abSat)
  else if (s >= C.R2_S_CRT && s < HS_S_TP_MAX) {
    const hmin = hSatLow(s);
    const hs = refinedSaturationBoundaryEnthalpy(h, s, h2abSat(s)).enthalpy;

    if (hmin <= h && h <= hs) return Region.Region4;
    if (hs <= h) return Region.Region2;
  }

  // Zone 8: sTPmax <= s < s2ab (Region 2 / Region 4)
  else if (s >= HS_S_TP_MAX && s < HS_S2AB) {
    const hmin = hSatLow(s);
    const hs = refinedSaturationBoundaryEnthalpy(h, s, h2abSat(s)).enthalpy;

    if (hmin <= h && h <= hs) return Region.Region4;
    if (hs <= h) return Region.Region2;
  }

  // Zone 9: s2ab <= s < s4v (Region 2 / Region 4)
  else if (s >= HS_S2AB && s < HS_TRIPLE_VAPOR.entropy) {
    const hmin = hSatLow(s);
    const hs = refinedSaturationBoundaryEnthalpy(h, s, h2abSat(s)).enthalpy;

    if (hmin <= h && h <= hs) return Region.Region4;
    if (hs <= h) return Region.Region2;
  }

  // Zone 10: s4v <= s <= smax (Region 2 only, superheated low-P)
  else if (s >= HS_TRIPLE_VAPOR.entropy && s <= HS_R2_PMIN_TMAX.entropy) {
    const hmin = HS_R2_PMIN_TMIN.enthalpy;

    if (hmin <= h) return Region.Region2;
    if (h < hmin) {
      throw new OutOfRangeError(`Enthalpy lower envelope at s=${s}`, h, hmin, C.H_MAX);
    }
  }

  return -1;
}

/**
 * Detect the IAPWS-IF97 region for given H and S.
 * Implements the zone-based detection from the IAPWS supplementary release.
 *
 * @param h - Specific enthalpy [kJ/kg]
 * @param s - Specific entropy [kJ/(kg·K)]
 * @returns Region number (1–5) or -1 if out of range
 */
export function detectRegionHS(h: number, s: number): Region | -1 {
  if (!Number.isFinite(h) || !Number.isFinite(s)) return -1;
  try {
    return classifyRegionHS(h, s);
  } catch (error) {
    if (error instanceof OutOfRangeError) return -1;
    throw error;
  }
}
