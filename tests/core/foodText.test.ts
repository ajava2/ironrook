import { describe, expect, it } from 'vitest';
import { normalize, parseFoodText } from '../../src/core/foodText';
import { BUILTIN_FOODS } from '../../src/data/foodDb';

describe('parseFoodText', () => {
  it('desglosa "Bocadillo con 100g de pan y 120g de lomo"', () => {
    const { items, unmatched } = parseFoodText('Bocadillo con 100g de pan y 120g de lomo', BUILTIN_FOODS);
    expect(unmatched).toEqual([]);
    expect(items).toEqual([
      { name: 'Pan de barra', grams: 100, kcal: 270, protein: 9, carbs: 55, fat: 1.5 },
      { name: 'Lomo de cerdo a la plancha', grams: 120, kcal: 192, protein: 30, carbs: 0, fat: 7.8 },
    ]);
  });

  it('entiende unidades y números en palabras', () => {
    const { items } = parseFoodText('dos huevos, medio plátano y 1 scoop de whey', BUILTIN_FOODS);
    expect(items.map((i) => [i.name, i.grams])).toEqual([
      ['Huevo', 120],
      ['Plátano', 60],
      ['Proteína whey', 30],
    ]);
  });

  it('el alias más largo gana ("arroz crudo" frente a "arroz")', () => {
    const { items } = parseFoodText('80g de arroz crudo', BUILTIN_FOODS);
    expect(items[0]!.name).toBe('Arroz crudo');
  });

  it('añade pan si se pide un bocadillo sin especificarlo', () => {
    const { items } = parseFoodText('bocadillo de jamon serrano', BUILTIN_FOODS);
    expect(items.map((i) => i.name)).toEqual(['Pan de barra', 'Jamón serrano']);
  });

  it('reporta lo que no reconoce', () => {
    expect(parseFoodText('200g de quinoa', BUILTIN_FOODS).unmatched).toEqual(['200g de quinoa']);
  });

  it('normalize quita tildes y mayúsculas', () => {
    expect(normalize('  Plátano   CON Jamón ')).toBe('platano con jamon');
  });
});
