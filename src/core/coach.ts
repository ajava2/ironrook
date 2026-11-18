import { addDays, formatWeekday } from './dates';
import { sumMacros } from './macros';
import { estimate1RM } from './oneRepMax';
import { rankByRemaining } from './suggest';
import type { DailyTargets } from './targets';
import { emaTrend, weeklyRate, type DatedValue } from './trend';
import type { BodyWeight, Favorite, ISODate, Macros, MealEntry, Profile, Workout } from './types';
import { e1rmHistory, LOWER_BODY, workoutVolume, type Catalog } from './volume';

export interface CoachSnapshot {
  date: ISODate;
  profile: Profile;
  day: DailyTargets & { consumed: Macros; remaining: Macros };
  mealsToday: MealEntry[];
  recentWorkouts: Workout[];
  weights: BodyWeight[];
  favorites: Favorite[];
}

const fmt = (m: Macros) => `${Math.round(m.kcal)} kcal · P ${Math.round(m.protein)} g · C ${Math.round(m.carbs)} g · G ${Math.round(m.fat)} g`;

function bestSetLine(w: Workout, catalog: Catalog): string {
  const tops = w.exercises
    .map((ex) => {
      const best = ex.sets.filter((s) => s.done).sort((a, b) => estimate1RM(b) - estimate1RM(a))[0];
      return best ? `${catalog.get(ex.exerciseId)?.name ?? ex.exerciseId} ${best.weight}×${best.reps}` : null;
    })
    .filter(Boolean)
    .slice(0, 4);
  return tops.join(', ');
}

export function weightTrendSummary(weights: readonly BodyWeight[]): { trend?: number; weekly?: number } {
  if (weights.length === 0) return {};
  const points: DatedValue[] = weights.map((w) => ({ date: w.date, value: w.kg }));
  const ema = emaTrend(points);
  return { trend: ema.at(-1)!.value, weekly: weeklyRate(ema.slice(-14)) };
}

/**
 * Prompt de sistema con el estado real del usuario. Se regenera en cada mensaje, así el modelo
 * siempre razona con los macros que faltan *ahora*, no con los de cuando empezó la conversación.
 */
export function buildCoachSystemPrompt(s: CoachSnapshot, catalog: Catalog): string {
  const { profile, day } = s;
  const lines: string[] = [];
  lines.push(
    `Eres el coach personal de fuerza y nutrición de un estudiante de ingeniería (${profile.heightCm} cm, ${profile.weightKg} kg). Objetivo: ${profile.goal}.`,
    'Responde en español, directo y concreto, sin relleno, en menos de 180 palabras salvo que te pidan detalle. Usa los números del contexto.',
    'Preferencias: comidas rápidas, bocadillos y sándwiches. Hombro delicado: evita press tras nuca, press militar con barra, fondos y aperturas profundas; prioriza agarre neutro, máquinas guiadas y poleas.',
    '',
    `## Hoy (${formatWeekday(s.date)})`,
    `Objetivo: ${fmt(day.targets)}${day.legDay ? ` (incluye +${day.bonusKcal} kcal en carbos por día de pierna pesada, ${day.lowerBodySets} series)` : ''}`,
    `Consumido: ${fmt(day.consumed)}`,
    `Falta: ${fmt(day.remaining)}`,
  );
  if (s.mealsToday.length) {
    lines.push('Comidas de hoy:');
    for (const m of s.mealsToday) lines.push(`- ${m.time} ${m.name}: ${fmt(sumMacros(m.items))}`);
  } else {
    lines.push('Comidas de hoy: ninguna registrada.');
  }

  lines.push('', '## Entrenos últimos 7 días');
  const since = addDays(s.date, -7);
  const week = s.recentWorkouts.filter((w) => w.date > since);
  if (week.length === 0) lines.push('Ninguno.');
  for (const w of week) {
    const lower = workoutVolume(w, catalog, LOWER_BODY);
    lines.push(`- ${formatWeekday(w.date)} ${w.name}: ${lower.sets} series de pierna; top: ${bestSetLine(w, catalog)}`);
  }

  const { trend, weekly } = weightTrendSummary(s.weights);
  if (trend !== undefined) {
    lines.push('', '## Peso', `Tendencia (EMA 7 días): ${trend} kg, ritmo ${weekly! >= 0 ? '+' : ''}${weekly} kg/semana.`);
  }

  if (s.favorites.length) {
    lines.push('', '## Comidas favoritas que suele comer');
    for (const f of s.favorites) lines.push(`- ${f.name}: ${fmt(sumMacros(f.items))}`);
  }
  return lines.join('\n');
}

