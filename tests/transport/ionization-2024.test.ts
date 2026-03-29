import { describe, expect, it } from 'vitest';
import { ionizationConstant } from '../../src/transport/properties.js';
import { expectDigitsClose } from '../assertions.js';

describe('ionizationConstant', () => {
  const cases = [
    { T: 300, rho: 1000, pKw: 13.906672 },
    { T: 600, rho: 70, pKw: 20.161651 },
    { T: 600, rho: 700, pKw: 11.147093 },
    { T: 800, rho: 200, pKw: 14.487671 },
    { T: 800, rho: 1200, pKw: 6.4058649 },
    { T: 1270, rho: 0, pKw: 35.081557 },
  ];

  for (const { T, rho, pKw } of cases) {
    it(`matches IAPWS R11-24 at T=${T} K, rho=${rho} kg/m^3`, () => {
      expectDigitsClose(ionizationConstant(T, rho)!, pKw, 6);
    });
  }
});
