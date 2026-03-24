/**
 * IAPWS-IF97 Backward Equations: H-S -> P, T
 *
 * Given specific enthalpy and entropy, compute pressure and temperature.
 * Uses backward P(h,s) equations for initial guess + Nelder-Mead refinement.
 *
 * Reference: IAPWS-IF97 Supplementary Release on Backward Equations p(h,s)
 */

import type { BasicProperties, CoefficientTable } from '../types.js';
import { Region, IF97Error, OutOfRangeError } from '../types.js';
import * as C from '../constants.js';
import { region1 } from '../regions/region1.js';
import { region2 } from '../regions/region2.js';
import { region3ByRhoT } from '../regions/region3.js';
import { region5 } from '../regions/region5.js';
import { detectRegionHS } from '../core/region-detector.js';
import { newtonRaphson } from '../solvers/newton-raphson.js';
import { nelderMead } from '../solvers/nelder-mead.js';
import { solvePH } from './ph.js';
import { validateBackwardState } from './solution-validation.js';
import {
  mixSaturationState,
  qualityFromSaturationProperty,
  saturationEndpointsAtPressure,
  saturationEndpointsAtTemperature,
} from '../saturation/common.js';

// ─── Backward Polynomial Evaluator ─────────────────────────────────────────

function evalPoly(table: CoefficientTable, aShift: number, bShift: number, a: number, b: number): number {
  let sum = 0;
  for (const [I, J, N] of table) {
    sum += N * Math.pow(a - aShift, I) * Math.pow(b - bShift, J);
  }
  return sum;
}

// ─── Region 1 P(h,s) — 19 coefficients ─────────────────────────────────────

const R1_PHS: CoefficientTable = [
  [0,0,-0.691997014660582],[0,1,-18.361254878756],[0,2,-9.28332409297335],
  [0,4,65.9639569909906],[0,5,-16.2060388912024],[0,6,450.620017338667],
  [0,8,854.68067822417],[0,14,6075.23214001161],[1,0,32.6487682621856],
  [1,1,-26.9408844582931],[1,4,-319.9478483343],[1,6,-928.35430704332],
  [2,0,30.3634537455249],[2,1,-65.0540422444146],[2,10,-4309.1316516130],
  [3,4,-747.512324096068],[4,1,730.000345529245],[4,4,1142.84032569021],
  [5,0,-436.407041874559],
] as const;

function r1Phs(h: number, s: number): number {
  const mu = h / 3400;
  const sig = s / 7.6;
  return 100 * evalPoly(R1_PHS, -0.05, -0.05, mu, sig);
}

// ─── Region 2 P(h,s) — Subregions 2a, 2b, 2c ──────────────────────────────

/** Boundary between Region 2a and Region 2b in h-s plane. */
function b2abBoundary(s: number): number {
  return -3498.98083432139 + 2575.60716905876 * s - 421.073558227969 * s * s + 27.6349063799944 * s * s * s;
}

const R2A_PHS: CoefficientTable = [
  [0,1,-0.0182575361923032],[0,3,-0.125229548799536],[0,6,0.592290437320145],
  [0,16,6.04769706185122],[0,20,238.624965444474],[0,22,-298.639090222922],
  [1,0,0.051225081304075],[1,1,-0.437266515606486],[1,2,0.413336902999504],
  [1,3,-5.16468254574773],[1,5,-5.57014838445711],[1,6,12.8555037824478],
  [1,10,11.414410895329],[1,16,-119.504225652714],[1,20,-2847.7798596156],
  [1,22,4317.57846408006],[2,3,1.1289404080265],[2,16,1974.09186206319],
  [2,20,1516.12444706087],[3,0,0.0141324451421235],[3,2,0.585501282219601],
  [3,3,-2.97258075863012],[3,6,5.94567314847319],[3,16,-6236.56565798905],
  [4,16,9659.86235133332],[5,3,6.81500934948134],[5,16,-6332.07286824489],
  [6,3,-5.5891922446576],[7,1,0.0400645798472063],
] as const;

