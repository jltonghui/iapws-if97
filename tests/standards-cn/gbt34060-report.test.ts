import { describe, expect, it } from 'vitest';
import { solvePT } from '../../src/index.js';
import { printGroupedReport, type ReportRow } from '../standards/reporting.js';

describe('GB/T 34060-2017 comparison report', () => {
  it('prints a superheated-steam comparison against GB/T 34060-2017 Table A.3', () => {
    // Source: GB/T 34060-2017 蒸汽热量计算方法
    // 表 A.3(续), printed page 55, p = 10 MPa.
    const cases = [
      {
        caseId: 'A.3 @ 10 MPa, 350 C',
        p: 10,
        tC: 350,
        expected: {
          v: 0.0224422,
          h: 2923.96,
          s: 5.9458,
          w: 534.45,
        },
      },
      {
        caseId: 'A.3 @ 10 MPa, 400 C',
        p: 10,
        tC: 400,
        expected: {
          v: 0.0264393,
          h: 3097.38,
          s: 6.2139,
          w: 582.04,
        },
      },
      {
        caseId: 'A.3 @ 10 MPa, 500 C',
        p: 10,
        tC: 500,
        expected: {
          v: 0.0328129,
          h: 3375.06,
          s: 6.5993,
          w: 647.89,
        },
      },
      {
        caseId: 'A.3 @ 10 MPa, 600 C',
        p: 10,
        tC: 600,
        expected: {
          v: 0.0383775,
          h: 3625.84,
          s: 6.9045,
          w: 698.54,
        },
      },
      {
        caseId: 'A.3 @ 10 MPa, 700 C',
        p: 10,
        tC: 700,
        expected: {
          v: 0.0435944,
          h: 3870.27,
          s: 7.1696,
          w: 742.03,
        },
      },
      {
        caseId: 'A.3 @ 10 MPa, 800 C',
        p: 10,
        tC: 800,
        expected: {
          v: 0.0486242,
          h: 4114.73,
          s: 7.4087,
          w: 781.12,
        },
      },
    ];

    const rows: ReportRow[] = [];

    for (const { caseId, p, tC, expected } of cases) {
      const state = solvePT(p, tC + 273.15);
      rows.push(
        { caseId, property: 'v', expected: expected.v, actual: state.specificVolume },
        { caseId, property: 'h', expected: expected.h, actual: state.enthalpy },
        { caseId, property: 's', expected: expected.s, actual: state.entropy },
        { caseId, property: 'w', expected: expected.w, actual: state.speedOfSound },
      );
    }

    const maxRelativeError = printGroupedReport(
      'GB/T 34060-2017 Table A.3 superheated-steam comparison',
      rows,
    );

    expect(maxRelativeError).toBeLessThan(5e-4);
  });
});
