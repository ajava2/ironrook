import { describe, expect, it } from 'vitest';
import { averageAdherence, dailyAdherence } from '../../src/core/progress';
import type { MealEntry, Workout } from '../../src/core/types';
import { EXERCISE_MAP } from '../../src/data/catalog';
import { DEFAULT_PROFILE } from '../../src/data/defaults';

const meal = (date: string, kcal: number): MealEntry => ({
  id: `${date}-${kcal}`,
  date,
  time: '12:00',
  name: 'x',
  source: 'manual',
  items: [{ name: 'x', grams: 100, kcal, protein: 0, carbs: 0, fat: 0 }],
  updatedAt: 0,
});

const legDay: Workout = {
  id: 'w',
  date: '2026-10-27',
  name: 'Pierna',
  startedAt: 0,
  updatedAt: 0,
  exercises: [
    { exerciseId: 'v_squat', restSec: 180, sets: Array.from({ length: 12 }, () => ({ weight: 100, reps: 8, done: true })) },
  ],
};

describe('dailyAdherence', () => {
  it('mide cada día contra su objetivo dinámico', () => {
    const days = dailyAdherence([meal('2026-10-26', 1000), meal('2026-10-26', 900), meal('2026-10-27', 2200)], [legDay], DEFAULT_PROFILE, EXERCISE_MAP);
    expect(days).toEqual([
      { date: '2026-10-26', kcal: 1900, target: 2000, pct: 95, legDay: false },
      { date: '2026-10-27', kcal: 2200, target: 2200, pct: 100, legDay: true },
    ]);
  });

  it('los días sin comidas no aparecen (dato ausente, no 0 %)', () => {
    expect(dailyAdherence([], [legDay], DEFAULT_PROFILE, EXERCISE_MAP)).toEqual([]);
  });

  it('media de cumplimiento', () => {
    const days = dailyAdherence([meal('2026-10-26', 1800), meal('2026-10-27', 2000)], [], DEFAULT_PROFILE, EXERCISE_MAP);
    expect(averageAdherence(days)).toBe(95);
    expect(averageAdherence([])).toBe(0);
  });
});
