import * as C from '../constants.js';
import { IF97Error, OutOfRangeError } from '../types.js';

export function normalizeRegion4Pressure(p: number): number {
  if (p < C.P_MIN && C.P_MIN - p <= C.REGION4_PRESSURE_TOLERANCE * C.P_MIN) return C.P_MIN;
  if (p > C.Pc && p - C.Pc <= C.REGION4_PRESSURE_TOLERANCE * C.Pc) return C.Pc;
  return p;
}

export function normalizeRegion4Temperature(T: number): number {
  if (T < C.T_MIN && C.T_MIN - T <= C.REGION4_TEMPERATURE_TOLERANCE) return C.T_MIN;
  if (T > C.Tc && T - C.Tc <= C.REGION4_TEMPERATURE_TOLERANCE) return C.Tc;
  return T;
}

export function clampRegion4TemperatureBelowCritical(T: number): number {
  return Math.max(C.Tt, Math.min(T, C.Tc - C.REGION4_SUBCRITICAL_TEMPERATURE_MARGIN));
}

function isRegion4CriticalPressure(p: number): boolean {
  return normalizeRegion4Pressure(p) === C.Pc;
}

function isRegion4CriticalTemperature(T: number): boolean {
  return normalizeRegion4Temperature(T) === C.Tc;
}

function criticalPointMessage(solverName: string): string {
  return `${solverName} does not support the critical point P=${C.Pc} MPa, T=${C.Tc} K as a Region 4 saturation state`;
}

export function assertRegion4PressureStateInput(p: number, solverName: string): number {
  const pressure = p < C.Pt && C.Pt - p <= 8 * Number.EPSILON * C.Pt ? C.Pt : normalizeRegion4Pressure(p);
  if (pressure < C.Pt || pressure > C.Pc) {
    throw new OutOfRangeError('Pressure', p, C.Pt, C.Pc);
  }
  if (pressure === C.Pc) {
    throw new IF97Error(criticalPointMessage(solverName));
  }
  return pressure;
}

export function assertRegion4TemperatureStateInput(T: number, solverName: string): number {
  const temperature = T < C.Tt && C.Tt - T <= 8 * Number.EPSILON * C.Tt ? C.Tt : normalizeRegion4Temperature(T);
  if (temperature < C.Tt || temperature > C.Tc) {
    const error = new OutOfRangeError('Temperature', T, C.Tt, C.Tc);
    if (temperature < C.Tt) {
      error.message += `; ${solverName} saturation states start at the triple point (${C.Tt} K). 0 °C = 273.15 K is 0.01 K lower; low-level saturationPressure accepts 273.15 K.`;
    }
    throw error;
  }
  if (temperature === C.Tc) {
    throw new IF97Error(criticalPointMessage(solverName));
  }
  return temperature;
}

export function assertRegion4StateAllowed(
  pressure: number,
  temperature: number,
  solverName: string,
): void {
  if (isRegion4CriticalPressure(pressure) || isRegion4CriticalTemperature(temperature)) {
    throw new IF97Error(criticalPointMessage(solverName));
  }
}

function isCriticalRegion4Enthalpy(h: number): boolean {
  return Math.abs(h - C.R3_H_CRT) <= C.REGION4_CRITICAL_HS_TOLERANCE;
}

function isCriticalRegion4Entropy(s: number): boolean {
  return Math.abs(s - C.R3_S_CRT) <= C.REGION4_CRITICAL_HS_TOLERANCE;
}

export function assertCriticalRegion4PHInput(p: number, h: number, solverName: string): void {
  if (isRegion4CriticalPressure(p) && isCriticalRegion4Enthalpy(h)) {
    throw new IF97Error(criticalPointMessage(solverName));
  }
}

export function assertCriticalRegion4PSInput(p: number, s: number, solverName: string): void {
  if (isRegion4CriticalPressure(p) && isCriticalRegion4Entropy(s)) {
    throw new IF97Error(criticalPointMessage(solverName));
  }
}

export function assertCriticalRegion4HSInput(h: number, s: number, solverName: string): void {
  if (isCriticalRegion4Enthalpy(h) && isCriticalRegion4Entropy(s)) {
    throw new IF97Error(criticalPointMessage(solverName));
  }
}
