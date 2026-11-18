import { describe, expect, it } from 'vitest';
import { CustomExerciseSchema } from '../../src/core/schemas';
import { EXERCISE_MAP, EXERCISES, exerciseName, registerExercises } from '../../src/data/catalog';

const base = { id: 'custom_t1', name: 'Press Hammer', primary: 'chest', equipment: 'machine', shoulderFriendly: true, increment: 5 } as const;

describe('CustomExerciseSchema', () => {
  it('acepta uno válido y limpia espacios del nombre', () => {
    const r = CustomExerciseSchema.safeParse({ ...base, name: '  Press Hammer  ' });
    expect(r.success && r.data.name).toBe('Press Hammer');
  });
  it.each([
    ['id sin prefijo', { id: 'v_squat' }],
    ['nombre vacío', { name: '   ' }],
    ['músculo inventado', { primary: 'cuello' }],
    ['equipo inventado', { equipment: 'kettlebell' }],
    ['salto 0', { increment: 0 }],
    ['salto enorme', { increment: 500 }],
    ['más de 3 secundarios', { secondary: ['arms', 'back', 'core', 'calves'] }],
  ])('rechaza %s', (_n, patch) => {
    expect(CustomExerciseSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });
});

describe('registerExercises', () => {
  it('añade al catálogo y exerciseName lo encuentra', () => {
    registerExercises([{ ...base, id: 'custom_reg1' }]);
    expect(EXERCISE_MAP.has('custom_reg1')).toBe(true);
    expect(exerciseName('custom_reg1')).toBe('Press Hammer');
  });
  it('no duplica si se registra dos veces', () => {
    const before = EXERCISES.length;
    registerExercises([{ ...base, id: 'custom_reg2' }]);
    registerExercises([{ ...base, id: 'custom_reg2' }]);
    expect(EXERCISES.length).toBe(before + 1);
  });
  it('no puede pisar un ejercicio base', () => {
    const original = EXERCISE_MAP.get('v_squat');
    registerExercises([{ ...base, id: 'v_squat', name: 'Falso' }]);
    expect(EXERCISE_MAP.get('v_squat')).toBe(original);
  });
});
