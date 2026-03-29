# `iapws-if97`

Calculate industrial water and steam properties in Node.js and TypeScript, based on the [IAPWS-IF97](https://www.iapws.org/) standard (International Association for the Properties of Water and Steam — Industrial Formulation 1997).

This library provides forward and backward state solvers, saturation solvers, and transport-property helpers for engineering calculations involving water and steam.

## Features

- Covers IF97 Regions 1–5, including high-temperature Region 5
- Forward, backward, and saturation solvers behind a consistent API
- Transport properties: viscosity, thermal conductivity, surface tension, dielectric constant, and ionization constant
- Verified against official IAPWS tables and published engineering references

## Project Origin

> `iapws-if97` is the core calculation engine behind the WeChat Mini Program "汽水计算器" (`wxid: wx7201fd1713b524e5`). Since its launch in 2019, it has served nearly 20,000 users. With the help of AI, this edition has been updated to incorporate `R11-24 (2024)`. I am open-sourcing it in the hope that it will help others with similar engineering needs.

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

Use `solve({ mode, ... })` when the input pair is determined at runtime:

```ts
import { solve } from 'iapws-if97';

const state = solve({ mode: 'PT', p: 16, T: 823.15 });
```

`solve` accepts both short-form and long-form property names:

```ts
const a = solve({ mode: 'PT', p: 16, T: 823.15 });
const b = solve({ mode: 'PT', pressure: 16, temperature: 823.15 });
```

Supported modes:

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

You can use either form for each property. If you provide both, their values must match.

## Solver Return Value

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

- `quality` is `null` for single-phase states — it is only defined on the saturation line.
- In two-phase mixtures (`0 < x < 1`), `cp`, `cv`, `speedOfSound`, `isobaricExpansion`, `isothermalCompressibility`, `viscosity`, `thermalConductivity`, `dielectricConstant`, and `ionizationConstant` are `null`.
- Saturation endpoints (`x = 0` or `x = 1`) still expose single-phase transport properties even though they carry Region 4 metadata.
- `solvePT(p, T)` is a single-phase solver. On the subcritical saturation boundary it resolves to the liquid side.
- `surfaceTension` is only available for Region 4 saturation states below the critical point; otherwise `null`.
- `density` is provided directly — no need to invert `specificVolume`.
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

## Saturation Endpoint

- Low-level Region 4 helpers stay mathematically permissive and high-level saturation state solvers are stricter:
  - `solvePx(p, x)` accepts `Pt ≤ p < Pc`
  - `solveTx(T, x)` accepts `Tt = 273.16 K ≤ T < Tc`
- The true triple point is supported as a saturation-state boundary:
  - `solvePx(Pt, x)` is valid
  - `solveTx(Tt, x)` is valid
- `273.15 K` is treated as a low-level extrapolation boundary only.
- The exact critical point is never returned as a Region 4 state.
- `solveTH(T, h)` and `solveTS(T, s)` keep a small exclusion band around `Tc` and reject inputs within `0.001 K` of the critical temperature.

## Errors and Limits

The library throws typed errors:

| Error | Meaning |
| --- | --- |
| `OutOfRangeError` | Input is outside the supported IF97 range |
| `ConvergenceError` | An internal iterative solve failed to converge |
| `IF97Error` | Base class for all library-specific errors |

## Validity Notes

- Thermodynamic properties follow IF97 validity ranges: up to `100 MPa` and `2273.15 K` (including Region 5).
- Surface tension applies only along the saturation line below the critical point.
- Thermal conductivity follows the IAPWS 2011 release.
- Ionization constant follows the IAPWS 2024 revised release, valid for stable fluid states from `273.15 K` to `1273.15 K` and up to `1000 MPa`.

## Verification

The test suite covers:

- Official IF97 verification tables (Regions 1–5)
- Backward-equation round-trip accuracy
- Temperature-led backward round trips (`TH` and `TS`)
- High-pressure Region 4 regressions
- IAPWS R11-24 ionization-constant verification values
- Coverage thresholds enforced locally
- ASME and GB/T steam-table comparisons against published values

To run locally:

```bash
npm run build
npm test
npm run test:coverage
npm run test:standards
```

## Integration Validation

![Mollier h-s diagram generated with iapws-if97](https://raw.githubusercontent.com/jltonghui/iapws-if97/main/assets/pics/mollier-hs-diagram.svg)

This Mollier `h-s` diagram was generated with `iapws-if97` as a practical end-to-end validation artifact.

### ASME Validation Snapshot

Compares saturation states against *ASME International Steam Tables for Industrial Use*, 3rd ed., Table S-2 ("Properties of Saturated Water and Steam — Pressure").
Each case checks 7 values: saturation temperature, liquid/vapor specific volume, enthalpy, and entropy.
The snapshot below reflects the current `tests/standards-asme` regression run.

| ASME case | Pressure (MPa) | Points checked | Max relative error |
| --- | ---: | ---: | ---: |
| Table S-2 @ 0.01 MPa | 0.01 | 7 | 0.0257993% |
| Table S-2 @ 0.10 MPa | 0.10 | 7 | 0.0141744% |
| Table S-2 @ 1.00 MPa | 1.00 | 7 | 0.0207405% |
| Table S-2 @ 5.0 MPa | 5.0 | 7 | 0.0315405% |
| Table S-2 @ 10.0 MPa | 10.0 | 7 | 0.0261599% |
| Table S-2 @ 20.0 MPa | 20.0 | 7 | 0.0173004% |
| Overall worst case | - | 42 | 0.0315405% |

The current ASME regression threshold is `maxRelativeError < 5e-4` (less than `0.05%`).

### GB/T Validation Snapshot

Compares superheated-steam states against *GB/T 34060-2017*, Table A.3(续), page 55.
Each case checks 4 values at `10 MPa`: specific volume, enthalpy, entropy, and speed of sound.
The snapshot below reflects the current `tests/standards-cn` regression run.

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

The package ships with bundled TypeScript declarations and ESM exports.

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

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability arising from the use of this software.
