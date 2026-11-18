import { toCSV } from './csv';
import { estimate1RM } from './oneRepMax';
import type { BodyWeight, MealEntry, Workout } from './types';
import type { Catalog } from './volume';

/** Una fila por ingrediente: es el formato que mejor se analiza luego en una hoja de cálculo. */
export function mealsToCSV(meals: readonly MealEntry[]): string {
  const rows = [...meals]
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .flatMap((m) => m.items.map((it) => ({ m, it })));
  return toCSV(rows, [
    { header: 'fecha', value: (r) => r.m.date },
    { header: 'hora', value: (r) => r.m.time },
    { header: 'comida', value: (r) => r.m.name },
    { header: 'origen', value: (r) => r.m.source },
    { header: 'ingrediente', value: (r) => r.it.name },
    { header: 'gramos', value: (r) => r.it.grams },
    { header: 'kcal', value: (r) => r.it.kcal },
    { header: 'proteina_g', value: (r) => r.it.protein },
    { header: 'carbohidratos_g', value: (r) => r.it.carbs },
    { header: 'grasa_g', value: (r) => r.it.fat },
  ]);
}

/** Una fila por serie completada, con su e1RM ya calculado. */
export function setsToCSV(workouts: readonly Workout[], catalog: Catalog): string {
  const rows = [...workouts]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((w) =>
      w.exercises.flatMap((ex) =>
        ex.sets.filter((s) => s.done).map((s, i) => ({ w, ex, s, n: i + 1 })),
      ),
    );
  return toCSV(rows, [
    { header: 'fecha', value: (r) => r.w.date },
    { header: 'sesion', value: (r) => r.w.name },
    { header: 'ejercicio', value: (r) => catalog.get(r.ex.exerciseId)?.name ?? r.ex.exerciseId },
    { header: 'serie', value: (r) => r.n },
    { header: 'peso_kg', value: (r) => r.s.weight },
    { header: 'reps', value: (r) => r.s.reps },
    { header: 'e1rm_kg', value: (r) => estimate1RM(r.s) },
    { header: 'volumen_kg', value: (r) => r.s.weight * r.s.reps },
  ]);
}

export function weightsToCSV(weights: readonly BodyWeight[]): string {
  return toCSV(
    [...weights].sort((a, b) => a.date.localeCompare(b.date)),
    [
      { header: 'fecha', value: (w) => w.date },
      { header: 'peso_kg', value: (w) => w.kg },
    ],
  );
}
