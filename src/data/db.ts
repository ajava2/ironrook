import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BodyWeight, ChatMessage, Favorite, FoodItem, MealEntry, Workout, WorkoutTemplate, Exercise} from '../core/types';

export interface FitDB extends DBSchema {
  workouts: { key: string; value: Workout; indexes: { by_date: string } };
  meals: { key: string; value: MealEntry; indexes: { by_date: string } };
  weights: { key: string; value: BodyWeight };
  foods: { key: string; value: FoodItem; indexes: { by_barcode: string } };
  favorites: { key: string; value: Favorite };
  chat: { key: string; value: ChatMessage };
  templates: { key: string; value: WorkoutTemplate };
  /** Clave-valor para objetos únicos: perfil, entreno en curso, marcas de sincronización. */
  meta: { key: string; value: unknown };
  customExercises: { key: string; value: Exercise };
}

export type FitDatabase = IDBPDatabase<FitDB>;

export const DB_NAME = 'fit-ai-tracker';
export const DB_VERSION = 3;

/**
 * Las migraciones se encadenan por versión: cada `if (oldVersion < N)` crea lo que la
 * versión N añadió. Un usuario que salte de v1 a v3 ejecuta ambos bloques en orden.
 */
export function openFitDb(name = DB_NAME): Promise<FitDatabase> {
  return openDB<FitDB>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('workouts', { keyPath: 'id' }).createIndex('by_date', 'date');
        db.createObjectStore('meals', { keyPath: 'id' }).createIndex('by_date', 'date');
        db.createObjectStore('weights', { keyPath: 'date' });
        db.createObjectStore('foods', { keyPath: 'id' }).createIndex('by_barcode', 'barcode');
        db.createObjectStore('favorites', { keyPath: 'id' });
        db.createObjectStore('chat', { keyPath: 'id' });
        db.createObjectStore('meta');
      }
      if (oldVersion < 2) {
        db.createObjectStore('templates', { keyPath: 'id' });
      }
      if (oldVersion < 3) {
        db.createObjectStore('customExercises', { keyPath: 'id' });
      }
    },
  });
}
