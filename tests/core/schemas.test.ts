import { describe, expect, it } from 'vitest';
import { BackupSchema, extractJson, FoodAnalysisSchema, NutritionLabelSchema, ProfileSchema } from '../../src/core/schemas';

describe('FoodAnalysisSchema', () => {
  it('acepta la respuesta canónica', () => {
    const r = FoodAnalysisSchema.parse({
      name: 'Arroz con pollo',
      items: [{ name: 'Arroz', grams: 200, kcal: 260, protein: 5.4, carbs: 56, fat: 0.6 }],
    });
    expect(r.items[0]!.kcal).toBe(260);
  });

  it('normaliza claves en español y números como string con coma', () => {
    const r = FoodAnalysisSchema.parse({
      ingredientes: [{ nombre: 'Lomo', gramos: '120', calorias: '192', proteinas: '30,0', carbohidratos: 0, grasas: '7,8' }],
    });
    expect(r.items[0]).toEqual({ name: 'Lomo', grams: 120, kcal: 192, protein: 30, carbs: 0, fat: 7.8 });
  });

  it('calcula las kcal con Atwater si faltan', () => {
    const r = FoodAnalysisSchema.parse({ items: [{ name: 'Pollo', grams: 100, protein: 31, carbs: 0, fat: 3.6 }] });
    expect(r.items[0]!.kcal).toBe(Math.round(31 * 4 + 3.6 * 9));
  });

  it('rechaza listas vacías y valores negativos', () => {
    expect(FoodAnalysisSchema.safeParse({ items: [] }).success).toBe(false);
    expect(FoodAnalysisSchema.safeParse({ items: [{ name: 'X', grams: 10, protein: -5 }] }).success).toBe(false);
  });
});

describe('NutritionLabelSchema', () => {
  it('lee la tabla por 100 g', () => {
    const r = NutritionLabelSchema.parse({ nombre: 'Skyr natural', marca: 'Hacendado', per100g: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 } });
    expect(r).toEqual({ name: 'Skyr natural', brand: 'Hacendado', per100g: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 } });
  });
});

describe('ProfileSchema', () => {
  const ok = {
    heightCm: 184,
    weightKg: 75,
    goal: 'Recomposición',
    targets: { kcal: 2000, protein: 150, carbs: 220, fat: 65 },
    legDayBonusKcal: 200,
    legDaySetThreshold: 12,
    restSec: 120,
  };

  it('acepta el perfil por defecto', () => {
    expect(ProfileSchema.safeParse(ok).success).toBe(true);
  });

  it('rechaza valores absurdos', () => {
    expect(ProfileSchema.safeParse({ ...ok, heightCm: 20 }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...ok, targets: { ...ok.targets, kcal: 100 } }).success).toBe(false);
  });
});

describe('BackupSchema', () => {
  const backup = {
    app: 'fit-ai-tracker',
    version: 1,
    exportedAt: '2026-10-28T20:00:00.000Z',
    workouts: [],
    meals: [{ id: 'm1', date: '2026-10-28', time: '14:00', name: 'Comida', source: 'quick', items: [], updatedAt: 1 }],
    weights: [{ date: '2026-10-28', kg: 75.2, updatedAt: 1 }],
    foods: [],
    favorites: [],
  };

  it('valida una copia correcta', () => {
    expect(BackupSchema.safeParse(backup).success).toBe(true);
  });

  it('rechaza ficheros de otra app o fechas mal formadas', () => {
    expect(BackupSchema.safeParse({ ...backup, app: 'otra' }).success).toBe(false);
    expect(BackupSchema.safeParse({ ...backup, weights: [{ date: '28/10/2026', kg: 75, updatedAt: 1 }] }).success).toBe(false);
  });
});

describe('extractJson', () => {
  it('extrae JSON envuelto en bloque markdown', () => {
    expect(extractJson('Aquí tienes:\n```json\n{"a": {"b": 1}}\n```')).toEqual({ a: { b: 1 } });
  });

  it('respeta llaves dentro de strings', () => {
    expect(extractJson('{"t": "llave } suelta", "n": 2} y texto')).toEqual({ t: 'llave } suelta', n: 2 });
  });

  it('falla si no hay JSON', () => {
    expect(() => extractJson('sin datos')).toThrow();
  });
});
