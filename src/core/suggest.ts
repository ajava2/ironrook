import type { Macros } from './types';

export interface Candidate {
  name: string;
  macros: Macros;
}

export interface RankedCandidate extends Candidate {
  score: number;
  fitsKcal: boolean;
}

/**
 * Ordena comidas por lo bien que encajan en los macros restantes.
 *
 *   error = Σ wₘ · ((cₘ − rₘ) / max(rₘ, sₘ))²     m ∈ {kcal, proteína, carbos, grasa}
 *
 * Error cuadrático relativo: un desvío de 20 g de proteína pesa más si te faltan 25 g que si te
 * faltan 120 g. sₘ evita dividir entre ~0 cuando ya casi has cerrado un macro. Pasarse de kcal
 * se penaliza ×3 porque, en recomposición, comer de más es peor que quedarse algo corto.
 */
export function rankByRemaining(candidates: readonly Candidate[], remaining: Macros): RankedCandidate[] {
  const weights = { kcal: 1, protein: 1.5, carbs: 0.6, fat: 0.6 };
  const floor = { kcal: 150, protein: 15, carbs: 20, fat: 8 };
  return candidates
    .map((c) => {
      let error = 0;
      for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const) {
        const rel = (c.macros[k] - remaining[k]) / Math.max(remaining[k], floor[k]);
        const overshoot = k === 'kcal' && c.macros.kcal > remaining.kcal ? 3 : 1;
        error += weights[k] * overshoot * rel * rel;
      }
      return { ...c, score: Math.round(error * 1000) / 1000, fitsKcal: c.macros.kcal <= remaining.kcal + 50 };
    })
    .sort((a, b) => a.score - b.score);
}
