/**
 * Macra — AI Meal Plan Generator (Server-side) v2
 *
 * Vercel Serverless Function
 * Endpoint: POST /api/generate-plan
 *
 * Cost optimizations vs v1:
 *   1. Model tiering — Haiku for simple profiles (score <4), Sonnet for complex
 *   2. Prompt caching — static system prompt cached across all requests (90% off cached tokens)
 *   3. max_tokens 8000→3500 — output tokens capped at realistic plan size
 *   4. Macro correction — cheap Haiku portion-adjustment instead of full Sonnet retry
 *
 * Rate limits:
 *   Free  → Intro: first 3 lifetime generations (no time restriction)
 *           Ongoing: 1 per rolling 7-day window
 *   Pro   → 2 per rolling 24 hours · 30 per calendar month
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// ── Rate limit constants ────────────────────────────────────────
const FREE_INTRO_LIMIT   = 3;
const FREE_WEEKLY_LIMIT  = 1;
const PRO_DAILY_LIMIT    = 2;
const PRO_MONTHLY_LIMIT  = 30;

// ── Model selection ─────────────────────────────────────────────
const MODEL_HAIKU  = "claude-haiku-4-5-20251001"; // ~5× cheaper than Sonnet 4
const MODEL_SONNET = "claude-sonnet-4-20250514";   // full power for complex profiles

// ── Cost rates (USD / 1M tokens) — for logging only ────────────
const RATES = {
  [MODEL_HAIKU]:  { in: 0.80, out: 4.00, cr: 0.08, cw: 1.00 },
  [MODEL_SONNET]: { in: 3.00, out: 15.00, cr: 0.30, cw: 3.75 },
};

function estimateCost(usage, model) {
  const r = RATES[model] || RATES[MODEL_SONNET];
  return (
    ((usage.input_tokens                 || 0) / 1e6) * r.in +
    ((usage.output_tokens                || 0) / 1e6) * r.out +
    ((usage.cache_read_input_tokens      || 0) / 1e6) * r.cr +
    ((usage.cache_creation_input_tokens  || 0) / 1e6) * r.cw
  );
}

function mergeUsage(a, b) {
  return {
    input_tokens:                (a.input_tokens                || 0) + (b.input_tokens                || 0),
    output_tokens:               (a.output_tokens               || 0) + (b.output_tokens               || 0),
    cache_read_input_tokens:     (a.cache_read_input_tokens     || 0) + (b.cache_read_input_tokens     || 0),
    cache_creation_input_tokens: (a.cache_creation_input_tokens || 0) + (b.cache_creation_input_tokens || 0),
  };
}

// ── Complexity scoring → model selection ────────────────────────
// Score <4 → Haiku (simple, fast, cheap)
// Score 4+ → Sonnet (complex constraints need more reasoning)
function getComplexityScore(profile) {
  let score = 0;
  const dietCount = (profile.diet || []).length;
  if      (dietCount >= 2) score += 3;
  else if (dietCount === 1) score += 1;
  if (profile.customMacroSplit)                          score += 2; // Pro feature
  if ((profile.dislikedFoods   || []).length > 5)       score += 2;
  if ((profile.dislikedCuisines || []).length > 2)      score += 2;
  const pickiness = profile.pickinessLevel ?? 3;
  if (pickiness <= 2 || pickiness >= 5)                 score += 1;
  const budget = profile.weeklyBudget ?? 75;
  if (budget < 50 || budget > 150)                      score += 1;
  if ((profile.goal || "").includes("bulk"))            score += 1;
  return score;
}

// ── Time window helpers ─────────────────────────────────────────
const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1).toISOString();

const sevenDaysAgo = () =>
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const rollingDayStart = () =>
  new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

// ── Count helper ────────────────────────────────────────────────
async function countLogs(sb, userId, since, label) {
  const { count, error } = await sb
    .from("generation_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("generated_at", since);

  if (error) {
    console.error(`[rate-limit] SELECT ${label} FAILED — rate limiting bypassed for this window`);
    console.error(`[rate-limit] Error code: ${error.code} | message: ${error.message} | hint: ${error.hint}`);
    console.error(`[rate-limit] LIKELY CAUSE: generation_log table missing or RLS blocking service role`);
    return 0;
  }

  const n = count ?? 0;
  console.log(`[rate-limit] ${label} count for user ${userId}: ${n}`);
  return n;
}

// ── Macro validation ────────────────────────────────────────────
function validateMacros(day, targets, label) {
  const totals = day.reduce(
    (a, m) => ({ cal: a.cal+(m.cal||0), p: a.p+(m.p||0), c: a.c+(m.c||0), f: a.f+(m.f||0) }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );

  const pctOff = (actual, target) => (((actual - target) / target) * 100).toFixed(1);
  const diffs = {
    calOff: pctOff(totals.cal, targets.target),
    pOff:   pctOff(totals.p,   targets.proteinG),
    cOff:   pctOff(totals.c,   targets.carbG),
    fOff:   pctOff(totals.f,   targets.fatG),
  };

  const failed =
    Math.abs(diffs.calOff) > 5 ||
    Math.abs(diffs.pOff)   > 5 ||
    Math.abs(diffs.cOff)   > 5 ||
    Math.abs(diffs.fOff)   > 5;

  console.log(
    `[macro-check] ${label}: ` +
    `cal ${totals.cal}kcal (${diffs.calOff}%) ` +
    `P:${totals.p}g (${diffs.pOff}%) ` +
    `C:${totals.c}g (${diffs.cOff}%) ` +
    `F:${totals.f}g (${diffs.fOff}%) → ${failed ? "FAIL" : "PASS"}`
  );

  return { totals, failed, diffs };
}

// ── Static system prompt — cached across every request ──────────
// This block is sent to Anthropic with cache_control: ephemeral.
// After the first request it costs 90% less to send on subsequent calls.
// NEVER include user-specific data here — only format + rules.
const STATIC_SYSTEM = `You are a precise meal planning AI. Generate A/B day meal plans in exact JSON format.

RULES:
- Day A and B must be completely different meals — no repeated dishes across days
- Each day: exactly 4 meals in order: BREAKFAST, LUNCH, SNACK, DINNER
- "name" = dish name only, never include the cuisine label in the name
- Share base ingredients across A and B where practical to keep shopping simple
- Never repeat the exact same meal as previous generations
- instructions: exactly 5 steps per meal, each under 12 words, starting with an action verb
- equipment: comma-separated string, max 3 items
- desc: max 8 words
- Return ONLY raw JSON starting with { and ending with } — no markdown, no explanation

OUTPUT FORMAT (follow exactly — all fields required):
{
  "A": [
    {"type":"BREAKFAST","cuisine":"American","name":"Dish name","desc":"Eight words max","cal":400,"p":30,"c":45,"f":12,"time":"10 min","ingredients":[{"name":"chicken breast","qty":"6","unit":"oz"}],"instructions":["Heat skillet over medium-high until hot.","Season chicken with salt and pepper.","Cook chicken 5 minutes each side.","Rest 2 minutes then slice thinly.","Plate with sides and serve warm."],"equipment":"Skillet, chef knife, cutting board"},
    {"type":"LUNCH","cuisine":"Mexican","name":"Dish name","desc":"Eight words max","cal":600,"p":50,"c":55,"f":18,"time":"20 min","ingredients":[{"name":"ground turkey","qty":"6","unit":"oz"}],"instructions":["Brown turkey in skillet over medium heat.","Add spices and stir to combine.","Warm tortillas in dry pan 30 seconds.","Fill tortillas with turkey and toppings.","Squeeze lime over finished tacos."],"equipment":"Skillet, cutting board"},
    {"type":"SNACK","cuisine":"Mediterranean","name":"Dish name","desc":"Eight words max","cal":300,"p":25,"c":20,"f":10,"time":"5 min","ingredients":[{"name":"Greek yogurt","qty":"1","unit":"cup"}],"instructions":["Spoon yogurt into bowl.","Add honey and stir gently.","Top with nuts and fruit.","Sprinkle cinnamon over top.","Serve immediately."],"equipment":"Bowl, spoon"},
    {"type":"DINNER","cuisine":"Japanese","name":"Dish name","desc":"Eight words max","cal":700,"p":55,"c":50,"f":22,"time":"30 min","ingredients":[{"name":"salmon fillet","qty":"8","unit":"oz"}],"instructions":["Preheat oven to 400°F.","Mix miso, mirin, and soy sauce.","Coat salmon with miso glaze.","Bake 12-15 minutes until flaky.","Garnish with sesame seeds."],"equipment":"Baking sheet, small bowl"}
  ],
  "B": [
    {"type":"BREAKFAST","cuisine":"Greek","name":"Dish name","desc":"Eight words max","cal":380,"p":28,"c":42,"f":11,"time":"10 min","ingredients":[{"name":"eggs","qty":"3","unit":"large"}],"instructions":["Whisk eggs with salt and pepper.","Heat olive oil in skillet over medium.","Pour eggs in and cook 2 minutes.","Fold omelette in half and plate.","Top with feta and fresh herbs."],"equipment":"Skillet, whisk"},
    {"type":"LUNCH","cuisine":"Korean","name":"Dish name","desc":"Eight words max","cal":580,"p":48,"c":52,"f":17,"time":"20 min","ingredients":[{"name":"beef sirloin","qty":"6","unit":"oz"}],"instructions":["Slice beef thinly against the grain.","Mix soy, garlic, sesame oil for marinade.","Marinate beef 10 minutes minimum.","Cook beef in hot skillet 2 minutes.","Serve over rice with kimchi."],"equipment":"Skillet, cutting board"},
    {"type":"SNACK","cuisine":"Indian","name":"Dish name","desc":"Eight words max","cal":290,"p":24,"c":19,"f":9,"time":"5 min","ingredients":[{"name":"cottage cheese","qty":"1","unit":"cup"}],"instructions":["Spoon cottage cheese into bowl.","Add cucumber and tomato pieces.","Sprinkle cumin and chili powder.","Drizzle with lemon juice.","Stir gently and serve cold."],"equipment":"Bowl, spoon"},
    {"type":"DINNER","cuisine":"Italian","name":"Dish name","desc":"Eight words max","cal":710,"p":56,"c":51,"f":23,"time":"30 min","ingredients":[{"name":"ground beef","qty":"8","unit":"oz"}],"instructions":["Brown ground beef over medium-high heat.","Drain fat and add marinara sauce.","Simmer 10 minutes until sauce thickens.","Cook pasta according to package directions.","Plate pasta topped with meat sauce."],"equipment":"Large pot, skillet, colander"}
  ]
}`;

// ── Claude API call with caching ────────────────────────────────
// systemContent: if useCache=true, wrapped with cache_control for prompt caching.
// userContent: string — the dynamic, user-specific portion of the request.
async function callClaude(apiKey, model, userContent, { useCache = true } = {}) {
  const systemContent = useCache
    ? [{ type: "text", text: STATIC_SYSTEM, cache_control: { type: "ephemeral" } }]
    : STATIC_SYSTEM;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":    "application/json",
      "x-api-key":       apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta":  "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({
      model,
      max_tokens: 3500,  // realistic cap for 8-meal plan; was 8000 (wasteful)
      system: systemContent,
      messages: [
        { role: "user",      content: userContent },
        { role: "assistant", content: "{"          }, // prefill forces JSON response
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMsg = "AI generation failed";
    try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch {}
    return { error: errMsg, status: res.status };
  }

  const data = await res.json();
  const usage = data.usage || {};
  console.log(`CLAUDE OK — model:${model} stop:${data.stop_reason} usage:${JSON.stringify(usage)}`);
  const continuation = data.content.map(b => b.text || "").join("");
  return { rawText: "{" + continuation, usage };
}

// ── Parse and validate a Claude response ───────────────────────
function parsePlan(rawText) {
  console.log("Claude raw response (first 500 chars):", rawText.slice(0, 500));
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { error: "AI returned no JSON — please try again." };

  let abPlan;
  try {
    abPlan = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("JSON.parse failed:", e.message);
    return { error: "AI returned malformed JSON — please try again." };
  }

  if (!abPlan.A || !abPlan.B || !Array.isArray(abPlan.A) || !Array.isArray(abPlan.B)) {
    console.error("Parsed JSON missing A/B arrays. Keys:", Object.keys(abPlan));
    return { error: "AI returned unexpected format — please try again." };
  }

  if (abPlan.A.length < 4 || abPlan.B.length < 4) {
    console.warn(`Meal count mismatch: A=${abPlan.A.length}, B=${abPlan.B.length} — treating as truncation`);
    return {
      error: "truncated",
      truncated: true,
      missingA: abPlan.A.length < 4,
      missingB: abPlan.B.length < 4,
    };
  }

  return { abPlan };
}

// ── Cheap Haiku portion-only macro correction ───────────────────
// Called instead of a full Sonnet re-generation when macros are off.
// Only adjusts ingredient quantities — meals, names, structure stay identical.
// Cost: ~10% of a full Sonnet generation.
async function adjustPortions(apiKey, plan, targets, checkA, checkB) {
  const missLines = [];

  if (checkA.failed) {
    if (Math.abs(checkA.diffs.calOff) > 5) missLines.push(`Day A cal: ${checkA.totals.cal} vs target ${targets.target}`);
    if (Math.abs(checkA.diffs.pOff)   > 5) missLines.push(`Day A protein: ${checkA.totals.p}g vs ${targets.proteinG}g`);
    if (Math.abs(checkA.diffs.cOff)   > 5) missLines.push(`Day A carbs: ${checkA.totals.c}g vs ${targets.carbG}g`);
    if (Math.abs(checkA.diffs.fOff)   > 5) missLines.push(`Day A fat: ${checkA.totals.f}g vs ${targets.fatG}g`);
  }
  if (checkB.failed) {
    if (Math.abs(checkB.diffs.calOff) > 5) missLines.push(`Day B cal: ${checkB.totals.cal} vs target ${targets.target}`);
    if (Math.abs(checkB.diffs.pOff)   > 5) missLines.push(`Day B protein: ${checkB.totals.p}g vs ${targets.proteinG}g`);
    if (Math.abs(checkB.diffs.cOff)   > 5) missLines.push(`Day B carbs: ${checkB.totals.c}g vs ${targets.carbG}g`);
    if (Math.abs(checkB.diffs.fOff)   > 5) missLines.push(`Day B fat: ${checkB.totals.f}g vs ${targets.fatG}g`);
  }

  const correctionContent =
    `This meal plan missed macro targets. Adjust ingredient quantities only — keep all meals, names, types, and structure exactly the same.\n\n` +
    `Issues:\n${missLines.join("\n")}\n\n` +
    `Daily targets: Cal:${targets.target} P:${targets.proteinG}g C:${targets.carbG}g F:${targets.fatG}g (within 3%)\n\n` +
    `Plan to fix:\n${JSON.stringify(plan)}\n\n` +
    `Return the corrected plan as raw JSON in the exact same structure.`;

  console.log("[macro-fix] Portion-only correction via Haiku — misses:", missLines.join(" | "));
  const result = await callClaude(apiKey, MODEL_HAIKU, correctionContent, { useCache: false });
  if (result.error) {
    console.warn("[macro-fix] Haiku correction call failed:", result.error);
    return null;
  }

  const parsed = parsePlan(result.rawText);
  if (parsed.error) {
    console.warn("[macro-fix] Haiku correction parse failed:", parsed.error);
    return null;
  }

  return { plan: parsed.abPlan, usage: result.usage };
}

// ── Main handler ────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const { profile, userId, excludedCuisines = [] } = req.body;
    if (!profile) {
      return res.status(400).json({ error: "Missing profile data" });
    }

    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      console.error("[rate-limit] Request missing userId — rejecting");
      return res.status(400).json({ error: "userId is required" });
    }

    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_KEY;
    if (!sbUrl || !sbKey) {
      console.error("[rate-limit] SUPABASE_URL or SUPABASE_SERVICE_KEY not configured — blocking generation");
      return res.status(500).json({ error: "Server misconfiguration — cannot enforce rate limits" });
    }
    const sb = createClient(sbUrl, sbKey);

    // Verify Pro status server-side — never trust the value sent from the frontend
    const { data: profileData } = await sb.from("profiles").select("is_pro").eq("id", userId).single();
    const isPro = profileData?.is_pro === true;
    console.log(`[rate-limit] Request from userId: ${userId} isPro: ${isPro} (server-verified)`);

    // ── Rate limiting ───────────────────────────────────────────
    let lifetimeCount = 0, weeklyCount = 0, dayCount = 0, monthCount = 0;
    let remaining = null;

    if (!isPro) {
      // Phase 1 — Intro: first FREE_INTRO_LIMIT lifetime gens, no time restriction
      lifetimeCount = await countLogs(sb, userId, "1970-01-01T00:00:00Z", "lifetime");
      console.log(`[rate-limit] FREE lifetime: ${lifetimeCount}`);

      if (lifetimeCount < FREE_INTRO_LIMIT) {
        console.log(`[rate-limit] FREE INTRO phase (${lifetimeCount}/${FREE_INTRO_LIMIT}) — PASSED`);
        remaining = { phase: "intro", introRemaining: Math.max(0, FREE_INTRO_LIMIT - lifetimeCount - 1) };
      } else {
        // Phase 2 — Ongoing: 1 per rolling 7-day window
        weeklyCount = await countLogs(sb, userId, sevenDaysAgo(), "7-day");
        console.log(`[rate-limit] FREE WEEKLY check — ${weeklyCount}/${FREE_WEEKLY_LIMIT}`);

        if (weeklyCount >= FREE_WEEKLY_LIMIT) {
          const { data: lastRow } = await sb
            .from("generation_log")
            .select("generated_at")
            .eq("user_id", userId)
            .order("generated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const lastTime = lastRow?.generated_at ? new Date(lastRow.generated_at) : new Date();
          const resetTime = new Date(lastTime.getTime() + 7 * 24 * 60 * 60 * 1000);
          const resetDays = Math.max(1, Math.ceil((resetTime - Date.now()) / (1000 * 60 * 60 * 24)));
          const d = resetDays === 1 ? "day" : "days";

          const errMsg = lifetimeCount === FREE_INTRO_LIMIT
            ? `You've used your free trial generations. Upgrade to Pro for more, or your weekly generation resets in ${resetDays} ${d}.`
            : `Your free weekly generation resets in ${resetDays} ${d}. Upgrade to Pro for up to 2 generations per day.`;

          return res.status(429).json({ error: errMsg, limitReached: true, isPro: false, remaining: { phase: "weekly", resetDays } });
        }

        console.log("[rate-limit] FREE WEEKLY — PASSED");
        remaining = { phase: "weekly", resetDays: 7 };
      }
    } else {
      // Pro: 2 per rolling 24h, 30 per calendar month
      [dayCount, monthCount] = await Promise.all([
        countLogs(sb, userId, rollingDayStart(), "pro-daily"),
        countLogs(sb, userId, startOfMonth(),    "pro-monthly"),
      ]);

      console.log(`[rate-limit] PRO check — day:${dayCount}/${PRO_DAILY_LIMIT} month:${monthCount}/${PRO_MONTHLY_LIMIT}`);

      if (dayCount >= PRO_DAILY_LIMIT) {
        return res.status(429).json({ error: "Daily limit reached. Resets tomorrow at midnight.", limitReached: true, isPro: true, remaining: { phase: "pro", daily: 0, monthly: Math.max(0, PRO_MONTHLY_LIMIT - monthCount) } });
      }
      if (monthCount >= PRO_MONTHLY_LIMIT) {
        return res.status(429).json({ error: "Monthly limit reached. Resets on the 1st of next month.", limitReached: true, isPro: true, remaining: { phase: "pro", daily: Math.max(0, PRO_DAILY_LIMIT - dayCount), monthly: 0 } });
      }

      console.log("[rate-limit] PRO — PASSED");
      remaining = { phase: "pro", daily: Math.max(0, PRO_DAILY_LIMIT - dayCount - 1), monthly: Math.max(0, PRO_MONTHLY_LIMIT - monthCount - 1) };
    }

    // ── Model selection ─────────────────────────────────────────
    const complexityScore = getComplexityScore(profile);
    const useHaiku = complexityScore < 4;
    const model = useHaiku ? MODEL_HAIKU : MODEL_SONNET;
    console.log(`[model] complexity:${complexityScore} → ${useHaiku ? "Haiku (simple)" : "Sonnet (complex)"}`);

    // ── Build dynamic user content (no JSON examples — those live in cached system) ──
    const macros = profile.macros || { target: 2200, proteinG: 180, carbG: 240, fatG: 70 };
    const goal = (profile.goal || "lean_bulk").replace("_", " ");

    const ALL_CUISINES = [
      "Mediterranean","Japanese","Mexican","Indian","Middle Eastern","American Southern",
      "Thai","Korean","Greek","West African","German","Italian","French","Brazilian",
      "Caribbean","Ethiopian","Vietnamese","Chinese","Spanish","American BBQ",
    ];

    const pickUnique = (arr, n, s) => {
      const src = [...arr]; const out = []; let seed = Math.abs(s) >>> 0;
      for (let i = 0; i < Math.min(n, src.length); i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        out.push(...src.splice(seed % src.length, 1));
      }
      return out;
    };

    const seed = randomBytes(4).readUInt32BE(0);
    const dislikedCuisines = profile.dislikedCuisines || [];
    const excluded = [...new Set([...excludedCuisines, ...dislikedCuisines])];
    const pool = ALL_CUISINES.filter(c => !excluded.includes(c));
    const availPool = pool.length >= 4 ? pool : ALL_CUISINES;

    const MEAL_TYPES = ["BREAKFAST", "LUNCH", "SNACK", "DINNER"];
    const dayCuisinesA = pickUnique(availPool, 4, seed);
    const dayCuisinesB = pickUnique(availPool, 4, seed + 99991);

    const cuisineAssignmentLines =
      `Day A — ${MEAL_TYPES.map((t, i) => `${t}: ${dayCuisinesA[i]}`).join(" | ")}\n` +
      `Day B — ${MEAL_TYPES.map((t, i) => `${t}: ${dayCuisinesB[i]}`).join(" | ")}`;

    console.log(`[prompt] Cuisine assignments: ${cuisineAssignmentLines.replace(/\n/g, " | ")}`);

    const dietList = profile.diet || [];
    const dislikedFoods = profile.dislikedFoods || [];

    const DIET_RULES = {
      "Vegan":        "no meat, fish, dairy, eggs, or animal products",
      "Vegetarian":   "no meat or fish — dairy and eggs allowed",
      "Keto":         "total carbs under 30g net for the entire day",
      "Gluten-Free":  "no wheat, barley, rye, or gluten ingredients",
      "Dairy-Free":   "no milk, cheese, butter, cream, yogurt, or dairy",
      "Carnivore":    "only animal proteins and fats — no grains, legumes, vegetables",
      "Paleo":        "no grains, legumes, dairy, or processed foods",
      "Halal":        "no pork or alcohol in any ingredient",
      "Kosher":       "no pork or shellfish; never mix meat and dairy",
      "High Protein": "min 35g protein per meal, prioritize lean protein",
      "High Fiber":   "include high-fiber foods every meal (legumes, veg, whole grains)",
    };

    const dietConstraintLines = dietList.length > 0
      ? dietList.filter(d => DIET_RULES[d]).map(d => `  - ${d}: ${DIET_RULES[d]}`).join("\n")
      : "  - None";

    const hardConstraints = [
      "DIETARY RULES:",
      dietConstraintLines,
      dislikedFoods.length    > 0 ? `FOODS NEVER TO USE: ${dislikedFoods.join(", ")}` : "",
      dislikedCuisines.length > 0 ? `CUISINES TO NEVER USE: ${dislikedCuisines.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const weeklyBudget = profile.weeklyBudget ?? null;
    const budgetLine = weeklyBudget
      ? `BUDGET: ~$${weeklyBudget}/week total for both days. Use affordable proteins (eggs, canned fish, chicken thighs, ground turkey, legumes). Avoid specialty/exotic ingredients.`
      : "";

    const pickinessLevel = profile.pickinessLevel ?? 3;
    const complexityLines = {
      1: "COMPLEXITY: Very adventurous. Bold, globally-inspired dishes, complex flavors, restaurant-quality creativity.",
      2: "COMPLEXITY: Adventurous. Varied, flavorful dishes from diverse cuisines. Some creativity welcome.",
      3: "COMPLEXITY: Balanced. Mix comfort foods with global options. Approachable but not boring.",
      4: "COMPLEXITY: Somewhat picky. Familiar American and basic international dishes. Simple preps, recognizable ingredients (pasta marinara, chicken tacos, stir fry, burgers). Max 7 ingredients per meal.",
      5: `COMPLEXITY: Very picky — child-like palate. Simple, familiar, comforting only.
Good meals: scrambled eggs with toast, grilled chicken with mac and cheese, spaghetti bolognese, cheeseburger bowl, chicken tenders with mashed potatoes, grilled cheese with turkey, pancakes with eggs and turkey bacon, pasta with butter and parmesan.
STRICT: no fish/seafood, no beans/legumes, no leafy greens, no ethnic names, no unusual grains (quinoa/farro/barley). Only: chicken, ground beef/turkey, eggs, cheese, pasta, rice, potatoes, bread, corn, carrots, broccoli. Basic seasoning only. Names must sound kid-friendly.`,
    };
    const complexityLine = complexityLines[pickinessLevel] || complexityLines[3];

    // Dynamic content only — static format/rules are in the cached system prompt
    const buildDynamicContent = (retryPrefix = "") =>
      `${retryPrefix}Generate an A/B day meal plan. Goal: ${goal}.
${budgetLine ? `\n${budgetLine}` : ""}

${complexityLine}

MACROS — hit daily totals within 3%:
Cal:${macros.target} P:${macros.proteinG}g C:${macros.carbG}g F:${macros.fatG}g

MACRO DISTRIBUTION: Distribute naturally — breakfast lighter, dinner heavier. The DAILY TOTAL must hit targets, not each individual meal.
Approximate per meal for ${macros.target} cal/day:
- Breakfast: ~${Math.round(macros.target*0.20)}-${Math.round(macros.target*0.22)} cal
- Lunch: ~${Math.round(macros.target*0.26)}-${Math.round(macros.target*0.28)} cal
- Snack: ~${Math.round(macros.target*0.14)}-${Math.round(macros.target*0.16)} cal
- Dinner: ~${Math.round(macros.target*0.34)}-${Math.round(macros.target*0.36)} cal

${hardConstraints}

Cuisine per slot:
${cuisineAssignmentLines}`;

    // ── First Claude call ────────────────────────────────────────
    let totalUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

    console.log(`CALLING CLAUDE API — model:${model} userId:${userId} ts:${new Date().toISOString()}`);
    const firstResult = await callClaude(apiKey, model, buildDynamicContent(), { useCache: true });

    if (firstResult.error) {
      console.error("CLAUDE API ERROR:", firstResult.error);
      return res.status(firstResult.status || 500).json({ error: firstResult.error });
    }

    totalUsage = mergeUsage(totalUsage, firstResult.usage || {});

    const firstParsed = parsePlan(firstResult.rawText);

    // Truncation on first attempt → retry with conciseness constraint
    if (firstParsed.truncated) {
      console.warn("[truncation] First response cut off — retrying with conciseness cap");
      const truncRetryContent =
        "Your previous response was cut off. Provide the complete plan with all 8 meals. " +
        "Keep instructions to exactly 5 steps per meal, each under 12 words.\n\n" +
        buildDynamicContent();

      const truncRetry = await callClaude(apiKey, model, truncRetryContent, { useCache: true });
      totalUsage = mergeUsage(totalUsage, truncRetry.usage || {});

      if (truncRetry.error) {
        console.error("Retry after truncation also failed:", truncRetry.error);
        return res.status(500).json({ error: "AI generation failed — please try again." });
      }
      const truncRetryParsed = parsePlan(truncRetry.rawText);
      if (truncRetryParsed.error) {
        console.error("Parse error on truncation retry:", truncRetryParsed.error);
        return res.status(500).json({ error: truncRetryParsed.error });
      }
      firstParsed.abPlan = truncRetryParsed.abPlan;
      delete firstParsed.error;
      delete firstParsed.truncated;
    }

    if (firstParsed.error) {
      console.error("Parse error on first attempt:", firstParsed.error);
      return res.status(500).json({ error: firstParsed.error });
    }

    const firstPlan = firstParsed.abPlan;

    // ── Layer 2: Macro validation ────────────────────────────────
    const checkA = validateMacros(firstPlan.A, macros, "Day A");
    const checkB = validateMacros(firstPlan.B, macros, "Day B");

    let abPlan = firstPlan;

    if (checkA.failed || checkB.failed) {
      // ── Cheap Haiku portion-only fix instead of full Sonnet regen ──
      // ~10% of the cost of a full retry.
      const fix = await adjustPortions(apiKey, firstPlan, macros, checkA, checkB);
      totalUsage = mergeUsage(totalUsage, (fix?.usage) || {});

      if (fix) {
        const fixA = validateMacros(fix.plan.A, macros, "Day A (fix)");
        const fixB = validateMacros(fix.plan.B, macros, "Day B (fix)");
        if (!fixA.failed && !fixB.failed) {
          console.log("[macro-fix] Portion adjustment PASSED — using corrected plan");
          abPlan = fix.plan;
        } else {
          console.warn("[macro-fix] Portion adjustment still off — using first attempt");
          // Keep firstPlan — don't spend another full Sonnet call
        }
      } else {
        console.warn("[macro-fix] Portion adjustment failed — using first attempt");
      }
    }

    // ── Cost logging ─────────────────────────────────────────────
    const estimatedCost = estimateCost(totalUsage, model);
    console.log(
      `[cost] model:${model} complexity:${complexityScore} ` +
      `in:${totalUsage.input_tokens} out:${totalUsage.output_tokens} ` +
      `cache_read:${totalUsage.cache_read_input_tokens} cache_write:${totalUsage.cache_creation_input_tokens} ` +
      `estimated:$${estimatedCost.toFixed(4)}`
    );

    // ── Log this generation ──────────────────────────────────────
    console.log(`[rate-limit] Inserting generation_log for user ${userId}`);
    const logPayload = {
      user_id:          userId,
      generated_at:     new Date().toISOString(),
      model_used:       model,
      complexity_score: complexityScore,
      input_tokens:     totalUsage.input_tokens,
      output_tokens:    totalUsage.output_tokens,
      estimated_cost:   parseFloat(estimatedCost.toFixed(4)),
    };

    // Try full insert with new columns; fall back to basic if columns don't exist yet
    let { error: insertError } = await sb.from("generation_log").insert(logPayload);
    if (insertError && (insertError.code === "42703" || insertError.message?.includes("column"))) {
      console.warn("[rate-limit] New log columns not yet migrated — falling back to basic insert");
      ({ error: insertError } = await sb.from("generation_log").insert({
        user_id: userId,
        generated_at: logPayload.generated_at,
      }));
    }

    if (insertError) {
      console.error("[rate-limit] generation_log INSERT FAILED:", JSON.stringify(insertError));
      console.error("[rate-limit] code:", insertError.code, "message:", insertError.message, "hint:", insertError.hint);
      console.warn("[rate-limit] Generation served WITHOUT being logged — limit may not enforce correctly");
    } else {
      console.log(`[rate-limit] generation_log insert OK for user ${userId}`);
    }

    return res.json({ abPlan, remaining });
  } catch (err) {
    console.error("Generate plan error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate meal plan" });
  }
}
