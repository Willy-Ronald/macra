/**
 * Macra — AI Meal Plan Generator (Server-side)
 *
 * Vercel Serverless Function
 * Endpoint: POST /api/generate-plan
 *
 * Proxies Claude API calls so the API key stays secret.
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

    const prompt = `Generate a single day meal plan as JSON.
Target macros: ${macros.target} calories, ${macros.proteinG}g protein, ${macros.carbG}g carbs, ${macros.fatG}g fat.
Dietary preferences: ${diet}.
Goal: ${goal}.

Requirements:
- Exactly 4 meals: BREAKFAST, LUNCH, SNACK, DINNER
- Total macros must sum within 5% of targets
- Include realistic prep times
- Ingredients should be common grocery store items
- Each meal description should list the main ingredients

Return ONLY a JSON array with this exact structure, no other text:
[{"type":"BREAKFAST","name":"Meal Name","desc":"ingredient list","cal":000,"p":00,"c":00,"f":00,"time":"X min"},{"type":"LUNCH",...},{"type":"SNACK",...},{"type":"DINNER",...}]`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
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
    const meals = JSON.parse(clean);

    res.json({ meals });
  } catch (err) {
    console.error("Generate plan error:", err);
    res.status(500).json({ error: "Failed to generate meal plan" });
  }
}
