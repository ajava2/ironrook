import { describe, expect, it } from 'vitest';
import { bestE1RM, detectPR, epley, estimate1RM, isSetPR, totalVolume } from '../../src/core/oneRepMax';

const s = (weight: number, reps: number, done = true) => ({ weight, reps, done });

describe('epley', () => {
  it('100 kg × 8 ≈ 126.7 kg', () => {
    expect(epley(100, 8)).toBeCloseTo(126.667, 2);
  });

  it('1 repetición = el propio peso', () => {
    expect(epley(140, 1)).toBe(140);
  });

  it('peso o reps no positivos dan 0', () => {
    expect(epley(0, 10)).toBe(0);
    expect(epley(100, 0)).toBe(0);
    expect(epley(-5, 5)).toBe(0);
  });

  it('30 reps duplica el peso (propiedad de la fórmula)', () => {
    expect(epley(50, 30)).toBe(100);
  });

  it('estimate1RM redondea a 0.1 kg', () => {
    expect(estimate1RM({ weight: 100, reps: 8 })).toBe(126.7);
  });
});

describe('agregados de series', () => {
  it('ignora series no completadas', () => {
    const sets = [s(100, 8), s(110, 6), s(200, 5, false)];
    expect(bestE1RM(sets)).toBe(132);
    expect(totalVolume(sets)).toBe(800 + 660);
  });
});

describe('detectPR', () => {
  const history = { bestE1RM: 126.7, bestSessionVolume: 2000, bestWeight: 100 };

  it('marca PR de 1RM cuando el e1RM supera el histórico', () => {
    const set = s(100, 9);
    const pr = detectPR(set, [set], history);
    expect(pr.e1rm).toBe(true);
    expect(pr.weight).toBe(false);
    expect(pr.any).toBe(true);
  });

  it('marca PR de volumen cuando el tonelaje de la sesión supera la mejor sesión', () => {
    const sets = [s(90, 8), s(90, 8), s(90, 8)];
    const pr = detectPR(sets[2]!, sets, history);
    expect(pr.volume).toBe(true);
    expect(pr.e1rm).toBe(false);
  });

  it('el PR de volumen solo salta en la serie que cruza el récord', () => {
    const sets = [s(90, 8), s(90, 8), s(90, 8), s(90, 8)];
    expect(detectPR(sets[2]!, sets.slice(0, 3), history).volume).toBe(true);
    expect(detectPR(sets[3]!, sets, history).volume).toBe(false);
  });

  it('isSetPR marca la serie que supera e1RM o peso máximo', () => {
    expect(isSetPR(s(110, 5), history)).toBe(true);
    expect(isSetPR(s(100, 9), history)).toBe(true);
    expect(isSetPR(s(100, 8), history)).toBe(false);
    expect(isSetPR(s(110, 5, false), history)).toBe(false);
    expect(isSetPR(s(110, 5), undefined)).toBe(false);
  });

  it('no marca nada igualando la marca', () => {
    const set = s(100, 8);
    expect(detectPR(set, [set], history).any).toBe(false);
  });

  it('sin historial no hay PR (la primera sesión es la línea base)', () => {
    const set = s(300, 10);
    expect(detectPR(set, [set], undefined).any).toBe(false);
  });

  it('una serie no completada nunca es PR', () => {
    const set = s(300, 10, false);
    expect(detectPR(set, [set], history).any).toBe(false);
  });
});
