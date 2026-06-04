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

export function formatFecha(fecha: string | Date): string {
  return new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(fecha));
}
