import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { WorkoutTemplate } from '../../src/core/types';
import { openFitDb } from '../../src/data/db';
import { Repository } from '../../src/data/repository';

async function newRepo() {
  return new Repository(await openFitDb(`test-${Math.random()}`));
}

const tpl = (id: string, name: string): WorkoutTemplate => ({
  id,
  name,
  focus: 'upper',
  exercises: [{ exerciseId: 'lat_pulldown', sets: 3, repMin: 8, repMax: 12, restSec: 120 }],
});

describe('rutinas', () => {
  it('empieza vacío', async () => {
    const repo = await newRepo();
    expect(await repo.allTemplates()).toEqual([]);
  });

  it('guarda, ordena y borra', async () => {
    const repo = await newRepo();
    await repo.saveTemplate(tpl('a', 'A'));
    await repo.saveTemplate(tpl('b', 'B'));
    await repo.saveTemplateOrder(['b', 'a']);
    expect((await repo.allTemplates()).map((t) => t.id)).toEqual(['b', 'a']);
    await repo.deleteTemplate('b');
    expect((await repo.allTemplates()).map((t) => t.id)).toEqual(['a']);
  });

  it('viajan en la copia de seguridad', async () => {
    const origen = await newRepo();
    const destino = await newRepo();
    await origen.saveTemplate(tpl('a', 'A'));
    await destino.importBackup(await origen.exportBackup());
    expect((await destino.allTemplates()).map((t) => t.id)).toEqual(['a']);
  });
});