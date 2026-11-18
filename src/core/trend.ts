import { daysBetween } from './dates';
import type { ISODate } from './types';

export interface DatedValue {
  date: ISODate;
  value: number;
}

/**
 * Media móvil exponencial con ventana N días, tolerante a huecos.
 *
 *   α = 2 / (N + 1)                      (N = 7 → α = 0.25)
 *   EMA_t = EMA_{t-1} + α_eff · (x_t − EMA_{t-1})
 *   α_eff = 1 − (1 − α)^Δ                (Δ = días desde la última medida)
 *
 * Con pesajes diarios Δ = 1 y α_eff = α. Si te saltas días, α_eff crece y la medida nueva
 * pesa más, como si la media hubiera "decaído" un paso por cada día sin datos.
 */
export function emaTrend(points: readonly DatedValue[], spanDays = 7): DatedValue[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const alpha = 2 / (spanDays + 1);
  const out: DatedValue[] = [];
  let prev: DatedValue | undefined;
  for (const p of sorted) {
    if (!prev) {
      prev = { date: p.date, value: p.value };
    } else {
      const gap = Math.max(1, daysBetween(prev.date, p.date));
      const a = 1 - Math.pow(1 - alpha, gap);
      prev = { date: p.date, value: prev.value + a * (p.value - prev.value) };
    }
    out.push({ date: prev.date, value: Math.round(prev.value * 100) / 100 });
  }
  return out;
}

/**
 * Pendiente por mínimos cuadrados (unidades/día):
 *   m = Σ(xᵢ − x̄)(yᵢ − ȳ) / Σ(xᵢ − x̄)²
 * con x = días desde la primera medida. Multiplicada por 7 da kg/semana.
 */
export function linearSlope(points: readonly DatedValue[]): number {
  if (points.length < 2) return 0;
  const first = points[0]!.date;
  const xs = points.map((p) => daysBetween(first, p.date));
  const ys = points.map((p) => p.value);
  const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const yMean = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - xMean) * (ys[i]! - yMean);
    den += (xs[i]! - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function weeklyRate(points: readonly DatedValue[]): number {
  return Math.round(linearSlope(points) * 7 * 100) / 100;
}
