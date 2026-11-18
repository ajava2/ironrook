import { describe, expect, it } from 'vitest';
import { emaTrend, linearSlope, weeklyRate } from '../../src/core/trend';

describe('emaTrend (7 días, α = 0.25)', () => {
  it('la primera medida siembra la media', () => {
    expect(emaTrend([{ date: '2026-10-01', value: 75 }])).toEqual([{ date: '2026-10-01', value: 75 }]);
  });

  it('aplica EMA_t = EMA_{t-1} + 0.25·(x − EMA_{t-1}) con pesajes diarios', () => {
    const out = emaTrend([
      { date: '2026-10-01', value: 75 },
      { date: '2026-10-02', value: 76 },
      { date: '2026-10-03', value: 74 },
    ]);
    // 75 → 75 + 0.25·1 = 75.25 → 75.25 + 0.25·(74 − 75.25) = 74.9375
    expect(out.map((p) => p.value)).toEqual([75, 75.25, 74.94]);
  });

  it('una serie constante tiene tendencia constante', () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, value: 75 }));
    expect(emaTrend(pts).every((p) => p.value === 75)).toBe(true);
  });

  it('con huecos usa α_eff = 1 − (1 − α)^Δ', () => {
    const out = emaTrend([
      { date: '2026-10-01', value: 75 },
      { date: '2026-10-04', value: 77 },
    ]);
    const alphaEff = 1 - Math.pow(0.75, 3);
    expect(out[1]!.value).toBeCloseTo(75 + alphaEff * 2, 2);
  });

  it('ordena por fecha aunque la entrada venga desordenada', () => {
    const out = emaTrend([
      { date: '2026-10-02', value: 76 },
      { date: '2026-10-01', value: 75 },
    ]);
    expect(out[0]!.date).toBe('2026-10-01');
    expect(out[1]!.value).toBe(75.25);
  });

  it('suaviza el ruido: la tendencia varía menos que el peso bruto', () => {
    const raw = [75, 75.8, 74.6, 75.9, 74.8, 76, 75.1, 75.7].map((value, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, '0')}`,
      value,
    }));
    const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    expect(range(emaTrend(raw).map((p) => p.value))).toBeLessThan(range(raw.map((p) => p.value)));
  });
});

describe('linearSlope / weeklyRate', () => {
  it('recta perfecta de +0.1 kg/día → +0.7 kg/semana', () => {
    const pts = Array.from({ length: 8 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, value: 75 + i * 0.1 }));
    expect(linearSlope(pts)).toBeCloseTo(0.1, 6);
    expect(weeklyRate(pts)).toBe(0.7);
  });

  it('menos de dos puntos → pendiente 0', () => {
    expect(linearSlope([{ date: '2026-10-01', value: 75 }])).toBe(0);
  });
});
