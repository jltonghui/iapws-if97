import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AmbiguousStateError, IF97Error, Region, solveHS, solvePH, solvePS, solvePT,
  solveTH, solveTS, solveTx,
} from '../dist/index.js';
import { detectRegionPT } from '../dist/detect.js';
import { boundary23_T_to_P } from '../dist/boundaries.js';
import { saturationPressure } from '../dist/saturation.js';
import * as C from '../dist/constants.js';
import { backwardConstraintTolerance, backwardSpecificVolumeTolerance } from '../dist/backward/tolerances.js';

// Reuse the absolute floor in tests/helpers/backward-assertions.ts.
const tolerance = (label, expected) => Math.max(5e-7, backwardConstraintTolerance(label, expected));
const span = (lower, upper, count, logarithmic = false) => Array.from({ length: count }, (_, i) =>
  logarithmic ? Math.exp(Math.log(lower) + i / (count - 1) * Math.log(upper / lower))
    : lower + i / (count - 1) * (upper - lower));
let seed = 0x1f972300;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
const points = new Map();
const skippedDomain = { outsideOverallPTEnvelope: 0, region5PressureAbove50: 0 };
function add(p, T, source) {
  if (p < C.P_MIN || p > C.P_MAX || T < C.T_MIN || T > C.T_MAX) { skippedDomain.outsideOverallPTEnvelope++; return; }
  if (T > C.R5_T_MIN && p > C.R5_P_MAX) { skippedDomain.region5PressureAbove50++; return; }
  const key = `${p},${T}`;
  if (!points.has(key)) points.set(key, { p, T, source });
}

if (process.argv[2] === '--point') {
  const p = Number(process.argv[3]), T = Number(process.argv[4]);
  assert.ok(Number.isFinite(p) && Number.isFinite(T), 'Use --point pressure temperature');
  add(p, T, 'reproducer');
  assert.equal(points.size, 1, 'Reproducer must be inside the PT envelope');
} else {
  const pressures = [...span(C.P_MIN, C.P_MAX, 64, true), ...span(1, C.P_MAX, 32), C.P_MIN, C.Pc, 50, 100];
  const temperatures = [...span(C.T_MIN, C.R5_T_MIN, 64), ...span(C.R5_T_MIN + 1e-7, C.T_MAX, 24)];
  for (const T of temperatures) for (const p of pressures) add(p, T, 'grid');
  for (let region of [1, 2, 3, 5]) {
    let accepted = 0;
    while (accepted < 500) {
      const T = region === 1 ? C.T_MIN + random() * (C.R2_T_MIN - C.T_MIN)
        : region === 3 ? C.R2_T_MIN + random() * (C.B23_T_MAX - C.R2_T_MIN)
          : region === 5 ? C.R5_T_MIN + random() * (C.T_MAX - C.R5_T_MIN)
            : C.T_MIN + random() * (C.R5_T_MIN - C.T_MIN);
      const p = region === 3 ? boundary23_T_to_P(T) + random() * (C.P_MAX - boundary23_T_to_P(T))
        : Math.exp(Math.log(C.P_MIN) + random() * Math.log((region === 5 ? 50 : 100) / C.P_MIN));
      if (detectRegionPT(p, T) !== region) continue;
      add(p, T, `seeded-region-${region}`);
      accepted++;
    }
  }
  for (const T of span(C.R2_T_MIN, C.B23_T_MAX, 41)) {
    const p = boundary23_T_to_P(T);
    for (const delta of [-1e-4, -1e-6, -1e-8, 0, 1e-8, 1e-6, 1e-4]) add(p * (1 + delta), T, 'b23');
  }
  for (const seam of [C.T_MIN, C.Tt, C.R2_T_MIN, C.R5_T_MIN, C.T_MAX]) {
    for (const delta of [-1e-7, 0, 1e-7]) {
      for (const p of [C.P_MIN, 0.001, 0.1, 1, 10, C.B23_P_MIN, 20, C.Pc, 40, 50, 100]) add(p, seam + delta, 'temperature-boundary');
    }
  }
  const saturationTemperatures = [273.15, 273.159, 273.16, 274.15, 277.13, 280, 300, 373.15, 500, 600, 623.1499999999999, 623.15, 623.1500000000001, 623.151, 630, 640, 645, 646, 647, 647.09, 647.094, 647.0949, 647.095, 647.0951, 647.0959];
  for (const T of saturationTemperatures) {
    const p = saturationPressure(T);
    for (const delta of [-1e-4, -1e-6, -1e-8, 0, 1e-8, 1e-6, 1e-4]) add(p * (1 + delta), T, 'saturation-neighborhood');
    for (const delta of [-1e-10, -1e-12, 1e-12, 1e-10]) add(p + delta, T, 'saturation-machine-neighborhood');
  }
  for (const dT of [-1, -0.1, -0.01, -0.002, -0.0011, -0.001, -0.0009, 0, 0.0009, 0.001, 0.0011, 0.002, 0.01, 0.1, 1]) {
    for (const dp of [-1e-3, -1e-5, -1e-7, 0, 1e-7, 1e-5, 1e-3]) add(C.Pc + dp, C.Tc + dT, 'critical-neighborhood');
  }
  add(C.Pc, C.Tc, 'documented-exact-critical-rejection');
}

