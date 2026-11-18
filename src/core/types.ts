/** Modelo de dominio compartido por la capa de datos, los servicios y la UI. */

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type ISODate = string; // YYYY-MM-DD en hora local

export type MuscleGroup =
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'calves'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'rear_delts'
  | 'arms'
  | 'core';

export interface Exercise {
  id: string;
  name: string;
  primary: MuscleGroup;
  secondary?: MuscleGroup[];
  equipment: 'machine' | 'smith' | 'dumbbell' | 'cable' | 'barbell' | 'bodyweight';
  /** Carga baja sobre la articulación glenohumeral (sin rotación interna forzada ni overhead). */
  shoulderFriendly: boolean;
  /** Paso de carga típico de la máquina/barra, usado por los botones rápidos. */
  increment: number;
}

export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  note?: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  focus: 'legs' | 'upper';
  /** Día habitual (0=domingo … 6=sábado, como Date.getDay()). */
  weekday?: number;
  /** Posición en la lista (menor = antes). */
  order?: number;
  updatedAt?: number;
  exercises: TemplateExercise[];
}

export interface WorkoutSet {
  weight: number;
  reps: number;
  done: boolean;
  completedAt?: number;
}

export interface WorkoutExercise {
  exerciseId: string;
  restSec: number;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  date: ISODate;
  name: string;
  templateId?: string;
  focus?: WorkoutTemplate['focus'];
  startedAt: number;
  finishedAt?: number;
  exercises: WorkoutExercise[];
  updatedAt: number;
  demo?: boolean;
}

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  per100g: Macros;
  source: 'openfoodfacts' | 'label' | 'ai' | 'manual' | 'builtin';
  updatedAt: number;
}

export interface MealItem extends Macros {
  name: string;
  grams: number;
}

export type MealSource = 'quick' | 'photo' | 'barcode' | 'label' | 'text' | 'manual';

export interface MealEntry {
  id: string;
  date: ISODate;
  time: string; // HH:MM
  name: string;
  source: MealSource;
  items: MealItem[];
  updatedAt: number;
  demo?: boolean;
}

export interface Favorite {
  id: string;
  name: string;
  emoji: string;
  items: MealItem[];
  updatedAt: number;
}

export interface BodyWeight {
  date: ISODate;
  kg: number;
  updatedAt: number;
  demo?: boolean;
}

export interface Profile {
  heightCm: number;
  weightKg: number;
  goal: string;
  targets: Macros;
  /** kcal extra que se suman (en carbohidratos) un día de pierna de alto volumen. */
  legDayBonusKcal: number;
  /** Series efectivas de tren inferior a partir de las cuales el día cuenta como "pierna pesada". */
  legDaySetThreshold: number;
  restSec: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}
