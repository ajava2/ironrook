import { describe, expect, it } from 'vitest';
import type { AIClient } from '../../src/services/ai';
import { analyzeMealPhoto, parseMealDescription, readNutritionLabel } from '../../src/services/nutritionAI';

function fakeClient(reply: string): AIClient {
  return {
    label: 'fake',
    chat: async () => reply,
    json: async () => reply,
  };
}

const image = { mimeType: 'image/jpeg', base64: 'AAAA' };

describe('analyzeMealPhoto', () => {
  it('acepta JSON envuelto en markdown y con claves en español', async () => {
    const client = fakeClient('```json\n{"nombre":"Arroz con pollo","ingredientes":[{"nombre":"Arroz","gramos":"200","calorias":260,"proteinas":5.4,"carbohidratos":56,"grasas":0.6}]}\n```');
    const r = await analyzeMealPhoto(client, image);
    expect(r.simulated).toBe(false);
    expect(r.name).toBe('Arroz con pollo');
    expect(r.items[0]).toEqual({ name: 'Arroz', grams: 200, kcal: 260, protein: 5.4, carbs: 56, fat: 0.6 });
  });

  it('rechaza respuestas sin ingredientes', async () => {
    await expect(analyzeMealPhoto(fakeClient('{"items": []}'), image)).rejects.toThrow();
  });

  it('sin cliente devuelve un plato simulado marcado como tal', async () => {
    const r = await analyzeMealPhoto(null, image);
    expect(r.simulated).toBe(true);
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.notes).toMatch(/simulación/);
  });
});

describe('parseMealDescription', () => {
  it('sin IA usa el parser local', async () => {
    const r = await parseMealDescription(null, 'Bocadillo con 100g de pan y 120g de lomo');
    expect(r.simulated).toBe(true);
    expect(r.items.map((i) => i.grams)).toEqual([100, 120]);
  });

  it('sin IA y sin nada reconocible lanza un error explicativo', async () => {
    await expect(parseMealDescription(null, 'algo raro')).rejects.toThrow(/No reconozco/);
  });
});

describe('readNutritionLabel', () => {
  it('lee la tabla por 100 g desde la IA', async () => {
    const r = await readNutritionLabel(fakeClient('{"name":"Skyr","brand":"Hacendado","per100g":{"kcal":63,"protein":11,"carbs":4,"fat":0.2}}'), image);
    expect(r).toEqual({ name: 'Skyr', brand: 'Hacendado', per100g: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 }, simulated: false });
  });
});
