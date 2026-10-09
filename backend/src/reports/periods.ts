/**
 * Períodos del informe mensual. Cada institución tiene su día de inicio
 * (`Company.periodStartDay`, 1–28): con 13, el período va del 13 de un mes al 12
 * del siguiente; con 1, coincide con el mes calendario.
 *
 * Todas las fechas son medianoche UTC, igual que `Service.fecha`, y se intercambian
 * como 'YYYY-MM-DD'.
 */

export interface Period {
  from: string; // primer día, inclusive
  to: string; // último día, inclusive
}

const DAY_MS = 86_400_000;

export const toYmd = (d: Date): string => d.toISOString().slice(0, 10);

export const parseYmd = (ymd: string): Date => new Date(`${ymd}T00:00:00.000Z`);

function periodStartingAt(year: number, month: number, startDay: number): Period {
  const from = new Date(Date.UTC(year, month, startDay));
  const nextFrom = new Date(Date.UTC(year, month + 1, startDay));
  return { from: toYmd(from), to: toYmd(new Date(nextFrom.getTime() - DAY_MS)) };
}

/** Período que contiene la fecha dada. */
export function periodContaining(date: Date, startDay: number): Period {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return date.getUTCDate() >= startDay
    ? periodStartingAt(y, m, startDay)
    : periodStartingAt(y, m - 1, startDay);
}

/** Período actual y los anteriores (el más reciente primero). */
export function recentPeriods(today: Date, startDay: number, count = 12): Period[] {
  const current = parseYmd(periodContaining(today, startDay).from);
  return Array.from({ length: count }, (_, i) =>
    periodStartingAt(current.getUTCFullYear(), current.getUTCMonth() - i, startDay),
  );
}

/** Período que empieza en `from`; null si `from` no coincide con el día de inicio. */
export function periodFrom(from: string, startDay: number): Period | null {
  const d = parseYmd(from);
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== startDay) return null;
  return periodStartingAt(d.getUTCFullYear(), d.getUTCMonth(), startDay);
}
