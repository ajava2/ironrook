import { describe, expect, it } from 'vitest';
import { buildCoachSystemPrompt, localDinnerAdvice, localLegAnalysis, localShoulderSwap, type CoachSnapshot } from '../../src/core/coach';
import { EXERCISE_MAP, SHOULDER_SAFE_SWAPS } from '../../src/data/catalog';
import { DEFAULT_FAVORITES, DEFAULT_PROFILE } from '../../src/data/defaults';
import { generateDemo } from '../../src/data/demo';

const demo = generateDemo('2026-10-28');

function snapshot(remaining = { kcal: 700, protein: 55, carbs: 70, fat: 20 }): CoachSnapshot {
  return {
    date: '2026-10-28',
    profile: DEFAULT_PROFILE,
    day: {
      targets: DEFAULT_PROFILE.targets,
      legDay: false,
      lowerBodySets: 0,
      bonusKcal: 0,
      consumed: { kcal: 2000 - remaining.kcal, protein: 150 - remaining.protein, carbs: 220 - remaining.carbs, fat: 65 - remaining.fat },
      remaining,
    },
    mealsToday: [],
    recentWorkouts: demo.workouts,
    weights: demo.weights,
    favorites: DEFAULT_FAVORITES,
  };
}

describe('buildCoachSystemPrompt', () => {
  it('inyecta lo que falta hoy, entrenos de la semana, peso y favoritos', () => {
    const prompt = buildCoachSystemPrompt(snapshot(), EXERCISE_MAP);
    expect(prompt).toContain('Falta: 700 kcal · P 55 g');
    expect(prompt).toContain('## Entrenos últimos 7 días');
    expect(prompt).toContain('V-Squat');
    expect(prompt).toMatch(/Tendencia \(EMA 7 días\): \d+\.?\d* kg/);
    expect(prompt).toContain('Bocadillo de lomo');
  });
});

describe('coach local', () => {
  it('propone cena a partir de los favoritos que mejor encajan', () => {
    const text = localDinnerAdvice(snapshot());
    expect(text).toContain('Te faltan **700 kcal**');
    expect(text).toMatch(/1\. \*\*.+\*\*/);
  });

  it('si ya no quedan kcal sugiere solo proteína', () => {
    expect(localDinnerAdvice(snapshot({ kcal: 50, protein: 10, carbs: 0, fat: 0 }))).toContain('skyr');
  });

  it('analiza la progresión de pierna del último mes', () => {
    const text = localLegAnalysis(snapshot(), EXERCISE_MAP);
    expect(text).toContain('V-Squat');
    expect(text).toMatch(/e1RM [\d.]+ → [\d.]+ kg/);
  });

  it('sustituye un ejercicio por alternativas sin carga en el hombro', () => {
    const text = localShoulderSwap('smith_incline_press', EXERCISE_MAP, SHOULDER_SAFE_SWAPS);
    expect(text).toContain('Press neutro con mancuernas');
  });
});
