import type { Macros } from '../core/types';

export interface BuiltinFood {
  name: string;
  /** Sin tildes y en minúsculas: el parser compara contra texto normalizado. */
  aliases: string[];
  per100g: Macros;
  /** Gramos de una unidad ("2 huevos", "1 scoop") o de una ración si no se indica cantidad. */
  unitGrams: number;
}

const f = (
  name: string,
  aliases: string[],
  [kcal, protein, carbs, fat]: [number, number, number, number],
  unitGrams = 100,
): BuiltinFood => ({ name, aliases, per100g: { kcal, protein, carbs, fat }, unitGrams });

/** Valores medios por 100 g (BEDCA / etiquetas habituales de supermercado en España). */
export const BUILTIN_FOODS: BuiltinFood[] = [
  f('Pan de barra', ['pan', 'barra', 'baguette', 'chapata', 'pan blanco'], [270, 9, 55, 1.5], 100),
  f('Pan de molde integral', ['pan de molde', 'pan bimbo', 'rebanada', 'rebanadas', 'pan integral'], [250, 10, 42, 3.8], 30),
  f('Lomo de cerdo a la plancha', ['lomo', 'cinta de lomo', 'lomo de cerdo'], [160, 25, 0, 6.5], 100),
  f('Jamón serrano', ['jamon', 'jamon serrano', 'jamon iberico'], [240, 31, 0, 13], 50),
  f('Jamón cocido', ['jamon york', 'jamon cocido', 'york'], [110, 18, 1.5, 3.5], 50),
  f('Pechuga de pavo (fiambre)', ['pavo', 'pechuga de pavo', 'fiambre de pavo'], [100, 19, 2, 1.5], 60),
  f('Pechuga de pollo a la plancha', ['pollo', 'pechuga', 'pechuga de pollo'], [165, 31, 0, 3.6], 150),
  f('Arroz cocido', ['arroz', 'arroz blanco', 'arroz cocido'], [130, 2.7, 28, 0.3], 200),
  f('Arroz crudo', ['arroz crudo', 'arroz en crudo'], [355, 7, 78, 0.6], 80),
  f('Pasta cocida', ['pasta', 'macarrones', 'espaguetis', 'spaghetti'], [155, 5.5, 30, 0.9], 200),
  f('Patata cocida', ['patata', 'patatas', 'papas'], [87, 1.9, 20, 0.1], 200),
  f('Huevo', ['huevo', 'huevos'], [143, 12.6, 0.7, 9.5], 60),
  f('Clara de huevo', ['clara', 'claras'], [52, 11, 0.7, 0.2], 33),
  f('Atún al natural', ['atun', 'lata de atun'], [110, 25, 0, 1], 60),
  f('Salmón', ['salmon'], [208, 20, 0, 13], 150),
  f('Ternera magra', ['ternera', 'filete', 'filete de ternera'], [170, 26, 0, 7], 150),
  f('Carne picada mixta', ['carne picada', 'picada'], [250, 18, 0, 20], 125),
  f('Queso semicurado', ['queso', 'queso semicurado', 'queso curado'], [380, 25, 1, 31], 30),
  f('Queso fresco batido 0%', ['queso batido', 'queso fresco batido', 'quark'], [50, 8, 3.5, 0.2], 250),
  f('Skyr / yogur proteico', ['skyr', 'yogur proteico', 'yogur'], [62, 10, 4, 0.2], 150),
  f('Leche semidesnatada', ['leche'], [46, 3.2, 4.8, 1.6], 250),
  f('Proteína whey', ['whey', 'proteina en polvo', 'proteina', 'scoop', 'cazo'], [380, 75, 8, 6], 30),
  f('Copos de avena', ['avena', 'copos de avena'], [370, 13, 60, 7], 60),
  f('Plátano', ['platano', 'platanos', 'banana'], [90, 1.1, 21, 0.3], 120),
  f('Manzana', ['manzana', 'manzanas'], [52, 0.3, 14, 0.2], 180),
  f('Tomate', ['tomate', 'tomates'], [18, 0.9, 3.9, 0.2], 100),
  f('Lechuga / ensalada', ['lechuga', 'ensalada'], [15, 1.3, 2.9, 0.2], 100),
  f('Aguacate', ['aguacate'], [160, 2, 8.5, 14.7], 150),
  f('Aceite de oliva', ['aceite', 'aceite de oliva', 'aove', 'cucharada de aceite'], [884, 0, 0, 100], 10),
  f('Mayonesa', ['mayonesa', 'mayo'], [680, 1, 1, 75], 15),
  f('Crema de cacahuete', ['crema de cacahuete', 'mantequilla de cacahuete'], [590, 25, 16, 50], 20),
  f('Almendras', ['almendras', 'frutos secos', 'nueces'], [580, 21, 22, 50], 30),
  f('Tortilla de patata', ['tortilla', 'tortilla de patata'], [190, 7, 15, 11], 150),
];
