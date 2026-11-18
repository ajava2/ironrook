import { today } from '../core/dates';
import { BackupSchema, ProfileSchema, type Backup } from '../core/schemas';
import type {
  BodyWeight,
  ChatMessage,
  Favorite,
  FoodItem,
  ISODate,
  MealEntry,
  Profile,
  Workout,
  WorkoutTemplate,
} from '../core/types';
import type { FitDatabase } from './db';
import { DEFAULT_FAVORITES, DEFAULT_PROFILE } from './defaults';
import { generateDemo } from './demo';

const META = {
  profile: 'profile',
  activeWorkout: 'activeWorkout',
  seeded: 'seeded',
  lastSync: 'lastSync',
} as const;

export type SyncedStore = 'workouts' | 'meals' | 'weights' | 'foods' | 'favorites';

/**
 * Único punto de acceso a IndexedDB. La UI nunca toca `db` directamente: así el día que
 * cambie el almacenamiento (PocketBase, SQLite) solo cambia esta clase.
 */
export class Repository {
  constructor(private readonly db: FitDatabase) {}

  /* ---------- Arranque ---------- */

  /** Primera ejecución: perfil por defecto, favoritos y 3 semanas de demo. Idempotente. */
  async seedIfEmpty(todayIso: ISODate = today()): Promise<boolean> {
    if (await this.db.get('meta', META.seeded)) return false;
    const demo = generateDemo(todayIso);
    const tx = this.db.transaction(['meta', 'favorites', 'workouts', 'meals', 'weights'], 'readwrite');
    await Promise.all([
      tx.objectStore('meta').put(DEFAULT_PROFILE, META.profile),
      // updatedAt creciente = orden de la lista por defecto (bocadillos primero).
      ...DEFAULT_FAVORITES.map((f, i) => tx.objectStore('favorites').put({ ...f, updatedAt: Date.now() + i })),
      ...demo.workouts.map((w) => tx.objectStore('workouts').put(w)),
      ...demo.meals.map((m) => tx.objectStore('meals').put(m)),
      ...demo.weights.map((w) => tx.objectStore('weights').put(w)),
      tx.objectStore('meta').put(true, META.seeded),
    ]);
    await tx.done;
    return true;
  }

  async clearDemoData(): Promise<number> {
    let removed = 0;
    for (const store of ['workouts', 'meals', 'weights'] as const) {
      const tx = this.db.transaction(store, 'readwrite');
      let cursor = await tx.store.openCursor();
      while (cursor) {
        if ((cursor.value as { demo?: boolean }).demo) {
          await cursor.delete();
          removed++;
        }
        cursor = await cursor.continue();
      }
      await tx.done;
    }
    return removed;
  }

  /** Borra todo y deja la app como recién instalada pero sin demo: perfil y favoritos por defecto. */
  async resetAll(): Promise<void> {
    const stores = ['workouts', 'templates', 'meals', 'weights', 'foods', 'favorites', 'chat', 'meta'] as const;
    const tx = this.db.transaction([...stores], 'readwrite');
    await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
    await Promise.all([
      tx.objectStore('meta').put(DEFAULT_PROFILE, META.profile),
      tx.objectStore('meta').put(true, META.seeded),
      ...DEFAULT_FAVORITES.map((f, i) => tx.objectStore('favorites').put({ ...f, updatedAt: Date.now() + i })),
    ]);
    await tx.done;
  }

  /* ---------- Perfil ---------- */

  async getProfile(): Promise<Profile> {
    const stored = await this.db.get('meta', META.profile);
    const parsed = ProfileSchema.safeParse(stored);
    return parsed.success ? parsed.data : DEFAULT_PROFILE;
  }

  async saveProfile(profile: Profile): Promise<Profile> {
    const valid = ProfileSchema.parse(profile);
    await this.db.put('meta', valid, META.profile);
    return valid;
  }

  /* ---------- Entrenos ---------- */

