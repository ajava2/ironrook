// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateExerciseSheet } from '../src/features/workout/CreateExerciseSheet';
import { ExercisePicker } from '../src/features/workout/ExercisePicker';

afterEach(cleanup);

describe('CreateExerciseSheet', () => {
  it('sin nombre muestra error y no guarda', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<CreateExerciseSheet onSave={onSave} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Ponle un nombre al ejercicio.')).toBeTruthy();
  });

  it('guarda con coma decimal y secundarios', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<CreateExerciseSheet onSave={onSave} onClose={() => {}} />);
    await user.type(screen.getByPlaceholderText(/Hammer/), 'Press Hammer');
    const inc = screen.getByDisplayValue('5');
    await user.clear(inc);
    await user.type(inc, '2,5');
    await user.click(screen.getByRole('button', { name: 'Brazos' }));
    await user.click(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    const e = onSave.mock.calls[0]![0];
    expect(e.id).toMatch(/^custom_/);
    expect(e.name).toBe('Press Hammer');
    expect(e.increment).toBe(2.5);
    expect(e.secondary).toEqual(['arms']);
    expect(e.primary).toBe('chest');
  });
});

describe('ExercisePicker con crear', () => {
  it('crea, guarda y selecciona el ejercicio nuevo', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onPick = vi.fn();
    render(<ExercisePicker title="Añadir" onPick={onPick} onClose={() => {}} onCreate={onCreate} />);
    await user.type(screen.getByPlaceholderText(/Buscar/), 'Remo Pendlay');
    await user.click(screen.getByRole('button', { name: /Crear ejercicio "Remo Pendlay"/ }));
    expect((screen.getByPlaceholderText(/Hammer/) as HTMLInputElement).value).toBe('Remo Pendlay');
    await user.click(screen.getByRole('button', { name: 'Guardar ejercicio' }));
    expect(onCreate).toHaveBeenCalledOnce();
    expect(onPick).toHaveBeenCalledWith(onCreate.mock.calls[0]![0].id);
  });

  it('sin onCreate no hay botón', () => {
    render(<ExercisePicker title="Añadir" onPick={() => {}} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: /Crear ejercicio/ })).toBeNull();
  });
});
