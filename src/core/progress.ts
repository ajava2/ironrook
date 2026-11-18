import { adherence, sumMacros } from './macros';
import { dailyTargets } from './targets';
import type { ISODate, MealEntry, Profile, Workout } from './types';
import type { Catalog } from './volume';

export interface DayAdherence {
  date: ISODate;
  kcal: number;
  target: number;
  pct: number;
  legDay: boolean;
}

function groupByDate<T extends { date: ISODate }>(items: readonly T[]): Map<ISODate, T[]> {
  const map = new Map<ISODate, T[]>();
  for (const it of items) {
    const list = map.get(it.date);
    if (list) list.push(it);
    else map.set(it.date, [it]);
  }
  return map;
}

/**
 * Cumplimiento calórico por día contra el objetivo *dinámico* de ese día: un día de pierna
 * se mide contra 2200 kcal, no contra 2000. Solo devuelve días con alguna comida registrada,
 * porque un día sin registros no es un 0 % de cumplimiento sino un dato que falta.
 */
export function dailyAdherence(
  meals: readonly MealEntry[],
  workouts: readonly Workout[],
  profile: Profile,
  catalog: Catalog,
): DayAdherence[] {
  const mealsByDay = groupByDate(meals);
  const workoutsByDay = groupByDate(workouts);
  return [...mealsByDay.entries()]
    .map(([date, list]) => {
      const kcal = sumMacros(list.flatMap((m) => m.items)).kcal;
      const t = dailyTargets(profile, workoutsByDay.get(date) ?? [], catalog);
      return { date, kcal, target: t.targets.kcal, pct: adherence(kcal, t.targets.kcal), legDay: t.legDay };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function averageAdherence(days: readonly DayAdherence[]): number {
  if (days.length === 0) return 0;
  return Math.round(days.reduce((a, d) => a + d.pct, 0) / days.length);
}