function r2aPhs(h: number, s: number): number {
  const mu = h / 4200;
  const sig = s / 12;
  const P = evalPoly(R2A_PHS, 0.5, 1.2, mu, sig);
  return 4 * P * P * P * P;
}

const R2B_PHS: CoefficientTable = [
  [0,0,0.0801496989929495],[0,1,-0.543862807146111],[0,2,0.337455597421283],
  [0,4,8.9055545115745],[0,8,313.840736431485],[1,0,0.797367065977789],
  [1,1,-1.2161697355624],[1,2,8.72803386937477],[1,3,-16.9769781757602],
  [1,5,-186.552827328416],[1,12,95115.9274344237],[2,1,-18.9168510120494],
  [2,6,-4334.0703719484],[2,18,543212633.012715],[3,0,0.144793408386013],
  [3,1,128.024559637516],[3,7,-67230.9534071268],[3,12,33697238.0095287],
  [4,1,-586.63419676272],[4,16,-22140322476.9889],[5,1,1716.06668708389],
  [5,12,-570817595.806302],[6,1,-3121.09693178482],[6,8,-2078413.8463301],
  [6,18,3056059461577.86],[7,1,3221.57004314333],[7,16,326810259797.295],
  [8,1,-1441.04158934487],[8,3,410.694867802691],[8,14,109077066873.024],
  [8,18,-24796465425889.3],[12,10,1888019068.65134],[14,16,-123651009018773],
] as const;

function r2bPhs(h: number, s: number): number {
  const mu = h / 4100;
  const sig = s / 7.9;
  const P = evalPoly(R2B_PHS, 0.6, 1.01, mu, sig);
  return 100 * P * P * P * P;
}

