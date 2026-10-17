# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added

- Add `solveBasic(input)` and exported `BasicProperties` for all eight modes, without `density` or transport fields.
- Include both Region 4 endpoints in `saturation` (`SaturationEndpoints`), including `x = 0` and `x = 1`, without extra saturation solves.
- Check backward and supplementary boundary equations against official IAPWS values (relative error `≤ 1e-8`), covering all 26 Region 3 `v(p,T)` subregions.

### Changed

- Remove public decimal snapping and return computed backward properties without input overwrites. Region 3 PT inversion preserves input pressure after checking EOS convergence.

### Fixed

- Correct two transcribed coefficients in Region 1 and Region 3b `p(h,s)` equations, verified against official check values.
- Refine Gibbs HS states to recover the minimum-pressure boundary with the existing acceptance tolerance.
- Explain the triple-point lower bound in low-temperature saturation errors without changing `OutOfRangeError` or input bounds.
- Compute `density` as `1 / specificVolume` from the returned volume.
- Search all valid `TH`/`TS` branches, including non-monotonic isotherms and subcritical Region 3 vapor. Low-temperature `TS` inputs can match two liquid states and wet steam.
- Throw `AmbiguousStateError` (an `IF97Error` subclass) from `solveTH`, `solveTS`, unified `TH`/`TS` modes, and `detectRegionTH`/`detectRegionTS` for multiple physical states. These could previously select a branch (wet steam for `TS`) or miss valid states. Unique solutions and shared saturation endpoints remain supported.
- Preserve input saturation pressure or temperature and use the correct region equation at `623.15 K`, including adjacent floating-point inputs.
- Evaluate saturation pressure and temperature with extended precision to preserve monotonicity near region boundaries and reduce critical-region rounding errors.
- Select Region 3 liquid/vapor branches using native saturation pressure to avoid phase changes from inverse-temperature rounding.
- Retain low-order pressure terms in Region 3 density inversion and saturation-state construction.
- Recover `TH`/`TS` roots just inside open branch endpoints with existing property tolerances. Use separate interior convergence tolerances to improve pressure recovery on nearly flat isotherms.
- Correct global enthalpy and entropy limits, computing upper limits from the Region 5 equation of state at module initialization to match runtime rounding.
- Correct HS classification for cold liquids and at Region 1/3 and Region 2/5 boundaries; use computed saturation endpoints in the HS residual.
- Preserve HS endpoint quality and single-phase properties when the endpoint EOS exactly reproduces input enthalpy and entropy.
- Prioritize the saturation property span over overlapping single-phase fits in PH/PS classification at `623.15 K`.
- Revalidate backward states before resolving B23 rounding.
- Throw `IF97Error` when near-critical calculations cannot construct the requested stable phase or distinct saturation endpoints.
- Resolve Region 1/3, B23, and Region 2/5 overlaps using `solvePT` boundary ownership. In fit gaps, return the boundary EOS state with computed enthalpy and entropy. HS checks both properties at the same boundary coordinate.
- Use pressure-dependent Region 2/5 PH/PS limits. Reject inputs above the local upper bound and restrict Region 5 inversion to its temperature range.
- Reject HS inputs above the entropy-dependent Region 2/3 upper boundary at `100 MPa` or `1073.15 K`; retain valid boundary states.
- Reject non-finite or non-positive viscosity results, non-positive thermal-conductivity `cp` inputs, and dielectric-constant inputs at or below `228 K`.

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
