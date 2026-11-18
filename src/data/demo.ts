import { addDays, parseISODate } from '../core/dates';
import type { BodyWeight, ISODate, MealEntry, Workout, WorkoutExercise } from '../core/types';
import { TEMPLATES } from './catalog';
import { builtinItem, DEFAULT_FAVORITES } from './defaults';

/** mulberry32: PRNG de 32 bits con semilla, para que la demo sea idéntica en cada instalación y en los tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Peso de trabajo inicial (kg) por ejercicio y progresión semanal. */
const START_LOADS: Record<string, { kg: number; weekly: number; reps: number }> = {
  v_squat: { kg: 100, weekly: 2.5, reps: 8 },
  hack_squat: { kg: 80, weekly: 2.5, reps: 10 },
  smith_squat: { kg: 70, weekly: 2.5, reps: 10 },
  hip_abduction: { kg: 55, weekly: 2.5, reps: 14 },
  leg_extension: { kg: 55, weekly: 2.5, reps: 12 },
  leg_curl: { kg: 45, weekly: 2.5, reps: 11 },
  calf_raise: { kg: 80, weekly: 5, reps: 12 },
  smith_incline_press: { kg: 60, weekly: 1.25, reps: 8 },
  db_neutral_press: { kg: 26, weekly: 1, reps: 10 },
  lat_pulldown: { kg: 65, weekly: 2.5, reps: 10 },
  chest_supported_row: { kg: 60, weekly: 2.5, reps: 10 },
  cable_lateral_raise: { kg: 7.5, weekly: 0.5, reps: 15 },
  face_pull: { kg: 20, weekly: 1.25, reps: 15 },
};

function timestamp(date: ISODate, hour: number, minute = 0): number {
  const d = parseISODate(date);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function buildWorkout(date: ISODate, templateIdx: number, week: number, rnd: () => number): Workout {
  const tpl = TEMPLATES[templateIdx]!;
  const start = timestamp(date, 18, 30);
  let clock = start;
  const exercises: WorkoutExercise[] = tpl.exercises.map((te) => {
    const load = START_LOADS[te.exerciseId] ?? { kg: 40, weekly: 1, reps: 10 };
    const kg = roundTo(load.kg + load.weekly * week, te.exerciseId === 'cable_lateral_raise' ? 0.5 : 1.25);
    const sets = Array.from({ length: te.sets }, (_, i) => {
      clock += te.restSec * 1000 + 45_000;
      const fatigue = i; // las últimas series caen alguna repetición
      const reps = Math.max(te.repMin, load.reps + Math.round(rnd() * 2) - Math.floor(fatigue / 2));
      return { weight: kg, reps, done: true, completedAt: clock };
    });
    return { exerciseId: te.exerciseId, restSec: te.restSec, sets };
  });
  return {
    id: `demo_w_${date}`,
    date,
    name: tpl.name,
    templateId: tpl.id,
    focus: tpl.focus,
    startedAt: start,
    finishedAt: clock,
    exercises,
    updatedAt: clock,
    demo: true,
  };
}

function favoriteMeal(id: string, date: ISODate, time: string, favId: string, scale = 1): MealEntry {
  const fav = DEFAULT_FAVORITES.find((f) => f.id === favId)!;
  const items = fav.items.map((it) => ({
    ...it,
    grams: Math.round(it.grams * scale),
    kcal: Math.round(it.kcal * scale),
    protein: Math.round(it.protein * scale * 10) / 10,
    carbs: Math.round(it.carbs * scale * 10) / 10,
    fat: Math.round(it.fat * scale * 10) / 10,
  }));
  const [h, m] = time.split(':').map(Number);
  return { id, date, time, name: fav.name, source: 'quick', items, updatedAt: timestamp(date, h!, m!), demo: true };
}

export interface DemoData {
  workouts: Workout[];
  meals: MealEntry[];
  weights: BodyWeight[];
}

/**
 * Tres semanas realistas que terminan ayer: pierna lunes y jueves, torso martes y viernes,
 * peso con tendencia de +0.25 kg/semana y ruido diario de ±0.4 kg (agua y glucógeno),
 * y comidas alrededor del objetivo con más hidratos los días de pierna.
 */
export function generateDemo(todayIso: ISODate, seed = 1337): DemoData {
  const rnd = mulberry32(seed);
  const days = 21;
  const first = addDays(todayIso, -days);
  const workouts: Workout[] = [];
  const meals: MealEntry[] = [];
  const weights: BodyWeight[] = [];

  for (let i = 0; i <= days; i++) {
    const date = addDays(first, i);
    const dow = (parseISODate(date).getDay() + 6) % 7; // 0 = lunes
    const week = Math.floor(i / 7);
    const isToday = date === todayIso;

    const prevWasLegDay = dow === 1 || dow === 4;
    if (rnd() > 0.12 || isToday) {
      const trend = 74.6 + (0.25 / 7) * i;
      const noise = (rnd() - 0.5) * 0.8 + (prevWasLegDay ? 0.3 : 0);
      weights.push({ date, kg: Math.round((trend + noise) * 10) / 10, updatedAt: timestamp(date, 8), demo: true });
    }
    if (isToday) continue;

    const legDay = dow === 0 || dow === 3;
    const upperDay = dow === 1 || dow === 4;
    if (legDay) workouts.push(buildWorkout(date, 0, week, rnd));
    if (upperDay) workouts.push(buildWorkout(date, 1, week, rnd));

    const lunch = rnd() > 0.5 ? 'fav_arroz_pollo' : 'fav_arroz_huevos';
    const dinner = ['fav_lomo', 'fav_jamon', 'fav_pollo', 'fav_sandwich'][Math.floor(rnd() * 4)]!;
    const carbBoost = legDay ? 1.25 : 1;
    meals.push(favoriteMeal(`demo_m_${date}_1`, date, '08:15', 'fav_desayuno', 1));
    meals.push(favoriteMeal(`demo_m_${date}_2`, date, '14:30', lunch, carbBoost * (0.9 + rnd() * 0.2)));
    if (legDay || upperDay) meals.push(favoriteMeal(`demo_m_${date}_3`, date, '20:15', 'fav_batido', 1));
    meals.push(favoriteMeal(`demo_m_${date}_4`, date, '21:45', dinner, 0.9 + rnd() * 0.25));
    if (rnd() > 0.55) {
      const snack = builtinItem('almendras', 25 + Math.round(rnd() * 15));
      meals.push({
        id: `demo_m_${date}_5`,
        date,
        time: '17:30',
        name: 'Puñado de almendras',
        source: 'manual',
        items: [snack],
        updatedAt: timestamp(date, 17, 30),
        demo: true,
      });
    }
  }

  return { workouts, meals, weights };
}