const started = performance.now();
const report = {
  node: process.version, seed: '0x1f972300', points: points.size, skippedDomain,
  coverage: { grid: '64 logarithmic and 32 linear pressure levels; 64 Region1–3 temperature levels and 24 Region5 levels', seeded: '500 accepted points per single-phase region', boundaries: 'b23, temperature seams, saturation neighborhoods and critical neighborhoods' },
  limits: ['Finite deterministic samples cannot prove continuum-wide correctness.', 'Saturation mixtures are covered by the separate saturation scan.', 'Transport extrapolations are checked for finite/physical output, not external reference accuracy.'],
  regions: {}, modes: {}, expectedRejections: [], ambiguity: [], worst: {}, worstConstraints: {}, observations: [], failures: [],
};
const modes = {
  PH: state => solvePH(state.pressure, state.enthalpy),
  PS: state => solvePS(state.pressure, state.entropy),
  HS: state => solveHS(state.enthalpy, state.entropy),
  TH: state => solveTH(state.temperature, state.enthalpy),
  TS: state => solveTS(state.temperature, state.entropy),
};
const summarize = state => Object.fromEntries(['region', 'pressure', 'temperature', 'specificVolume', 'enthalpy', 'entropy', 'quality'].map(field => [field, state[field]]));
function failure(point, mode, message, details = {}) {
  const classification = mode.endsWith('.constraints') ? 'input constraint or EOS reconstruction failure'
    : message === 'round-trip mismatch' ? 'same-region round-trip accuracy, investigate conditioning'
      : message === 'ambiguity requires independent corroboration' ? 'unresolved independent witness'
        : 'valid PT state rejected or invalid returned state';
  report.failures.push({ ...point, mode, message, classification, ...details, command: `node scripts/scan-domain.mjs --point ${point.p} ${point.T}` });
}
function physical(state) {
  for (const field of ['pressure', 'temperature', 'specificVolume', 'density', 'internalEnergy', 'enthalpy', 'entropy']) assert.ok(Number.isFinite(state[field]), `${field} must be finite`);
  assert.ok(state.specificVolume > 0 && state.density > 0, 'volume/density must be positive');
  assert.ok(Math.abs(state.density * state.specificVolume - 1) < 1e-10, 'density must equal 1/v');
  assert.ok(Math.abs(state.enthalpy - state.internalEnergy - 1000 * state.pressure * state.specificVolume) <= tolerance('enthalpy', state.enthalpy), 'h must equal u+pv');
  const mixture = state.region === 4 && state.quality > 0 && state.quality < 1;
  for (const field of ['cp', 'cv', 'speedOfSound', 'isothermalCompressibility', 'viscosity', 'thermalConductivity', 'dielectricConstant']) {
    if (mixture) assert.equal(state[field], null, `${field} must be null for mixtures`);
    else assert.ok(Number.isFinite(state[field]) && state[field] > 0, `${field} must be finite and positive`);
  }
  if (!mixture) {
    assert.ok(Number.isFinite(state.isobaricExpansion), 'expansion must be finite');
    assert.ok(state.cp >= state.cv, 'cp must be at least cv');
  }
  if (mixture || state.temperature > 1273.15) assert.equal(state.ionizationConstant, null, 'pKw must be null outside its domain');
  else assert.ok(Number.isFinite(state.ionizationConstant), 'pKw must be finite within its domain');
  if (state.region === 4) assert.ok(Number.isFinite(state.surfaceTension) && state.surfaceTension >= 0, 'surface tension must be finite on saturation');
  else {
    assert.equal(state.surfaceTension, null, 'surface tension must be null outside saturation');
    assert.equal(state.quality, null, 'quality must be null outside saturation');
  }
}
function compare(point, mode, actual, expected, crossRegion = false) {
  const differences = [];
  for (const field of ['pressure', 'temperature', 'enthalpy', 'entropy', 'specificVolume']) {
    const allowed = field === 'specificVolume' ? Math.max(5e-7, backwardSpecificVolumeTolerance(expected[field])) : tolerance(field, expected[field]);
    const absolute = Math.abs(actual[field] - expected[field]);
    const ratio = absolute / allowed;
    const key = `${mode}.${field}`;
    if (!report.worst[key] || ratio > report.worst[key].toleranceRatio) report.worst[key] = { ...point, actual: actual[field], expected: expected[field], absoluteError: absolute, tolerance: allowed, toleranceRatio: ratio };
    if (ratio > 1) differences.push({ field, actual: actual[field], expected: expected[field], absoluteError: absolute, tolerance: allowed });
  }
  if (differences.length) {
    const details = { differences, actual: summarize(actual), expected: summarize(expected) };
    if (crossRegion) report.observations.push({ ...point, mode, message: 'different region equations returned a second numerical state', ...details });
    else failure(point, mode, 'round-trip mismatch', details);
  }
}
function checkConstraints(point, mode, actual, expected) {
  const labels = { PH: ['pressure', 'enthalpy'], PS: ['pressure', 'entropy'], HS: ['enthalpy', 'entropy'], TH: ['temperature', 'enthalpy'], TS: ['temperature', 'entropy'] }[mode];
  for (const label of labels) {
    const allowed = backwardConstraintTolerance(label, expected[label]);
    const absolute = Math.abs(actual[label] - expected[label]);
    const ratio = absolute / allowed;
    const key = `${mode}.${label}`;
    if (!report.worstConstraints[key] || ratio > report.worstConstraints[key].toleranceRatio) {
      report.worstConstraints[key] = { ...point, actual: actual[label], expected: expected[label], absoluteError: absolute, tolerance: allowed, toleranceRatio: ratio };
    }
    if (absolute > allowed) failure(point, `${mode}.constraints`, `${label} constraint mismatch`, { actual: actual[label], expected: expected[label], tolerance: allowed });
  }
}

