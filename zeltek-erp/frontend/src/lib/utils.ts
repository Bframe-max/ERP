import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUSD(monto: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(monto);
}

export function formatNIO(monto: number): string {
  return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(monto);
}

// Todo el sistema opera en la zona horaria de Nicaragua (UTC-6), sin importar
// la zona del navegador/SO donde corra — evita fechas "adelantadas".
export const TIMEZONE_NI = 'America/Managua';

export function formatFecha(fecha: string | Date): string {
  return new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TIMEZONE_NI }).format(new Date(fecha));
}

export function formatFechaHora(fecha: string | Date): string {
  return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short', timeZone: TIMEZONE_NI }).format(new Date(fecha));
}

// Devuelve "hoy" como YYYY-MM-DD según la hora de Nicaragua (no UTC), para
// usar como valor por defecto en inputs de fecha.
export function hoyNI(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE_NI, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// Primer día del mes actual (según Nicaragua) como YYYY-MM-DD.
export function primerDiaMesNI(): string {
  return `${hoyNI().slice(0, 7)}-01`;
}
