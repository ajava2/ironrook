import { changedSince, mergeLWW } from '../core/merge';
import { pbRecordId } from '../core/pbId';
import type { Repository, SyncedStore } from '../data/repository';

/**
 * Sincronización con un PocketBase propio. Usa UNA colección genérica `fit_records`:
 *   store (text) · key (text) · payload (json) · updatedAt (number)
 * El id remoto se deriva de store+key, así que subir es un upsert idempotente.
 */
const COLLECTION = 'fit_records';
const STORES: SyncedStore[] = ['workouts', 'meals', 'weights', 'foods', 'favorites'];
const TOKEN_KEY = 'fit.pbToken';

interface RemoteRecord {
  id: string;
  store: SyncedStore;
  key: string;
  payload: { updatedAt: number } & Record<string, unknown>;
  updatedAt: number;
}

function keyOf(store: SyncedStore, item: Record<string, unknown>): string {
  return String(store === 'weights' ? item.date : item.id);
}

export function getPbToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export async function pbLogin(baseUrl: string, email: string, password: string): Promise<void> {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/collections/users/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });
  if (!res.ok) throw new Error(`Login PocketBase falló (HTTP ${res.status})`);
  const { token } = (await res.json()) as { token: string };
  localStorage.setItem(TOKEN_KEY, token);
}

export function pbLogout(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface SyncResult {
  pushed: number;
  pulled: number;
}

export async function syncWithPocketBase(baseUrl: string, repo: Repository): Promise<SyncResult> {
  const base = `${baseUrl.replace(/\/$/, '')}/api/collections/${COLLECTION}/records`;
  const token = getPbToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) };
  const lastSync = await repo.getLastSync();
  const startedAt = Date.now();

  let pushed = 0;
  for (const store of STORES) {
    const local = (await repo.rawAll(store)) as unknown as RemoteRecord['payload'][];
    for (const item of changedSince(local, lastSync)) {
      const key = keyOf(store, item);
      const id = pbRecordId(store, key);
      const body = JSON.stringify({ store, key, payload: item, updatedAt: item.updatedAt });
      let res = await fetch(`${base}/${id}`, { method: 'PATCH', headers, body });
      if (res.status === 404) res = await fetch(base, { method: 'POST', headers, body: JSON.stringify({ id, store, key, payload: item, updatedAt: item.updatedAt }) });
      if (!res.ok) throw new Error(`Error subiendo ${store}/${key}: HTTP ${res.status}`);
      pushed++;
    }
  }

  const remote: RemoteRecord[] = [];
  for (let page = 1; ; page++) {
    const filter = encodeURIComponent(`updatedAt > ${lastSync}`);
    const res = await fetch(`${base}?filter=${filter}&perPage=200&page=${page}`, { headers });
    if (!res.ok) throw new Error(`Error descargando cambios: HTTP ${res.status}`);
    const data = (await res.json()) as { items: RemoteRecord[]; totalPages: number };
    remote.push(...data.items);
    if (page >= data.totalPages) break;
  }

  let pulled = 0;
  for (const store of STORES) {
    const incoming = remote.filter((r) => r.store === store).map((r) => r.payload);
    if (incoming.length === 0) continue;
    const local = (await repo.rawAll(store)) as unknown as RemoteRecord['payload'][];
    const localKeys = new Map(local.map((l) => [keyOf(store, l), l.updatedAt]));
    const merged = mergeLWW(local, incoming, (x) => keyOf(store, x));
    const winners = merged.filter((m) => (localKeys.get(keyOf(store, m)) ?? -1) < m.updatedAt);
    await repo.rawPutMany(store, winners);
    pulled += winners.length;
  }

  // Si otro dispositivo tiene el reloj adelantado, sus registros traen updatedAt > startedAt:
  // avanzar la marca hasta ellos evita volver a subirlos en la próxima sincronización.
  const newest = remote.reduce((m, r) => Math.max(m, r.updatedAt), 0);
  await repo.setLastSync(Math.max(startedAt, newest));
  return { pushed, pulled };
}