// Independent witnesses use public PT/Tx evaluations and derivative sign brackets,
// not the production candidate/stationary-point search.
const isotherms = new Map();
function isotherm(T, property) {
  const key = `${T},${property}`;
  if (isotherms.has(key)) return isotherms.get(key);
  const maxP = T > C.R5_T_MIN ? 50 : 100;
  const groups = [];
  const psat = T < C.Tc ? saturationPressure(T) : null;
  const p23 = T > C.R2_T_MIN && T < C.B23_T_MAX ? boundary23_T_to_P(T) : null;
  const boundaries = [...new Set([C.P_MIN, ...(psat === null ? [] : [psat]), ...(p23 === null ? [] : [p23]), maxP])].sort((a, b) => a - b);
  for (let i = 1; i < boundaries.length; i++) {
    const a = boundaries[i - 1], b = boundaries[i];
    const sample = [a * (1 + 1e-13), a * (1 + 1e-9), b * (1 - 1e-13), b * (1 - 1e-9), ...span(a, b, 65, true), ...span(a, b, 65)].filter(p => p > a && p < b);
    const states = [];
    for (const p of [a, ...sample.sort((x, y) => x - y), b]) {
      try {
        const state = solvePT(p, T);
        if (state.cp > 0 && state.isothermalCompressibility > 0) states.push(state);
      } catch { /* A witness must be an actual returned stable state. */ }
    }
    const derivative = state => property === 'enthalpy' ? 1000 * state.specificVolume * (1 - T * state.isobaricExpansion) : -1000 * state.specificVolume * state.isobaricExpansion;
    const extra = [];
    for (let j = 1; j < states.length; j++) {
      let left = states[j - 1], right = states[j];
      if (left.region !== right.region || derivative(left) * derivative(right) >= 0) continue;
      for (let k = 0; k < 60; k++) {
        const p = (left.pressure + right.pressure) / 2;
        if (p === left.pressure || p === right.pressure) break;
        const mid = solvePT(p, T);
        if (derivative(left) * derivative(mid) <= 0) right = mid;
        else left = mid;
      }
      extra.push(Math.abs(derivative(left)) < Math.abs(derivative(right)) ? left : right);
    }
    groups.push([...states, ...extra].sort((x, y) => x.pressure - y.pressure));
  }
  isotherms.set(key, groups);
  return groups;
}
function ambiguityWitnesses(forward, property) {
  const T = forward.temperature, target = forward[property];
  const rootTolerance = property === 'enthalpy' ? 1e-9 : 1e-12;
  const witnesses = [forward];
  const distinct = state => witnesses.every(other => Math.abs(other.pressure - state.pressure) > 1e-9 * Math.max(1, Math.abs(state.pressure)) || Math.abs(other.specificVolume - state.specificVolume) > 1e-9 * Math.max(other.specificVolume, state.specificVolume));
  const accept = state => { if (Math.abs(state[property] - target) <= rootTolerance && distinct(state)) witnesses.push(state); };
  if (T >= C.Tt && T < C.Tc) {
    const liquid = solveTx(T, 0), vapor = solveTx(T, 1);
    const x = (target - liquid[property]) / (vapor[property] - liquid[property]);
    if (x >= 0 && x <= 1) accept(solveTx(T, x));
  }
  if (witnesses.length > 1) return witnesses.map(summarize);
  for (const group of isotherm(T, property)) {
    for (let i = 1; i < group.length; i++) {
      let left = group[i - 1], right = group[i];
      let fa = left[property] - target, fb = right[property] - target;
      accept(left); accept(right);
      if (left.region !== right.region || fa * fb >= 0) continue;
      for (let step = 0; step < 64; step++) {
        const p = (left.pressure + right.pressure) / 2;
        if (p === left.pressure || p === right.pressure) break;
        const mid = solvePT(p, T), fm = mid[property] - target;
        accept(mid);
        if (witnesses.length > 1) return witnesses.map(summarize);
        if (fa * fm <= 0) { right = mid; fb = fm; }
        else { left = mid; fa = fm; }
      }
    }
  }
  return witnesses.map(summarize);
}

