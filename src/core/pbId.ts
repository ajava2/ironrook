/**
 * Id determinista de 15 caracteres [a-z0-9] (formato de PocketBase) a partir de "store:clave".
 * Permite hacer upsert con un PATCH directo al id, sin buscar antes el registro remoto.
 * FNV-1a de 32 bits aplicado con dos semillas distintas para tener ~64 bits de dispersión.
 */
export function pbRecordId(store: string, key: string): string {
  const input = `${store}:${key}`;
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
  };
  const a = fnv(0x811c9dc5).toString(36).padStart(7, '0');
  const b = fnv(0x01234567).toString(36).padStart(8, '0');
  return (a + b).slice(0, 15);
}
