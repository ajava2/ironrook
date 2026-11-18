import { describe, expect, it } from 'vitest';
import { csvEscape, toCSV } from '../../src/core/csv';
import { addDays, daysBetween, startOfWeek } from '../../src/core/dates';
import { changedSince, mergeLWW } from '../../src/core/merge';
import { parseOpenFoodFacts } from '../../src/core/openFoodFacts';
import { rankByRemaining } from '../../src/core/suggest';

describe('fechas', () => {
  it('addDays cruza meses y años', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('daysBetween no se rompe con el cambio de hora (25 oct 2026)', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('startOfWeek devuelve el lunes', () => {
    expect(startOfWeek('2026-10-28')).toBe('2026-10-26');
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26');
  });
});

describe('csv', () => {
  it('escapa comillas, comas y saltos de línea', () => {
    expect(csvEscape('Bocadillo "XL", lomo')).toBe('"Bocadillo ""XL"", lomo"');
    expect(csvEscape(12.5)).toBe('12.5');
    expect(csvEscape(undefined)).toBe('');
  });

  it('genera cabecera y filas', () => {
    const csv = toCSV([{ d: '2026-10-28', kg: 75 }], [
      { header: 'fecha', value: (r) => r.d },
      { header: 'peso', value: (r) => r.kg },
    ]);
    expect(csv).toBe('fecha,peso\n2026-10-28,75');
  });
});

describe('mergeLWW', () => {
  const key = (x: { id: string }) => x.id;

  it('gana la versión más reciente', () => {
    const local = [{ id: 'a', v: 1, updatedAt: 10 }, { id: 'b', v: 1, updatedAt: 30 }];
    const remote = [{ id: 'a', v: 2, updatedAt: 20 }, { id: 'c', v: 1, updatedAt: 5 }];
    const merged = mergeLWW(local, remote, key).sort((x, y) => x.id.localeCompare(y.id));
    expect(merged.map((m) => [m.id, m.v])).toEqual([['a', 2], ['b', 1], ['c', 1]]);
  });

  it('es conmutativa e idempotente', () => {
    const a = [{ id: 'x', updatedAt: 1 }, { id: 'y', updatedAt: 9 }];
    const b = [{ id: 'x', updatedAt: 5 }];
    const sort = (l: { id: string; updatedAt: number }[]) => [...l].sort((p, q) => p.id.localeCompare(q.id));
    expect(sort(mergeLWW(a, b, key))).toEqual(sort(mergeLWW(b, a, key)));
    const once = mergeLWW(a, b, key);
    expect(sort(mergeLWW(once, b, key))).toEqual(sort(once));
  });

  it('changedSince filtra por marca temporal', () => {
    expect(changedSince([{ updatedAt: 1 }, { updatedAt: 5 }], 3)).toEqual([{ updatedAt: 5 }]);
  });
});

describe('parseOpenFoodFacts', () => {
  it('lee nutrientes por 100 g', () => {
    const item = parseOpenFoodFacts('8480000123456', {
      status: 1,
      product: {
        product_name: 'Skyr natural',
        brands: 'Hacendado, Mercadona',
        nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 },
      },
    }, 0);
    expect(item).toEqual({
      id: 'off_8480000123456',
      name: 'Skyr natural',
      brand: 'Hacendado',
      barcode: '8480000123456',
      per100g: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 },
      source: 'openfoodfacts',
      updatedAt: 0,
    });
  });

  it('convierte kJ a kcal si no hay kcal', () => {
    const item = parseOpenFoodFacts('1', {
      product: { product_name: 'X', nutriments: { energy_100g: 1046, proteins_100g: 10, carbohydrates_100g: 20, fat_100g: 5 } },
    });
    expect(item!.per100g.kcal).toBe(250);
  });

  it('null si el producto no existe o le faltan macros', () => {
    expect(parseOpenFoodFacts('1', { status: 0 })).toBeNull();
    expect(parseOpenFoodFacts('1', { product: { product_name: 'X', nutriments: { proteins_100g: 1 } } })).toBeNull();
  });
});

describe('rankByRemaining', () => {
  it('prioriza la opción que mejor cierra proteína sin pasarse de kcal', () => {
    const remaining = { kcal: 600, protein: 50, carbs: 60, fat: 15 };
    const ranked = rankByRemaining(
      [
        { name: 'Pizza', macros: { kcal: 1100, protein: 40, carbs: 120, fat: 45 } },
        { name: 'Bocadillo de pollo', macros: { kcal: 560, protein: 48, carbs: 66, fat: 8 } },
        { name: 'Ensalada', macros: { kcal: 150, protein: 5, carbs: 10, fat: 10 } },
      ],
      remaining,
    );
    expect(ranked[0]!.name).toBe('Bocadillo de pollo');
    expect(ranked.at(-1)!.name).toBe('Pizza');
    expect(ranked[0]!.fitsKcal).toBe(true);
  });
});