  async allWorkouts(): Promise<Workout[]> {
    const list = await this.db.getAll('workouts');
    return list.sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt);
  }

  workoutsOn(date: ISODate): Promise<Workout[]> {
    return this.db.getAllFromIndex('workouts', 'by_date', date);
  }

  workoutsBetween(from: ISODate, to: ISODate): Promise<Workout[]> {
    return this.db.getAllFromIndex('workouts', 'by_date', IDBKeyRange.bound(from, to));
  }

  async saveWorkout(w: Workout): Promise<void> {
    await this.db.put('workouts', { ...w, updatedAt: Date.now() });
  }

  async deleteWorkout(id: string): Promise<void> {
    await this.db.delete('workouts', id);
  }

  /** El entreno en curso vive aparte para sobrevivir a recargas sin contaminar el histórico. */
  async getActiveWorkout(): Promise<Workout | undefined> {
    return (await this.db.get('meta', META.activeWorkout)) as Workout | undefined;
  }

  async setActiveWorkout(w: Workout | undefined): Promise<void> {
    if (w) await this.db.put('meta', w, META.activeWorkout);
    else await this.db.delete('meta', META.activeWorkout);
  }

  /* ---------- Comidas ---------- */

  async mealsOn(date: ISODate): Promise<MealEntry[]> {
    const list = await this.db.getAllFromIndex('meals', 'by_date', date);
    return list.sort((a, b) => a.time.localeCompare(b.time));
  }

  mealsBetween(from: ISODate, to: ISODate): Promise<MealEntry[]> {
    return this.db.getAllFromIndex('meals', 'by_date', IDBKeyRange.bound(from, to));
  }

  async saveMeal(m: MealEntry): Promise<void> {
    await this.db.put('meals', { ...m, updatedAt: Date.now() });
  }

  async deleteMeal(id: string): Promise<void> {
    await this.db.delete('meals', id);
  }

  /* ---------- Peso corporal ---------- */

  async allWeights(): Promise<BodyWeight[]> {
    return this.db.getAll('weights');
  }

  async saveWeight(date: ISODate, kg: number): Promise<void> {
    await this.db.put('weights', { date, kg, updatedAt: Date.now() });
  }

  async deleteWeight(date: ISODate): Promise<void> {
    await this.db.delete('weights', date);
  }

  /* ---------- Alimentos (caché local de códigos de barras y etiquetas) ---------- */

  async foodByBarcode(barcode: string): Promise<FoodItem | undefined> {
    return this.db.getFromIndex('foods', 'by_barcode', barcode);
  }

  allFoods(): Promise<FoodItem[]> {
    return this.db.getAll('foods');
  }

  async saveFood(f: FoodItem): Promise<void> {
    await this.db.put('foods', { ...f, updatedAt: Date.now() });
  }

  /* ---------- Favoritos ---------- */

  async allFavorites(): Promise<Favorite[]> {
    const list = await this.db.getAll('favorites');
    return list.sort((a, b) => a.updatedAt - b.updatedAt);
  }

  async saveFavorite(f: Favorite): Promise<void> {
    await this.db.put('favorites', { ...f, updatedAt: Date.now() });
  }

  async deleteFavorite(id: string): Promise<void> {
    await this.db.delete('favorites', id);
  }
  /* ---------- Rutinas (plantillas) ---------- */

  async allTemplates(): Promise<WorkoutTemplate[]> {
    const list = await this.db.getAll('templates');
    return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
  }

  async saveTemplate(t: WorkoutTemplate): Promise<void> {
    await this.db.put('templates', { ...t, updatedAt: Date.now() });
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.db.delete('templates', id);
  }

  /** Guarda el orden: la plantilla en la posición i recibe order = i. */
  async saveTemplateOrder(ids: string[]): Promise<void> {
    const tx = this.db.transaction('templates', 'readwrite');
    await Promise.all(
      ids.map(async (id, i) => {
        const t = await tx.store.get(id);
        if (t) await tx.store.put({ ...t, order: i });
      }),
    );
    await tx.done;
  }

  /* ---------- Chat del coach ---------- */

  async chatHistory(): Promise<ChatMessage[]> {
    const list = await this.db.getAll('chat');
    return list.sort((a, b) => a.createdAt - b.createdAt);
  }

  async saveChatMessage(m: ChatMessage): Promise<void> {
    await this.db.put('chat', m);
  }

  async clearChat(): Promise<void> {
    await this.db.clear('chat');
  }

  /* ---------- Sincronización ---------- */

  async getLastSync(): Promise<number> {
    return ((await this.db.get('meta', META.lastSync)) as number | undefined) ?? 0;
  }

  async setLastSync(ts: number): Promise<void> {
    await this.db.put('meta', ts, META.lastSync);
  }

  async rawAll(store: SyncedStore): Promise<{ updatedAt: number }[]> {
    return this.db.getAll(store);
  }

  async rawPutMany(store: SyncedStore, items: readonly unknown[]): Promise<void> {
    const tx = this.db.transaction(store, 'readwrite');
    await Promise.all(items.map((i) => tx.store.put(i as never)));
    await tx.done;
  }

  /* ---------- Copia de seguridad ---------- */

  async exportBackup(): Promise<Backup> {
    const [profile, workouts, meals, weights, foods, favorites, templates ] = await Promise.all([
      this.getProfile(),
      this.db.getAll('workouts'),
      this.db.getAll('meals'),
      this.db.getAll('weights'),
      this.db.getAll('foods'),
      this.db.getAll('favorites'),
      this.db.getAll('templates'),
    ]);
    return {
      app: 'fit-ai-tracker',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      workouts,
      meals,
      weights,
      foods,
      favorites,
      templates,
    };
  }

  /**
   * Importa sobre los datos existentes (upsert por id). Valida todo el fichero antes de
   * escribir nada, y escribe en una sola transacción: o entra la copia entera o no entra nada.
   */
  async importBackup(raw: unknown): Promise<{ records: number }> {
    const backup = BackupSchema.parse(raw);
    const stores = ['workouts', 'meals', 'weights', 'foods', 'favorites', 'meta', 'templates'] as const;
    const tx = this.db.transaction([...stores], 'readwrite');
    const ops: Promise<unknown>[] = [];
    backup.workouts.forEach((w) => ops.push(tx.objectStore('workouts').put(w)));
    backup.meals.forEach((m) => ops.push(tx.objectStore('meals').put(m)));
    backup.weights.forEach((w) => ops.push(tx.objectStore('weights').put(w)));
    backup.foods.forEach((f) => ops.push(tx.objectStore('foods').put(f)));
    backup.favorites.forEach((f) => ops.push(tx.objectStore('favorites').put(f)));
    backup.templates.forEach((t) => ops.push(tx.objectStore('templates').put(t)));
    if (backup.profile) ops.push(tx.objectStore('meta').put(backup.profile, META.profile));
    ops.push(tx.objectStore('meta').put(true, META.seeded));
    await Promise.all(ops);
    await tx.done;
    return {
      records:
        backup.workouts.length + backup.meals.length + backup.weights.length + backup.foods.length + backup.favorites.length,
    };
  }
}
