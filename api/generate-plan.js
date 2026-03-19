/**
 * Macra — AI Meal Plan Generator (Server-side)
 *
 * Vercel Serverless Function
 * Endpoint: POST /api/generate-plan
 *
 * Generates an A/B day meal plan via Claude API.
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

    const prompt = `Generate an A/B day meal plan as JSON with exactly 2 day variations.

Target macros PER DAY:
- Calories: ${macros.target}
- Protein: ${macros.proteinG}g (MUST be within 3% of target)
- Carbs: ${macros.carbG}g (MUST be within 3% of target)
- Fat: ${macros.fatG}g (MUST be within 3% of target)

Dietary preferences: ${diet}.
Goal: ${goal}.

STRICT REQUIREMENTS:
- Each day has exactly 4 meals: BREAKFAST, LUNCH, SNACK, DINNER
- Day A and Day B must have COMPLETELY DIFFERENT meals — do NOT repeat any meal
- Use varied cuisines and cooking styles
- Include realistic prep times
- Ingredients should be common grocery store items
- For each meal, include an "ingredients" array where each ingredient has: name (string), qty (number), and unit (string: oz, g, lbs, cups, tbsp, tsp, piece, slice, etc)
- Example ingredient: {"name":"chicken breast","qty":8,"unit":"oz"}

Return ONLY a JSON object with keys "A" and "B". No other text, no markdown, no explanation.

Example structure:
{"A":[{"type":"BREAKFAST","name":"...","desc":"main ingredients listed","cal":000,"p":00,"c":00,"f":00,"time":"X min","ingredients":[{"name":"...","qty":1,"unit":"cup"}]},{"type":"LUNCH","name":"...","desc":"...","cal":000,"p":00,"c":00,"f":00,"time":"X min","ingredients":[...]},{"type":"SNACK","name":"...","desc":"...","cal":000,"p":00,"c":00,"f":00,"time":"X min","ingredients":[...]},{"type":"DINNER","name":"...","desc":"...","cal":000,"p":00,"c":00,"f":00,"time":"X min","ingredients":[...]}],"B":[...4 meals...]}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Claude API error:", errText);
      let errMsg = "AI generation failed";
      try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch {}
      return res.status(response.status).json({ error: errMsg });
    }

    const data = await response.json();
    const text = data.content.map((block) => block.text || "").join("");
    const clean = text.replace(/```json|```/g, "").trim();

    let abPlan;
    try {
      abPlan = JSON.parse(clean);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr.message, "| Raw:", clean.slice(0, 400));
      return res.status(500).json({ error: "AI returned malformed JSON — please try again." });
    }

    if (!abPlan.A || !abPlan.B || !Array.isArray(abPlan.A) || !Array.isArray(abPlan.B)) {
      console.error("Invalid plan structure, keys:", Object.keys(abPlan));
      return res.status(500).json({ error: "AI returned unexpected format — please try again." });
    }

    res.json({ abPlan });
  } catch (err) {
    console.error("Generate plan error:", err);
    res.status(500).json({ error: err.message || "Failed to generate meal plan" });
  }
}
