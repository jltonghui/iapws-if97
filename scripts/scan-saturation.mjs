import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AmbiguousStateError, IF97Error, Region,
  solvePT, solvePx, solveTx, solvePH, solvePS, solveHS, solveTH, solveTS,
} from '../dist/index.js';
import { saturationPressure, saturationTemperature } from '../dist/saturation.js';
import { region3ByRhoT } from '../dist/regions.js';
import {
  Pt, Tt, Pc, Tc, P_MIN, RHOc, CRITICAL_T_EXCLUSION_BAND,
  REGION4_PRESSURE_TOLERANCE, REGION4_TEMPERATURE_TOLERANCE,
} from '../dist/constants.js';
import {
  backwardConstraintTolerance, backwardSpecificVolumeTolerance,
  BACKWARD_REGION4_QUALITY_TOLERANCE,
} from '../dist/backward/tolerances.js';

const qualities = [0, 1e-9, 0.01, 0.25, 0.5, 0.75, 0.99, 1 - 1e-9, 1];
const pressures = new Set([Pt, 0.001, 0.01, 0.1, 1, 10, 20]);
const temperatures = new Set([Tt, 274.15, 275, 276, 277.15, 277.5, 278, 300, 500, 600, 640]);
function adjacentFloat(value, direction) {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + BigInt(direction));
  return view.getFloat64(0);
}
const seamPressure = saturationPressure(623.15);
for (const p of [22.054, 22.063, 22.0639, 22.06399,
  adjacentFloat(seamPressure, -1), seamPressure, adjacentFloat(seamPressure, 1)]) pressures.add(p);
for (const T of [adjacentFloat(623.15, -1), adjacentFloat(623.15, 1)]) temperatures.add(T);
for (let i = 0; i <= 120; i++) pressures.add(Pt * (Pc / Pt) ** (i / 121));
for (let i = 0; i <= 136; i++) temperatures.add(Tt + (Tc - Tt) * i / 137);
for (const delta of [1e-6, 1e-4, 0.01, 0.1]) {
  temperatures.add(Tt + delta);
  temperatures.add(623.15 - delta);
  temperatures.add(623.15 + delta);
}
temperatures.add(623.15);
for (const delta of [1, 0.1, 0.01, 0.002, 0.0015, 0.0011, 0.0010001, 0.001,
  0.0009999, 0.0005, 0.0001, 1e-5, 1e-6, 1e-7, 1e-8]) temperatures.add(Tc - delta);
for (const delta of [1e-2, 1e-3, 1e-4, 1e-5, 1e-6, 1e-7, 1e-8]) pressures.add(Pc - delta);
assert.equal(qualities.length, 9);
assert(qualities.every((x, i) => x >= 0 && x <= 1 && (i === 0 || x > qualities[i - 1])));
assert([...pressures].every((p) => p >= Pt && p < Pc));
assert([...temperatures].every((T) => T >= Tt && T < Tc));

