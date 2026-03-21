# `iapws-if97`

Industrial water and steam properties for Node.js and TypeScript, based on IAPWS-IF97 (The International Association for the Properties of Water and Steam - Industrial Formulation 1997).

`iapws-if97` provides forward and backward state solvers, saturation solvers, and transport-property helpers for engineering calculations involving water and steam. For the standards organization and official releases, see [IAPWS](https://www.iapws.org/).

## Features

- IF97 Regions 1 to 5, including Region 5 high-temperature support
- Forward, backward, and saturation solvers from a consistent public API
- Transport properties including viscosity, thermal conductivity, surface tension, dielectric constant, and ionization constant
- Typed ESM package with bundled declarations
- `2.0` export split: root import for main solvers, subpaths for advanced helpers
- Verified against IAPWS tables and published engineering references

## Project Origin

> `iapws-if97` is the core calculation library behind the WeChat MiniProgram "汽水计算器" (`wxid: wx7201fd1713b524e5`). First launched in 2019, it has served nearly 20,000 users. With the help of AI, this edition has now been updated through `R11-24 (2024)`. I am open-sourcing it in the hope that it can help others with similar engineering needs.

<p align="right">-- Retired Thermodynamic Engineer, Shuping</p>

## Installation

```bash
npm install iapws-if97
```

## Quick Start

```ts
import { solve, solvePT, solvePx } from 'iapws-if97';

const a = solvePT(3, 300);
const b = solve({ mode: 'PH', p: 3, h: a.enthalpy });
const c = solvePx(1, 0.5);

console.log(a.enthalpy);   // kJ/kg
console.log(b.temperature); // K
console.log(c.quality);     // 0.5
```

## Main API

- `solvePT(p, T)` // `MPa`, `K`
- `solvePH(p, h)` // `MPa`, `kJ/kg`
- `solvePS(p, s)` // `MPa`, `kJ/(kg·K)`
- `solveHS(h, s)` // `kJ/kg`, `kJ/(kg·K)`
- `solveTH(T, h)` // `K`, `kJ/kg`
- `solveTS(T, s)` // `K`, `kJ/(kg·K)`
- `solvePx(p, x)` // `MPa`, quality `[0, 1]`
- `solveTx(T, x)` // `K`, quality `[0, 1]`
- `solve(input)` // same units as the selected `mode`

Use `solve({ mode, ... })` when the input pair varies at runtime:

```ts
import { solve } from 'iapws-if97';

const state = solve({ mode: 'PT', p: 16, T: 823.15 });
```

`solve({ mode, ... })` accepts either engineering shorthand or long-form input names:

```ts
const a = solve({ mode: 'PT', p: 16, T: 823.15 });
const b = solve({ mode: 'PT', pressure: 16, temperature: 823.15 });
```

Supported `mode`:

```ts
type SolveInput =
  | { mode: 'PT'; p: number; T: number }
  | { mode: 'PH'; p: number; h: number }
  | { mode: 'PS'; p: number; s: number }
  | { mode: 'HS'; h: number; s: number }
  | { mode: 'Px'; p: number; x: number }
  | { mode: 'Tx'; T: number; x: number }
  | { mode: 'TH'; T: number; h: number }
  | { mode: 'TS'; T: number; s: number };
```

For each aliased pair, provide either form. If you provide both, their values must match.

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
  ionizationConstant: number | null;
  isobaricExpansion: number | null;
  isothermalCompressibility: number | null;
};
```

`SteamState` uses canonical output names only. Input aliases such as `p`/`pressure` do not create duplicate output fields.

Notes:

- `quality` is only defined for saturated states and is `null` elsewhere.
- In two-phase mixture states (`0 < x < 1`), `cp`, `cv`, `speedOfSound`, `isobaricExpansion`, and `isothermalCompressibility` return `null`.
- `surfaceTension` is only returned on Region 4 saturation states below the critical point. In bulk single-phase states it returns `null`.
- `density` is included directly, so you do not need to invert `specificVolume` yourself.
- `ionizationConstant` is returned as `null` outside the released IAPWS validity range for that correlation.

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

## Advanced Imports

The package root is intentionally limited to the main solver API, core types, and error classes.
Lower-level helpers are available from dedicated subpaths:

- `iapws-if97/transport`: `viscosity`, `thermalConductivity`, `surfaceTension`, `dielectricConstant`, `ionizationConstant`
- `iapws-if97/regions`: `region1`, `region2`, `region3ByRhoT`, `region5`
- `iapws-if97/saturation`: `saturationPressure`, `saturationTemperature`
- `iapws-if97/boundaries`: `boundary23_T_to_P`, `boundary23_P_to_T`, `region3Volume`, `region3SatVolume`
- `iapws-if97/detect`: `detectRegionPT`, `detectRegionPH`, `detectRegionPS`, `detectRegionHS`, `detectRegionTH`, `detectRegionTS`

Examples:

```ts
import { viscosity } from 'iapws-if97/transport';
import { region1 } from 'iapws-if97/regions';
import { saturationTemperature } from 'iapws-if97/saturation';
import { detectRegionPT } from 'iapws-if97/detect';
```

## Migration to 2.0

Version `2.0.0` narrows the root export surface to the main solver API.
If you imported lower-level helpers from the package root in `1.x`, move them to subpath imports:

- `import { viscosity } from 'iapws-if97'` → `import { viscosity } from 'iapws-if97/transport'`
- `import { region1 } from 'iapws-if97'` → `import { region1 } from 'iapws-if97/regions'`
- `import { saturationTemperature } from 'iapws-if97'` → `import { saturationTemperature } from 'iapws-if97/saturation'`
- `import { detectRegionPT } from 'iapws-if97'` → `import { detectRegionPT } from 'iapws-if97/detect'`

## Advanced Usage Notes

- `region1`, `region2`, `region3ByRhoT`, and `region5` return core thermodynamic properties without transport-property enrichment.
- `detectRegion*` helpers return a `Region` enum value or `-1` when the input pair is outside IF97 validity.
- `viscosity(T, rho)` and `dielectricConstant(T, rho)` require temperature and density, not a `SteamState`.
- `ionizationConstant(T, rho)` also requires temperature and density, and returns `null` outside its released validity range.
- `thermalConductivity(T, rho, cp?, cv?, drhodP_T?, mu?)` supports two levels:
  - minimal call: base conductivity from `T` and `rho`
  - full call: include `cp`, `cv`, `drhodP_T`, and `mu` to evaluate the IAPWS 2011 critical-enhancement term
- `surfaceTension(T)` returns `null` outside its valid temperature range and should be interpreted as a saturation-line property.
- `solveTH(T, h)` prefers the compressed-liquid branch when a subcritical liquid state and a two-phase state are both thermodynamically possible at the same `T` and `h`; exact saturation endpoints still return Region 4 metadata.

## Errors and Limits

The library throws typed errors from the public API:

- `OutOfRangeError`: an input is outside the supported IF97 range
- `ConvergenceError`: an internal numerical solve failed to converge
- `IF97Error`: base class for library-specific failures

Typical boundary rules:

- `solvePT(p, T)` supports the IF97 industrial range up to `100 MPa` and `2273.15 K`, with Region 5 limited to `50 MPa`.
- The exact critical point (`22.064 MPa`, `647.096 K`) is rejected with `IF97Error` because derivative properties are singular there.
- `solvePx(p, x)` is only valid on the saturation line for `Pt <= p <= Pc`.
- `solveTx(T, x)` is only valid on the saturation line for `273.15 K <= T <= Tc`.
- `solveTH(T, h)` and `solveTS(T, s)` currently support Region 1 to Region 5. Inputs within `0.001 K` of the critical-point temperature are rejected conservatively with `IF97Error`.
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
- Temperature-led backward round trips for `TH` and `TS`
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
