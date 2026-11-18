import { parseOpenFoodFacts } from '../core/openFoodFacts';
import type { FoodItem } from '../core/types';

const FIELDS = 'code,product_name,product_name_es,generic_name,brands,nutriments';

export async function fetchProduct(barcode: string, signal?: AbortSignal): Promise<FoodItem | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  const res = await fetch(url, { signal });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OpenFoodFacts respondió HTTP ${res.status}`);
  return parseOpenFoodFacts(barcode, await res.json());
}
