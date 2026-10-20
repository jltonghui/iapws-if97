# Changelog

## 2.8.0 (2026-10-20)

### Added

- Add `solveBasic(input)` and exported `BasicProperties` for all eight modes, without density or transport fields.
- Include liquid and vapor endpoints in Region 4 `saturation` (`SaturationEndpoints`), including at `x = 0` and `x = 1`.
- Test backward and boundary equations against official IAPWS values at their printed precision, including all 26 Region 3 `v(p,T)` subregions.

### Changed

- Remove decimal snapping and backward property input overwrites. Region 3 PT preserves input pressure after checking equation-of-state (EOS) convergence.
- Throw `AmbiguousStateError`, an `IF97Error` subclass, when `TH`/`TS` inputs match multiple states. This applies to direct solvers, `solve`, `solveBasic`, and region detectors. Its `candidates` field contains validated basic states in ascending pressure order. Callers that previously received one branch must handle ambiguity.
- Tighten ordinary backward enthalpy/entropy acceptance to `1e-9 × max(1, |input|)` and Region 3 PT pressure convergence to relative `1e-12`, with separate endpoint and fit-gap tolerances.
- Shorten the README, move API details to `docs/reference.md`, and redraw the P–T region map.

### Fixed

- Correct 11 coefficient transcription errors in Region 1/3 `p(h,s)`, Region 3 `v(p,T)`, HS boundaries, and Region 2a `T(p,h)`/`T(p,s)`. Public `region3Volume` results change; refined solver results can differ in their last floating-point bits.
- Search all valid `TH`/`TS` branches, including non-monotonic isotherms, subcritical Region 3 vapor, and roots near open endpoints. Preserve multiple candidates near the triple point; low-temperature `TS` can match two liquid states and wet steam.
- Recover PH/PS and HS boundary roots and resolve region overlaps using `solvePT` boundary ownership. Recompute EOS properties after boundary normalization and revalidate input constraints before accepting candidates or fit-gap states.
- Preserve saturation input pressure or temperature, endpoint quality, and phase selection at `623.15 K` and near critical conditions. Use extended precision for saturation equations and Region 3 pressure inversion. Throw `IF97Error` when a stable phase or distinct saturation endpoints cannot be constructed.
- Correct global and pressure/entropy-dependent input limits. Reject out-of-range backward inputs while retaining valid boundary states; explain the triple-point lower bound in saturation errors.
- Force bisection when two iterations fail to halve the Newton bracket, preserving roots with quantized residuals near the triple point.
- Compute density as `1 / specificVolume`. Reject non-finite or non-positive viscosity, non-positive thermal-conductivity `cp`, and dielectric-constant inputs at or below `228 K`.

## 2.2.0

### Fixed

- Improved backward-solver accuracy and performance.
- Fixed saturation-region detection and package validation.
- Requires Node.js `>=20.19.0`.

## 2.1.5

- fix some issues

## 2.1.2

- fix some issues

## 2.1.1

- fix some issues: enhance end-points process

## 2.1.0

- fix some issues

## 2.0.2

- Consolidated Region 3 subregion coefficient tables into a single module.
- Simplified Region 3 dispatcher data access through a single aggregate lookup table.
- Added structural test coverage to ensure the full Region 3 subregion table remains intact.

## 2.0.1

- Added long-form aliases to `solve({ mode, ... })` inputs while keeping shorthand fields fully supported.
- Normalized tiny floating-point residue at the public API boundary.

## 2.0.0

- Narrowed the root export surface to the main solver API, core types, and error classes.
- Added public subpath exports for advanced helpers:
  `transport`, `regions`, `saturation`, `boundaries`, and `detect`.
- Updated README for the `2.0` package layout and added migration guidance for users upgrading from `1.x`.
- Tightened several public API boundary checks and error cases, including runtime `solve()` mode validation, critical-point handling, and explicit out-of-range errors on backward solvers.
