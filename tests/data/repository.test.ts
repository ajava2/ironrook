import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openFitDb } from '../../src/data/db';
import { DEFAULT_PROFILE } from '../../src/data/defaults';
import { generateDemo } from '../../src/data/demo';
import { Repository } from '../../src/data/repository';

let repo: Repository;
let n = 0;

beforeEach(async () => {
  repo = new Repository(await openFitDb(`test-${n++}`));
});

describe('Repository', () => {
  it('siembra perfil, favoritos y demo una sola vez', async () => {
    expect(await repo.seedIfEmpty('2026-10-28')).toBe(true);
    expect(await repo.seedIfEmpty('2026-10-28')).toBe(false);
    expect(await repo.getProfile()).toEqual(DEFAULT_PROFILE);
    expect((await repo.allFavorites()).length).toBeGreaterThanOrEqual(6);
    expect((await repo.allWorkouts()).length).toBeGreaterThan(8);
  });

  it('consulta comidas por fecha usando el índice', async () => {
    await repo.seedIfEmpty('2026-10-28');
    const meals = await repo.mealsOn('2026-10-27');
    expect(meals.length).toBeGreaterThanOrEqual(3);
    expect(meals.every((m) => m.date === '2026-10-27')).toBe(true);
    expect(await repo.mealsOn('2026-10-28')).toEqual([]);
  });

  it('limpia solo los datos de demo y conserva lo del usuario', async () => {
    await repo.seedIfEmpty('2026-10-28');
    await repo.saveWeight('2026-10-28', 75.4);
    await repo.saveMeal({ id: 'mine', date: '2026-10-28', time: '10:00', name: 'Mío', source: 'manual', items: [], updatedAt: 0 });
    const removed = await repo.clearDemoData();
    expect(removed).toBeGreaterThan(50);
    expect(await repo.allWorkouts()).toEqual([]);
    expect((await repo.allWeights()).map((w) => w.date)).toEqual(['2026-10-28']);
    expect((await repo.mealsOn('2026-10-28')).map((m) => m.id)).toEqual(['mine']);
  });

  it('rechaza perfiles inválidos', async () => {
    await expect(repo.saveProfile({ ...DEFAULT_PROFILE, heightCm: 5 })).rejects.toThrow();
  });

  it('exporta e importa una copia completa (ida y vuelta)', async () => {
    await repo.seedIfEmpty('2026-10-28');
    const backup = await repo.exportBackup();
    const other = new Repository(await openFitDb(`test-${n++}`));
    const { records } = await other.importBackup(JSON.parse(JSON.stringify(backup)));
    expect(records).toBe(backup.workouts.length + backup.meals.length + backup.weights.length + backup.favorites.length);
    expect((await other.allWorkouts()).length).toBe(backup.workouts.length);
    expect(await other.seedIfEmpty()).toBe(false);
  });

  it('no escribe nada si la copia es inválida', async () => {
    await expect(repo.importBackup({ app: 'fit-ai-tracker', version: 1, workouts: 'x' })).rejects.toThrow();
    expect(await repo.allWorkouts()).toEqual([]);
  });

  it('persiste y borra el entreno en curso', async () => {
    const w = { id: 'a', date: '2026-10-28', name: 'X', startedAt: 1, updatedAt: 1, exercises: [] };
    await repo.setActiveWorkout(w);
    expect(await repo.getActiveWorkout()).toEqual(w);
    await repo.setActiveWorkout(undefined);
    expect(await repo.getActiveWorkout()).toBeUndefined();
  });

  it('encuentra alimentos cacheados por código de barras', async () => {
    await repo.saveFood({
      id: 'off_123',
      name: 'Skyr',
      barcode: '123',
      per100g: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 },
      source: 'openfoodfacts',
      updatedAt: 0,
    });
    expect((await repo.foodByBarcode('123'))?.name).toBe('Skyr');
    expect(await repo.foodByBarcode('999')).toBeUndefined();
  });
});

describe('generateDemo', () => {
  it('es determinista con la misma semilla', () => {
    expect(generateDemo('2026-10-28')).toEqual(generateDemo('2026-10-28'));
  });

  it('cubre 3 semanas con 2 sesiones de pierna por semana y peso hasta hoy', () => {
    const demo = generateDemo('2026-10-28');
    const legs = demo.workouts.filter((w) => w.focus === 'legs');
    expect(legs.length).toBe(6);
    expect(demo.weights.at(-1)!.date).toBe('2026-10-28');
    expect(demo.meals.every((m) => m.date < '2026-10-28')).toBe(true);
  });

  it('la carga de V-Squat progresa semana a semana', () => {
    const demo = generateDemo('2026-10-28');
    const vs = demo.workouts
      .flatMap((w) => w.exercises.filter((e) => e.exerciseId === 'v_squat').map((e) => e.sets[0]!.weight));
    expect(vs.at(-1)!).toBeGreaterThan(vs[0]!);
  });
});

describe('resetAll', () => {
  it('borra todo, no vuelve a sembrar demo y conserva perfil y favoritos por defecto', async () => {
    const r = new Repository(await openFitDb(`test-reset`));
    await r.seedIfEmpty('2026-10-28');
    await r.resetAll();
    expect(await r.allWorkouts()).toEqual([]);
    expect(await r.allWeights()).toEqual([]);
    expect((await r.allFavorites()).length).toBeGreaterThan(0);
    expect(await r.seedIfEmpty('2026-10-28')).toBe(false);
  });
});
