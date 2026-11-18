import { z } from 'zod';
import { roundMacros } from './macros';
import type { FoodItem } from './types';

const KJ_PER_KCAL = 4.184;

const OFFResponseSchema = z.object({
  status: z.union([z.number(), z.string()]).optional(),
  product: z
    .object({
      code: z.string().optional(),
      product_name: z.string().optional(),
      product_name_es: z.string().optional(),
      generic_name: z.string().optional(),
      brands: z.string().optional(),
      nutriments: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

function numberField(n: Record<string, unknown>, key: string): number | undefined {
  const v = n[key];
  const parsed = typeof v === 'string' ? Number.parseFloat(v) : v;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Convierte la respuesta de OpenFoodFacts v2 en un FoodItem por 100 g.
 * Si el producto solo trae energía en kJ (frecuente en etiquetas europeas), kcal = kJ / 4.184.
 */
export function parseOpenFoodFacts(barcode: string, json: unknown, now = Date.now()): FoodItem | null {
  const parsed = OFFResponseSchema.safeParse(json);
  if (!parsed.success || !parsed.data.product) return null;
  const p = parsed.data.product;
  const n = p.nutriments ?? {};
  const kcal = numberField(n, 'energy-kcal_100g') ?? (numberField(n, 'energy_100g') ?? NaN) / KJ_PER_KCAL;
  const protein = numberField(n, 'proteins_100g');
  const carbs = numberField(n, 'carbohydrates_100g');
  const fat = numberField(n, 'fat_100g');
  if (!Number.isFinite(kcal) || protein === undefined || carbs === undefined || fat === undefined) return null;
  const name = (p.product_name_es || p.product_name || p.generic_name || '').trim() || `Producto ${barcode}`;
  return {
    id: `off_${barcode}`,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    barcode,
    per100g: roundMacros({ kcal, protein, carbs, fat }),
    source: 'openfoodfacts',
    updatedAt: now,
  };
}