/* ---------- Coach local (sin IA): respuestas deterministas para las consultas rápidas ---------- */

export function localDinnerAdvice(s: CoachSnapshot): string {
  const r = s.day.remaining;
  if (r.kcal < 150) {
    return `Hoy ya estás en ${Math.round(s.day.consumed.kcal)} de ${s.day.targets.kcal} kcal. Si tienes hambre, tira de algo casi solo proteína: skyr o queso batido 0 % (~60 kcal y 10 g de proteína por 100 g).`;
  }
  const ranked = rankByRemaining(
    s.favorites.map((f) => ({ name: f.name, macros: sumMacros(f.items) })),
    r,
  );
  const top = ranked.slice(0, 3);
  const lines = [
    `Te faltan **${Math.round(r.kcal)} kcal**, **${Math.round(r.protein)} g de proteína**, ${Math.round(r.carbs)} g de carbos y ${Math.round(r.fat)} g de grasa.`,
    '',
    'Lo que mejor encaja de tus favoritos:',
    ...top.map(
      (c, i) =>
        `${i + 1}. **${c.name}** — ${Math.round(c.macros.kcal)} kcal, P ${Math.round(c.macros.protein)} g${c.fitsKcal ? '' : ' (te pasarías un poco: reduce el pan)'}`,
    ),
  ];
  const best = top[0];
  if (best) {
    const proteinGap = r.protein - best.macros.protein;
    if (proteinGap > 20) lines.push('', `Aun así te quedarían ~${Math.round(proteinGap)} g de proteína: añade un skyr o un batido de whey.`);
  }
  return lines.join('\n');
}

export function localLegAnalysis(s: CoachSnapshot, catalog: Catalog): string {
  const since = addDays(s.date, -30);
  const monthly = s.recentWorkouts.filter((w) => w.date >= since);
  const legIds = [...catalog.values()].filter((e) => LOWER_BODY.has(e.primary)).map((e) => e.id);
  const rows: string[] = [];
  for (const id of legIds) {
    const hist = e1rmHistory(monthly, id);
    if (hist.length < 2) continue;
    const first = hist[0]!;
    const last = hist.at(-1)!;
    const delta = Math.round((last.e1rm - first.e1rm) * 10) / 10;
    const pct = Math.round((delta / first.e1rm) * 1000) / 10;
    rows.push(`- **${catalog.get(id)!.name}**: e1RM ${first.e1rm} → ${last.e1rm} kg (${delta >= 0 ? '+' : ''}${pct} %), última ${last.weight}×${last.reps}`);
  }
  if (rows.length === 0) return 'Aún no hay dos sesiones de pierna en los últimos 30 días para comparar. Registra al menos dos y vuelve a preguntar.';
  const sessions = monthly.filter((w) => workoutVolume(w, catalog, LOWER_BODY).sets >= 6);
  const totalSets = sessions.reduce((a, w) => a + workoutVolume(w, catalog, LOWER_BODY).sets, 0);
  const weeks = Math.max(1, Math.round(30 / 7));
  return [
    `Últimos 30 días: ${sessions.length} sesiones de pierna, ~${Math.round(totalSets / weeks)} series efectivas/semana.`,
    '',
    ...rows,
    '',
    'Regla práctica: si un ejercicio sube <1 % en un mes con el mismo rango de reps, añade 1 serie o cambia el rango; si sube >5 %, mantén y no toques nada.',
  ].join('\n');
}

export function localShoulderSwap(exerciseId: string, catalog: Catalog, swaps: Record<string, string[]>): string {
  const ex = catalog.get(exerciseId);
  if (!ex) return 'No encuentro ese ejercicio en el catálogo.';
  const options = (swaps[exerciseId] ?? []).map((id) => catalog.get(id)).filter((e) => e !== undefined);
  if (options.length === 0) {
    return ex.shoulderFriendly
      ? `**${ex.name}** ya es amigable con el hombro. Mantén codos a ~45° del torso y rango sin dolor.`
      : `No tengo sustituto registrado para **${ex.name}**. Busca una variante guiada con agarre neutro.`;
  }
  return [
    `Para **${ex.name}** sin cargar el hombro:`,
    ...options.map((o, i) => `${i + 1}. **${o.name}**`),
    '',
    'Por qué: trayectoria guiada, agarre neutro y sin rotación interna bajo carga. Empieza con un 10-15 % menos de peso y las mismas repeticiones.',
  ].join('\n');
}
