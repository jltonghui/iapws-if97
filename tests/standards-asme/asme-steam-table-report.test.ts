import { describe, expect, it } from 'vitest';
import { saturationTemperature, solvePx } from '../../src/index.js';
import { printGroupedReport, type ReportRow } from '../standards/reporting.js';

describe('ASME steam table comparison report', () => {
  it('prints a saturation-table comparison against ASME Table S-2', () => {
    // Source: ASME International Steam Tables for Industrial Use, 3rd ed.
    // Table S-2 "Properties of Saturated Water and Steam (Pressure)",
    // printed pages 61-63.
    const cases = [
      {
        caseId: 'S2 @ 0.01 MPa',
        p: 0.01,
        expected: {
          tC: 45.81,
          vL: 0.00101,
          vV: 14.671,
          hL: 191.81,
          hV: 2583.9,
          sL: 0.6492,
          sV: 8.1489,
        },
      },
      {
        caseId: 'S2 @ 0.10 MPa',
        p: 0.1,
        expected: {
          tC: 99.606,
          vL: 0.001043,
          vV: 1.6940,
          hL: 417.44,
          hV: 2674.9,
          sL: 1.3026,
          sV: 7.3588,
        },
      },
      {
        caseId: 'S2 @ 1.00 MPa',
        p: 1.0,
        expected: {
          tC: 179.886,
          vL: 0.001127,
          vV: 0.19435,
          hL: 762.68,
          hV: 2777.1,
          sL: 2.1384,
          sV: 6.5850,
        },
      },
      {
        caseId: 'S2 @ 5.0 MPa',
        p: 5.0,
        expected: {
          tC: 263.943,
          vL: 0.001286,
          vV: 0.039446,
          hL: 1154.5,
          hV: 2794.2,
          sL: 2.9207,
          sV: 5.9737,
        },
      },
      {
        caseId: 'S2 @ 10.0 MPa',
        p: 10.0,
        expected: {
          tC: 310.999,
          vL: 0.001453,
          vV: 0.018034,
          hL: 1407.9,
          hV: 2725.5,
          sL: 3.3603,
          sV: 5.6159,
        },
      },
      {
        caseId: 'S2 @ 20.0 MPa',
        p: 20.0,
        expected: {
          tC: 365.746,
          vL: 0.002039,
          vV: 0.0058583,
          hL: 1827.1,
          hV: 2411.4,
          sL: 4.0154,
          sV: 4.9299,
        },
      },
    ];

    const rows: ReportRow[] = [];

    for (const { caseId, p, expected } of cases) {
      const saturatedLiquid = solvePx(p, 0);
      const saturatedVapor = solvePx(p, 1);

      rows.push(
        { caseId, property: 't_sat_C', expected: expected.tC, actual: saturationTemperature(p) - 273.15 },
        { caseId, property: 'vL', expected: expected.vL, actual: saturatedLiquid.specificVolume },
        { caseId, property: 'vV', expected: expected.vV, actual: saturatedVapor.specificVolume },
        { caseId, property: 'hL', expected: expected.hL, actual: saturatedLiquid.enthalpy },
        { caseId, property: 'hV', expected: expected.hV, actual: saturatedVapor.enthalpy },
        { caseId, property: 'sL', expected: expected.sL, actual: saturatedLiquid.entropy },
        { caseId, property: 'sV', expected: expected.sV, actual: saturatedVapor.entropy },
      );
    }

    const maxRelativeError = printGroupedReport(
      'ASME Table S-2 saturation comparison',
      rows,
    );

    expect(maxRelativeError).toBeLessThan(5e-4);
  });
});
