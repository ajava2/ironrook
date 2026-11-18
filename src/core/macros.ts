import type { Macros, MealItem } from './types';

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

/** Factores de Atwater: kcal por gramo de cada macronutriente. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

export function kcalFromMacros(m: Pick<Macros, 'protein' | 'carbs' | 'fat'>): number {
  return m.protein * KCAL_PER_GRAM.protein + m.carbs * KCAL_PER_GRAM.carbs + m.fat * KCAL_PER_GRAM.fat;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function roundMacros(m: Macros): Macros {
  return { kcal: Math.round(m.kcal), protein: round1(m.protein), carbs: round1(m.carbs), fat: round1(m.fat) };
}

/** Valores por 100 g → valores para `grams`. Regla de tres lineal. */
export function scaleMacros(per100g: Macros, grams: number): Macros {
  const f = Math.max(0, grams) / 100;
  return roundMacros({
    kcal: per100g.kcal * f,
    protein: per100g.protein * f,
    carbs: per100g.carbs * f,
    fat: per100g.fat * f,
  });
}

/** Reescala un ingrediente ya cuantificado manteniendo su densidad (macros/gramo). */
export function rescaleItem(item: MealItem, grams: number): MealItem {
  if (item.grams <= 0) return { ...item, grams };
  const per100g = {
    kcal: (item.kcal / item.grams) * 100,
    protein: (item.protein / item.grams) * 100,
    carbs: (item.carbs / item.grams) * 100,
    fat: (item.fat / item.grams) * 100,
  };
  return { ...item, grams, ...scaleMacros(per100g, grams) };
}

export function sumMacros(list: readonly Macros[]): Macros {
  return roundMacros(
    list.reduce<Macros>(
      (acc, m) => ({
        kcal: acc.kcal + m.kcal,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
      }),
      { ...ZERO_MACROS },
    ),
  );
}

export function subtractMacros(a: Macros, b: Macros): Macros {
  return roundMacros({
    kcal: a.kcal - b.kcal,
    protein: a.protein - b.protein,
    carbs: a.carbs - b.carbs,
    fat: a.fat - b.fat,
  });
}

/** Lo que falta para el objetivo; nunca negativo (si te pasas, falta 0). */
export function remainingMacros(target: Macros, consumed: Macros): Macros {
  const diff = subtractMacros(target, consumed);
  return {
    kcal: Math.max(0, diff.kcal),
    protein: Math.max(0, diff.protein),
    carbs: Math.max(0, diff.carbs),
    fat: Math.max(0, diff.fat),
  };
}

/**
 * Cumplimiento calórico en %: 100 = clavado. Se usa en las gráficas y en el coach.
 * Devuelve 0 si no hay objetivo para no dividir entre cero.
 */
export function adherence(consumedKcal: number, targetKcal: number): number {
  if (targetKcal <= 0) return 0;
  return Math.round((consumedKcal / targetKcal) * 100);
}

/** Distribución del objetivo calórico entre macros, en % de kcal. */
export function macroSplit(m: Macros): { protein: number; carbs: number; fat: number } {
  const total = kcalFromMacros(m);
  if (total === 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: Math.round(((m.protein * KCAL_PER_GRAM.protein) / total) * 100),
    carbs: Math.round(((m.carbs * KCAL_PER_GRAM.carbs) / total) * 100),
    fat: Math.round(((m.fat * KCAL_PER_GRAM.fat) / total) * 100),
  };
}
