import { describe, expect, it } from 'vitest';
import { B23_T_MAX, P_MIN, R2_T_MAX } from '../../src/constants.js';
import { detectRegionHS } from '../../src/detect.js';
import { IF97Error, Region, solve, solveHS, solvePT, type SteamState } from '../../src/index.js';
import { solveRegion3PTBasic } from '../../src/core/region3-pt.js';
import { region2 } from '../../src/regions/region2.js';
import { expectBackwardValue } from '../helpers/backward-assertions.js';

const reportedInputs = [
  { h: 2750, s: 4 },
  { h: 2700, s: 3.8 },
  { h: 3300, s: 5.4 },
  { h: 3918, s: 6.5 },
];
const routes = [
  { name: 'solveHS', run: solveHS },
  { name: 'solve', run: (h: number, s: number) => solve({ mode: 'HS', h, s }) },
];
const b23Bits = new BigUint64Array(new Float64Array([B23_T_MAX]).buffer);
b23Bits[0] += 1n;
const firstTemperatureAboveB23 = new Float64Array(b23Bits.buffer)[0];

function expectReconstruction(recovered: SteamState, forward: SteamState): void {
  const checked = solvePT(recovered.pressure, recovered.temperature);
  expectBackwardValue(checked.enthalpy, forward.enthalpy, 'enthalpy', 1e-6);
  expectBackwardValue(checked.entropy, forward.entropy, 'entropy', 1e-9);
}

describe('HS upper envelope', () => {
  it.each(reportedInputs)('rejects the reported input h=$h, s=$s in detection', ({ h, s }) => {
    expect(detectRegionHS(h, s)).toBe(-1);
  });

  describe.each(routes)('$name', ({ run }) => {
    it.each(reportedInputs)('rejects h=$h, s=$s before numerical refinement', ({ h, s }) => {
      expect(() => run(h, s)).toThrow(IF97Error);
      expect(() => run(h, s)).toThrow(/^Cannot determine region for h=/);
    });
  });

  it.each([
    { zone: '2', p: 100, T: 650 },
    { zone: '3', p: 100, T: 700 },
    { zone: '4', p: 100, T: 802.35 },
    { zone: '5, Region 3 ceiling', p: 100, T: 860 },
    { zone: '5, Region 2 ceiling', p: 100, T: 865 },
    { zone: '6', p: 100, T: 916.9086 },
    { zone: '7', p: 100, T: 1040 },
    { zone: '8', p: 80, T: R2_T_MAX },
    { zone: '8', p: 60, T: R2_T_MAX },
  ])('rejects a 1e-7 kJ/kg excess above the native Zone $zone ceiling at p=$p, T=$T', ({ p, T }) => {
    const boundary = T < B23_T_MAX
      ? solveRegion3PTBasic(p, T)
      : region2(p, T);
    const h = boundary.enthalpy + 1e-7;
    expect(detectRegionHS(h, boundary.entropy)).toBe(-1);
    expect(() => solveHS(h, boundary.entropy)).toThrow(/^Cannot determine region for h=/);
  });

  it.each([
    623.150001, 650, 700, 802.35, 855, 860, B23_T_MAX,
    firstTemperatureAboveB23, 865, 916.9086, 986.35, 1040, R2_T_MAX,
  ])('round-trips the public closed 100 MPa ceiling at T=%s K', (T) => {
    const forward = solvePT(100, T);
    expect(detectRegionHS(forward.enthalpy, forward.entropy)).not.toBe(-1);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure');
    expectBackwardValue(recovered.temperature, forward.temperature, 'temperature');
    expectReconstruction(recovered, forward);
  });

  it('preserves a physical alternative in the native Region 3/2 upper seam overlap', () => {
    const forward = solvePT(100, B23_T_MAX - 1e-6);
    expect(detectRegionHS(forward.enthalpy, forward.entropy)).not.toBe(-1);
    expectReconstruction(solveHS(forward.enthalpy, forward.entropy), forward);
  });

  it.each([100, 80, 60, 50, 4, P_MIN])('round-trips the public closed 1073.15 K ceiling at p=%s MPa', (p) => {
    const forward = solvePT(p, R2_T_MAX);
    const recovered = solveHS(forward.enthalpy, forward.entropy);
    expectBackwardValue(recovered.pressure, forward.pressure, 'pressure');
    expectBackwardValue(recovered.temperature, forward.temperature, 'temperature');
    expectReconstruction(recovered, forward);
  });

  it.each([
    { p: 0.001, T: R2_T_MAX + 1e-8 },
    { p: 1, T: R2_T_MAX + 1e-8 },
    { p: 30, T: R2_T_MAX + 1e-8 },
    { p: 50, T: R2_T_MAX + 1e-8 },
    { p: 0.5, T: 1500 },
    { p: 25, T: 2161.15 },
  ])('keeps a physical Region 5 state reconstructible at p=$p, T=$T', ({ p, T }) => {
    const forward = solvePT(p, T);
    expect(detectRegionHS(forward.enthalpy, forward.entropy)).not.toBe(-1);
    expectReconstruction(solveHS(forward.enthalpy, forward.entropy), forward);
  });

  it.each([0.7890307761728763, 23.856756016612053])(
    'preserves a Region 5 input inside the existing Region 2 seam comparison window at p=%s',
    (p) => {
      const forward = solvePT(p, R2_T_MAX + 1e-7);
      expect(forward.region).toBe(Region.Region5);
      expect(detectRegionHS(forward.enthalpy, forward.entropy)).toBe(Region.Region2);
      const recovered = solveHS(forward.enthalpy, forward.entropy);
      const checked = solvePT(recovered.pressure, recovered.temperature);
      expectBackwardValue(checked.enthalpy, forward.enthalpy, 'enthalpy', 5e-7);
      expectBackwardValue(checked.entropy, forward.entropy, 'entropy', 1e-9);
    },
  );
});
