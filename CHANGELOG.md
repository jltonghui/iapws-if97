# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added

- Add `solveBasic(input)` and the exported `BasicProperties` type for all eight input modes, without density or transport fields.
- Return both Region 4 endpoints in `saturation` (type `SaturationEndpoints`), even at `x = 0` or `x = 1`, without extra saturation solves.

### Fixed

- Explain the triple-point lower bound in low-temperature saturation errors. `OutOfRangeError` and input bounds are unchanged.
- Compute `density` as `1 / specificVolume` after public numeric normalization.
- Search all valid `TH`/`TS` branches, including non-monotonic isotherms and subcritical Region 3 vapor states. Low-temperature `TS` inputs can match two liquid states and wet steam.
- `solveTH`, `solveTS`, unified `TH`/`TS` modes, and `detectRegionTH`/`detectRegionTS` now throw `AmbiguousStateError` (an `IF97Error` subclass) for multiple physical states. Previously, these calls could silently select a branch (wet steam for `TS`) or report no valid state. Unique solutions and shared saturation endpoints remain supported.
- Preserve the supplied saturation pressure or temperature and select the correct region equation at the 623.15 K boundary, including adjacent floating-point inputs.
- Evaluate the saturation pressure and temperature equations with extended precision, preserving monotonicity near region boundaries and reducing critical-region rounding errors.
- Use native saturation pressure to select the Region 3 liquid or vapor branch, preventing phase changes caused by inverse-temperature rounding.
- Retain low-order pressure terms during Region 3 density inversion and saturation-state construction.
- Recover `TH`/`TS` roots just inside open branch endpoints using existing property tolerances. Separate interior convergence from endpoint property tolerances to improve pressure recovery on nearly flat isotherms.
- Correct global enthalpy and entropy limits; compute upper limits from the Region 5 equation of state at module initialization to match runtime rounding.
- Correct HS classification for cold liquids and at the Region 1/3 and Region 2/5 boundaries, and use computed saturation endpoints in the HS residual.
- Preserve HS endpoint quality and single-phase properties when the endpoint equation of state exactly reproduces the supplied enthalpy and entropy.
- Give the saturation property span priority over overlapping single-phase fits in PH/PS classification at 623.15 K.
- Revalidate backward states before resolving B23 boundary rounding; preserve pressure and temperature when decimal normalization would change region or phase.
- Report `IF97Error` when near-critical calculations cannot construct the requested stable phase or distinct saturation endpoints.
- Resolve Region 1/3, B23, and Region 2/5 overlaps using `solvePT` boundary ownership. In numerical gaps, return the boundary EOS state without overwriting its enthalpy or entropy. HS checks both properties at the same boundary coordinate.
- Use pressure-dependent Region 2/5 limits in PH/PS classification. Reject inputs above the local upper bound and bracket Region 5 inversion to its temperature range.
- Reject HS inputs above the entropy-dependent Region 2/3 upper boundary at `100 MPa` or `1073.15 K`, while preserving valid boundary states.
- Reject non-finite or non-positive viscosity results, non-positive supplied thermal-conductivity `cp`, and dielectric-constant inputs at or below `228 K`.

## 2.2.0

### Fixed

- Improved backward-solver accuracy, robustness, and performance.
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
