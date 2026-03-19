/**
 * Macra — Claude AI Meal Plan Generator
 *
 * Calls the server-side /api/generate-plan endpoint
 * which proxies requests to Claude API, keeping the
 * API key secure on the server.
 */

/**
 * Generate an A/B day meal plan based on user profile.
 * Day A runs Mon/Wed/Fri/Sun, Day B runs Tue/Thu/Sat.
 * @param {Object} profile - User profile with macros, diet, goal
 * @returns {{ A: Meal[], B: Meal[] }} Object with Day A and Day B meal arrays
 */
export async function generateMealPlan(profile) {
  const response = await fetch("/api/generate-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Failed to generate meal plan");
  }

  return data.abPlan;
}
