import { describe, expect, it } from 'vitest';
import {
  adherence,
  kcalFromMacros,
  macroSplit,
  remainingMacros,
  rescaleItem,
  scaleMacros,
  sumMacros,
} from '../../src/core/macros';

describe('kcalFromMacros (Atwater 4/4/9)', () => {
  it('calcula las kcal de los objetivos base', () => {
    // 150·4 + 220·4 + 65·9 = 600 + 880 + 585 = 2065
    expect(kcalFromMacros({ protein: 150, carbs: 220, fat: 65 })).toBe(2065);
  });

  it('devuelve 0 sin macros', () => {
    expect(kcalFromMacros({ protein: 0, carbs: 0, fat: 0 })).toBe(0);
  });
});

describe('scaleMacros', () => {
  const pan = { kcal: 270, protein: 9, carbs: 55, fat: 1.5 };

  it('escala linealmente por gramos', () => {
    expect(scaleMacros(pan, 120)).toEqual({ kcal: 324, protein: 10.8, carbs: 66, fat: 1.8 });
  });

  it('100 g es identidad', () => {
    expect(scaleMacros(pan, 100)).toEqual(pan);
  });

  it('gramos negativos se tratan como 0', () => {
    expect(scaleMacros(pan, -50)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe('rescaleItem', () => {
  it('mantiene la densidad al mover el deslizador de gramos', () => {
    const lomo = { name: 'Lomo', grams: 100, kcal: 160, protein: 25, carbs: 0, fat: 6.5 };
    expect(rescaleItem(lomo, 150)).toEqual({ name: 'Lomo', grams: 150, kcal: 240, protein: 37.5, carbs: 0, fat: 9.8 });
  });

  it('no divide entre cero si el ingrediente tenía 0 g', () => {
    const vacio = { name: 'X', grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 };
    expect(rescaleItem(vacio, 50).grams).toBe(50);
  });
});

describe('sumMacros / remainingMacros / adherence', () => {
  it('suma y redondea sin arrastrar error de coma flotante', () => {
    const total = sumMacros([
      { kcal: 100.4, protein: 0.1, carbs: 0.2, fat: 0 },
      { kcal: 50.3, protein: 0.2, carbs: 0.1, fat: 0 },
    ]);
    expect(total).toEqual({ kcal: 151, protein: 0.3, carbs: 0.3, fat: 0 });
  });

  it('lo restante nunca es negativo', () => {
    const target = { kcal: 2000, protein: 150, carbs: 220, fat: 65 };
    const consumed = { kcal: 2100, protein: 120, carbs: 230, fat: 40 };
    expect(remainingMacros(target, consumed)).toEqual({ kcal: 0, protein: 30, carbs: 0, fat: 25 });
  });

  it('adherencia en porcentaje y sin dividir entre cero', () => {
    expect(adherence(1900, 2000)).toBe(95);
    expect(adherence(1000, 0)).toBe(0);
  });

  it('reparto energético del objetivo base', () => {
    expect(macroSplit({ kcal: 2000, protein: 150, carbs: 220, fat: 65 })).toEqual({ protein: 29, carbs: 43, fat: 28 });
  });
});
