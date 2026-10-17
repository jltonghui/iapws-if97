import { describe, expect, it } from 'vitest';
import {
  b2bc_H_P,
  b3ab_P_to_H,
  r1BackwardT as r1TemperaturePH,
  r2BackwardT as r2TemperaturePH,
  r3BackwardPHInitial,
} from '../../src/backward/ph.js';
import {
  r1BackwardT as r1TemperaturePS,
  r2BackwardT as r2TemperaturePS,
  r3BackwardPSInitial,
} from '../../src/backward/ps.js';
import {
  b2abBoundary,
  r1Phs,
  r2aPhs,
  r2bPhs,
  r2cPhs,
  r3aPhs,
  r3bPhs,
} from '../../src/backward/hs-state.js';
import {
  backward2cPhs,
  h1Sat,
  h13Boundary,
  h2abSat,
  h2c3bSat,
  h3aSat,
  tB23hs,
} from '../../src/backward/hs-region.js';
import { boundary23_P_to_T, boundary23_T_to_P } from '../../src/regions/boundaries.js';
import { region4BackwardTemperatureHS } from '../../src/saturation/region4-hs.js';

// Published values are rounded; verify raw correlations with relative error, before EOS refinement.
function expectCheckValue(actual: number, expected: number): void {
  expect(Math.abs((actual - expected) / expected)).toBeLessThanOrEqual(1e-8);
}

// https://iapws.org/technical-guidance/release/IF97-Rev.download
describe('IF97 raw backward check values', () => {
  it.each([
    { p: 3, h: 500, T: 391.798509 },
    { p: 80, h: 500, T: 378.108626 },
    { p: 80, h: 1500, T: 611.041229 },
  ])('Table 7, R1 T(p,h): p=$p, h=$h', ({ p, h, T }) => {
    expectCheckValue(r1TemperaturePH(p, h), T);
  });

  it.each([
    { p: 3, s: 0.5, T: 307.842258 },
    { p: 80, s: 0.5, T: 309.979785 },
    { p: 80, s: 3, T: 565.899909 },
  ])('Table 9, R1 T(p,s): p=$p, s=$s', ({ p, s, T }) => {
    expectCheckValue(r1TemperaturePS(p, s), T);
  });

  it.each([
    { subregion: '2a', p: 0.001, h: 3000, T: 534.433241 },
    { subregion: '2a', p: 3, h: 3000, T: 575.373370 },
    { subregion: '2a', p: 3, h: 4000, T: 1010.77577 },
    { subregion: '2b', p: 5, h: 3500, T: 801.299102 },
    { subregion: '2b', p: 5, h: 4000, T: 1015.31583 },
    { subregion: '2b', p: 25, h: 3500, T: 875.279054 },
    { subregion: '2c', p: 40, h: 2700, T: 743.056411 },
    { subregion: '2c', p: 60, h: 2700, T: 791.137067 },
    { subregion: '2c', p: 60, h: 3200, T: 882.756860 },
  ])('Table 24, R$subregion T(p,h): p=$p, h=$h', ({ p, h, T }) => {
    expectCheckValue(r2TemperaturePH(p, h), T);
  });

  it.each([
    { subregion: '2a', p: 0.1, s: 7.5, T: 399.517097 },
    { subregion: '2a', p: 0.1, s: 8, T: 514.127081 },
    { subregion: '2a', p: 2.5, s: 8, T: 1039.84917 },
    { subregion: '2b', p: 8, s: 6, T: 600.484040 },
    { subregion: '2b', p: 8, s: 7.5, T: 1064.95556 },
    { subregion: '2b', p: 90, s: 6, T: 1038.01126 },
    { subregion: '2c', p: 20, s: 5.75, T: 697.992849 },
    { subregion: '2c', p: 80, s: 5.25, T: 854.011484 },
    { subregion: '2c', p: 80, s: 5.75, T: 949.017998 },
  ])('Table 29, R$subregion T(p,s): p=$p, s=$s', ({ p, s, T }) => {
    expectCheckValue(r2TemperaturePS(p, s), T);
  });

  it('reproduces the B23 and B2bc verification points, Eqs. 5, 6 and 20', () => {
    expectCheckValue(boundary23_T_to_P(623.15), 16.5291643);
    expectCheckValue(boundary23_P_to_T(16.5291643), 623.15);
    expectCheckValue(b2bc_H_P(3516.004323), 100);
  });
});

