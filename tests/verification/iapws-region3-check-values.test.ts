import { describe, expect, it } from 'vitest';
import {
  b3ab, b3cd, b3ef, b3gh, b3ij, b3jk, b3mn, b3op, b3qu, b3rx, b3uv, b3wx,
} from '../../src/regions/boundaries.js';
import { REGION3_SUBREGIONS } from '../../src/regions/region3-data.js';
import { evalSubregion } from '../../src/regions/region3-eval.js';
import { region3Volume } from '../../src/regions/region3-subregions.js';

// IAPWS SR5-05(2016), Tables 3, 5, 11 and 13. Units: MPa, K, m³/kg.
// https://iapws.org/technical-guidance/release/Supp-VPT3-2016.download
const volumeCases = [
  { subregion: 'A', p: 50, T: 630, v: 1.470853100e-3 },
  { subregion: 'A', p: 80, T: 670, v: 1.503831359e-3 },
  { subregion: 'B', p: 50, T: 710, v: 2.204728587e-3 },
  { subregion: 'B', p: 80, T: 750, v: 1.973692940e-3 },
  { subregion: 'C', p: 20, T: 630, v: 1.761696406e-3 },
  { subregion: 'C', p: 30, T: 650, v: 1.819560617e-3 },
  { subregion: 'D', p: 26, T: 656, v: 2.245587720e-3 },
  { subregion: 'D', p: 30, T: 670, v: 2.506897702e-3 },
  { subregion: 'E', p: 26, T: 661, v: 2.970225962e-3 },
  { subregion: 'E', p: 30, T: 675, v: 3.004627086e-3 },
  { subregion: 'F', p: 26, T: 671, v: 5.019029401e-3 },
  { subregion: 'F', p: 30, T: 690, v: 4.656470142e-3 },
  { subregion: 'G', p: 23.6, T: 649, v: 2.163198378e-3 },
  { subregion: 'G', p: 24, T: 650, v: 2.166044161e-3 },
  { subregion: 'H', p: 23.6, T: 652, v: 2.651081407e-3 },
  { subregion: 'H', p: 24, T: 654, v: 2.967802335e-3 },
  { subregion: 'I', p: 23.6, T: 653, v: 3.273916816e-3 },
  { subregion: 'I', p: 24, T: 655, v: 3.550329864e-3 },
  { subregion: 'J', p: 23.5, T: 655, v: 4.545001142e-3 },
  { subregion: 'J', p: 24, T: 660, v: 5.100267704e-3 },
  { subregion: 'K', p: 23, T: 660, v: 6.109525997e-3 },
  { subregion: 'K', p: 24, T: 670, v: 6.427325645e-3 },
  { subregion: 'L', p: 22.6, T: 646, v: 2.117860851e-3 },
  { subregion: 'L', p: 23, T: 646, v: 2.062374674e-3 },
  { subregion: 'M', p: 22.6, T: 648.6, v: 2.533063780e-3 },
  { subregion: 'M', p: 22.8, T: 649.3, v: 2.572971781e-3 },
  { subregion: 'N', p: 22.6, T: 649, v: 2.923432711e-3 },
  { subregion: 'N', p: 22.8, T: 649.7, v: 2.913311494e-3 },
  { subregion: 'O', p: 22.6, T: 649.1, v: 3.131208996e-3 },
  { subregion: 'O', p: 22.8, T: 649.9, v: 3.221160278e-3 },
  { subregion: 'P', p: 22.6, T: 649.4, v: 3.715596186e-3 },
  { subregion: 'P', p: 22.8, T: 650.2, v: 3.664754790e-3 },
  { subregion: 'Q', p: 21.1, T: 640, v: 1.970999272e-3 },
  { subregion: 'Q', p: 21.8, T: 643, v: 2.043919161e-3 },
  { subregion: 'R', p: 21.1, T: 644, v: 5.251009921e-3 },
  { subregion: 'R', p: 21.8, T: 648, v: 5.256844741e-3 },
  { subregion: 'S', p: 19.1, T: 635, v: 1.932829079e-3 },
  { subregion: 'S', p: 20, T: 638, v: 1.985387227e-3 },
  { subregion: 'T', p: 17, T: 626, v: 8.483262001e-3 },
  { subregion: 'T', p: 20, T: 640, v: 6.227528101e-3 },
  { subregion: 'U', p: 21.5, T: 644.6, v: 2.268366647e-3 },
  { subregion: 'U', p: 22, T: 646.1, v: 2.296350553e-3 },
  { subregion: 'V', p: 22.5, T: 648.6, v: 2.832373260e-3 },
  { subregion: 'V', p: 22.3, T: 647.9, v: 2.811424405e-3 },
  { subregion: 'W', p: 22.15, T: 647.5, v: 3.694032281e-3 },
  { subregion: 'W', p: 22.3, T: 648.1, v: 3.622226305e-3 },
  { subregion: 'X', p: 22.11, T: 648, v: 4.528072649e-3 },
  { subregion: 'X', p: 22.3, T: 649, v: 4.556905799e-3 },
  { subregion: 'Y', p: 22, T: 646.84, v: 2.698354719e-3 },
  { subregion: 'Y', p: 22.064, T: 647.05, v: 2.717655648e-3 },
  { subregion: 'Z', p: 22, T: 646.89, v: 3.798732962e-3 },
  { subregion: 'Z', p: 22.064, T: 647.15, v: 3.701940010e-3 },
] as const;

describe('IAPWS SR5-05(2016) Region 3 verification values', () => {
  it.each(volumeCases)('3$subregion at p=$p MPa, T=$T K', ({ subregion, p, T, v }) => {
    const direct = evalSubregion(REGION3_SUBREGIONS[subregion], p, T);
    expect(Math.abs((direct - v) / v), 'direct subregion equation').toBeLessThanOrEqual(1e-8);
    expect(Math.abs((region3Volume(p, T) - v) / v), 'subregion dispatcher').toBeLessThanOrEqual(1e-8);
  });

  it.each([
    { boundary: '3ab', equation: b3ab, p: 40, T: 6.930341408e2 },
    { boundary: '3cd', equation: b3cd, p: 25, T: 6.493659208e2 },
    { boundary: '3ef', equation: b3ef, p: 40, T: 7.139593992e2 },
    { boundary: '3gh', equation: b3gh, p: 23, T: 6.498873759e2 },
    { boundary: '3ij', equation: b3ij, p: 23, T: 6.515778091e2 },
    { boundary: '3jk', equation: b3jk, p: 23, T: 6.558338344e2 },
    { boundary: '3mn', equation: b3mn, p: 22.8, T: 6.496054133e2 },
    { boundary: '3op', equation: b3op, p: 22.8, T: 6.500106943e2 },
    { boundary: '3qu', equation: b3qu, p: 22, T: 6.456355027e2 },
    { boundary: '3rx', equation: b3rx, p: 22, T: 6.482622754e2 },
    { boundary: '3uv', equation: b3uv, p: 22.3, T: 6.477996121e2 },
    { boundary: '3wx', equation: b3wx, p: 22.3, T: 6.482049480e2 },
  ])('$boundary boundary at p=$p MPa', ({ equation, p, T }) => {
    expect(Math.abs((equation(p) - T) / T)).toBeLessThanOrEqual(1e-8);
  });
});
