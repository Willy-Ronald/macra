/**
 * Macra — AI Meal Plan Generator (Server-side)
 *
 * Vercel Serverless Function
 * Endpoint: POST /api/generate-plan
 *
 * Generates a full 7-day meal plan via Claude API.
 */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const { profile } = req.body;
    if (!profile) {
      return res.status(400).json({ error: "Missing profile data" });
    }

    const macros = profile.macros || { target: 2200, proteinG: 180, carbG: 240, fatG: 70 };
    const diet = (profile.diet || []).join(", ") || "no restrictions";
    const goal = (profile.goal || "lean_bulk").replace("_", " ");

    const prompt = `Generate a FULL 7-day meal plan as JSON.

Target macros PER DAY:
- Calories: ${macros.target}
- Protein: ${macros.proteinG}g (MUST be within 3% of target)
- Carbs: ${macros.carbG}g (MUST be within 3% of target)
- Fat: ${macros.fatG}g (MUST be within 3% of target)

Dietary preferences: ${diet}.
Goal: ${goal}.

STRICT REQUIREMENTS:
- Each day has exactly 4 meals: BREAKFAST, LUNCH, SNACK, DINNER
- Each day's total protein MUST be within 3% of ${macros.proteinG}g
- Each day's total carbs MUST be within 3% of ${macros.carbG}g
- Each day's total fat MUST be within 3% of ${macros.fatG}g
- Each day must have COMPLETELY DIFFERENT meals — do NOT repeat the same meal across days
- Use varied cuisines and cooking styles across the week
- Include realistic prep times
- Ingredients should be common grocery store items
- Each meal description should list the main ingredients

Return ONLY a JSON object where keys are 0 (Monday) through 6 (Sunday), and each value is an array of 4 meals. No other text, no markdown.

Example structure:
{"0":[{"type":"BREAKFAST","name":"...","desc":"ingredients","cal":000,"p":00,"c":00,"f":00,"time":"X min"},{"type":"LUNCH",...},{"type":"SNACK",...},{"type":"DINNER",...}],"1":[...],...,"6":[...]}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Claude API error:", err);
      return res.status(response.status).json({ error: "AI generation failed" });
    }

    const data = await response.json();
    const text = data.content.map((block) => block.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const weekPlan = JSON.parse(clean);

    res.json({ weekPlan });
  } catch (err) {
    console.error("Generate plan error:", err);
    res.status(500).json({ error: "Failed to generate meal plan" });
  }
}
