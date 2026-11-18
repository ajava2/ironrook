import { remainingMacros, sumMacros } from '../core/macros';
import { dailyTargets, type DailyTargets } from '../core/targets';
import type { ISODate, Macros, MealEntry, Workout } from '../core/types';
import { EXERCISE_MAP } from '../data/catalog';
import { useAppData, useQuery } from './AppData';

export interface DaySummary extends DailyTargets {
  meals: MealEntry[];
  workouts: Workout[];
  consumed: Macros;
  remaining: Macros;
}

/** Comidas, entrenos (incluido el que está en curso) y objetivo dinámico de un día. */
export function useDaySummary(date: ISODate): DaySummary {
  const { profile } = useAppData();
  const { meals, workouts } = useQuery(
    async (r) => {
      const [meals, workouts, active] = await Promise.all([r.mealsOn(date), r.workoutsOn(date), r.getActiveWorkout()]);
      return { meals, workouts: active && active.date === date ? [...workouts, active] : workouts };
    },
    [date],
    { meals: [] as MealEntry[], workouts: [] as Workout[] },
  );
  const consumed = sumMacros(meals.flatMap((m) => m.items));
  const daily = dailyTargets(profile, workouts, EXERCISE_MAP);
  return { ...daily, meals, workouts, consumed, remaining: remainingMacros(daily.targets, consumed) };
}
