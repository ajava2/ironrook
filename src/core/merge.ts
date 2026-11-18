export interface Versioned {
  updatedAt: number;
}

/**
 * Fusión last-write-wins por clave: para cada id gana la versión con `updatedAt` mayor.
 * Es la estrategia de sincronización más simple que converge: aplicar merge(a, b) en
 * cualquier orden y cualquier número de veces da el mismo resultado (conmutativa e idempotente).
 */
export function mergeLWW<T extends Versioned>(local: readonly T[], remote: readonly T[], key: (item: T) => string): T[] {
  const out = new Map<string, T>();
  for (const item of [...local, ...remote]) {
    const k = key(item);
    const prev = out.get(k);
    if (!prev || item.updatedAt > prev.updatedAt) out.set(k, item);
  }
  return [...out.values()];
}

export function changedSince<T extends Versioned>(items: readonly T[], since: number): T[] {
  return items.filter((i) => i.updatedAt > since);
}
