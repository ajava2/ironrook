import type { WorkoutSet } from './types';

/**
 * Fórmula de Epley: 1RM ≈ w · (1 + reps / 30).
 * Con 1 repetición el 1RM es el propio peso. Pierde precisión por encima de ~12 reps,
 * por eso solo se usa como tendencia, no como valor absoluto.
 */
export function epley(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function estimate1RM(set: Pick<WorkoutSet, 'weight' | 'reps'>): number {
  return Math.round(epley(set.weight, set.reps) * 10) / 10;
}

export function setVolume(set: Pick<WorkoutSet, 'weight' | 'reps'>): number {
  return Math.max(0, set.weight) * Math.max(0, set.reps);
}

export function completedSets(sets: readonly WorkoutSet[]): WorkoutSet[] {
  return sets.filter((s) => s.done && s.reps > 0);
}

export function bestE1RM(sets: readonly WorkoutSet[]): number {
  return completedSets(sets).reduce((best, s) => Math.max(best, estimate1RM(s)), 0);
}

export function totalVolume(sets: readonly WorkoutSet[]): number {
  return completedSets(sets).reduce((acc, s) => acc + setVolume(s), 0);
}

export interface ExerciseHistory {
  bestE1RM: number;
  bestSessionVolume: number;
  bestWeight: number;
}

export interface PRResult {
  e1rm: boolean;
  volume: boolean;
  weight: boolean;
  any: boolean;
}

/**
 * Compara la sesión en curso de un ejercicio contra su historial.
 * - PR de 1RM: el e1RM de la serie recién completada supera el mejor histórico.
 * - PR de volumen: el tonelaje acumulado hoy en el ejercicio cruza la mejor sesión previa con
 *   esta serie. Solo en el cruce, para no repetir el aviso en cada serie posterior.
 * Sin historial no se marca PR: la primera sesión es la línea base, no un récord.
 */
export function detectPR(
  justCompleted: WorkoutSet,
  sessionSets: readonly WorkoutSet[],
  history: ExerciseHistory | undefined,
): PRResult {
  const none: PRResult = { e1rm: false, volume: false, weight: false, any: false };
  if (!history || !justCompleted.done || justCompleted.reps <= 0) return none;
  const e1rm = estimate1RM(justCompleted) > history.bestE1RM;
  const after = totalVolume(sessionSets);
  const before = after - setVolume(justCompleted);
  const volume = history.bestSessionVolume > 0 && before <= history.bestSessionVolume && after > history.bestSessionVolume;
  const weight = justCompleted.weight > history.bestWeight;
  return { e1rm, volume, weight, any: e1rm || volume || weight };
}

/** Insignia [PR] de una serie ya completada: supera el mejor e1RM o el peso máximo histórico. */
export function isSetPR(set: WorkoutSet, history: ExerciseHistory | undefined): boolean {
  if (!history || !set.done || set.reps <= 0) return false;
  return estimate1RM(set) > history.bestE1RM || set.weight > history.bestWeight;
}
