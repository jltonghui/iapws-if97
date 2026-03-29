import * as C from '../constants.js';
import { IF97Error, OutOfRangeError } from '../types.js';

export function normalizeRegion4Pressure(p: number): number {
  if (Math.abs(p - C.P_MIN) <= C.REGION4_PRESSURE_TOLERANCE) return C.P_MIN;
  if (Math.abs(p - C.Pt) <= C.REGION4_PRESSURE_TOLERANCE) return C.Pt;
  if (Math.abs(p - C.Pc) <= C.REGION4_PRESSURE_TOLERANCE) return C.Pc;
  return p;
}

export function normalizeRegion4Temperature(T: number): number {
  if (Math.abs(T - C.T_MIN) <= C.REGION4_TEMPERATURE_TOLERANCE) return C.T_MIN;
  if (Math.abs(T - C.Tt) <= C.REGION4_TEMPERATURE_TOLERANCE) return C.Tt;
  if (Math.abs(T - C.Tc) <= C.REGION4_TEMPERATURE_TOLERANCE) return C.Tc;
  return T;
}

export function clampRegion4TemperatureBelowCritical(T: number): number {
  return Math.max(C.Tt, Math.min(T, C.Tc - C.REGION4_SUBCRITICAL_TEMPERATURE_MARGIN));
}

export function isRegion4CriticalPressure(p: number): boolean {
  return normalizeRegion4Pressure(p) === C.Pc;
}

export function isRegion4CriticalTemperature(T: number): boolean {
  return normalizeRegion4Temperature(T) === C.Tc;
}

function criticalPointMessage(solverName: string): string {
  return `${solverName} does not support the critical point P=${C.Pc} MPa, T=${C.Tc} K as a Region 4 saturation state`;
}

export function assertRegion4PressureStateInput(p: number, solverName: string): number {
  const pressure = normalizeRegion4Pressure(p);
  if (pressure < C.Pt || pressure > C.Pc) {
    throw new OutOfRangeError('Pressure', p, C.Pt, C.Pc);
  }
  if (pressure === C.Pc) {
    throw new IF97Error(criticalPointMessage(solverName));
  }
  return pressure;
}

export function assertRegion4TemperatureStateInput(T: number, solverName: string): number {
  const temperature = normalizeRegion4Temperature(T);
  if (temperature < C.Tt || temperature > C.Tc) {
    throw new OutOfRangeError('Temperature', T, C.Tt, C.Tc);
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

export function isCriticalRegion4Enthalpy(h: number): boolean {
  return Math.abs(h - C.R3_H_CRT) <= C.REGION4_CRITICAL_HS_TOLERANCE;
}

export function isCriticalRegion4Entropy(s: number): boolean {
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
