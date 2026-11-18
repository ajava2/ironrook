import { TemplateSchema } from './schemas';
import type { WorkoutTemplate } from './types';

const PREFIX = 'FITAI1:';

/** Devuelve una copia de la lista con el elemento `from` movido a la posición `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return [...list];
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item as T);
  return copy;
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Convierte una rutina en un texto corto que se puede pegar por WhatsApp. */
export function encodeTemplate(t: WorkoutTemplate): string {
  const payload = {
    name: t.name,
    focus: t.focus,
    weekday: t.weekday,
    exercises: t.exercises,
  };
  return PREFIX + toBase64(JSON.stringify(payload));
}

export type DecodeResult = { ok: true; template: WorkoutTemplate; unknown: string[] } | { ok: false; error: string };

/**
 * Lee el texto de una rutina compartida. Genera un id nuevo (para no pisar nada)
 * y avisa de los ejercicios que no existen en este móvil (`knownIds`).
 */
export function decodeTemplate(text: string, newId: string, knownIds: ReadonlySet<string>): DecodeResult {
  const clean = text.trim().replace(/\s+/g, '');
  const start = clean.indexOf(PREFIX);
  if (start < 0) return { ok: false, error: 'Ese texto no parece una rutina de Fit AI Tracker.' };
  let json: unknown;
  try {
    json = JSON.parse(fromBase64(clean.slice(start + PREFIX.length)));
  } catch {
    return { ok: false, error: 'El código está incompleto o dañado. Cópialo entero otra vez.' };
  }
  const parsed = TemplateSchema.safeParse({ ...(json as object), id: newId });
  if (!parsed.success) return { ok: false, error: 'La rutina tiene datos no válidos.' };
  const t = parsed.data as WorkoutTemplate;
  if (t.exercises.some((e) => e.repMin > e.repMax)) return { ok: false, error: 'La rutina tiene rangos de repeticiones no válidos.' };
  const unknown = [...new Set(t.exercises.map((e) => e.exerciseId).filter((id) => !knownIds.has(id)))];
  return { ok: true, template: { ...t, updatedAt: Date.now() }, unknown };
}
