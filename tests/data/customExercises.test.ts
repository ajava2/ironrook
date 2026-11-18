import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openFitDb } from '../../src/data/db';
import { Repository } from '../../src/data/repository';
import type { Exercise } from '../../src/core/types';

const ex = (id: string, name: string): Exercise => ({
  id: `custom_${id}`,
  name,
  primary: 'chest',
  secondary: ['arms'],
  equipment: 'machine',
  shoulderFriendly: true,
  increment: 2.5,
});

let repo: Repository;
let n = 0;
beforeEach(async () => {
  repo = new Repository(await openFitDb(`test-ex-${n++}`));
});

describe('ejercicios propios en la base de datos', () => {
  it('empieza vacío', async () => {
    expect(await repo.allCustomExercises()).toEqual([]);
  });

  it('guarda, ordena por nombre y borra', async () => {
    await repo.saveCustomExercise(ex('b', 'Zancadas'));
    await repo.saveCustomExercise(ex('a', 'Aperturas'));
    expect((await repo.allCustomExercises()).map((e) => e.name)).toEqual(['Aperturas', 'Zancadas']);
    await repo.deleteCustomExercise('custom_a');
    expect((await repo.allCustomExercises()).map((e) => e.id)).toEqual(['custom_b']);
  });

  it('rechaza ids que podrían pisar el catálogo y datos inválidos', async () => {
    await expect(repo.saveCustomExercise({ ...ex('x', 'Mal'), id: 'v_squat' })).rejects.toThrow();
    await expect(repo.saveCustomExercise({ ...ex('x', ''), name: '  ' })).rejects.toThrow();
    await expect(repo.saveCustomExercise({ ...ex('x', 'Mal'), increment: 0 })).rejects.toThrow();
    expect(await repo.allCustomExercises()).toEqual([]);
  });

  it('viaja en la copia de seguridad', async () => {
    await repo.saveCustomExercise(ex('a', 'Aperturas'));
    const backup = await repo.exportBackup();
    expect(backup.customExercises).toHaveLength(1);
    const other = new Repository(await openFitDb(`test-ex-${n++}`));
    await other.importBackup(JSON.parse(JSON.stringify(backup)));
    expect((await other.allCustomExercises()).map((e) => e.name)).toEqual(['Aperturas']);
  });

  it('una copia antigua sin el campo sigue importándose', async () => {
    const backup = await repo.exportBackup();
    const old: Record<string, unknown> = { ...backup };
    delete old.customExercises;
    delete old.templates;
    await expect(repo.importBackup(old)).resolves.toBeDefined();
  });

  it('resetAll los borra', async () => {
    await repo.saveCustomExercise(ex('a', 'Aperturas'));
    await repo.resetAll();
    expect(await repo.allCustomExercises()).toEqual([]);
  });
});
