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
  if (budget < 60)                                      score += 3; // strict budget needs Sonnet to follow ingredient rules
  else if (budget < 90 || budget > 150)                 score += 1;
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

Generate realistic portion sizes that fit within the user's weekly budget. The estimated grocery cost should not exceed 130% of the stated budget.

RULES:
- Day A and B must be completely different meals — no repeated dishes across days
- Each day: exactly 4 meals in order: BREAKFAST, LUNCH, SNACK, DINNER
- "name" = dish name only, never include the cuisine label in the name
- Share base ingredients across A and B where practical to keep shopping simple
- Never repeat the exact same meal as previous generations
- instructions: exactly 5 steps per meal, each under 20 words, starting with an action verb
- instructions must include: specific heat level AND temperature in °F (e.g. "medium-high heat (375°F)"), pan/pot size (e.g. "large 12-inch skillet"), exact cook time in minutes, and a visual doneness cue (e.g. "until golden brown", "until internal temp reaches 165°F"). No vague steps like "cook until done".
- equipment: comma-separated string, max 3 items
- desc: max 8 words
- Return ONLY raw JSON starting with { and ending with } — no markdown, no explanation
- STRICT BUDGET ONLY (<$60/week): Before returning the plan, verify: (1) (Day A meat oz × 4) + (Day B meat oz × 3) ≤ 48 oz — if over, reduce portions; (2) (Day A olive oil tbsp × 4) + (Day B olive oil tbsp × 3) ≤ 8 tbsp — if over, switch to cooking spray; (3) estimated grocery cost ≤ 130% of stated budget.

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
      max_tokens: 4000,  // increased from 3500 — gives room for complex constraint plans
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
    const { data: profileData } = await sb.from("profiles").select("is_pro, is_dev_account").eq("id", userId).single();
    const isPro = profileData?.is_pro === true;
    const isDevAccount = profileData?.is_dev_account === true;
    console.log(`[rate-limit] Request from userId: ${userId} isPro: ${isPro} isDevAccount: ${isDevAccount} (server-verified)`);

    // ── Rate limiting ───────────────────────────────────────────
    let lifetimeCount = 0, weeklyCount = 0, dayCount = 0, monthCount = 0;
    let remaining = null;

    if (isDevAccount) {
      // Dev accounts bypass all rate limits entirely
      console.log(`[rate-limit] DEV ACCOUNT — bypassing all limits for ${userId}`);
      remaining = { phase: "dev", daily: 999, monthly: 999 };
    } else if (!isPro) {
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
    // NOTE: Haiku tiering temporarily disabled — Haiku does not reliably hit
    // numerical macro targets (30-50g protein deficits observed in QA).
    // Force Sonnet for all generations until Haiku accuracy is verified.
    const complexityScore = getComplexityScore(profile);
    const model = MODEL_SONNET;
    console.log(`[model] complexity:${complexityScore} → Sonnet (forced — Haiku macro accuracy under review)`);

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
      "Vegan":        "ZERO TOLERANCE — absolutely no meat (chicken, beef, pork, turkey, fish, seafood, shrimp, tuna, salmon), no dairy (milk, cheese, butter, cream, yogurt, whey), no eggs, no honey, no animal products of any kind. Every single ingredient must be plant-based.",
      "Vegetarian":   "ZERO TOLERANCE — absolutely no meat (chicken, beef, pork, turkey, lamb, bison), no fish, no seafood (shrimp, tuna, salmon, cod, crab). Dairy and eggs are allowed.",
      "Keto":         "ZERO TOLERANCE — total net carbs must be under 30g for the ENTIRE day. No bread, rice, pasta, potatoes, oats, tortillas, beans, legumes, fruit (except small berries), sugar, or grains of any kind.",
      "Gluten-Free":  "ZERO TOLERANCE — no wheat, barley, rye, spelt, farro, or anything containing gluten. No regular bread, pasta, flour tortillas, soy sauce (unless certified GF), or beer.",
      "Dairy-Free":   "ZERO TOLERANCE — absolutely no milk, cheese (cheddar, feta, mozzarella, parmesan, cottage cheese, ricotta), butter, cream, sour cream, yogurt, whey protein, or any dairy derivative.",
      "Carnivore":    "STRICT — only animal proteins and fats: meat, fish, eggs, butter, lard. Absolutely no grains, legumes, vegetables, fruits, seeds, nuts, or plant foods.",
      "Paleo":        "STRICT — no grains (rice, oats, bread, pasta), no legumes (beans, lentils, peanuts), no dairy, no refined sugar, no processed foods. Use meat, fish, eggs, vegetables, fruits, nuts, and healthy fats.",
      "Halal":        "ZERO TOLERANCE — no pork or pork derivatives (bacon, ham, lard, pepperoni), no alcohol in any ingredient (no wine sauces, beer-battered, sake-marinated).",
      "Kosher":       "STRICT — no pork (bacon, ham, pork chops), no shellfish (shrimp, lobster, crab, oysters, clams). Never mix meat and dairy in the same meal.",
      "High Protein": "Every meal must have at least 35g protein. Lead with a primary protein source in every meal. Prioritize lean proteins (chicken breast, turkey, egg whites, Greek yogurt, tuna, cottage cheese).",
      "High Fiber":   "Every meal must include high-fiber foods. Include legumes (beans, lentils, chickpeas), cruciferous vegetables, whole grains, or seeds in every meal.",
    };

    const dietConstraintLines = dietList.length > 0
      ? dietList.filter(d => DIET_RULES[d]).map(d => `✗ ${d}: ${DIET_RULES[d]}`).join("\n")
      : null;

    console.log(`[dietary] constraints sent: diet=[${dietList.join(",")}] dislikedFoods=[${dislikedFoods.join(",")}]`);

    const hardConstraints = [
      dietConstraintLines
        ? `⚠ DIETARY RESTRICTIONS — NON-NEGOTIABLE. VIOLATION = UNUSABLE PLAN:\n${dietConstraintLines}`
        : "",
      dislikedFoods.length    > 0 ? `✗ FOODS NEVER TO USE (user allergy/preference): ${dislikedFoods.join(", ")}` : "",
      dislikedCuisines.length > 0 ? `✗ CUISINES TO NEVER USE: ${dislikedCuisines.join(", ")}` : "",
    ].filter(Boolean).join("\n\n");

    const weeklyBudget = profile.weeklyBudget ?? null;

    // Build tiered budget instruction based on how tight the budget is
    let budgetLine = "";
    if (weeklyBudget) {
      if (weeklyBudget < 60) {
        budgetLine = `=== STRICT BUDGET MODE ($60 OR LESS) ===

🚨 ABSOLUTE PRIORITY: BUDGET COMPLIANCE 🚨

You MUST generate a plan that costs $50-65 at Kroger prices. Plans that exceed $70 are REJECTED.

CORE PRINCIPLE:
Your job is to hit the user's macro targets (${macros.proteinG}g protein, ${macros.carbG}g carbs, ${macros.fatG}g fat per day) while staying within the weekly budget of $${weeklyBudget}.

You have COMPLETE FREEDOM to use as much chicken, eggs, tofu, beans, rice, or any other affordable ingredient as needed to hit macros — AS LONG AS the total estimated grocery cost stays under $65.

There are NO portion limits. Use 100 eggs if that's what fits the budget and hits macros. Use 10 lbs of chicken if it works. The ONLY constraint is total cost.

---

STEP 1: KNOW YOUR PRICES (Kroger 2026)

PROTEINS (use as much as needed):
- Eggs: $1.79/dozen (12 count) — CHEAPEST protein at $0.025/g
- Chicken thighs: $2.49/lb (16 oz) — $0.027/g protein
- Ground turkey: $4.99/lb (16 oz) — $0.054/g protein
- Firm tofu: $1.99/14 oz — $0.034/g protein
- Canned tuna: $1.00/5oz can — $0.038/g protein
- Canned beans (black/white/kidney/chickpeas): $0.89/15oz can — $0.014/g protein

GRAINS & CARBS:
- White rice: $1.79/32 oz (2 lb bag)
- Pasta: $1.00-1.59/16 oz box
- White bread: $2.99/24 oz loaf
- Wheat bread: $2.99/20 oz loaf
- Potatoes: $1.99/80 oz (5 lb bag)

OILS & FATS:
- Vegetable oil: $3.99/48 oz
- Olive oil: $6.49/16 oz (expensive — use sparingly)
- Butter: $3.79/16 oz

VEGETABLES (frozen preferred):
- Frozen mixed vegetables: $1.99/12 oz bag
- Frozen broccoli: $1.49/12 oz bag
- Frozen green beans: $0.88/12 oz bag
- Fresh onions: $0.50/8 oz (1 medium)
- Potatoes: $1.99/5 lb bag

PANTRY (free or cheap):
- Soy sauce: $2.49/15 oz
- Garlic powder, onion powder, cumin, paprika, salt, pepper: pantry items (free)

---

STEP 2: FORBIDDEN ITEMS (TOO EXPENSIVE — NEVER USE)

❌ Jasmine rice ($7.49/5lb) — use white rice instead
❌ Basmati rice ($7.49/5lb) — use white rice instead
❌ Quinoa, farro, bulgur — use white rice instead
❌ Tahini ($6.99/16oz)
❌ Greek yogurt ($4.99/32oz) — regular yogurt ok if needed
❌ BBQ sauce ($3.79) — use soy sauce instead
❌ Specialty sauces (hoisin, teriyaki, fish sauce) — use soy sauce
❌ Dijon mustard ($3.49)
❌ Fresh salmon, fresh shrimp, fresh fish
❌ Specialty cheeses — basic cheddar only if needed ($2.33/8oz)
❌ Nuts as ingredients (peanuts, almonds, cashews, walnuts)
❌ Fresh herbs (basil, cilantro, parsley) — use dried only
❌ Wide rice noodles ($2.50/8oz) — use pasta or rice

---

STEP 3: STRATEGY FOR $50-65 BUDGETS

PROTEIN HIERARCHY (cheapest first):
1. Canned beans ($0.014/g) — use HEAVILY
2. Eggs ($0.025/g) — use 3-5 dozen if needed
3. Chicken thighs ($0.027/g) — primary meat
4. Firm tofu ($0.034/g) — cheap bulk protein
5. Canned tuna ($0.038/g) — occasionally
6. Ground turkey ($0.054/g) — use sparingly, expensive

MACRO STRATEGY:
- Load up on beans for cheap protein + fiber + carbs
- Use eggs liberally (dozens are cheap)
- Chicken thighs as primary meat (cheapest per gram)
- White rice for cheap carbs (not jasmine/basmati)
- Vegetable oil for fats (cheapest option)
- Frozen vegetables for volume + nutrients

CUISINE RESTRICTIONS:
- Maximum 2-3 cuisine styles per week (reduces specialty ingredients)
- Keep meals SIMPLE (complexity = more ingredients = higher cost)
- Repeat core ingredients across multiple meals

---

STEP 4: VERIFICATION (MANDATORY BEFORE RETURNING PLAN)

Before returning your meal plan, estimate the total grocery cost:

A) Protein costs:
   Eggs: ___ count × $1.79/dozen = $___
   Chicken thighs: ___ oz × $2.49/16oz = $___
   Ground turkey: ___ oz × $4.99/16oz = $___
   Tofu: ___ oz × $1.99/14oz = $___
   Tuna: ___ cans × $1.00/can = $___
   Beans: ___ cans × $0.89/can = $___
   PROTEIN SUBTOTAL: $___

B) Grains/carbs costs:
   White rice: ___ cups ÷ 16 cups/bag × $1.79 = $___
   Pasta: ___ boxes × $1.00 = $___
   Bread: ___ loaves × $2.99 = $___
   GRAINS SUBTOTAL: $___

C) Oils/fats:
   Vegetable oil: ___ tbsp (1 bottle = $3.99)
   Olive oil: ___ tbsp (1 bottle = $6.49)
   Butter: ___ tbsp (1 stick = $3.79)
   OILS SUBTOTAL: $___

D) Vegetables:
   Frozen bags: ___ bags × $1.99 = $___
   Fresh items: $___
   VEGETABLES SUBTOTAL: $___

E) Other:
   Soy sauce, pantry: ~$2.50

ESTIMATED TOTAL COST: $___

IF TOTAL > $65:
- Replace ground turkey with chicken thighs
- Replace olive oil with vegetable oil
- Replace fresh vegetables with frozen
- Reduce meat, increase beans/tofu
- Simplify meals further

IF TOTAL < $45:
- You have room to add variety
- Consider adding more vegetables
- Consider adding fruit (bananas $0.19 each)

TARGET RANGE: $50-65

---

STEP 5: FINAL OUTPUT

Return the meal plan JSON with simple, budget-optimized meals.

If you genuinely cannot hit the macro targets within $65 budget, respond with:
"Unable to generate strict budget plan. The protein target of ${macros.proteinG}g/day requires approximately $${Math.ceil((macros.proteinG * 7 * 0.025) + 20)}/week minimum. Recommend increasing budget to $75-85."`;
      } else if (weeklyBudget < 90) {
        budgetLine = `MODERATE BUDGET — $${weeklyBudget}/week.
Total grocery cost for the week (4A + 3B) should stay at or under $${weeklyBudget}.

PREFERRED proteins: chicken breast, ground turkey, eggs, ground beef, canned beans.
OCCASIONAL (max 1 meal/week): salmon or pork chops.
AVOID: steak, shrimp, lamb, any cut over $8/lb.

PRODUCE: mix fresh and frozen; seasonal fruit (apple, banana, orange).
Limit avocado to 1 meal max. Prefer frozen berries over fresh.

CARBS: rice, pasta, potatoes as primary starches.`;
      } else {
        budgetLine = `BUDGET — $${weeklyBudget}/week. Total grocery cost for the week should stay near $${weeklyBudget}.
All proteins allowed. Vary protein sources. Fresh produce encouraged. Still avoid unnecessary waste — don't use exotic specialty items that spike cost without nutrition benefit.`;
      }
    }

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
    const buildDynamicContent = (retryPrefix = "") => {
      const parts = [];

      if (retryPrefix) parts.push(retryPrefix);

      // Budget goes FIRST — highest priority so Claude never forgets it
      if (budgetLine) parts.push(budgetLine);

      parts.push(`Generate an A/B day meal plan. Goal: ${goal}.`);

      // Dietary constraints — second highest priority
      if (hardConstraints) {
        parts.push(hardConstraints);
      }

      // Macros — explicit and prominent
      parts.push(
        `MACROS — REQUIRED. Hit EVERY daily total within 3% or the plan fails:
Daily targets: Cal:${macros.target} P:${macros.proteinG}g C:${macros.carbG}g F:${macros.fatG}g
Protein target of ${macros.proteinG}g is critical — use sufficient protein sources at each meal.

MACRO DISTRIBUTION — breakfast lighter, dinner heavier:
- Breakfast: ~${Math.round(macros.target*0.20)}-${Math.round(macros.target*0.22)} cal, ~${Math.round(macros.proteinG*0.20)}-${Math.round(macros.proteinG*0.22)}g protein
- Lunch:     ~${Math.round(macros.target*0.27)}-${Math.round(macros.target*0.29)} cal, ~${Math.round(macros.proteinG*0.27)}-${Math.round(macros.proteinG*0.29)}g protein
- Snack:     ~${Math.round(macros.target*0.13)}-${Math.round(macros.target*0.15)} cal, ~${Math.round(macros.proteinG*0.13)}-${Math.round(macros.proteinG*0.15)}g protein
- Dinner:    ~${Math.round(macros.target*0.34)}-${Math.round(macros.target*0.36)} cal, ~${Math.round(macros.proteinG*0.34)}-${Math.round(macros.proteinG*0.36)}g protein`
      );

      parts.push(complexityLine);
      parts.push(`Cuisine per slot:\n${cuisineAssignmentLines}`);

      return parts.join("\n\n");
    };

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
      // ── Full Sonnet retry with explicit correction prefix ──────
      // Haiku portion-fix removed: Haiku was not reliable enough for macro accuracy.
      // A second Sonnet call with a correction prefix is more reliable.
      const missDetails = [];
      if (checkA.failed) {
        if (Math.abs(checkA.diffs.calOff) > 5) missDetails.push(`Day A cal: got ${checkA.totals.cal}, need ${macros.target}`);
        if (Math.abs(checkA.diffs.pOff)   > 5) missDetails.push(`Day A protein: got ${checkA.totals.p}g, need ${macros.proteinG}g`);
        if (Math.abs(checkA.diffs.cOff)   > 5) missDetails.push(`Day A carbs: got ${checkA.totals.c}g, need ${macros.carbG}g`);
        if (Math.abs(checkA.diffs.fOff)   > 5) missDetails.push(`Day A fat: got ${checkA.totals.f}g, need ${macros.fatG}g`);
      }
      if (checkB.failed) {
        if (Math.abs(checkB.diffs.calOff) > 5) missDetails.push(`Day B cal: got ${checkB.totals.cal}, need ${macros.target}`);
        if (Math.abs(checkB.diffs.pOff)   > 5) missDetails.push(`Day B protein: got ${checkB.totals.p}g, need ${macros.proteinG}g`);
        if (Math.abs(checkB.diffs.cOff)   > 5) missDetails.push(`Day B carbs: got ${checkB.totals.c}g, need ${macros.carbG}g`);
        if (Math.abs(checkB.diffs.fOff)   > 5) missDetails.push(`Day B fat: got ${checkB.totals.f}g, need ${macros.fatG}g`);
      }

      const retryPrefix =
        `PREVIOUS ATTEMPT FAILED MACRO TARGETS. Generate a completely new plan that hits the targets.\n` +
        `Misses: ${missDetails.join("; ")}\n` +
        `CRITICAL: Protein target of ${macros.proteinG}g per day MUST be met. Use larger protein portions.\n\n`;

      console.log("[macro-fix] Macro validation failed — full Sonnet retry:", missDetails.join(" | "));
      const retryResult = await callClaude(apiKey, MODEL_SONNET, buildDynamicContent(retryPrefix), { useCache: true });
      totalUsage = mergeUsage(totalUsage, retryResult.usage || {});

      if (!retryResult.error) {
        const retryParsed = parsePlan(retryResult.rawText);
        if (!retryParsed.error && retryParsed.abPlan) {
          const retryA = validateMacros(retryParsed.abPlan.A, macros, "Day A (retry)");
          const retryB = validateMacros(retryParsed.abPlan.B, macros, "Day B (retry)");
          if (!retryA.failed && !retryB.failed) {
            console.log("[macro-fix] Retry PASSED — using corrected plan");
            abPlan = retryParsed.abPlan;
          } else {
            console.warn("[macro-fix] Retry still off — serving best available plan");
            abPlan = retryParsed.abPlan; // serve retry plan even if imperfect (better than first fail)
          }
        } else {
          console.warn("[macro-fix] Retry parse failed:", retryParsed.error, "— serving first attempt");
        }
      } else {
        console.warn("[macro-fix] Retry API call failed:", retryResult.error, "— serving first attempt");
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

    // TODO V1.5: Validate estimated cost here and retry if >150% of budget
    return res.json({ abPlan, remaining });
  } catch (err) {
    console.error("Generate plan error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate meal plan" });
  }
}