const R2C_PHS: CoefficientTable = [
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

function r2cPhs(h: number, s: number): number {
  const mu = h / 3500;
  const sig = s / 5.9;
  const P = evalPoly(R2C_PHS, 0.7, 1.1, mu, sig);
  return 100 * P * P * P * P;
}

function r2Phs(h: number, s: number): number {
  const hBound = b2abBoundary(s);
  if (h <= hBound) return r2aPhs(h, s);
  if (s >= 5.85) return r2bPhs(h, s);
  return r2cPhs(h, s);
}

// ─── Region 3 P(h,s) — Subregions 3a, 3b ───────────────────────────────────

const R3A_PHS: CoefficientTable = [
  [0,0,7.70889828326934],[0,1,-26.0835009128688],[0,5,267.416218930389],
  [1,0,17.2221089496844],[1,3,-293.54233214597],[1,4,614.135601882478],
  [1,8,-61056.2757725674],[1,14,-65127225.1118219],[2,6,73591.9313521937],
  [2,16,-11664650591.4191],[3,0,35.5267086434461],[3,2,-596.144543825955],
  [3,3,-475.842430145708],[4,0,69.6781965359503],[4,1,335.674250377312],
  [4,4,25052.6809130882],[4,5,146997.380630766],[5,28,5.38069315091534e19],
  [6,28,1.43619827291346e21],[7,24,3.64985866165990e19],[8,1,-2547.41561156775],
  [10,32,2.40120197096563e27],[10,36,-3.93847464679496e29],[14,22,1.47073407024852e24],
  [18,28,-4.26391250432059e31],[20,36,1.94509340621077e38],[22,16,6.66212132114896e23],
  [22,28,7.06777016552858e33],[24,36,1.75563621975576e41],[28,16,1.08408607429124e28],
  [28,36,7.30872705175151e43],[32,10,1.5914584739887e24],[32,28,3.77121605943324e40],
] as const;

function r3aPhs(h: number, s: number): number {
  const mu = h / 2300;
  const sig = s / 4.4;
  return 99 * evalPoly(R3A_PHS, 1.01, 0.75, mu, sig);
}

const R3B_PHS: CoefficientTable = [
  [-12,2,1.25244360717979e-13],[-12,10,-0.0126599322553713],[-12,12,5.06878030140626],
  [-12,14,31.7847171154202],[-12,20,-391041.161399932],[-10,2,-9.75733406392044e-11],
  [-10,10,-18.6312419488279],[-10,14,510.973543414101],[-10,18,373847.005822362],
  [-8,2,2.99804024666572e-8],[-8,8,20.0544393820342],[-6,2,-4.98030487662829e-6],
  [-6,6,-10.230180636003],[-6,7,55.2819126990325],[-6,8,-206.211367510878],
  [-5,10,-7940.12232324823],[-4,4,7.82248472028153],[-4,5,-58.6544326902468],
  [-4,8,3550.73647696481],[-3,1,-1.15303107290162e-4],[-3,3,-1.75092403171802],
  [-3,5,257.98168774816],[-3,6,-727.048374179467],[-2,0,1.21644822609198e-4],
  [-2,1,0.0393137871762692],[-1,0,7.04181005909296e-3],[0,3,-82.910820069811],
  [2,0,-0.26517881813125],[2,1,13.7531682453991],[5,0,-52.3940907530460],
  [6,1,2405.56298941048],[8,1,-22736.1631268929],[10,1,89074.6343932567],
  [14,3,-23923456.5822486],[14,7,5687958081.29714],
] as const;

function r3bPhs(h: number, s: number): number {
  const mu = h / 2800;
  const sig = s / 5.3;
  return 16.6 / evalPoly(R3B_PHS, 0.681, 0.792, mu, sig);
}

function r3Phs(h: number, s: number): number {
  if (s <= C.R3_S_CRT) return r3aPhs(h, s);
  return r3bPhs(h, s);
}

// ─── Region 4 Tsat(h,s) — Eq. 9 ────────────────────────────────────────────

const R4_THS: CoefficientTable = [
  [0,0,0.179882673606601],[0,3,-0.267507455199603],[0,12,1.1627672261266],
  [1,0,0.147545428713616],[1,1,-0.512871635973248],[1,2,0.421333567697984],
  [1,5,0.56374952218987],[2,0,0.429274443819153],[2,5,-3.3570455214214],
  [2,8,10.8890916499278],[3,0,-0.248483390456012],[3,2,0.30415322190639],
  [3,3,-0.494819763939905],[3,4,1.07551674933261],[4,0,0.0733888415457688],
  [4,1,0.0140170545411085],[5,1,-0.106110975998808],[5,2,0.0168324361811875],
  [5,4,1.25028363714877],[5,16,1013.16840309509],[6,6,-1.51791558000712],
  [6,8,52.4277865990866],[6,22,23049.5545563912],[8,1,0.0249459806365456],
  [10,20,2107964.67412137],[10,36,3.66836848613065e8],[12,24,-1.44814105365163e8],
  [14,1,-1.7927637300359e-3],[14,28,4.89955602100459e9],[16,12,471.262212070518],
  [16,32,-8.29294390198652e10],[18,14,-1715.45662263191],[18,22,3557776.82973575],
  [18,36,5.86062760258436e11],[20,24,-1.29887635078195e7],[28,36,3.17247449371057e10],
] as const;

function r4Ths(h: number, s: number): number {
  const mu = h / 2800;
  const sig = s / 9.2;
  return 550 * evalPoly(R4_THS, 0.119, 1.07, mu, sig);
}

// ─── Main HS Solver ─────────────────────────────────────────────────────────

/**
 * Solve for thermodynamic state given H and S.
 * @param h - Specific enthalpy [kJ/kg]
 * @param s - Specific entropy [kJ/(kg·K)]
 */
export function solveHS(h: number, s: number): BasicProperties {
  if (h < C.H_MIN || h > C.H_MAX) {
    throw new OutOfRangeError('Enthalpy', h, C.H_MIN, C.H_MAX);
  }
  if (s < C.S_MIN || s > C.S_MAX) {
    throw new OutOfRangeError('Entropy', s, C.S_MIN, C.S_MAX);
  }

  const region = detectRegionHS(h, s);

  switch (region) {
    case Region.Region1: {
      const P0 = r1Phs(h, s);
      const sol = nelderMead(
        (pair) => Math.abs(region1(pair[0], pair[1]).enthalpy - h) +
                  Math.abs(region1(pair[0], pair[1]).entropy - s),
        [P0, 400],
      );
      return validateBackwardState(
        region1(sol.x[0], sol.x[1]),
        [
          { label: 'enthalpy', expected: h },
          { label: 'entropy', expected: s },
        ],
        { solverName: 'solveHS', expectedRegion: Region.Region1 },
      );
    }
    case Region.Region2: {
      const P0 = r2Phs(h, s);
      const T0 = newtonRaphson((T) => region2(P0, T).enthalpy - h, 500);
      const sol = nelderMead(
        (pair) => Math.abs(region2(pair[0], pair[1]).enthalpy - h) +
                  Math.abs(region2(pair[0], pair[1]).entropy - s),
        [P0, T0],
      );
      return validateBackwardState(
        region2(sol.x[0], sol.x[1]),
        [
          { label: 'enthalpy', expected: h },
          { label: 'entropy', expected: s },
        ],
        { solverName: 'solveHS', expectedRegion: Region.Region2 },
      );
    }
    case Region.Region3: {
      const P0 = r3Phs(h, s);
      const init = solvePH(P0, h);
      const rho0 = 1 / init.specificVolume;
      const T0 = init.temperature;
      const sol = nelderMead(
        (pair) => Math.abs(region3ByRhoT(pair[0], pair[1]).enthalpy - h) +
                  Math.abs(region3ByRhoT(pair[0], pair[1]).entropy - s),
        [rho0, T0],
      );
      return validateBackwardState(
        region3ByRhoT(sol.x[0], sol.x[1]),
        [
          { label: 'enthalpy', expected: h },
          { label: 'entropy', expected: s },
        ],
        { solverName: 'solveHS', expectedRegion: Region.Region3 },
      );
    }
    case Region.Region4: {
      // Critical point check
      if (Math.abs(s - C.R3_S_CRT) < 1e-6 && Math.abs(h - C.R3_H_CRT) < 1e-6) {
        return region3ByRhoT(C.RHOc, C.Tc);
      }

      let T = r4Ths(h, s);
      T = Math.max(273.15, Math.min(T, C.Tc - 0.001));
      const temperature = newtonRaphson(
        (temperatureGuess) => {
          const endpoints = saturationEndpointsAtTemperature(
            Math.max(273.15, Math.min(temperatureGuess, C.Tc - 0.001)),
          );
          const xh = qualityFromSaturationProperty(
            endpoints.liquid.enthalpy,
            endpoints.vapor.enthalpy,
            h,
          );
          const xs = qualityFromSaturationProperty(
            endpoints.liquid.entropy,
            endpoints.vapor.entropy,
            s,
          );
          return xh - xs;
        },
        T,
      );

      const finalTemperature = Math.max(273.15, Math.min(temperature, C.Tc - 0.001));
      const endpoints = saturationEndpointsAtTemperature(finalTemperature);
      const quality = (
        qualityFromSaturationProperty(
          endpoints.liquid.enthalpy,
          endpoints.vapor.enthalpy,
          h,
        ) +
        qualityFromSaturationProperty(
          endpoints.liquid.entropy,
          endpoints.vapor.entropy,
          s,
        )
      ) / 2;

      return validateBackwardState(
        mixSaturationState(
          saturationEndpointsAtPressure(endpoints.pressure),
          quality,
        ),
        [
          { label: 'enthalpy', expected: h },
          { label: 'entropy', expected: s },
        ],
        { solverName: 'solveHS', expectedRegion: Region.Region4 },
      );
    }
    case Region.Region5: {
      const sol = nelderMead(
        (pair) => Math.abs(region5(pair[0], pair[1]).enthalpy - h) +
                  Math.abs(region5(pair[0], pair[1]).entropy - s),
        [1, 1400],
      );
      return validateBackwardState(
        region5(sol.x[0], sol.x[1]),
        [
          { label: 'enthalpy', expected: h },
          { label: 'entropy', expected: s },
        ],
        { solverName: 'solveHS', expectedRegion: Region.Region5 },
      );
    }
    default:
      throw new IF97Error(`Cannot determine region for h=${h} kJ/kg, s=${s} kJ/(kg·K)`);
  }
}
