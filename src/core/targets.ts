import { KCAL_PER_GRAM } from './macros';
import type { Macros, Profile, Workout } from './types';
import { LOWER_BODY, workoutVolume, type Catalog } from './volume';

export interface DailyTargets {
  targets: Macros;
  legDay: boolean;
  lowerBodySets: number;
  bonusKcal: number;
}

export function lowerBodySetsOfDay(workouts: readonly Workout[], catalog: Catalog): number {
  return workouts.reduce((acc, w) => acc + workoutVolume(w, catalog, LOWER_BODY).sets, 0);
}

/**
 * Objetivo del día = objetivo base + bonus de pierna.
 * Si las series efectivas de tren inferior del día alcanzan el umbral, se suman
 * `legDayBonusKcal` íntegramente como carbohidratos (kcal / 4 g), porque el glucógeno
 * muscular es el sustrato que más se vacía en una sesión de pierna de alto volumen.
 */
export function dailyTargets(profile: Profile, workoutsOfDay: readonly Workout[], catalog: Catalog): DailyTargets {
  const lowerBodySets = lowerBodySetsOfDay(workoutsOfDay, catalog);
  const legDay = lowerBodySets >= profile.legDaySetThreshold;
  const bonusKcal = legDay ? profile.legDayBonusKcal : 0;
  return {
    targets: {
      ...profile.targets,
      kcal: profile.targets.kcal + bonusKcal,
      carbs: profile.targets.carbs + Math.round(bonusKcal / KCAL_PER_GRAM.carbs),
    },
    legDay,
    lowerBodySets,
    bonusKcal,
  };
}
