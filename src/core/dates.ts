import type { ISODate } from './types';

const DAY_MS = 86_400_000;

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): ISODate {
  return toISODate(new Date());
}

/** Parsea YYYY-MM-DD como fecha local a mediodía, para que DST nunca cambie el día. */
export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / DAY_MS);
}

/** Lunes de la semana ISO que contiene la fecha. */
export function startOfWeek(iso: ISODate): ISODate {
  const d = parseISODate(iso);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  return addDays(iso, -dow);
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatShort(iso: ISODate): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function formatWeekday(iso: ISODate): string {
  return parseISODate(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
}
