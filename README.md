# iapws-if97

**Industrial water and steam properties for Node.js and TypeScript.**

Turn two known properties into a water or steam state using [IAPWS-IF97](https://iapws.org/technical-guidance/release/IF97-Rev). For steam tables, thermal-cycle calculations, and engineering tools.

[![CI](https://github.com/jltonghui/iapws-if97/actions/workflows/ci.yml/badge.svg)](https://github.com/jltonghui/iapws-if97/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/iapws-if97.svg)](https://www.npmjs.com/package/iapws-if97)

[API reference](https://github.com/jltonghui/iapws-if97/blob/main/docs/reference.md) · [References](#references) · [Changelog](CHANGELOG.md)

![IAPWS-IF97 pressure–temperature map showing Regions 1–5, the saturation curve, and the 100 MPa and 50 MPa pressure limits.](https://raw.githubusercontent.com/jltonghui/iapws-if97/main/assets/pics/if97-regions.svg)

- Forward, backward, and saturation solvers for eight input pairs across IF97 Regions 1–5.
- Saturation results include liquid and vapor endpoints.
- Viscosity, thermal conductivity, surface tension, dielectric constant, and ionization constant where applicable.
- ESM with TypeScript declarations and no runtime dependencies.

## Start calculating

Requires Node.js ≥20.19.0. Use ESM imports.

```bash
npm install iapws-if97
```

Save as `example.mjs` and run `node example.mjs`:

```js
import { solvePT } from 'iapws-if97';

const steam = solvePT(3, 573.15); // 3 MPa, 300 °C

console.log(steam.enthalpy.toFixed(2)); // 2994.35 kJ/kg
console.log(steam.density.toFixed(3));  // 12.319 kg/m³
```

The result includes pressure, temperature, enthalpy, entropy, density, heat capacities, speed of sound, and applicable transport properties. [All fields and units →](https://github.com/jltonghui/iapws-if97/blob/main/docs/reference.md#solver-return-value)

## Use the properties you have

| Known properties | Solver |
| --- | --- |
| Pressure + temperature | `solvePT(p, T)` |
| Pressure + enthalpy | `solvePH(p, h)` |
| Pressure + entropy | `solvePS(p, s)` |
| Enthalpy + entropy | `solveHS(h, s)` |
| Temperature + enthalpy | `solveTH(T, h)` |
| Temperature + entropy | `solveTS(T, s)` |
| Pressure + vapor quality | `solvePx(p, x)` |
| Temperature + vapor quality | `solveTx(T, x)` |

Use MPa, K, kJ/kg, and kJ/(kg·K) for pressure, temperature, enthalpy, and entropy. Vapor quality `x` is the vapor mass fraction, from `0` (saturated liquid) to `1` (saturated vapor).

Use `solve()` when the input pair is chosen at runtime:

```js
import { solve } from 'iapws-if97';

const state = solve({ mode: 'PH', p: 3, h: 3000 });
```

Long field names such as `pressure` and `enthalpy` are also accepted. Use [`solveBasic()`](https://github.com/jltonghui/iapws-if97/blob/main/docs/reference.md#thermodynamics-without-transport) when you only need thermodynamics; it skips transport calculations and omits `density`.

## Work with saturation

Specify quality to calculate saturated liquid, saturated vapor, or wet steam:

```js
import { solvePx } from 'iapws-if97';

const wet = solvePx(1, 0.9); // 1 MPa, 90% vapor by mass

console.log(wet.temperature.toFixed(2)); // 453.04 K

if (wet.saturation) {
  const { liquid, vapor } = wet.saturation;
  const latentHeat = vapor.enthalpy - liquid.enthalpy;
  console.log(latentHeat.toFixed(2)); // 2014.44 kJ/kg
}
```

Every saturation result includes `saturation.liquid` and `saturation.vapor` for phase properties and latent-heat calculations. Use `solveTx(T, x)` when temperature is known instead of pressure.

## Before integrating

- PT selects a single phase. Pressure and temperature alone do not determine wet-steam quality; use `Px` or `Tx` for a mixture.
- Single-phase `quality` is `null`. Mixtures return `null` for heat capacities, speed of sound, and most transport properties. [Return-value details →](https://github.com/jltonghui/iapws-if97/blob/main/docs/reference.md#solver-return-value)
- TH and TS throw `AmbiguousStateError` with candidate states when multiple solutions exist. Use pressure or quality to resolve the state. [Errors →](https://github.com/jltonghui/iapws-if97/blob/main/docs/reference.md#errors-and-limits)
- The exact critical point is unsupported, and near-critical solves can fail. Transport correlations have separate validity ranges. [Numerical limits →](https://github.com/jltonghui/iapws-if97/blob/main/docs/reference.md#saturation-endpoints) · [Transport limits →](https://github.com/jltonghui/iapws-if97/blob/main/docs/reference.md#transport-correlation-limits)

| Thermodynamic temperature range | Maximum pressure |
| --- | --- |
| 273.15–1073.15 K | 100 MPa |
| Above 1073.15 K, up to 2273.15 K | 50 MPa |

Saturation solvers accept 273.16 ≤ T < 647.096 K or 0.000611657 ≤ p < 22.064 MPa. All numeric inputs must be finite; invalid or unresolved states throw [typed errors](https://github.com/jltonghui/iapws-if97/blob/main/docs/reference.md#errors-and-limits).

## Verification and development

Tests cover official IAPWS verification values, backward-solver round trips, region boundaries, and published ASME and GB/T steam tables. CI also checks TypeScript types, package exports, and coverage thresholds. [Verification details and references →](https://github.com/jltonghui/iapws-if97/blob/main/docs/reference.md#verification)

```bash
npm ci
npm run typecheck
npm test
npm run test:package
```

For low-level region equations, saturation curves, transport correlations, or region detection, see [advanced imports](https://github.com/jltonghui/iapws-if97/blob/main/docs/reference.md#advanced-imports).

## References

- [IAPWS R7-97(2012), Industrial Formulation 1997](https://iapws.org/technical-guidance/release/IF97-Rev).
- [IAPWS supplementary releases](https://iapws.org/technical-guidance/release) for alternative input pairs, region boundaries, and Region 3 specific volume.
- [R12-08, viscosity](https://iapws.org/technical-guidance/release/viscosity) and [R15-11, thermal conductivity](https://iapws.org/technical-guidance/release/ThCond).
- [R1-76(2014), surface tension](https://iapws.org/technical-guidance/release/Surf-H2O), [R8-97, dielectric constant](https://iapws.org/technical-guidance/release/Dielec), and [R11-24, ionization constant](https://iapws.org/technical-guidance/release/Ionization).

See the [full reference list](https://github.com/jltonghui/iapws-if97/blob/main/docs/reference.md#references) for release details.

## Project origin

> `iapws-if97` began as the calculation engine behind the WeChat Mini Program "汽水计算器" (`wxid: wx7201fd1713b524e5`). Since its 2019 launch, it has served more than 20,000 users. AI-assisted review helped bring this open-source edition up to date with IAPWS `R11-24 (2024)`. I am sharing the engine so it can reach engineers far beyond the original program.

<p align="right">Shuping, retired thermodynamic engineer</p>

## License

[MIT](LICENSE)
