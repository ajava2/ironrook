import { describe, expect, it } from 'vitest';
import { mealsToCSV, setsToCSV, weightsToCSV } from '../../src/core/exportCsv';
import { pbRecordId } from '../../src/core/pbId';
import { EXERCISE_MAP } from '../../src/data/catalog';

describe('exportación CSV', () => {
  it('comidas: una fila por ingrediente', () => {
    const csv = mealsToCSV([
      {
        id: 'm',
        date: '2026-10-28',
        time: '21:00',
        name: 'Bocadillo, lomo',
        source: 'quick',
        updatedAt: 0,
        items: [
          { name: 'Pan', grams: 120, kcal: 324, protein: 10.8, carbs: 66, fat: 1.8 },
          { name: 'Lomo', grams: 100, kcal: 160, protein: 25, carbs: 0, fat: 6.5 },
        ],
      },
    ]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('2026-10-28,21:00,"Bocadillo, lomo",quick,Pan,120,324,10.8,66,1.8');
  });

  it('series: solo completadas, con e1RM', () => {
    const csv = setsToCSV(
      [
        {
          id: 'w',
          date: '2026-10-28',
          name: 'Pierna',
          startedAt: 0,
          updatedAt: 0,
          exercises: [{ exerciseId: 'v_squat', restSec: 180, sets: [{ weight: 100, reps: 8, done: true }, { weight: 100, reps: 8, done: false }] }],
        },
      ],
      EXERCISE_MAP,
    );
    expect(csv.split('\n')).toEqual([
      'fecha,sesion,ejercicio,serie,peso_kg,reps,e1rm_kg,volumen_kg',
      '2026-10-28,Pierna,V-Squat,1,100,8,126.7,800',
    ]);
  });

  it('peso ordenado por fecha', () => {
    expect(weightsToCSV([{ date: '2026-10-28', kg: 75.4, updatedAt: 0 }, { date: '2026-10-27', kg: 75.1, updatedAt: 0 }])).toBe(
      'fecha,peso_kg\n2026-10-27,75.1\n2026-10-28,75.4',
    );
  });
});

describe('pbRecordId', () => {
  it('genera 15 caracteres [a-z0-9] deterministas', () => {
    const id = pbRecordId('meals', 'm_abc');
    expect(id).toMatch(/^[a-z0-9]{15}$/);
    expect(pbRecordId('meals', 'm_abc')).toBe(id);
  });

  it('distingue store y clave', () => {
    expect(pbRecordId('meals', 'x')).not.toBe(pbRecordId('workouts', 'x'));
    const ids = new Set(Array.from({ length: 2000 }, (_, i) => pbRecordId('meals', `m_${i}`)));
    expect(ids.size).toBe(2000);
  });
});