// https://iapws.org/technical-guidance/release/Supp-PHS12-2014.download
describe('SR2-01(2014) raw p(h,s) check values', () => {
  it.each([
    { h: 0.001, s: 0, p: 9.800980612e-4 },
    { h: 90, s: 0, p: 91.92954727 },
    { h: 1500, s: 3.4, p: 58.68294423 },
  ])('Table 3, R1: h=$h, s=$s', ({ h, s, p }) => {
    expectCheckValue(r1Phs(h, s), p);
  });

  for (const { subregion, pressure, cases } of [
    { subregion: '2a', pressure: r2aPhs, cases: [
      { h: 2800, s: 6.5, p: 1.371012767 },
      { h: 2800, s: 9.5, p: 1.879743844e-3 },
      { h: 4100, s: 9.5, p: 0.1024788997 },
    ] },
    { subregion: '2b', pressure: r2bPhs, cases: [
      { h: 2800, s: 6, p: 4.793911442 },
      { h: 3600, s: 6, p: 83.95519209 },
      { h: 3600, s: 7, p: 7.527161441 },
    ] },
    { subregion: '2c', pressure: r2cPhs, cases: [
      { h: 2800, s: 5.1, p: 94.39202060 },
      { h: 2800, s: 5.8, p: 8.414574124 },
      { h: 3400, s: 5.8, p: 83.76903879 },
    ] },
  ]) {
    it.each(cases)(`Table 9, R${subregion}: h=$h, s=$s`, ({ h, s, p }) => {
      expectCheckValue(pressure(h, s), p);
      if (subregion === '2c') expectCheckValue(backward2cPhs(h, s), p);
    });
  }

  it('reproduces the h2ab(s) verification point, Eq. 2', () => {
    expectCheckValue(b2abBoundary(7), 3376.437884);
  });
});

// https://iapws.org/technical-guidance/release/Supp-Tv-ph-ps-3-2014.download
describe('SR3-03(2014) raw Region 3 backward check values', () => {
  it.each([
    { subregion: '3a', p: 20, h: 1700, T: 629.3083892, v: 1.749903962e-3 },
    { subregion: '3a', p: 50, h: 2000, T: 690.5718338, v: 1.908139035e-3 },
    { subregion: '3a', p: 100, h: 2100, T: 733.6163014, v: 1.676229776e-3 },
    { subregion: '3b', p: 20, h: 2500, T: 641.8418053, v: 6.670547043e-3 },
    { subregion: '3b', p: 50, h: 2400, T: 735.1848618, v: 2.801244590e-3 },
    { subregion: '3b', p: 100, h: 2700, T: 842.0460876, v: 2.404234998e-3 },
  ])('Tables 5 and 8, R$subregion T/v(p,h): p=$p, h=$h', ({ p, h, T, v }) => {
    const initial = r3BackwardPHInitial(p, h);
    expectCheckValue(initial.T, T);
    expectCheckValue(1 / initial.rho, v);
  });

  it.each([
    { subregion: '3a', p: 20, s: 3.8, T: 628.2959869, v: 1.733791463e-3 },
    { subregion: '3a', p: 50, s: 3.6, T: 629.7158726, v: 1.469680170e-3 },
    { subregion: '3a', p: 100, s: 4, T: 705.6880237, v: 1.555893131e-3 },
    { subregion: '3b', p: 20, s: 5, T: 640.1176443, v: 6.262101987e-3 },
    { subregion: '3b', p: 50, s: 4.5, T: 716.3687517, v: 2.332634294e-3 },
    { subregion: '3b', p: 100, s: 5, T: 847.4332825, v: 2.449610757e-3 },
  ])('Tables 12 and 15, R$subregion T/v(p,s): p=$p, s=$s', ({ p, s, T, v }) => {
    const initial = r3BackwardPSInitial(p, s);
    expectCheckValue(initial.T, T);
    expectCheckValue(1 / initial.rho, v);
  });

  it('reproduces the h3ab(p) verification point, Eq. 1', () => {
    expectCheckValue(b3ab_P_to_H(25), 2095.936454);
  });
});

