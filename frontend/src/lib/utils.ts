import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * `fecha` llega como medianoche UTC del día elegido (ej. "2026-03-01T00:00:00.000Z").
 * `new Date()` la convertiría a hora de Chile y mostraría el día anterior,
 * así que se toma solo la parte YYYY-MM-DD y se construye como fecha local.
 */
export function parseServiceDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}
