import { describe, expect, it } from 'vitest';
import type { Workout } from '../../src/core/types';
import { e1rmHistory, personalRecords, previousSets, weeklyVolume } from '../../src/core/volume';
import { EXERCISE_MAP } from '../../src/data/catalog';

function w(id: string, date: string, exerciseId: string, sets: [number, number][], startedAt = 0): Workout {
  return {
    id,
    date,
    name: id,
    startedAt,
    updatedAt: 0,
    exercises: [{ exerciseId, restSec: 120, sets: sets.map(([weight, reps]) => ({ weight, reps, done: true })) }],
  };
}

const history = [
  w('a', '2026-10-05', 'v_squat', [[100, 8], [100, 8]]), // lunes semana 41
  w('b', '2026-10-08', 'leg_extension', [[60, 12]]), // jueves misma semana
  w('c', '2026-10-12', 'v_squat', [[105, 8], [105, 7]]), // lunes semana siguiente
  w('d', '2026-10-13', 'lat_pulldown', [[70, 10]]), // torso: no cuenta
];

describe('weeklyVolume (tren inferior)', () => {
  it('agrupa por semana ISO (lunes) y suma series efectivas y tonelaje kg×reps', () => {
    expect(weeklyVolume(history, EXERCISE_MAP)).toEqual([
      { weekStart: '2026-10-05', sets: 3, tonnage: 1600 + 720 },
      { weekStart: '2026-10-12', sets: 2, tonnage: 840 + 735 },
    ]);
  });
});

describe('e1rmHistory', () => {
  it('devuelve la mejor serie por sesión ordenada por fecha', () => {
    expect(e1rmHistory(history, 'v_squat')).toEqual([
      { date: '2026-10-05', e1rm: 126.7, weight: 100, reps: 8 },
      { date: '2026-10-12', e1rm: 133, weight: 105, reps: 8 },
    ]);
  });
});

describe('personalRecords', () => {
  it('guarda mejor e1RM, mejor peso y mejor sesión por ejercicio', () => {
    const rec = personalRecords(history).get('v_squat')!;
    expect(rec.bestE1RM).toBe(133);
    expect(rec.bestE1RMDate).toBe('2026-10-12');
    expect(rec.bestWeight).toBe(105);
    expect(rec.bestSessionVolume).toBe(1600);
  });
});

describe('previousSets', () => {
  it('devuelve las series de la sesión más reciente del ejercicio', () => {
    expect(previousSets(history, 'v_squat').map((s) => [s.weight, s.reps])).toEqual([
      [105, 8],
      [105, 7],
    ]);
  });

  it('excluye el entreno en curso', () => {
    expect(previousSets(history, 'v_squat', 'c')[0]!.weight).toBe(100);
  });

  it('vacío si nunca se hizo el ejercicio', () => {
    expect(previousSets(history, 'face_pull')).toEqual([]);
  });
});
