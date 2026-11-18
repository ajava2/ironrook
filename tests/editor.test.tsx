// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TemplateEditor } from '../src/features/workout/TemplateEditor';

afterEach(cleanup);

describe('TemplateEditor', () => {
  it('crea una rutina nueva, reordena y guarda', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<TemplateEditor initial={null} newId="tpl_1" onSave={onSave} onClose={() => {}} />);

    const save = screen.getByRole('button', { name: 'Guardar rutina' });
    expect((save as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByPlaceholderText(/Pierna A/), 'Torso A');
    for (const name of ['Jalón neutro', 'Curl martillo']) {
      await user.click(screen.getAllByRole('button', { name: /Añadir ejercicio/ })[0]!);
      await user.click(screen.getByRole('button', { name: new RegExp(name) }));
    }
    expect((save as HTMLButtonElement).disabled).toBe(false);

    await user.click(screen.getAllByRole('button', { name: 'Subir' })[1]!);
    const reps = screen.getAllByText('Reps mín')[0]!.closest('label')!.querySelector('input')!;
    await user.clear(reps);
    await user.type(reps, '6');
    await user.click(save);

    const t = onSave.mock.calls[0]![0];
    expect(t.id).toBe('tpl_1');
    expect(t.name).toBe('Torso A');
    expect(t.exercises.map((e: { exerciseId: string }) => e.exerciseId)).toEqual(['hammer_curl', 'neutral_pulldown']);
    expect(t.exercises[0].repMin).toBe(6);
    expect(t.exercises[0].repMax).toBeGreaterThanOrEqual(6);
  });

  it('quitar ejercicio y repMax nunca menor que repMin', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const initial = { id: 'a', name: 'X', focus: 'legs' as const, exercises: [
      { exerciseId: 'v_squat', sets: 3, repMin: 10, repMax: 8, restSec: 90 },
      { exerciseId: 'leg_curl', sets: 3, repMin: 8, repMax: 12, restSec: 90 },
    ] };
    render(<TemplateEditor initial={initial} newId="n" onSave={onSave} onClose={() => {}} />);
    await user.click(screen.getAllByRole('button', { name: 'Quitar ejercicio' })[1]!);
    await user.click(screen.getByRole('button', { name: 'Guardar rutina' }));
    const t = onSave.mock.calls[0]![0];
    expect(t.exercises).toHaveLength(1);
    expect(t.exercises[0].repMax).toBe(10);
    expect(t.id).toBe('a');
  });
});