// https://iapws.org/technical-guidance/release/Supp-phs3-2014.download
describe('SR4-04(2014) raw p(h,s), boundary and Tsat(h,s) check values', () => {
  for (const { subregion, pressure, cases } of [
    { subregion: '3a', pressure: r3aPhs, cases: [
      { h: 1700, s: 3.8, p: 25.55703246 },
      { h: 2000, s: 4.2, p: 45.40873468 },
      { h: 2100, s: 4.3, p: 60.78123340 },
    ] },
    { subregion: '3b', pressure: r3bPhs, cases: [
      { h: 2600, s: 5.1, p: 34.34999263 },
      { h: 2400, s: 4.7, p: 63.63924887 },
      { h: 2700, s: 5, p: 88.39043281 },
    ] },
  ]) {
    it.each(cases)(`Table 5, R${subregion} p(h,s): h=$h, s=$s`, ({ h, s, p }) => {
      expectCheckValue(pressure(h, s), p);
    });
  }

  for (const { table, equation, enthalpy, cases } of [
    { table: 11, equation: 'h1Sat', enthalpy: h1Sat, cases: [
      { s: 1, h: 308.5509647 },
      { s: 2, h: 700.6304472 },
      { s: 3, h: 1198.359754 },
    ] },
    { table: 11, equation: 'h3aSat', enthalpy: h3aSat, cases: [
      { s: 3.8, h: 1685.025565 },
      { s: 4, h: 1816.891476 },
      { s: 4.2, h: 1949.352563 },
    ] },
    { table: 18, equation: 'h2abSat', enthalpy: h2abSat, cases: [
      { s: 7, h: 2723.729985 },
      { s: 8, h: 2599.047210 },
      { s: 9, h: 2511.861477 },
    ] },
    { table: 18, equation: 'h2c3bSat', enthalpy: h2c3bSat, cases: [
      { s: 5.5, h: 2687.693850 },
      { s: 5, h: 2451.623609 },
      { s: 4.5, h: 2144.360448 },
    ] },
    { table: 24, equation: 'h13Boundary', enthalpy: h13Boundary, cases: [
      { s: 3.7, h: 1632.525047 },
      { s: 3.6, h: 1593.027214 },
      { s: 3.5, h: 1566.104611 },
    ] },
  ]) {
    it.each(cases)(`Table ${table}, ${equation}(s): s=$s`, ({ s, h }) => {
      expectCheckValue(enthalpy(s), h);
    });
  }

  it.each([
    { h: 2600, s: 5.1, T: 713.5259364 },
    { h: 2700, s: 5.15, T: 768.5345532 },
    { h: 2800, s: 5.2, T: 817.6202120 },
  ])('Table 26, TB23(h,s): h=$h, s=$s', ({ h, s, T }) => {
    expectCheckValue(tB23hs(h, s), T);
  });

  it.each([
    { h: 1800, s: 5.3, T: 346.8475498 },
    { h: 2400, s: 6, T: 425.1373305 },
    { h: 2500, s: 5.5, T: 522.5579013 },
  ])('Table 29, Tsat(h,s): h=$h, s=$s', ({ h, s, T }) => {
    expectCheckValue(region4BackwardTemperatureHS(h, s), T);
  });
});
