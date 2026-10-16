import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Region, solvePT } from 'iapws-if97';
import { viscosity } from 'iapws-if97/transport';
import { region1 } from 'iapws-if97/regions';
import { saturationPressure } from 'iapws-if97/saturation';
import { boundary23_T_to_P } from 'iapws-if97/boundaries';
import { detectRegionPT } from 'iapws-if97/detect';

const state = solvePT(3, 300);
assert.equal(state.region, Region.Region1);
assert.ok(Math.abs(state.enthalpy - 115.331273) < 1e-6);
assert.ok(Math.abs(region1(3, 300).specificVolume - 0.00100215168) < 1e-11);
assert.ok(Math.abs(viscosity(298.15, 998) - 889.735100e-6) < 1e-12);
assert.ok(Math.abs(saturationPressure(300) - 0.00353658941) < 1e-11);
assert.ok(Math.abs(boundary23_T_to_P(623.15) - 16.5291642526) < 1e-9);
assert.equal(detectRegionPT(3, 300), Region.Region1);
assert.equal(createRequire(import.meta.url)('iapws-if97/package.json').name, 'iapws-if97');
