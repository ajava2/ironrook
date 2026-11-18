import { useCallback } from 'react';
import type { Exercise } from '../../core/types';
import { registerExercises } from '../../data/catalog';
import { useAppData } from '../../state/AppData';

/** Guarda un ejercicio propio en la base de datos y lo añade al catálogo en memoria. */
export function useCreateExercise(): (e: Exercise) => Promise<void> {
  const { repo, invalidate, toast } = useAppData();
  return useCallback(
    async (e: Exercise) => {
      const saved = await repo.saveCustomExercise(e);
      registerExercises([saved]);
      invalidate();
      toast(`Ejercicio "${saved.name}" creado`, 'success');
    },
    [repo, invalidate, toast],
  );
}
