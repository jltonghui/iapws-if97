# `iapws-if97`

IAPWS-IF97 (The International Association for the Properties of Water and Steam Industrial Formulation 1997) water/steam properties for Node.js and TypeScript.

This library implements the industrial IAPWS-IF97 formulation for Regions 1 to 5, backward equations for `PH`, `PS`, and `HS`, saturation solvers for `Px` and `Tx`, and transport-property helpers commonly needed in engineering work. For the standards organization and official releases, see [IAPWS](https://www.iapws.org/).

## Project Origin

> `iapws-if97` is the core calculation library behind the WeChat MiniProgram "汽水计算器" (`wxid: wx7201fd1713b524e5`). First launched in 2019, it has served nearly 20,000 users. With the help of AI, this edition has now been updated through `R11-24 (2024)`. I am open-sourcing it in the hope that it can help others with similar engineering needs.

<p align="right">-- Retired Thermodynamic Engineer, Shuping</p>

## Features

- Forward solver: `solvePT(p, T)`
- Backward solvers: `solvePH(p, h)`, `solvePS(p, s)`, `solveHS(h, s)`
- Saturation solvers: `solvePx(p, x)`, `solveTx(T, x)`
- Unified dispatcher: `solve({ mode, ... })`
- Region-level advanced APIs for direct access and verification
- TypeScript declarations included
- Verified against IAPWS reference tables and supplementary releases

## Installation

```bash
npm install iapws-if97
```

## Usage

### Basic `PT` solve

Use pressure and temperature as inputs to calculate a thermodynamic state.

```ts
import { solvePT } from 'iapws-if97';

const state = solvePT(3, 300);
console.log(state.enthalpy); // kJ/kg
```

### Backward `PH` solve

Use pressure and enthalpy to recover the corresponding state, for example when enthalpy is already known from measurement or a previous calculation.

```ts
import { solvePT, solvePH } from 'iapws-if97';

const state = solvePT(3, 300);
const fromPH = solvePH(3, state.enthalpy);
console.log(fromPH.temperature); // K
```

### Saturation `Px` solve

Use pressure and vapor quality to calculate a saturated liquid-vapor mixture state.

```ts
import { solvePx } from 'iapws-if97';

const wetSteam = solvePx(1, 0.5);
console.log(wetSteam.quality); // 0.5
```

## Solver Return Value

All public solvers return a `SteamState` object with thermodynamic and transport properties already populated.
For user-facing documentation, it is best understood as the solver return object. The exported TypeScript type name is `SteamState`.

```ts
type SteamState = {
  region: Region;
  pressure: number;
  temperature: number;
  specificVolume: number;
  density: number;
  internalEnergy: number;
  entropy: number;
  enthalpy: number;
  cp: number | null;
  cv: number | null;
  speedOfSound: number | null;
  quality: number | null;
  viscosity: number;
  thermalConductivity: number;
  surfaceTension: number | null;
  dielectricConstant: number;
  ionizationConstant: number;
  isobaricExpansion: number | null;
  isothermalCompressibility: number | null;
};
```

Notes:

- `quality` is only defined for saturated states and is `null` elsewhere.
- In two-phase mixture states (`0 < x < 1`), `cp`, `cv`, `speedOfSound`, `isobaricExpansion`, and `isothermalCompressibility` return `null`.
- `surfaceTension` is only returned on Region 4 saturation states below the critical point. In bulk single-phase states it returns `null`.
- `density` is included directly, so you do not need to invert `specificVolume` yourself.

## Units

- Pressure: `MPa`
- Temperature: `K`
- Specific volume: `m^3/kg`
- Density: `kg/m^3`
- Enthalpy, internal energy: `kJ/kg`
- Entropy, heat capacities: `kJ/(kg·K)`
- Speed of sound: `m/s`
- Quality: dimensionless, `0` to `1` on the saturation line
- Viscosity: `Pa·s`
- Thermal conductivity: `W/(m·K)`
- Surface tension: `N/m`
- Dielectric constant: dimensionless
- Ionization constant (`pKw`): dimensionless
- Isobaric expansion coefficient: `1/K`
- Isothermal compressibility: `1/MPa`

Fields documented as `number | null` return `null` when the property is not defined for the requested state.

## API

### Main solvers

- `solvePT(p, T)`
- `solvePH(p, h)`
- `solvePS(p, s)`
- `solveHS(h, s)`
- `solvePx(p, x)`
- `solveTx(T, x)`
- `solve(input)`

### Unified dispatcher

Use `solve({ mode, ... })` when your inputs vary by calculation path.

```ts
import { solve } from 'iapws-if97';

const a = solve({ mode: 'PT', p: 16, T: 823.15 });
const b = solve({ mode: 'PH', p: 10, h: 2800 });
const c = solve({ mode: 'PS', p: 10, s: 6.5 });
const d = solve({ mode: 'HS', h: 2800, s: 6.1 });
const e = solve({ mode: 'Px', p: 1, x: 0.2 });
const f = solve({ mode: 'Tx', T: 453.15, x: 0.8 });
```

### Advanced exports

- Region functions: `region1`, `region2`, `region3ByRhoT`, `region5`
- Saturation helpers: `saturationPressure`, `saturationTemperature`
- Boundary helpers: `boundary23_T_to_P`, `boundary23_P_to_T`, `region3Volume`, `region3SatVolume`
- Transport properties: `viscosity`, `thermalConductivity`, `surfaceTension`, `dielectricConstant`, `ionizationConstant`
- Region detection: `detectRegionPT`, `detectRegionPH`, `detectRegionPS`, `detectRegionHS`

### Advanced usage notes

- `region1`, `region2`, `region3ByRhoT`, and `region5` return core thermodynamic properties without transport-property enrichment.
- `detectRegion*` helpers return a `Region` enum value or `-1` when the input pair is outside IF97 validity.
- `viscosity(T, rho)`, `dielectricConstant(T, rho)`, and `ionizationConstant(T, rho)` require temperature and density, not a `SteamState`.
- `thermalConductivity(T, rho, cp?, cv?, drhodP_T?, mu?)` supports two levels:
  - minimal call: base conductivity from `T` and `rho`
  - full call: include `cp`, `cv`, `drhodP_T`, and `mu` to evaluate the IAPWS 2011 critical-enhancement term
- `surfaceTension(T)` returns `null` outside its valid temperature range and should be interpreted as a saturation-line property.

## Errors and Limits

The library throws typed errors from the public API:

- `OutOfRangeError`: an input is outside the supported IF97 range
- `ConvergenceError`: an internal numerical solve failed to converge
- `IF97Error`: base class for library-specific failures

Typical boundary rules:

- `solvePT(p, T)` supports the IF97 industrial range up to `100 MPa` and `2273.15 K`, with Region 5 limited to `50 MPa`.
- `solvePx(p, x)` is only valid on the saturation line for `Pt <= p <= Pc`.
- `solveTx(T, x)` is only valid on the saturation line for `273.15 K <= T <= Tc`.
- `x` must be in `[0, 1]` for two-phase calculations.
- Properties that are not defined for the requested state are returned as `null`, not `NaN`.

## Validity notes

- Thermodynamic core follows IF97 industrial validity ranges up to `100 MPa` and `2273.15 K`, including Region 5.
- Surface tension is only meaningful on the saturation line below the critical point.
- Thermal conductivity follows the IAPWS 2011 release.
- Ionization constant uses the latest IAPWS 2024 revised release and is officially recommended for stable fluid states from `273.15 K` to `1273.15 K` and up to `1000 MPa`.

## Verification

The test suite includes:

- Official IF97 verification tables for Regions 1 to 5
- Backward-equation round trips
- High-pressure Region 4 regression tests
- IAPWS R11-24 ionization-constant verification values
- Coverage thresholds enforced in CI-style local runs
- ASME and GB/T steam-table comparison reports for published standard values

Run locally:

```bash
npm run build
npm test
npm run test:coverage
npm run test:standards
```

### ASME Validation Snapshot

`tests/standards-asme/asme-steam-table-report.test.ts` compares saturation states against ASME International Steam Tables for Industrial Use, 3rd ed., Table S-2 ("Properties of Saturated Water and Steam (Pressure)").
Each pressure case checks 7 published values: saturation temperature, saturated-liquid/saturated-vapor specific volume, enthalpy, and entropy.

| ASME case | Pressure (MPa) | Points checked | Max relative error |
| --- | ---: | ---: | ---: |
| Table S-2 @ 0.01 MPa | 0.01 | 7 | 0.02580% |
| Table S-2 @ 0.10 MPa | 0.10 | 7 | 0.01417% |
| Table S-2 @ 1.00 MPa | 1.00 | 7 | 0.02074% |
| Table S-2 @ 5.0 MPa | 5.0 | 7 | 0.03154% |
| Table S-2 @ 10.0 MPa | 10.0 | 7 | 0.02616% |
| Table S-2 @ 20.0 MPa | 20.0 | 7 | 0.01730% |
| Overall worst case | - | 42 | 0.03154% |

The current ASME regression threshold is `maxRelativeError < 5e-4` (less than `0.05%`).

### GB/T Validation Snapshot

`tests/standards-cn/gbt34060-report.test.ts` compares superheated-steam states against `GB/T 34060-2017`, Table A.3(续), page 55.
Each temperature case checks 4 published values at `10 MPa`: specific volume, enthalpy, entropy, and speed of sound.

| GB/T case | Pressure (MPa) | Temperature (°C) | Points checked | Max relative error |
| --- | ---: | ---: | ---: | ---: |
| Table A.3 @ 10 MPa, 350 C | 10 | 350 | 4 | 0.0007020% |
| Table A.3 @ 10 MPa, 400 C | 10 | 400 | 4 | 0.0004650% |
| Table A.3 @ 10 MPa, 500 C | 10 | 500 | 4 | 0.0006808% |
| Table A.3 @ 10 MPa, 600 C | 10 | 600 | 4 | 0.0005630% |
| Table A.3 @ 10 MPa, 700 C | 10 | 700 | 4 | 0.0004072% |
| Table A.3 @ 10 MPa, 800 C | 10 | 800 | 4 | 0.0004146% |
| Overall worst case | - | - | 24 | 0.0007020% |

The current GB/T regression threshold is `maxRelativeError < 5e-4` (less than `0.05%`).

## TypeScript

The package ships with bundled declarations and ESM exports.

```ts
import type { SolveInput, SteamState } from 'iapws-if97';
import { Region, solve } from 'iapws-if97';

const input: SolveInput = { mode: 'PT', p: 3, T: 300 };
const state: SteamState = solve(input);

if (state.region === Region.Region1) {
  console.log('compressed liquid');
}
```

## References

- [IAPWS official website](https://www.iapws.org/)
- IAPWS R7-97(2012), Revised Release on the IAPWS Industrial Formulation 1997 for the Thermodynamic Properties of Water and Steam
- IAPWS supplementary releases for backward equations `T(p,h)`, `T(p,s)`, and `p(h,s)`
- IAPWS R15-11, Thermal Conductivity of Ordinary Water Substance
- IAPWS R1-76(2014), Surface Tension of Ordinary Water Substance
- IAPWS R11-24, Revised Release on the Ionization Constant of H2O

## License

MIT

## Disclaimer

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and noninfringement.

In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use of the software.
