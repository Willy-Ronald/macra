/**
 * Macra — Minimum Budget Calculator
 *
 * Estimates the minimum weekly grocery budget required to hit a given
 * daily protein target, based on actual Kroger pricing analysis.
 *
 * Formula: (dailyProtein × 0.25) + 20, rounded up to the nearest $5.
 * The +20 baseline covers staple carbs, fats, and produce for the week.
 * The 0.25 coefficient reflects ~$0.25/gram for budget protein sources
 * (chicken thighs ~$0.16/g, eggs ~$0.12/g, ground turkey ~$0.31/g).
 */

/**
 * Calculate the minimum and suggested weekly grocery budgets for a
 * given daily protein target.
 *
 * @param {number} dailyProtein - Daily protein target in grams
 * @returns {{ minimumBudget: number, suggestedBudget: number }}
 *   minimumBudget — bare minimum to hit protein target, rounded up to nearest $5
 *   suggestedBudget — minimumBudget + $20 for comfortable meal variety
 */
export function calculateMinimumBudget(dailyProtein) {
  // More realistic formula based on actual Kroger pricing:
  // Protein: ~$0.25/gram for budget sources (chicken thighs, eggs, ground turkey)
  // Carbs/Fats/Produce: ~$20 baseline per week
  const raw = (dailyProtein * 0.25) + 20;

  const minimumBudget = Math.ceil(raw / 5) * 5;
  const suggestedBudget = minimumBudget + 20;

  return { minimumBudget, suggestedBudget };
}
