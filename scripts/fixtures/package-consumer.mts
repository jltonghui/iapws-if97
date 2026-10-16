import { solve, type BasicProperties, type Region, type SolveInput, type SteamState } from 'iapws-if97';
import { viscosity } from 'iapws-if97/transport';
import { region1 } from 'iapws-if97/regions';
import { saturationPressure } from 'iapws-if97/saturation';
import { boundary23_T_to_P } from 'iapws-if97/boundaries';
import { detectRegionPT } from 'iapws-if97/detect';

const input: SolveInput = { mode: 'PT', p: 3, T: 300 };
export const state: SteamState = solve(input);
export const primitive: BasicProperties = region1(3, 300);
export const dynamicViscosity: number = viscosity(298.15, 998);
export const saturation: number = saturationPressure(300);
export const boundary: number = boundary23_T_to_P(623.15);
export const detectedRegion: Region | -1 = detectRegionPT(3, 300);
