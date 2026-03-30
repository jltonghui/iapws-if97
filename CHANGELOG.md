# Changelog

All notable changes to this project will be documented in this file.

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