const report = {
  node: process.version, pressureSamples: pressures.size, temperatureSamples: temperatures.size,
  qualities, states: 0, checks: 0, calls: {}, expectedCriticalRejections: 0, expectedInputSnaps: [],
  verifiedAmbiguities: [], witnessedHSMultipleRoots: [], numericalConsistencyRejections: [],
  endpointMetadataChecks: 0,
  unexpectedFailureCount: 0, failures: [], failureGroups: {}, worst: {},
};
const started = Date.now();
function fail(kind, context, detail) {
  report.unexpectedFailureCount++;
  report.failureGroups[kind] = (report.failureGroups[kind] ?? 0) + 1;
  report.failures.push({ ...context, kind, detail });
}
function close(metric, actual, expected, tolerance, context) {
  report.checks++;
  const error = Math.abs(actual - expected);
  const ratio = error / tolerance;
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || error > tolerance) {
    fail(metric, context, { actual, expected, error, tolerance, ratio });
  }
  if (!report.worst[metric] || ratio > report.worst[metric].ratio) {
    report.worst[metric] = { error, tolerance, ratio, actual, expected, ...context };
  }
}
function vaporSpinodalWitness(name, context) {
  const p = name === 'Px' ? context.p ?? context.input : saturationPressure(context.T ?? context.input);
  const T = name === 'Tx' ? context.T ?? context.input : saturationTemperature(p);
  if (!(T < Tc && T > 623.15)) return null;
  let lower = RHOc * 0.9;
  let upper = RHOc;
  const derivative = (rho) => 1 / (rho * region3ByRhoT(rho, T).isothermalCompressibility);
  if (!(derivative(lower) > 0 && derivative(upper) < 0)) return null;
  for (let iteration = 0; iteration < 60; iteration++) {
    const midpoint = (lower + upper) / 2;
    if (midpoint === lower || midpoint === upper) break;
    if (derivative(midpoint) > 0) lower = midpoint;
    else upper = midpoint;
  }
  const rho = (lower + upper) / 2;
  const vaporMaximumPressure = region3ByRhoT(rho, T).pressure;
  return p > vaporMaximumPressure
    ? { p, T, rho, vaporMaximumPressure, targetAboveVaporMaximum: p - vaporMaximumPressure }
    : null;
}
function call(name, context, fn) {
  report.calls[name] = (report.calls[name] ?? 0) + 1;
  try { return fn(); }
  catch (error) {
    if (error instanceof IF97Error && /numerical inconsistency/.test(error.message)) {
      const phaseWitness = vaporSpinodalWitness(name, context);
      if (phaseWitness) {
        report.numericalConsistencyRejections.push({ name, ...context, message: error.message, phaseWitness });
      } else fail(`${name}:unverified numerical inconsistency`, context, { message: error.message });
    } else fail(`${name}:throw`, context, { name: error.name, message: error.message });
    return null;
  }
}
function stateValid(state, context) {
  for (const field of ['pressure', 'temperature', 'enthalpy', 'entropy', 'internalEnergy', 'specificVolume', 'density']) {
    report.checks++;
    if (!Number.isFinite(state[field])) fail('nonfinite', context, { field, value: state[field] });
  }
  if (state.region !== Region.Region4) fail('region', context, { actual: state.region, expected: Region.Region4 });
  if (!(state.specificVolume > 0 && state.density > 0)) fail('density', context, state);
  close('density reciprocal', state.density * state.specificVolume, 1, 1e-12, context);
  if (state.quality === null || state.quality < 0 || state.quality > 1) fail('quality range', context, state.quality);
  if (state.quality > 0 && state.quality < 1) {
    for (const field of ['cp', 'cv', 'speedOfSound', 'isobaricExpansion', 'isothermalCompressibility',
      'viscosity', 'thermalConductivity', 'dielectricConstant', 'ionizationConstant']) {
      report.checks++;
      if (state[field] !== null) fail('mixture null', context, { field, actual: state[field] });
    }
  }
}
function compare(actual, expected, context) {
  stateValid(actual, context);
  for (const field of ['pressure', 'temperature', 'enthalpy', 'entropy']) {
    close(field, actual[field], expected[field],
      Math.max(backwardConstraintTolerance(field, expected[field]), 5e-7), context);
  }
  close('specificVolume', actual.specificVolume, expected.specificVolume,
    Math.max(backwardSpecificVolumeTolerance(expected.specificVolume), 5e-7), context);
  close('quality', actual.quality ?? NaN, expected.quality, BACKWARD_REGION4_QUALITY_TOLERANCE, context);
  if (context.via === 'HS' && (expected.quality === 0 || expected.quality === 1)) {
    report.endpointMetadataChecks++;
    if (actual.quality !== expected.quality || actual.cp === null || actual.viscosity === null) {
      fail('HS endpoint metadata', context, {
        expectedQuality: expected.quality, actualQuality: actual.quality,
        cp: actual.cp, viscosity: actual.viscosity,
      });
    }
  }
}

