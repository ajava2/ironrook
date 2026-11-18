import { uid } from './id';
import type { ISODate, TemplateExercise, Workout, WorkoutExercise, WorkoutSet, WorkoutTemplate } from './types';
import { previousSets } from './volume';

/**
 * Prepara las series de un ejercicio copiando peso y reps de la última sesión: lo normal es
 * repetir o subir un poco, así que el caso común es pulsar ✓ sin teclear nada.
 */
export function prefillSets(te: Pick<TemplateExercise, 'exerciseId' | 'sets' | 'repMin'>, history: readonly Workout[]): WorkoutSet[] {
  const prev = previousSets(history, te.exerciseId);
  return Array.from({ length: te.sets }, (_, i) => {
    const ref = prev[i] ?? prev.at(-1);
    return { weight: ref?.weight ?? 0, reps: ref?.reps ?? te.repMin, done: false };
  });
}

export function createWorkout(
  template: WorkoutTemplate | undefined,
  history: readonly Workout[],
  date: ISODate,
  now = Date.now(),
): Workout {
  const exercises: WorkoutExercise[] = (template?.exercises ?? []).map((te) => ({
    exerciseId: te.exerciseId,
    restSec: te.restSec,
    sets: prefillSets(te, history),
  }));
  return {
    id: uid('w'),
    date,
    name: template?.name ?? 'Entreno libre',
    templateId: template?.id,
    focus: template?.focus,
    startedAt: now,
    exercises,
    updatedAt: now,
  };
}

/** Al terminar se descartan series sin marcar y ejercicios vacíos: el histórico solo guarda trabajo real. */
export function finalizeWorkout(w: Workout, now = Date.now()): Workout {
  const exercises = w.exercises
    .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => s.done && s.reps > 0) }))
    .filter((ex) => ex.sets.length > 0);
  return { ...w, exercises, finishedAt: now, updatedAt: now };
}

export function sessionStats(w: Workout): { sets: number; tonnage: number; minutes: number } {
  let sets = 0;
  let tonnage = 0;
  for (const ex of w.exercises) {
    for (const s of ex.sets) {
      if (!s.done) continue;
      sets++;
      tonnage += s.weight * s.reps;
    }
  }
  const end = w.finishedAt ?? Date.now();
  return { sets, tonnage: Math.round(tonnage), minutes: Math.max(0, Math.round((end - w.startedAt) / 60000)) };
}
