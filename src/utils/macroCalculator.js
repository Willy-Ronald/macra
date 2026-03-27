/**
 * Macra — Minimum Budget Calculator
 *
 * Estimates the minimum weekly grocery budget required to hit a given
 * daily protein target, based on the cost of budget-friendly protein sources.
 *
 * Formula: (dailyProtein × 0.18) + 15, rounded up to the nearest $5.
 * The +15 baseline covers staple carbs, produce, and pantry items.
 * The 0.18 coefficient reflects the average cost per gram of protein
 * when using cheap sources (eggs, chicken thighs, canned tuna, beans).
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
  const raw = (dailyProtein * 0.18) + 15;
  const minimumBudget = Math.ceil(raw / 5) * 5;
  const suggestedBudget = minimumBudget + 20;
  return { minimumBudget, suggestedBudget };
}
