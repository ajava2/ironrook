import { startOfWeek } from './dates';
import { completedSets, estimate1RM, setVolume } from './oneRepMax';
import type { Exercise, ISODate, MuscleGroup, Workout, WorkoutSet } from './types';

export type Catalog = ReadonlyMap<string, Exercise>;

export const LOWER_BODY: ReadonlySet<MuscleGroup> = new Set(['quads', 'hamstrings', 'glutes', 'adductors', 'calves']);

/**
 * Serie efectiva = completada y con al menos el 50 % del peso máximo usado ese día en el
 * ejercicio. Es un filtro barato para no contar series de aproximación como volumen real.
 */
export function effectiveSets(sets: readonly WorkoutSet[]): WorkoutSet[] {
  const done = completedSets(sets);
  const top = done.reduce((m, s) => Math.max(m, s.weight), 0);
  return done.filter((s) => top === 0 || s.weight >= top * 0.5);
}

export interface VolumeSummary {
  sets: number;
  tonnage: number;
}

export function workoutVolume(workout: Workout, catalog: Catalog, groups: ReadonlySet<MuscleGroup>): VolumeSummary {
  let sets = 0;
  let tonnage = 0;
  for (const ex of workout.exercises) {
    const meta = catalog.get(ex.exerciseId);
    if (!meta || !groups.has(meta.primary)) continue;
    const eff = effectiveSets(ex.sets);
    sets += eff.length;
    tonnage += eff.reduce((acc, s) => acc + setVolume(s), 0);
  }
  return { sets, tonnage };
}

export interface WeeklyVolume extends VolumeSummary {
  weekStart: ISODate;
}

export function weeklyVolume(
  workouts: readonly Workout[],
  catalog: Catalog,
  groups: ReadonlySet<MuscleGroup> = LOWER_BODY,
): WeeklyVolume[] {
  const byWeek = new Map<ISODate, VolumeSummary>();
  for (const w of workouts) {
    const week = startOfWeek(w.date);
    const acc = byWeek.get(week) ?? { sets: 0, tonnage: 0 };
    const v = workoutVolume(w, catalog, groups);
    byWeek.set(week, { sets: acc.sets + v.sets, tonnage: acc.tonnage + v.tonnage });
  }
  return [...byWeek.entries()]
    .map(([weekStart, v]) => ({ weekStart, ...v }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export interface E1RMPoint {
  date: ISODate;
  e1rm: number;
  weight: number;
  reps: number;
}

/** Mejor serie (por e1RM) de cada sesión en la que aparece el ejercicio. */
export function e1rmHistory(workouts: readonly Workout[], exerciseId: string): E1RMPoint[] {
  const points: E1RMPoint[] = [];
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      let best: E1RMPoint | undefined;
      for (const s of completedSets(ex.sets)) {
        const e = estimate1RM(s);
        if (!best || e > best.e1rm) best = { date: w.date, e1rm: e, weight: s.weight, reps: s.reps };
      }
      if (best) points.push(best);
    }
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export interface PersonalRecord {
  exerciseId: string;
  bestE1RM: number;
  bestE1RMDate: ISODate;
  bestWeight: number;
  bestSessionVolume: number;
}

export function personalRecords(workouts: readonly Workout[]): Map<string, PersonalRecord> {
  const records = new Map<string, PersonalRecord>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const done = completedSets(ex.sets);
      if (done.length === 0) continue;
      const rec = records.get(ex.exerciseId) ?? {
        exerciseId: ex.exerciseId,
        bestE1RM: 0,
        bestE1RMDate: w.date,
        bestWeight: 0,
        bestSessionVolume: 0,
      };
      for (const s of done) {
        const e = estimate1RM(s);
        if (e > rec.bestE1RM) {
          rec.bestE1RM = e;
          rec.bestE1RMDate = w.date;
        }
        rec.bestWeight = Math.max(rec.bestWeight, s.weight);
      }
      rec.bestSessionVolume = Math.max(
        rec.bestSessionVolume,
        done.reduce((acc, s) => acc + setVolume(s), 0),
      );
      records.set(ex.exerciseId, rec);
    }
  }
  return records;
}

/** Última vez que se hizo el ejercicio: series completadas, para el "Anterior: 100 kg × 8". */
export function previousSets(
  workouts: readonly Workout[],
  exerciseId: string,
  excludeWorkoutId?: string,
): WorkoutSet[] {
  const sorted = [...workouts]
    .filter((w) => w.id !== excludeWorkoutId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt);
  for (const w of sorted) {
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
    const done = ex ? completedSets(ex.sets) : [];
    if (done.length > 0) return done;
  }
  return [];
}
