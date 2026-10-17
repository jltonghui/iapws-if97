/** Public region-detection helper exports. */
import { uniqueFixedTemperatureState } from './backward/fixed-temperature-candidates.js';
import type { Region } from './types.js';
import { OutOfRangeError } from './types.js';

export { detectRegionPT } from './core/region-detector.js';
export { detectRegionPH, detectRegionPS } from './backward/pressure-property-region.js';
export { detectRegionHS } from './backward/hs-region.js';

/**
 * Detect the region only when T and h identify a unique physical state.
 * @returns Region number (1–5) or -1 if no valid state exists
 * @throws {AmbiguousStateError} if multiple physical states match, even in one region
 * @throws {IF97Error} if numerical state construction fails, including near-critical saturation endpoints
 */
export function detectRegionTH(T: number, h: number): Region | -1 {
  try {
    return uniqueFixedTemperatureState(T, h, 'enthalpy')?.region ?? -1;
  } catch (error) {
    if (error instanceof OutOfRangeError) return -1;
    throw error;
  }
}

/**
 * Detect the region only when T and s identify a unique physical state.
 * @returns Region number (1–5) or -1 if no valid state exists
 * @throws {AmbiguousStateError} if multiple physical states match, even in one region
 * @throws {IF97Error} if numerical state construction fails, including near-critical saturation endpoints
 */
export function detectRegionTS(T: number, s: number): Region | -1 {
  try {
    return uniqueFixedTemperatureState(T, s, 'entropy')?.region ?? -1;
  } catch (error) {
    if (error instanceof OutOfRangeError) return -1;
    throw error;
  }
}
