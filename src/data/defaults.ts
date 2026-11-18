import { scaleMacros } from '../core/macros';
import type { Favorite, MealItem, Profile } from '../core/types';
import { BUILTIN_FOODS } from './foodDb';

export const DEFAULT_PROFILE: Profile = {
  heightCm: 184,
  weightKg: 75,
  goal: 'Recomposición corporal y ganancia limpia (+2-3 kg magros)',
  targets: { kcal: 2000, protein: 150, carbs: 220, fat: 65 },
  legDayBonusKcal: 200,
  legDaySetThreshold: 12,
  restSec: 120,
};

/** Construye un ingrediente a partir de la base interna; lanza si el alias no existe para detectar erratas pronto. */
export function builtinItem(alias: string, grams: number): MealItem {
  const food = BUILTIN_FOODS.find((f) => f.aliases.includes(alias));
  if (!food) throw new Error(`Alimento desconocido: ${alias}`);
  return { name: food.name, grams, ...scaleMacros(food.per100g, grams) };
}

const fav = (id: string, emoji: string, name: string, items: [string, number][]): Favorite => ({
  id,
  emoji,
  name,
  items: items.map(([alias, g]) => builtinItem(alias, g)),
  updatedAt: 0,
});

export const DEFAULT_FAVORITES: Favorite[] = [
  fav('fav_lomo', '🥖', 'Bocadillo de lomo', [['pan', 120], ['lomo', 100], ['aceite', 5]]),
  fav('fav_jamon', '🥖', 'Bocadillo de jamón', [['pan', 120], ['jamon serrano', 60], ['tomate', 30], ['aceite', 5]]),
  fav('fav_pollo', '🍗', 'Bocadillo de pollo', [['pan', 120], ['pollo', 120], ['tomate', 30], ['aceite', 5]]),
  fav('fav_sandwich', '🥪', 'Sándwich proteico', [['pan de molde', 60], ['pavo', 80], ['queso', 20], ['tomate', 40]]),
  fav('fav_batido', '🥤', 'Batido post-entreno', [['whey', 30], ['leche', 300], ['platano', 120]]),
  fav('fav_arroz_huevos', '🍳', 'Arroz con huevos', [['arroz', 250], ['huevos', 120], ['aceite', 5]]),
  fav('fav_arroz_pollo', '🍚', 'Arroz con pollo', [['arroz', 250], ['pollo', 150], ['aceite', 10]]),
  fav('fav_desayuno', '🥣', 'Avena + skyr + plátano', [['avena', 60], ['skyr', 150], ['platano', 120]]),
];