// A second PT root witnesses ambiguity independently of the TH/TS candidate search.
const witnessCache = new Map();
function ambiguityWitness(state, property) {
  const key = state.temperature;
  let samples = witnessCache.get(key);
  if (!samples) {
    const pValues = new Set([P_MIN, 100]);
    for (let i = 0; i <= 160; i++) {
      pValues.add(P_MIN * (100 / P_MIN) ** (i / 160));
      pValues.add(100 * i / 160 || P_MIN);
    }
    for (const factor of [1 - 1e-8, 1 + 1e-8, 1 - 1e-6, 1 + 1e-6]) pValues.add(state.pressure * factor);
    samples = [...pValues].filter((p) => p >= P_MIN && p <= 100).sort((a, b) => a - b)
      .map((p) => solvePT(p, state.temperature));
    witnessCache.set(key, samples);
  }
  const target = state[property];
  const tolerance = property === 'enthalpy' ? 1e-9 : 1e-12;
  const distinct = (candidate) => Math.abs(candidate.pressure - state.pressure) > 1e-7 * Math.max(1, state.pressure)
    && Math.abs(candidate.specificVolume - state.specificVolume) > 1e-9 * state.specificVolume;
  for (let i = 1; i < samples.length; i++) {
    let a = samples[i - 1];
    let b = samples[i];
    if (a.region !== b.region || (a.pressure < state.pressure && b.pressure > state.pressure)) continue;
    let fa = a[property] - target;
    let fb = b[property] - target;
    if (fa * fb > 0) continue;
    for (let step = 0; step < 64; step++) {
      const p = (a.pressure + b.pressure) / 2;
      if (p === a.pressure || p === b.pressure) break;
      const candidate = solvePT(p, state.temperature);
      const residual = candidate[property] - target;
      if (Math.abs(residual) <= tolerance && distinct(candidate)) {
        return { pressure: candidate.pressure, specificVolume: candidate.specificVolume,
          property, actual: candidate[property], target, residual, region: candidate.region };
      }
      if (fa * residual <= 0) { b = candidate; fb = residual; }
      else { a = candidate; fa = residual; }
    }
  }
  return null;
}

const inverseSolvers = {
  PH: (state) => solvePH(state.pressure, state.enthalpy),
  PS: (state) => solvePS(state.pressure, state.entropy),
  HS: (state) => solveHS(state.enthalpy, state.entropy),
  TH: (state) => solveTH(state.temperature, state.enthalpy),
  TS: (state) => solveTS(state.temperature, state.entropy),
};
function scan(kind, value) {
  const baseContext = { source: kind, input: value };
  const fn = kind === 'Px' ? (x) => solvePx(value, x) : (x) => solveTx(value, x);
  const liquid = call(kind, { ...baseContext, x: 0 }, () => fn(0));
  const vapor = call(kind, { ...baseContext, x: 1 }, () => fn(1));
  if (!liquid || !vapor) return;
  for (const field of ['enthalpy', 'entropy', 'specificVolume']) {
    report.checks++;
    if (!(vapor[field] > liquid[field])) {
      fail('saturation phase ordering', baseContext, { field, liquid: liquid[field], vapor: vapor[field] });
    }
  }
  for (const x of qualities) {
    const context = { ...baseContext, x, T: liquid.temperature, p: liquid.pressure };
    const forward = x === 0 ? liquid : x === 1 ? vapor : call(kind, context, () => fn(x));
    if (!forward) continue;
    report.states++;
    stateValid(forward, context);
    close('forward quality', forward.quality, x, 1e-14, context);
    for (const field of ['enthalpy', 'entropy', 'internalEnergy', 'specificVolume']) {
      const expected = liquid[field] + x * (vapor[field] - liquid[field]);
      close(`mixture ${field}`, forward[field], expected, 1e-12 * Math.max(1, Math.abs(expected)), context);
    }
    const crossName = kind === 'Px' ? 'Tx' : 'Px';
    const crossed = call(crossName, { ...context, via: 'cross' }, () => kind === 'Px'
      ? solveTx(forward.temperature, x) : solvePx(forward.pressure, x));
    if (crossed) compare(crossed, forward, { ...context, via: 'cross' });
    for (const [name, solve] of Object.entries(inverseSolvers)) {
      report.calls[name] = (report.calls[name] ?? 0) + 1;
      const inverseContext = { ...context, via: name };
      const criticalExcluded = (name === 'TH' || name === 'TS')
        && Math.abs(forward.temperature - Tc) < CRITICAL_T_EXCLUSION_BAND;
      try {
        const backward = solve(forward);
        if (criticalExcluded) fail('missing critical rejection', inverseContext, backward);
        else {
          const seamAlternative = name === 'HS' && backward.region === Region.Region4 &&
            forward.quality > 0 && forward.quality < 1 && backward.quality > 0 && backward.quality < 1 &&
            (forward.temperature <= 623.15) !== (backward.temperature <= 623.15);
          const reconstructed = seamAlternative ? solveTx(backward.temperature, backward.quality) : null;
          if (reconstructed && Math.abs(reconstructed.enthalpy - forward.enthalpy) <= 1e-9 &&
              Math.abs(reconstructed.entropy - forward.entropy) <= 1e-12) {
            stateValid(backward, inverseContext);
            report.witnessedHSMultipleRoots.push({ ...inverseContext,
              source: { p: forward.pressure, T: forward.temperature, x: forward.quality,
                h: forward.enthalpy, s: forward.entropy },
              alternative: { p: reconstructed.pressure, T: reconstructed.temperature, x: reconstructed.quality,
                h: reconstructed.enthalpy, s: reconstructed.entropy },
            });
          } else compare(backward, forward, inverseContext);
        }
      } catch (error) {
        if (criticalExcluded && error instanceof IF97Error && /within 0\.001 K/.test(error.message)) {
          report.expectedCriticalRejections++;
        } else if ((name === 'TH' || name === 'TS') && error instanceof AmbiguousStateError) {
          let witness;
          try { witness = ambiguityWitness(forward, name === 'TH' ? 'enthalpy' : 'entropy'); }
          catch (witnessError) { fail('witness exception', inverseContext, witnessError.message); }
          if (witness) report.verifiedAmbiguities.push({ ...inverseContext, witness });
          else fail('unverified ambiguity', inverseContext, error.message);
        } else fail(`${name}:throw`, inverseContext, { name: error.name, message: error.message });
      }
    }
  }
}

