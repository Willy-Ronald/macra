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
 *
 * @param {Object} profile  – User profile with macros, diet, goal
 * @param {string} userId   – Supabase user ID (used for rate limiting)
 * @param {boolean} isPro   – Whether the user is on a Pro plan
 * @returns {{ abPlan: { A: Meal[], B: Meal[] }, remaining: object|null }}
 */
export async function generateMealPlan(profile, userId = null, isPro = false) {
  const response = await fetch("/api/generate-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, userId, isPro }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.error || "Failed to generate meal plan");
    // Attach rate-limit metadata so the UI can show targeted messages
    err.limitReached = data.limitReached || false;
    err.isPro        = data.isPro;
    err.remaining    = data.remaining || null;
    throw err;
  }

  return { abPlan: data.abPlan, remaining: data.remaining || null };
}
