import { scaleMacros } from './macros';
import type { Macros, MealItem } from './types';

export interface ParsableFood {
  name: string;
  aliases: string[];
  per100g: Macros;
  unitGrams: number;
}

export interface ParsedText {
  items: MealItem[];
  unmatched: string[];
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  medio: 0.5,
  media: 0.5,
};

/** Palabras que describen el plato pero no aportan un ingrediente por sí mismas. */
const CONTAINERS = ['bocadillo', 'bocata', 'sandwich', 'plato', 'racion', 'tupper', 'cena', 'comida', 'desayuno'];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Busca el alias más largo contenido en el fragmento: "arroz crudo" gana a "arroz". */
function matchFood(fragment: string, db: readonly ParsableFood[]): ParsableFood | undefined {
  let best: { food: ParsableFood; len: number } | undefined;
  for (const food of db) {
    for (const alias of food.aliases) {
      const re = new RegExp(`(^|\\b)${alias}(\\b|$)`);
      if (re.test(fragment) && (!best || alias.length > best.len)) best = { food, len: alias.length };
    }
  }
  return best?.food;
}

/**
 * Parser local para el modo sin IA. Divide el texto en fragmentos por comas, "y", "con", "+"
 * y en cada uno busca una cantidad ("120g de", "2 huevos", "medio plátano") y un alimento.
 * Si se nombra un bocadillo sin cantidad de pan, añade 100 g de pan de barra.
 */
export function parseFoodText(text: string, db: readonly ParsableFood[]): ParsedText {
  const norm = normalize(text);
  const fragments = norm
    .split(/,|\+|\by\b|\bcon\b|\be\b|;/)
    .map((s) => s.trim())
    .filter(Boolean);

  const items: MealItem[] = [];
  const unmatched: string[] = [];

  for (const frag of fragments) {
    const food = matchFood(frag, db);
    if (!food) {
      if (!CONTAINERS.some((c) => frag.includes(c))) unmatched.push(frag);
      continue;
    }
    let grams = food.unitGrams;
    const gramsMatch = frag.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|grs|gramos|ml)\b/);
    const unitMatch = frag.match(/^(\d+(?:[.,]\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|medio|media)\s/);
    if (gramsMatch) {
      grams = Number.parseFloat(gramsMatch[1]!.replace(',', '.'));
    } else if (unitMatch) {
      const raw = unitMatch[1]!;
      const count = NUMBER_WORDS[raw] ?? Number.parseFloat(raw.replace(',', '.'));
      grams = count * food.unitGrams;
    }
    items.push({ name: food.name, grams: Math.round(grams), ...scaleMacros(food.per100g, grams) });
  }

  const mentionsSandwich = /\b(bocadillo|bocata)\b/.test(norm);
  const hasBread = items.some((i) => normalize(i.name).startsWith('pan'));
  if (mentionsSandwich && !hasBread) {
    const bread = db.find((d) => d.aliases.includes('pan'));
    if (bread) items.unshift({ name: bread.name, grams: 100, ...scaleMacros(bread.per100g, 100) });
  }

  return { items, unmatched };
}
