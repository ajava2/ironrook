import { z } from 'zod';
import { kcalFromMacros, roundMacros } from './macros';

/**
 * Los LLM devuelven números como string ("12,5"), claves en español o campos ausentes.
 * Todo lo que entra desde fuera (IA, OpenFoodFacts, ficheros de backup) pasa por aquí.
 */
const num = z.preprocess((v) => {
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return v;
}, z.number().finite().nonnegative());

const SPANISH_KEYS: Record<string, string> = {
  nombre: 'name',
  alimento: 'name',
  ingrediente: 'name',
  gramos: 'grams',
  peso: 'grams',
  calorias: 'kcal',
  calorías: 'kcal',
  kcal: 'kcal',
  proteinas: 'protein',
  proteínas: 'protein',
  proteina: 'protein',
  carbohidratos: 'carbs',
  hidratos: 'carbs',
  grasas: 'fat',
  grasa: 'fat',
  marca: 'brand',
  ingredientes: 'items',
};

function normalizeKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalizeKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, val]) => [
        SPANISH_KEYS[k.toLowerCase()] ?? k,
        normalizeKeys(val),
      ]),
    );
  }
  return v;
}

export const MacrosSchema = z
  .object({
    kcal: num.optional(),
    protein: num.default(0),
    carbs: num.default(0),
    fat: num.default(0),
  })
  .transform((m) => roundMacros({ ...m, kcal: m.kcal && m.kcal > 0 ? m.kcal : kcalFromMacros(m) }));

export const MealItemSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    grams: num.default(100),
    kcal: num.optional(),
    protein: num.default(0),
    carbs: num.default(0),
    fat: num.default(0),
  })
  .transform((m) => ({
    ...m,
    grams: Math.round(m.grams),
    ...roundMacros({ ...m, kcal: m.kcal && m.kcal > 0 ? m.kcal : kcalFromMacros(m) }),
  }));

export const FoodAnalysisSchema = z.preprocess(
  normalizeKeys,
  z.object({
    name: z.string().trim().min(1).max(80).optional(),
    items: z.array(MealItemSchema).min(1),
    notes: z.string().optional(),
  }),
);
export type FoodAnalysis = z.infer<typeof FoodAnalysisSchema>;

export const NutritionLabelSchema = z.preprocess(
  normalizeKeys,
  z.object({
    name: z.string().trim().min(1).max(80),
    brand: z.string().trim().max(60).optional(),
    per100g: MacrosSchema,
  }),
);
export type NutritionLabel = z.infer<typeof NutritionLabelSchema>;

export const ProfileSchema = z.object({
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(30).max(300),
  goal: z.string().max(200),
  targets: z.object({
    kcal: z.number().min(800).max(8000),
    protein: z.number().min(0).max(500),
    carbs: z.number().min(0).max(1000),
    fat: z.number().min(0).max(400),
  }),
  legDayBonusKcal: z.number().min(0).max(1500),
  legDaySetThreshold: z.number().int().min(1).max(60),
  restSec: z.number().int().min(15).max(600),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const macroNum = z.number().finite().min(0);

const WorkoutBackupSchema = z.object({
  id: z.string(),
  date: isoDate,
  name: z.string(),
  templateId: z.string().optional(),
  focus: z.enum(['legs', 'upper']).optional(),
  startedAt: z.number(),
  finishedAt: z.number().optional(),
  updatedAt: z.number(),
  demo: z.boolean().optional(),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      restSec: z.number(),
      sets: z.array(
        z.object({
          weight: z.number().min(0),
          reps: z.number().int().min(0),
          done: z.boolean(),
          completedAt: z.number().optional(),
        }),
      ),
    }),
  ),
});

const MealItemBackupSchema = z.object({
  name: z.string(),
  grams: macroNum,
  kcal: macroNum,
  protein: macroNum,
  carbs: macroNum,
  fat: macroNum,
});
export const TemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  focus: z.enum(['legs', 'upper']),
  weekday: z.number().int().min(0).max(6).optional(),
  order: z.number().optional(),
  updatedAt: z.number().optional(),
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().min(1),
        sets: z.number().int().min(1).max(20),
        repMin: z.number().int().min(1).max(100),
        repMax: z.number().int().min(1).max(100),
        restSec: z.number().int().min(0).max(600),
        note: z.string().max(120).optional(),
      }),
    )
    .max(30),
});
export const MUSCLES = ['quads', 'hamstrings', 'glutes', 'adductors', 'calves', 'chest', 'back', 'shoulders', 'rear_delts', 'arms', 'core'] as const;
export const EQUIPMENT = ['machine', 'smith', 'dumbbell', 'cable', 'barbell', 'bodyweight'] as const;

/** Ejercicio creado por el usuario. Los ids propios empiezan por `custom_` para no pisar nunca el catálogo. */
export const CustomExerciseSchema = z.object({
  id: z.string().regex(/^custom_/),
  name: z.string().trim().min(1).max(60),
  primary: z.enum(MUSCLES),
  secondary: z.array(z.enum(MUSCLES)).max(3).optional(),
  equipment: z.enum(EQUIPMENT),
  shoulderFriendly: z.boolean(),
  increment: z.number().min(0.25).max(50),
});
export const BackupSchema = z.object({
  app: z.literal('fit-ai-tracker'),
  version: z.literal(1),
  exportedAt: z.string(),
  profile: ProfileSchema.optional(),
  workouts: z.array(WorkoutBackupSchema),
  meals: z.array(
    z.object({
      id: z.string(),
      date: isoDate,
      time: z.string(),
      name: z.string(),
      source: z.enum(['quick', 'photo', 'barcode', 'label', 'text', 'manual']),
      items: z.array(MealItemBackupSchema),
      updatedAt: z.number(),
      demo: z.boolean().optional(),
    }),
  ),
  weights: z.array(
    z.object({ date: isoDate, kg: z.number().min(20).max(400), updatedAt: z.number(), demo: z.boolean().optional() }),
  ),
  foods: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      brand: z.string().optional(),
      barcode: z.string().optional(),
      per100g: z.object({ kcal: macroNum, protein: macroNum, carbs: macroNum, fat: macroNum }),
      source: z.enum(['openfoodfacts', 'label', 'ai', 'manual', 'builtin']),
      updatedAt: z.number(),
    }),
  ),
  favorites: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      emoji: z.string(),
      items: z.array(MealItemBackupSchema),
      updatedAt: z.number(),
    }),
  ),
  templates: z.array(TemplateSchema).default([]),
  customExercises: z.array(CustomExerciseSchema).default([]),
});
export type Backup = z.infer<typeof BackupSchema>;

/**
 * Extrae el primer objeto JSON de una respuesta de LLM, aunque venga envuelto en
 * ```json ... ``` o con texto alrededor. Recorre llaves contando profundidad y
 * respetando strings, en vez de usar una regex codiciosa que rompería con anidados.
 */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('La respuesta no contiene JSON');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error('JSON incompleto en la respuesta');
}