for (const point of points.values()) {
  let forward;
  try {
    forward = solvePT(point.p, point.T);
    physical(forward);
    assert.notEqual(forward.region, Region.Region4, 'PT must return a single-phase state');
    report.regions[forward.region] = (report.regions[forward.region] ?? 0) + 1;
  } catch (error) {
    if (point.p === C.Pc && point.T === C.Tc && error instanceof IF97Error && /critical/.test(error.message)) report.expectedRejections.push({ ...point, mode: 'PT', reason: 'exact critical point' });
    else failure(point, 'PT', error.message, { error: error.name });
    continue;
  }
  for (const [mode, solve] of Object.entries(modes)) {
    const stats = report.modes[mode] ??= { attempts: 0, passed: 0, ambiguous: 0, rejectedCritical: 0, failed: 0 };
    stats.attempts++;
    const excludedCritical = (mode === 'TH' || mode === 'TS') && Math.abs(forward.temperature - C.Tc) < C.CRITICAL_T_EXCLUSION_BAND;
    try {
      const recovered = solve(forward);
      if (excludedCritical) throw new Error('documented critical-temperature rejection did not occur');
      physical(recovered);
      const before = report.failures.length;
      checkConstraints(point, mode, recovered, forward);
      const reconstructed = recovered.region === Region.Region4
        ? solveTx(recovered.temperature, recovered.quality)
        : solvePT(recovered.pressure, recovered.temperature);
      physical(reconstructed);
      checkConstraints(point, mode, reconstructed, forward);
      compare(point, mode, recovered, forward, recovered.region !== forward.region);
      compare(point, `${mode}.PT`, reconstructed, forward, reconstructed.region !== forward.region);
      if (before === report.failures.length) stats.passed++;
      else stats.failed++;
    } catch (error) {
      if (excludedCritical && error instanceof IF97Error && /critical-point temperature/.test(error.message)) {
        stats.rejectedCritical++;
        report.expectedRejections.push({ ...point, mode, reason: 'documented TH/TS critical-temperature exclusion' });
      } else if ((mode === 'TH' || mode === 'TS') && error instanceof AmbiguousStateError) {
        const property = mode === 'TH' ? 'enthalpy' : 'entropy';
        let witnesses = [], witnessError;
        try { witnesses = ambiguityWitnesses(forward, property); } catch (e) { witnessError = e.message; }
        if (witnesses.length > 1) {
          stats.ambiguous++;
          report.ambiguity.push({ ...point, mode, T: forward.temperature, target: forward[property], witnesses });
        } else {
          stats.failed++;
          failure(point, mode, 'ambiguity requires independent corroboration', { T: forward.temperature, property, target: forward[property], forwardP: forward.pressure, witnesses, witnessError });
        }
      } else {
        stats.failed++;
        failure(point, mode, error.message, { error: error.name, forward: summarize(forward) });
      }
    }
  }
}
if (process.argv[2] !== '--point') for (const region of [1, 2, 3, 5]) assert.ok(report.regions[region] > 500, `Region ${region} coverage missing`);
report.elapsedSeconds = (performance.now() - started) / 1000;
const output = process.argv[2] === '--point' ? join(tmpdir(), `iapws-point-node${process.versions.node}.json`) : process.argv[2] ?? join(tmpdir(), `iapws-domain-node${process.versions.node}.json`);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
const categories = {};
for (const issue of report.failures) categories[`${issue.mode}: ${issue.message}`] = (categories[`${issue.mode}: ${issue.message}`] ?? 0) + 1;
console.log(JSON.stringify({ node: report.node, points: report.points, regions: report.regions, modes: report.modes, failures: report.failures.length, observations: report.observations.length, categories: Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 15), elapsedSeconds: report.elapsedSeconds, output }, null, 2));
assert.equal(report.failures.length, 0, `Unexpected domain scan findings; inspect ${output}`);
