import { describe, expect, it } from 'vitest';
import { dailyTargets } from '../../src/core/targets';
import type { Profile, Workout, WorkoutExercise } from '../../src/core/types';
import { EXERCISE_MAP } from '../../src/data/catalog';

const profile: Profile = {
  heightCm: 184,
  weightKg: 75,
  goal: 'Recomposición',
  targets: { kcal: 2000, protein: 150, carbs: 220, fat: 65 },
  legDayBonusKcal: 200,
  legDaySetThreshold: 12,
  restSec: 120,
};

function ex(exerciseId: string, sets: [number, number][], done = true): WorkoutExercise {
  return { exerciseId, restSec: 120, sets: sets.map(([weight, reps]) => ({ weight, reps, done })) };
}

function workout(exercises: WorkoutExercise[]): Workout {
  return { id: 'w', date: '2026-10-28', name: 'Test', startedAt: 0, updatedAt: 0, exercises };
}

const heavyLegs = workout([
  ex('v_squat', [[100, 8], [100, 8], [100, 7]]),
  ex('hack_squat', [[80, 10], [80, 10], [80, 9]]),
  ex('leg_extension', [[60, 12], [60, 12], [60, 11]]),
  ex('leg_curl', [[45, 12], [45, 11], [45, 10]]),
]);

describe('dailyTargets', () => {
  it('día sin entreno = objetivo base', () => {
    const d = dailyTargets(profile, [], EXERCISE_MAP);
    expect(d.legDay).toBe(false);
    expect(d.targets).toEqual(profile.targets);
  });

  it('pierna de alto volumen: +200 kcal todo en carbohidratos (+50 g)', () => {
    const d = dailyTargets(profile, [heavyLegs], EXERCISE_MAP);
    expect(d.lowerBodySets).toBe(12);
    expect(d.legDay).toBe(true);
    expect(d.targets).toEqual({ kcal: 2200, protein: 150, carbs: 270, fat: 65 });
  });

  it('las series de torso no cuentan para el umbral', () => {
    const upper = workout([
      ex('smith_incline_press', [[60, 8], [60, 8], [60, 8], [60, 8], [60, 8], [60, 8]]),
      ex('lat_pulldown', [[70, 10], [70, 10], [70, 10], [70, 10], [70, 10], [70, 10]]),
      ex('leg_extension', [[60, 12]]),
    ]);
    const d = dailyTargets(profile, [upper], EXERCISE_MAP);
    expect(d.lowerBodySets).toBe(1);
    expect(d.legDay).toBe(false);
  });

  it('las series de aproximación (<50 % del peso máximo) no son efectivas', () => {
    const withWarmups = workout([
      ex('v_squat', [[20, 10], [40, 8], [100, 8], [100, 8], [100, 8]]),
      ex('leg_extension', [[60, 12], [60, 12], [60, 12]]),
      ex('leg_curl', [[45, 12], [45, 12], [45, 12]]),
      ex('calf_raise', [[80, 12], [80, 12], [80, 12]]),
    ]);
    const d = dailyTargets(profile, [withWarmups], EXERCISE_MAP);
    expect(d.lowerBodySets).toBe(12);
  });

  it('las series sin completar no cuentan', () => {
    const notDone = workout([ex('v_squat', Array.from({ length: 15 }, () => [100, 8] as [number, number]), false)]);
    expect(dailyTargets(profile, [notDone], EXERCISE_MAP).legDay).toBe(false);
  });

  it('respeta un bonus y umbral personalizados', () => {
    const d = dailyTargets({ ...profile, legDayBonusKcal: 300, legDaySetThreshold: 6 }, [heavyLegs], EXERCISE_MAP);
    expect(d.targets.kcal).toBe(2300);
    expect(d.targets.carbs).toBe(295);
  });
});
