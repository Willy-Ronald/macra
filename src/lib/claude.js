/**
 * Macra — Claude AI Meal Plan Generator
 *
 * Calls the server-side /api/generate-plan endpoint
 * which proxies requests to Claude API, keeping the
 * API key secure on the server.
 */

/**
 * Generate a single day's meal plan based on user profile
 * @param {Object} profile - User profile with macros, diet, goal
 * @returns {Array} Array of 4 meal objects
 */
export async function generateMealPlan(profile) {
  const response = await fetch("/api/generate-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to generate meal plan");
  }

  const data = await response.json();
  return data.meals;
}

/**
 * Validate that generated meals are within acceptable macro range
 * @param {Array} meals - Array of meal objects
 * @param {Object} targets - Target macros { target, proteinG, carbG, fatG }
 * @returns {boolean}
 */
export function validateMealPlan(meals, targets) {
  const totals = meals.reduce(
    (acc, m) => ({
      cal: acc.cal + m.cal,
      p: acc.p + m.p,
      c: acc.c + m.c,
      f: acc.f + m.f,
    }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );

  const calTolerance = targets.target * 0.1; // 10% tolerance
  return Math.abs(totals.cal - targets.target) <= calTolerance;
}
