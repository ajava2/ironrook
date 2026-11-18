import { describe, expect, it } from 'vitest';
import { decodeTemplate, encodeTemplate, moveItem } from '../../src/core/templates';
import { EXERCISES, TEMPLATES } from '../../src/data/catalog';

const known = new Set(EXERCISES.map((e) => e.id));

describe('moveItem', () => {
  it('mueve hacia abajo y hacia arriba', () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem([1, 2, 3, 4], 3, 1)).toEqual([1, 4, 2, 3]);
  });
  it('ignora posiciones inválidas y no muta', () => {
    const l = [1, 2, 3];
    expect(moveItem(l, 0, 9)).toEqual([1, 2, 3]);
    expect(moveItem(l, 1, 1)).toEqual([1, 2, 3]);
    expect(l).toEqual([1, 2, 3]);
  });
});

describe('compartir rutinas', () => {
  it('ida y vuelta con tildes, ñ y emojis', () => {
    const t = { ...TEMPLATES[0]!, name: 'Pierna ñandú 🦵 · énfasis', weekday: 3 };
    const r = decodeTemplate(encodeTemplate(t), 'nuevo', known);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.template.id).toBe('nuevo');
      expect(r.template.name).toBe(t.name);
      expect(r.template.weekday).toBe(3);
      expect(r.template.exercises).toEqual(t.exercises);
      expect(r.unknown).toEqual([]);
    }
  });
  it('tolera saltos de línea solos', () => {
    const code = encodeTemplate(TEMPLATES[1]!);
    expect(decodeTemplate(`${code.slice(0, 20)}\n${code.slice(20)}`, 'x', known).ok).toBe(true);
  });
  it('rechaza basura', () => {
    expect(decodeTemplate('hola', 'x', known).ok).toBe(false);
    expect(decodeTemplate('FITAI1:@@@', 'x', known).ok).toBe(false);
    expect(decodeTemplate('FITAI1:' + btoa('{"name":""}'), 'x', known).ok).toBe(false);
  });
  it('avisa de ejercicios desconocidos', () => {
    const t = { ...TEMPLATES[0]!, exercises: [{ ...TEMPLATES[0]!.exercises[0]!, exerciseId: 'custom_zzz' }] };
    const r = decodeTemplate(encodeTemplate(t), 'x', known);
    expect(r.ok && r.unknown).toEqual(['custom_zzz']);
  });
});
