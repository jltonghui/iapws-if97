# `iapws-if97`

[![CI](https://github.com/jltonghui/iapws-if97/actions/workflows/ci.yml/badge.svg)](https://github.com/jltonghui/iapws-if97/actions/workflows/ci.yml)

`iapws-if97` calculates industrial water and steam properties in Node.js and TypeScript using the [IAPWS-IF97](https://www.iapws.org/) standard published by the International Association for the Properties of Water and Steam.

It includes forward and backward state solvers, saturation solvers, and transport-property helpers.

## Features

- Covers IF97 Regions 1–5, including high-temperature Region 5
- Forward, backward, and saturation solvers behind a consistent API
- Transport properties: viscosity, thermal conductivity, surface tension, dielectric constant, and ionization constant
- Verified against official IAPWS tables and published engineering references

## Installation

Requires Node.js `>=20.19.0`. The package publishes ESM, and all documented examples use `import`. CommonJS is not part of the tested API.

```bash
npm install iapws-if97
```

## Quick start

Save the following as `example.mjs` and run it with `node example.mjs`:

```js
import { solve, solvePT, solvePx } from 'iapws-if97';

const a = solvePT(3, 300);
const b = solve({ mode: 'PH', p: 3, h: a.enthalpy });
const c = solvePx(1, 0.5);

console.log(a.enthalpy);   // kJ/kg
console.log(b.temperature); // K
console.log(c.quality);     // 0.5
```

## Main API

| Function | Input pair | Units |
| --- | --- | --- |
| `solvePT(p, T)` | pressure, temperature | `MPa`, `K` |
| `solvePH(p, h)` | pressure, enthalpy | `MPa`, `kJ/kg` |
| `solvePS(p, s)` | pressure, entropy | `MPa`, `kJ/(kg·K)` |
| `solveHS(h, s)` | enthalpy, entropy | `kJ/kg`, `kJ/(kg·K)` |
| `solveTH(T, h)` | temperature, enthalpy | `K`, `kJ/kg` |
| `solveTS(T, s)` | temperature, entropy | `K`, `kJ/(kg·K)` |
| `solvePx(p, x)` | pressure, vapor quality | `MPa`, dimensionless `[0, 1]` |
| `solveTx(T, x)` | temperature, vapor quality | `K`, dimensionless `[0, 1]` |

All numeric inputs must be finite numbers.

### Unified `solve()`

Use `solve({ mode, ... })` when the input pair is determined at runtime:

```ts
import { solve } from 'iapws-if97';

const state = solve({ mode: 'PT', p: 16, T: 823.15 });
```

Each mode accepts canonical short fields or their long aliases:

| Mode | Short fields | Long aliases |
| --- | --- | --- |
| `PT` | `p`, `T` | `pressure`, `temperature` |
| `PH` | `p`, `h` | `pressure`, `enthalpy` |
| `PS` | `p`, `s` | `pressure`, `entropy` |
| `HS` | `h`, `s` | `enthalpy`, `entropy` |
| `Px` | `p`, `x` | `pressure`, `quality` |
| `Tx` | `T`, `x` | `temperature`, `quality` |
| `TH` | `T`, `h` | `temperature`, `enthalpy` |
| `TS` | `T`, `s` | `temperature`, `entropy` |

```ts
import type { SolveInput } from 'iapws-if97';
import { solve } from 'iapws-if97';

const shortForm: SolveInput = { mode: 'PT', p: 16, T: 823.15 };
const longForm: SolveInput = { mode: 'PT', pressure: 16, temperature: 823.15 };

const a = solve(shortForm);
const b = solve(longForm);
```

You can mix short and long names within one input. If both aliases for the same property are present, their values must match exactly. The exported `SolveInput` type is the source of truth for accepted combinations.

## Solver return value

All solvers return a `SteamState` object containing both thermodynamic and transport properties:

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
  viscosity: number | null;
  thermalConductivity: number | null;
  surfaceTension: number | null;
  dielectricConstant: number | null;
  ionizationConstant: number | null;
  isobaricExpansion: number | null;
  isothermalCompressibility: number | null;
};
```

`SteamState` always uses canonical property names.

**Notes:**

- `quality` is `null` for single-phase states; it is only defined on the saturation line.
- In two-phase mixtures (`0 < x < 1`), `cp`, `cv`, `speedOfSound`, `isobaricExpansion`, `isothermalCompressibility`, `viscosity`, `thermalConductivity`, `dielectricConstant`, and `ionizationConstant` are `null`.
- Saturation endpoints (`x = 0` or `x = 1`) still expose single-phase transport properties even though they carry Region 4 metadata.
- `solvePT(p, T)` is a single-phase solver. On the subcritical saturation boundary it resolves to the liquid side.
- `surfaceTension` is only available for Region 4 saturation states below the critical point; otherwise `null`.
- `density` is provided directly, so there is no need to invert `specificVolume`.
- `ionizationConstant` is `null` outside the IAPWS validity range for that correlation.

## Units

- Pressure: `MPa`
- Temperature: `K`
- Specific volume: `m^3/kg`
- Density: `kg/m^3`
- Enthalpy, internal energy: `kJ/kg`
- Entropy, heat capacities: `kJ/(kg·K)`
- Speed of sound: `m/s`
- Quality: dimensionless, `0`–`1` (saturation line only)
- Viscosity: `Pa·s`
- Thermal conductivity: `W/(m·K)`
- Surface tension: `N/m`
- Dielectric constant: dimensionless
- Ionization constant (`pKw`): dimensionless
- Isobaric expansion coefficient: `1/K`
- Isothermal compressibility: `1/MPa`

Any field typed as `number | null` returns `null` when the property is undefined for the given state.

## Advanced imports

The package root is limited to the main solvers, `SteamState`, `SolveInput`, `Region`, and the public error classes. Lower-level helpers are available from explicit subpaths:

| Subpath | Exports |
| --- | --- |
| `iapws-if97/transport` | `viscosity`, `thermalConductivity`, `surfaceTension`, `dielectricConstant`, `ionizationConstant` |
| `iapws-if97/regions` | `region1`, `region2`, `region3ByRhoT`, `region5` |
| `iapws-if97/saturation` | `saturationPressure`, `saturationTemperature` |
| `iapws-if97/boundaries` | `boundary23_T_to_P`, `boundary23_P_to_T`, `region3Volume`, `region3SatVolume` |
| `iapws-if97/detect` | `detectRegionPT`, `detectRegionPH`, `detectRegionPS`, `detectRegionHS`, `detectRegionTH`, `detectRegionTS` |

```ts
import { viscosity } from 'iapws-if97/transport';
import { region1 } from 'iapws-if97/regions';
import { saturationTemperature } from 'iapws-if97/saturation';
import { detectRegionPT } from 'iapws-if97/detect';
```

These are low-level mathematical interfaces:

- Region functions return core thermodynamic properties without `density` or transport-property enrichment.
- Region, boundary, and detection helpers expect callers to respect the corresponding equation domains. Detection helpers return a `Region` value or `-1` when no valid region is found.
- `thermalConductivity(T, rho)` calculates the base contribution. Pass `cp`, `cv`, `drhodP_T`, and `mu` to include the IAPWS 2011 critical-enhancement term.
- `surfaceTension(T)` is a saturation-line property. `saturationPressure(T)` and `saturationTemperature(p)` expose the mathematical Region 4 boundary and are more permissive at endpoints than `solveTx` and `solvePx`.

## Transport correlation limits

Transport correlations have validity ranges independent of the IF97 thermodynamic envelope. The library may return extrapolated values where noted:

| Property | Implemented behavior |
| --- | --- |
| Viscosity | Uses the IAPWS 2008 dilute-gas and finite-density terms. The near-critical enhancement is omitted, as permitted for industrial use by the release. |
| Thermal conductivity | Full `SteamState` calculations include the IAPWS 2011 critical enhancement. The two-argument low-level call does not. Values above the release's temperature range are extrapolations. |
| Surface tension | Defined for saturation states below the critical point. The low-level helper permits `273.15 K ≤ T ≤ Tc`; values below the triple point `Tt = 273.16 K` are extrapolations. |
| Dielectric constant | The IAPWS 1997 release is valid through `873 K`. The low-level helper does not enforce that upper bound, so higher-temperature results are extrapolations. |
| Ionization constant (`pKw`) | Returns `null` outside `273.15 K ≤ T ≤ 1273.15 K`. The release's `1000 MPa` pressure limit describes the correlation, not the state-solver pressure range. |

## Saturation endpoints

The triple and critical points are `Pt = 0.000611657 MPa`, `Tt = 273.16 K`, `Pc = 22.064 MPa`, and `Tc = 647.096 K`.

- Low-level Region 4 helpers accept a wider endpoint range. The saturation state solvers use these stricter bounds:
  - `solvePx(p, x)` accepts `Pt ≤ p < Pc`
  - `solveTx(T, x)` accepts `Tt = 273.16 K ≤ T < Tc`
- The triple point is supported as a saturation-state boundary:
  - `solvePx(Pt, x)` is valid
  - `solveTx(Tt, x)` is valid
- `273.15 K` is treated as a low-level extrapolation boundary only.
- The solvers do not return the exact critical point as a Region 4 state.
- `solveTH(T, h)` and `solveTS(T, s)` reject inputs within `0.001 K` of the critical temperature.

## Errors and limits

The library throws typed errors:

| Error | Meaning |
| --- | --- |
| `OutOfRangeError` | Input is outside the supported IF97 range |
| `ConvergenceError` | An internal iterative solve failed to converge |
| `IF97Error` | Base class; root solvers also use it directly for non-numeric or non-finite inputs, conflicting aliases, unsupported modes, and unsupported critical-point states |

Numeric inputs to root solvers and transport helpers must be finite. Low-level region, boundary, and detection helpers rely on callers to respect their equation domains. `solvePT(Pc, Tc)`, exact critical Region 4 states, and `solveTH`/`solveTS` inputs within `0.001 K` of `Tc` are rejected because the required derivative properties or inverse solution are singular or ill-conditioned.

## Thermodynamic validity

The thermodynamic solvers follow the piecewise IF97 industrial range:

- `273.15 K ≤ T ≤ 1073.15 K`: pressure up to `100 MPa`.
- `1073.15 K < T ≤ 2273.15 K` (Region 5): pressure up to `50 MPa`.

Transport-property limits are separate; see [Transport correlation limits](#transport-correlation-limits).

## Verification

The test suite covers:

- Official IF97 verification tables (Regions 1–5)
- Backward-equation round-trip accuracy
- Temperature-led backward round trips (`TH` and `TS`)
- High-pressure Region 4 regressions
- IAPWS R11-24 ionization-constant verification values
- Coverage thresholds enforced locally
- ASME and GB/T steam-table comparisons against published values

For a clean local verification run:

```bash
npm ci
npm run test:package
npm test
```

`test:package` performs a clean build and checks that the dry-run npm tarball has no dangling source-map references. Coverage and published-table comparisons are available separately:

```bash
npm run test:coverage
npm run test:standards
```

## Integration validation

![Mollier h-s diagram generated with iapws-if97](https://raw.githubusercontent.com/jltonghui/iapws-if97/main/assets/pics/mollier-hs-diagram.svg)

This Mollier `h-s` diagram was generated with `iapws-if97` as an end-to-end check of the calculation pipeline.

The standards tests check the published tables below. Both suites enforce `maxRelativeError < 5e-4` (less than `0.05%`).

| Reference | Coverage | Points checked | Worst relative error |
| --- | --- | ---: | ---: |
| *ASME International Steam Tables for Industrial Use*, 3rd ed., Table S-2 | Saturation states at 6 pressures | 42 | `0.0315405%` |
| *GB/T 34060-2017*, Table A.3(续), page 55 | Superheated steam at `10 MPa` and 6 temperatures | 24 | `0.0007020%` |

See [`tests/standards-asme`](tests/standards-asme) and [`tests/standards-cn`](tests/standards-cn) for the source values and per-case comparisons.

## TypeScript

The package ships with generated TypeScript declarations for the root and every public subpath.

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
- [IAPWS R7-97(2012), Industrial Formulation 1997](https://www.iapws.org/relguide/IF97-Rev.html)
- [IAPWS supplementary releases](https://www.iapws.org/release.html) for `T(p,h)`, `T(p,s)`, `p(h,s)`, Region 3 boundary equations, `Tsat(h,s)`, and `v(p,T)`
- [IAPWS SR4-04(2014), Region 3 `p(h,s)` and Region 4 `Tsat(h,s)`](https://iapws.org/documents/release/Supp-phs3-2014)
- [IAPWS R12-08, Viscosity of Ordinary Water Substance](https://www.iapws.org/relguide/viscosity.html)
- [IAPWS R15-11, Thermal Conductivity of Ordinary Water Substance](https://www.iapws.org/relguide/ThCond.html)
- [IAPWS R8-97, Static Dielectric Constant of Ordinary Water Substance](https://www.iapws.org/relguide/dielec.pdf)
- [IAPWS R1-76(2014), Surface Tension of Ordinary Water Substance](https://www.iapws.org/relguide/Surf-H2O.html)
- [IAPWS R11-24, Ionization Constant of H2O](https://www.iapws.org/relguide/Ionization.html)

## Project origin

> `iapws-if97` began as the calculation engine behind the WeChat Mini Program "汽水计算器" (`wxid: wx7201fd1713b524e5`). Since its 2019 launch, it has served more than 20,000 users. AI-assisted review helped bring this open-source edition up to date with IAPWS `R11-24 (2024)`. I am sharing the engine so it can reach engineers far beyond the original program.

<p align="right">Shuping, retired thermodynamic engineer</p>

## License

MIT

## Disclaimer

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability arising from the use of this software.