for (const T of [...temperatures].sort((a, b) => a - b)) {
  const p = saturationPressure(T);
  const recovered = saturationTemperature(p);
  const tripleSnap = p === Pt && recovered === Tt
    && T >= saturationTemperature(Pt - REGION4_PRESSURE_TOLERANCE)
    && T <= saturationTemperature(Pt + REGION4_PRESSURE_TOLERANCE);
  const criticalSnap = p === Pc && recovered === Tc
    && T >= saturationTemperature(Pc - REGION4_PRESSURE_TOLERANCE) && T <= Tc;
  if (T !== recovered && (tripleSnap || criticalSnap)) {
    report.expectedInputSnaps.push({ T, p, recovered });
  } else close('saturation T inverse', recovered, T, 1e-8, { T, p });
  scan('Tx', T);
}
for (const p of [...pressures].sort((a, b) => a - b)) {
  const T = saturationTemperature(p);
  close('saturation p inverse', saturationPressure(T), p, 1e-8 * Math.max(1, p), { p, T });
  scan('Px', p);
}
for (const [name, fn] of [
  ['solvePx', () => solvePx(Pc, 0.5)], ['solveTx', () => solveTx(Tc, 0.5)],
  ['solvePx normalized critical', () => solvePx(Pc - REGION4_PRESSURE_TOLERANCE / 2, 0.5)],
  ['solveTx normalized critical', () => solveTx(Tc - REGION4_TEMPERATURE_TOLERANCE / 2, 0.5)],
]) {
  try { fn(); fail('missing critical rejection', { name }, 'returned a critical saturation state'); }
  catch (error) {
    if (error instanceof IF97Error && /critical point/.test(error.message)) report.expectedCriticalRejections++;
    else fail('wrong critical rejection', { name }, { name: error.name, message: error.message });
  }
}
report.elapsedSeconds = (Date.now() - started) / 1000;
const output = process.argv[2] ?? join(tmpdir(), `iapws-saturation-${process.version}.json`);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ node: report.node, states: report.states, checks: report.checks,
  calls: report.calls, verifiedAmbiguities: report.verifiedAmbiguities.length,
  witnessedHSMultipleRoots: report.witnessedHSMultipleRoots.length,
  numericalConsistencyRejections: report.numericalConsistencyRejections.length,
  expectedCriticalRejections: report.expectedCriticalRejections,
  endpointMetadataChecks: report.endpointMetadataChecks,
  unexpectedFailureCount: report.unexpectedFailureCount, failureGroups: report.failureGroups,
  elapsedSeconds: report.elapsedSeconds, report: output }, null, 2));
process.exitCode = report.unexpectedFailureCount ? 1 : 0;
