import { parseFoodText } from '../core/foodText';
import { extractJson, FoodAnalysisSchema, NutritionLabelSchema, type FoodAnalysis, type NutritionLabel } from '../core/schemas';
import { BUILTIN_FOODS } from '../data/foodDb';
import { builtinItem } from '../data/defaults';
import type { AIClient, AIImage } from './ai';

const SYSTEM = `Eres un nutricionista deportivo que estima raciones de comida española.
Responde SOLO con JSON válido, sin texto adicional. Usa números (no strings) y gramos enteros.
Las kcal deben ser coherentes con los macros (≈ 4·proteína + 4·carbohidratos + 9·grasa).`;

const ANALYSIS_SHAPE = `{"name": "nombre corto del plato", "items": [{"name": "ingrediente", "grams": 120, "kcal": 192, "protein": 30, "carbs": 0, "fat": 7.8}], "notes": "suposiciones relevantes"}`;

export interface AnalysisResult extends FoodAnalysis {
  simulated: boolean;
}

async function askJson<T>(client: AIClient, schema: { parse: (v: unknown) => T }, prompt: string, image?: AIImage): Promise<T> {
  const raw = await client.json(SYSTEM, prompt, image);
  return schema.parse(extractJson(raw));
}

export async function analyzeMealPhoto(client: AIClient | null, image: AIImage): Promise<AnalysisResult> {
  if (!client) return { ...simulatedPlate(image), simulated: true };
  const prompt = `Identifica cada ingrediente visible en la foto del plato y estima los gramos a ojo usando como referencia el tamaño del plato, cubiertos o manos. Incluye aceite o salsas si se aprecian. Devuelve exactamente esta forma: ${ANALYSIS_SHAPE}`;
  return { ...(await askJson(client, FoodAnalysisSchema, prompt, image)), simulated: false };
}

export async function parseMealDescription(client: AIClient | null, text: string): Promise<AnalysisResult & { unmatched: string[] }> {
  if (!client) {
    const local = parseFoodText(text, BUILTIN_FOODS);
    if (local.items.length === 0) throw new Error('No reconozco ningún alimento. Prueba "150g de pollo y 200g de arroz" o configura la IA en Ajustes.');
    return { name: text.slice(0, 60), items: local.items, unmatched: local.unmatched, simulated: true };
  }
  const prompt = `Desglosa esta comida en ingredientes con gramos y macros. Si no se indican cantidades, usa raciones típicas españolas. Texto: "${text}". Devuelve exactamente esta forma: ${ANALYSIS_SHAPE}`;
  return { ...(await askJson(client, FoodAnalysisSchema, prompt)), simulated: false, unmatched: [] };
}

export async function readNutritionLabel(client: AIClient | null, image: AIImage): Promise<NutritionLabel & { simulated: boolean }> {
  if (!client) {
    return {
      name: 'Producto escaneado (simulación)',
      brand: undefined,
      per100g: { kcal: 120, protein: 10, carbs: 12, fat: 3.5 },
      simulated: true,
    };
  }
  const prompt = `Lee la tabla de información nutricional del envase. Usa SIEMPRE la columna "por 100 g" o "por 100 ml" (no la de por ración). Si solo aparece energía en kJ, conviértela a kcal dividiendo entre 4.184. Devuelve: {"name": "nombre del producto", "brand": "marca o null", "per100g": {"kcal": 0, "protein": 0, "carbs": 0, "fat": 0}}`;
  const label = await askJson(client, NutritionLabelSchema, prompt, image);
  return { ...label, simulated: false };
}

/**
 * Sin API key no hay visión real. En lugar de inventar números al azar, propone el plato más
 * probable según la hora (desayuno/comida/cena) para que el flujo de revisión sea útil igualmente.
 */
function simulatedPlate(image: AIImage): FoodAnalysis {
  const hour = new Date().getHours();
  const variant = image.base64.length % 2;
  const note = 'Modo simulación: añade tu API key gratuita de Gemini en Ajustes para analizar la foto de verdad. Ajusta los gramos con los deslizadores.';
  if (hour < 11) {
    return { name: 'Desayuno', items: [builtinItem('avena', 60), builtinItem('skyr', 150), builtinItem('platano', 120)], notes: note };
  }
  if (hour < 17) {
    return variant
      ? { name: 'Arroz con pollo', items: [builtinItem('arroz', 220), builtinItem('pollo', 150), builtinItem('aceite', 10)], notes: note }
      : { name: 'Pasta con atún', items: [builtinItem('pasta', 220), builtinItem('atun', 80), builtinItem('tomate', 80), builtinItem('aceite', 10)], notes: note };
  }
  return variant
    ? { name: 'Bocadillo de lomo', items: [builtinItem('pan', 120), builtinItem('lomo', 100), builtinItem('aceite', 5)], notes: note }
    : { name: 'Tortilla y ensalada', items: [builtinItem('tortilla', 180), builtinItem('lechuga', 100), builtinItem('tomate', 100), builtinItem('aceite', 8)], notes: note };
}
