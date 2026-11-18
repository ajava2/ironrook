import { describe, expect, it } from 'vitest';
import { createWorkout, finalizeWorkout, prefillSets, sessionStats } from '../../src/core/session';
import type { Workout } from '../../src/core/types';
import { TEMPLATES } from '../../src/data/catalog';

const past: Workout = {
  id: 'p',
  date: '2026-10-26',
  name: 'Pierna',
  startedAt: 0,
  updatedAt: 0,
  exercises: [
    {
      exerciseId: 'v_squat',
      restSec: 180,
      sets: [
        { weight: 100, reps: 8, done: true },
        { weight: 100, reps: 7, done: true },
      ],
    },
  ],
};

describe('prefillSets', () => {
  it('copia la sesión anterior y repite la última serie si hay más series planificadas', () => {
    const sets = prefillSets({ exerciseId: 'v_squat', sets: 3, repMin: 6 }, [past]);
    expect(sets).toEqual([
      { weight: 100, reps: 8, done: false },
      { weight: 100, reps: 7, done: false },
      { weight: 100, reps: 7, done: false },
    ]);
  });

  it('sin historial: peso 0 y reps mínimas del rango', () => {
    expect(prefillSets({ exerciseId: 'leg_curl', sets: 2, repMin: 10 }, [])).toEqual([
      { weight: 0, reps: 10, done: false },
      { weight: 0, reps: 10, done: false },
    ]);
  });
});

describe('createWorkout', () => {
  it('instancia la plantilla de pierna con todos sus ejercicios', () => {
    const w = createWorkout(TEMPLATES[0], [past], '2026-10-28', 1000);
    expect(w.focus).toBe('legs');
    expect(w.exercises.map((e) => e.exerciseId)).toEqual(TEMPLATES[0]!.exercises.map((e) => e.exerciseId));
    expect(w.exercises[0]!.sets[0]!.weight).toBe(100);
  });

  it('entreno libre sin plantilla', () => {
    expect(createWorkout(undefined, [], '2026-10-28').exercises).toEqual([]);
  });
});

describe('finalizeWorkout / sessionStats', () => {
  it('descarta series no completadas y ejercicios vacíos', () => {
    const w: Workout = {
      ...past,
      exercises: [
        { exerciseId: 'v_squat', restSec: 180, sets: [{ weight: 100, reps: 8, done: true }, { weight: 100, reps: 8, done: false }] },
        { exerciseId: 'leg_curl', restSec: 90, sets: [{ weight: 40, reps: 10, done: false }] },
      ],
    };
    const f = finalizeWorkout(w, 5000);
    expect(f.exercises).toHaveLength(1);
    expect(f.exercises[0]!.sets).toHaveLength(1);
    expect(f.finishedAt).toBe(5000);
  });

  it('cuenta series, tonelaje y duración', () => {
    expect(sessionStats({ ...past, startedAt: 0, finishedAt: 45 * 60000 })).toEqual({ sets: 2, tonnage: 1500, minutes: 45 });
  });
});
