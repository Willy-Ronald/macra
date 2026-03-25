/**
 * Macra — AI Meal Plan Generator (Server-side)
 *
 * Vercel Serverless Function
 * Endpoint: POST /api/generate-plan
 *
 * Generates an A/B day meal plan via Claude API with per-user rate limiting.
 *
 * Rate limits:
 *   Free  → 1/day · 2/week · 8/month
 *   Pro   → 3/day · 20/month
 *
 * Required Vercel env vars (in addition to ANTHROPIC_API_KEY):
 *   SUPABASE_URL          – your Supabase project URL
 *   SUPABASE_SERVICE_KEY  – service_role secret key (NOT the anon key)
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// ── Rate limit constants ────────────────────────────────────────
const FREE_DAILY_LIMIT   = 1;
const FREE_WEEKLY_LIMIT  = 2;
const FREE_MONTHLY_LIMIT = 8;
const PRO_DAILY_LIMIT    = 3;
const PRO_MONTHLY_LIMIT  = 20;

// ── Time window helpers ─────────────────────────────────────────
const startOfDay = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();

const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1).toISOString();

const sevenDaysAgo = () =>
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

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
// Returns { totals, failed, diffs } and logs a [macro-check] line.
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
    `cal ${totals.cal}kcal (${diffs.calOff}% off) ` +
    `protein ${totals.p}g (${diffs.pOff}% off) ` +
    `carbs ${totals.c}g (${diffs.cOff}% off) ` +
    `fat ${totals.f}g (${diffs.fOff}% off) → ${failed ? "FAIL" : "PASS"}`
  );

  return { totals, failed, diffs };
}

// ── Claude API call helper ──────────────────────────────────────
async function callClaude(apiKey, prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [
        { role: "user",      content: prompt },
        { role: "assistant", content: "{"    }, // prefill forces response to begin with {
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
  console.log("CLAUDE RESPONSE OK — stop_reason:", data.stop_reason, "| usage:", JSON.stringify(data.usage));
  const continuation = data.content.map(b => b.text || "").join("");
  return { rawText: "{" + continuation };
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

// ── main handler ───────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  try {
    const { profile, userId, isPro, excludedCuisines = [] } = req.body;
    if (!profile) {
      return res.status(400).json({ error: "Missing profile data" });
    }

    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      console.error("[rate-limit] Request missing userId — rejecting");
      return res.status(400).json({ error: "userId is required" });
    }
    console.log(`[rate-limit] Request from userId: ${userId} isPro: ${isPro}`);

    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_KEY;
    if (!sbUrl || !sbKey) {
      console.error("[rate-limit] SUPABASE_URL or SUPABASE_SERVICE_KEY not configured — blocking generation");
      return res.status(500).json({ error: "Server misconfiguration — cannot enforce rate limits" });
    }
    const sb = createClient(sbUrl, sbKey);

    // ── Rate limiting ───────────────────────────────────────────
    let dayCount = 0, weeklyCount = 0, monthCount = 0;

    if (!isPro) {
      [dayCount, weeklyCount, monthCount] = await Promise.all([
        countLogs(sb, userId, startOfDay(),   "daily"),
        countLogs(sb, userId, sevenDaysAgo(), "weekly"),
        countLogs(sb, userId, startOfMonth(), "monthly"),
      ]);

      console.log(`[rate-limit] FREE check — day:${dayCount}/${FREE_DAILY_LIMIT} week:${weeklyCount}/${FREE_WEEKLY_LIMIT} month:${monthCount}/${FREE_MONTHLY_LIMIT}`);

      if (dayCount >= FREE_DAILY_LIMIT) {
        return res.status(429).json({ error: "You've used your free plan for today. Upgrade to Pro for more.", limitReached: true, isPro: false, remaining: { daily: 0, weekly: Math.max(0, FREE_WEEKLY_LIMIT - weeklyCount), monthly: Math.max(0, FREE_MONTHLY_LIMIT - monthCount) } });
      }
      if (weeklyCount >= FREE_WEEKLY_LIMIT) {
        return res.status(429).json({ error: "You've used your 2 free plans this week. Upgrade to Pro for more.", limitReached: true, isPro: false, remaining: { daily: 0, weekly: 0, monthly: Math.max(0, FREE_MONTHLY_LIMIT - monthCount) } });
      }
      if (monthCount >= FREE_MONTHLY_LIMIT) {
        return res.status(429).json({ error: "You've used your 8 free plans this month. Upgrade to Pro for more.", limitReached: true, isPro: false, remaining: { daily: 0, weekly: 0, monthly: 0 } });
      }

      console.log("[rate-limit] FREE — PASSED");
    } else {
      [dayCount, monthCount] = await Promise.all([
        countLogs(sb, userId, startOfDay(),   "daily"),
        countLogs(sb, userId, startOfMonth(), "monthly"),
      ]);

      console.log(`[rate-limit] PRO check — day:${dayCount}/${PRO_DAILY_LIMIT} month:${monthCount}/${PRO_MONTHLY_LIMIT}`);

      if (dayCount >= PRO_DAILY_LIMIT) {
        return res.status(429).json({ error: "You've reached your daily generation limit. Resets tomorrow.", limitReached: true, isPro: true, remaining: { daily: 0, monthly: Math.max(0, PRO_MONTHLY_LIMIT - monthCount) } });
      }
      if (monthCount >= PRO_MONTHLY_LIMIT) {
        return res.status(429).json({ error: "You've reached your monthly generation limit. Resets next month.", limitReached: true, isPro: true, remaining: { daily: Math.max(0, PRO_DAILY_LIMIT - dayCount), monthly: 0 } });
      }

      console.log("[rate-limit] PRO — PASSED");
    }

    // ── Build prompt ─────────────────────────────────────────────
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
      "Vegan":        "absolutely no meat, fish, dairy, eggs, or animal products of any kind",
      "Vegetarian":   "no meat or fish — dairy and eggs are allowed",
      "Keto":         "total carbs across all meals must stay under 30g net carbs for the entire day",
      "Gluten-Free":  "no wheat, barley, rye, or any gluten-containing ingredients",
      "Dairy-Free":   "no milk, cheese, butter, cream, yogurt, or any dairy products",
      "Carnivore":    "meals centered exclusively on animal proteins and fats — no grains, legumes, or vegetables",
      "Paleo":        "no grains, legumes, dairy, or processed foods",
      "Halal":        "no pork or alcohol in any ingredient",
      "Kosher":       "no pork or shellfish, and never mix meat and dairy in the same meal",
      "High Protein": "every meal must prioritize lean protein sources — minimum 35g protein per meal",
      "High Fiber":   "include high-fiber foods in every meal (legumes, vegetables, whole grains, seeds)",
    };

    const dietConstraintLines = dietList.length > 0
      ? dietList.filter(d => DIET_RULES[d]).map(d => `  - ${d}: ${DIET_RULES[d]}`).join("\n")
      : "  - No dietary restrictions";

    const hardConstraints = [
      "HARD CONSTRAINTS — follow all of these without exception:",
      "DIETARY RULES:",
      dietConstraintLines,
      dislikedFoods.length    > 0 ? `FOODS NEVER TO USE: ${dislikedFoods.join(", ")}` : "",
      dislikedCuisines.length > 0 ? `CUISINES TO NEVER USE: ${dislikedCuisines.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    // Computed macro accuracy ranges (3% tolerance shown in prompt)
    const calLo  = Math.round(macros.target   * 0.97);
    const calHi  = Math.round(macros.target   * 1.03);
    const pLo    = Math.round(macros.proteinG * 0.97);
    const pHi    = Math.round(macros.proteinG * 1.03);
    const cLo    = Math.round(macros.carbG    * 0.97);
    const cHi    = Math.round(macros.carbG    * 1.03);
    const fLo    = Math.round(macros.fatG     * 0.97);
    const fHi    = Math.round(macros.fatG     * 1.03);
    const avgMealProtein = Math.round(macros.proteinG / 4);
    const minMealProtein = Math.round(macros.proteinG * 0.15);

    const macroAccuracyBlock = `MACRO ACCURACY IS MANDATORY. The total macros across all 4 meals must hit these targets within 3%:
- Calories: ${macros.target} cal (acceptable range: ${calLo} to ${calHi})
- Protein: ${macros.proteinG}g (acceptable range: ${pLo} to ${pHi})
- Carbs: ${macros.carbG}g (acceptable range: ${cLo} to ${cHi})
- Fat: ${macros.fatG}g (acceptable range: ${fLo} to ${fHi})

To hit protein targets, prioritize high-protein ingredients in every meal: chicken breast, turkey, eggs, Greek yogurt, cottage cheese, lean beef, fish, whey protein, tofu, tempeh, legumes. Every meal must contain a substantial protein source.
Do not pad meals with extra carbs or fats to hit calorie targets — adjust portion sizes of the protein source instead.
Before finalizing your response, mentally sum the cal, p, c, and f values across all 4 meals and verify each is within 3% of the target. If not, adjust portion sizes until they are.

With a daily protein target of ${macros.proteinG}g across 4 meals, each meal should average ${avgMealProtein}g protein. No single meal should have less than ${minMealProtein}g protein.`;

    const buildPrompt = (retryPrefix = "") => `${retryPrefix}Generate an A/B day meal plan that matches these daily macro targets:
- Calories: ${macros.target} (within 3%)
- Protein: ${macros.proteinG}g (within 3%)
- Carbs: ${macros.carbG}g (within 3%)
- Fat: ${macros.fatG}g (within 3%)
- Goal: ${goal}

${macroAccuracyBlock}

${hardConstraints}

Cuisine assignment for this generation — each meal slot has its own unique style:
${cuisineAssignmentLines}

Each meal must reflect its assigned cuisine style in ingredients, seasoning, and preparation. The goal is a realistic mixed day of eating — the way people actually eat — not a single-cuisine day. Breakfast might be American, lunch Mexican, snack Mediterranean, dinner Japanese. Make each meal feel authentic to its assigned style.

IMPORTANT — meal name rules: The "name" field must contain only the dish name itself (e.g. "Miso Glazed Salmon"). Never include the cuisine type, style label, or category prefix in the name field. The "cuisine" field stores the cuisine style string separately (e.g. "Japanese"). The cuisine style should only influence the ingredients and preparation, not appear in the name.

Across Day A and Day B, use overlapping base ingredients where practical (same protein prepared differently, same vegetables used in different ways) so the weekly grocery list stays efficient and affordable to shop for.

Never repeat the exact same meal across generations. Even if the cuisine style repeats, the specific dish must be different.

Rules:
- Day A and Day B must have completely different meals from each other
- Each day has exactly 4 meals: BREAKFAST, LUNCH, SNACK, DINNER — in that order
- Use realistic grocery store ingredients
- Each meal needs an ingredients array, step-by-step instructions, and equipment list.

For instructions, write 5-8 detailed cooking steps. Each step should include: the action to take, the heat level or timing where relevant, what the food should look like or smell like when done, and any technique tips that help a beginner succeed. Example of a good step: 'Heat a non-stick skillet over medium-high heat until hot, then add 1 tsp olive oil and swirl to coat. Add the chicken and cook undisturbed for 4-5 minutes until golden brown on the bottom before flipping.' Never write a step shorter than one full descriptive sentence. For equipment, list only the essential items needed, maximum 4 items.

Return ONLY valid JSON. No markdown, no code blocks, no backticks, no explanation. Just the raw JSON object starting with { and ending with }.

The JSON must follow this exact structure:
{
  "A": [
    {"type":"BREAKFAST","cuisine":"American","name":"Meal name","desc":"Short description","cal":400,"p":30,"c":45,"f":12,"time":"10 min","ingredients":[{"name":"ingredient name","qty":"1","unit":"cup"}],"instructions":["Step 1: Do this first.","Step 2: Then do this.","Step 3: Continue until done."],"equipment":["Non-stick skillet","Cutting board"]},
    {"type":"LUNCH","cuisine":"Mexican","name":"Meal name","desc":"Short description","cal":600,"p":50,"c":55,"f":18,"time":"20 min","ingredients":[{"name":"ingredient name","qty":"6","unit":"oz"}],"instructions":["Step 1: Do this first.","Step 2: Then do this."],"equipment":["Large pot","Colander"]},
    {"type":"SNACK","cuisine":"Mediterranean","name":"Meal name","desc":"Short description","cal":300,"p":25,"c":20,"f":10,"time":"5 min","ingredients":[{"name":"ingredient name","qty":"1","unit":"serving"}],"instructions":["Step 1: Do this first.","Step 2: Then do this."],"equipment":["Bowl"]},
    {"type":"DINNER","cuisine":"Japanese","name":"Meal name","desc":"Short description","cal":700,"p":55,"c":50,"f":22,"time":"30 min","ingredients":[{"name":"ingredient name","qty":"8","unit":"oz"}],"instructions":["Step 1: Do this first.","Step 2: Then do this.","Step 3: Continue until done.","Step 4: Finish and serve."],"equipment":["Wok","Chef knife","Cutting board"]}
  ],
  "B": [
    {"type":"BREAKFAST","cuisine":"Greek","name":"Different meal","desc":"Short description","cal":400,"p":30,"c":45,"f":12,"time":"10 min","ingredients":[{"name":"ingredient name","qty":"2","unit":"piece"}],"instructions":["Step 1: Do this first.","Step 2: Then do this."],"equipment":["Non-stick pan"]},
    {"type":"LUNCH","cuisine":"Korean","name":"Different meal","desc":"Short description","cal":600,"p":50,"c":55,"f":18,"time":"20 min","ingredients":[{"name":"ingredient name","qty":"0.5","unit":"cup"}],"instructions":["Step 1: Do this first.","Step 2: Then do this.","Step 3: Continue until done."],"equipment":["Skillet","Tongs"]},
    {"type":"SNACK","cuisine":"Indian","name":"Different meal","desc":"Short description","cal":300,"p":25,"c":20,"f":10,"time":"5 min","ingredients":[{"name":"ingredient name","qty":"1","unit":"oz"}],"instructions":["Step 1: Do this first.","Step 2: Then do this."],"equipment":["Bowl","Spoon"]},
    {"type":"DINNER","cuisine":"Italian","name":"Different meal","desc":"Short description","cal":700,"p":55,"c":50,"f":22,"time":"30 min","ingredients":[{"name":"ingredient name","qty":"1","unit":"lbs"}],"instructions":["Step 1: Do this first.","Step 2: Then do this.","Step 3: Continue until done.","Step 4: Finish and serve."],"equipment":["Large pot","Colander","Sauce pan"]}
  ]
}`;

    // ── First Claude call ────────────────────────────────────────
    console.log("CALLING CLAUDE API", { model: "claude-sonnet-4-20250514", userId, timestamp: new Date().toISOString() });
    const firstResult = await callClaude(apiKey, buildPrompt());

    if (firstResult.error) {
      console.error("CLAUDE API ERROR:", firstResult.error);
      return res.status(firstResult.status || 500).json({ error: firstResult.error });
    }

    const firstParsed = parsePlan(firstResult.rawText);

    // Truncation on first attempt → retry immediately with a conciseness constraint
    if (firstParsed.truncated) {
      console.warn("[truncation] First response cut off — retrying with conciseness cap");
      const truncRetryPrefix =
        "Your previous response was cut off before completing. Please provide the complete plan " +
        "with all 8 meals, keeping instructions concise — maximum 5 steps per meal, each step under 20 words. ";
      const truncRetry = await callClaude(apiKey, buildPrompt(truncRetryPrefix));
      if (truncRetry.error) {
        console.error("Retry after truncation also failed:", truncRetry.error);
        return res.status(500).json({ error: "AI generation failed — please try again." });
      }
      const truncRetryParsed = parsePlan(truncRetry.rawText);
      if (truncRetryParsed.error) {
        console.error("Parse error on truncation retry:", truncRetryParsed.error);
        return res.status(500).json({ error: truncRetryParsed.error });
      }
      // Fall through with retry result
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
      // Build a targeted correction message highlighting which macros missed
      const missLines = [];
      if (checkA.failed) {
        if (Math.abs(checkA.diffs.pOff)   > 5) missLines.push(`Day A protein was ${checkA.totals.p}g but target is ${macros.proteinG}g (${checkA.diffs.pOff}% off)`);
        if (Math.abs(checkA.diffs.cOff)   > 5) missLines.push(`Day A carbs were ${checkA.totals.c}g but target is ${macros.carbG}g (${checkA.diffs.cOff}% off)`);
        if (Math.abs(checkA.diffs.calOff) > 5) missLines.push(`Day A calories were ${checkA.totals.cal} but target is ${macros.target} (${checkA.diffs.calOff}% off)`);
        if (Math.abs(checkA.diffs.fOff)   > 5) missLines.push(`Day A fat was ${checkA.totals.f}g but target is ${macros.fatG}g (${checkA.diffs.fOff}% off)`);
      }
      if (checkB.failed) {
        if (Math.abs(checkB.diffs.pOff)   > 5) missLines.push(`Day B protein was ${checkB.totals.p}g but target is ${macros.proteinG}g (${checkB.diffs.pOff}% off)`);
        if (Math.abs(checkB.diffs.cOff)   > 5) missLines.push(`Day B carbs were ${checkB.totals.c}g but target is ${macros.carbG}g (${checkB.diffs.cOff}% off)`);
        if (Math.abs(checkB.diffs.calOff) > 5) missLines.push(`Day B calories were ${checkB.totals.cal} but target is ${macros.target} (${checkB.diffs.calOff}% off)`);
        if (Math.abs(checkB.diffs.fOff)   > 5) missLines.push(`Day B fat was ${checkB.totals.f}g but target is ${macros.fatG}g (${checkB.diffs.fOff}% off)`);
      }

      const retryPrefix =
        `IMPORTANT: Your previous response missed the macro targets. ` +
        missLines.join(". ") +
        `. Adjust portion sizes significantly — especially increase the protein source quantities — to hit the targets this time. `;

      console.log("[macro-check] Validation FAILED — retrying with correction prefix");
      console.log("[macro-check] Retry prefix:", retryPrefix);

      const retryResult = await callClaude(apiKey, buildPrompt(retryPrefix));

      if (retryResult.error) {
        console.warn("[macro-check] Retry Claude call failed:", retryResult.error, "— returning first attempt");
      } else {
        const { abPlan: retryPlan, error: retryParseError } = parsePlan(retryResult.rawText);
        if (retryParseError) {
          console.warn("[macro-check] Retry parse failed:", retryParseError, "— returning first attempt");
        } else {
          const retryA = validateMacros(retryPlan.A, macros, "Day A (retry)");
          const retryB = validateMacros(retryPlan.B, macros, "Day B (retry)");

          if (retryA.failed || retryB.failed) {
            console.warn("[macro-check] Retry also failed validation — returning retry result anyway");
          } else {
            console.log("[macro-check] Retry PASSED — using retry result");
          }
          abPlan = retryPlan;
        }
      }
    }

    // ── Log this generation ──────────────────────────────────────
    console.log(`[rate-limit] Inserting generation_log for user ${userId}`);
    const { error: insertError } = await sb
      .from("generation_log")
      .insert({ user_id: userId, generated_at: new Date().toISOString() });

    if (insertError) {
      console.error("[rate-limit] generation_log INSERT FAILED:", JSON.stringify(insertError));
      console.error("[rate-limit] Insert error details — code:", insertError.code, "message:", insertError.message, "hint:", insertError.hint);
      console.warn("[rate-limit] Generation served WITHOUT being logged — this user's limit may not enforce correctly");
    } else {
      console.log(`[rate-limit] generation_log insert OK for user ${userId}`);
    }

    // ── Compute remaining counts ─────────────────────────────────
    let remaining = null;
    if (!isPro) {
      remaining = {
        daily:   Math.max(0, FREE_DAILY_LIMIT   - (dayCount   + 1)),
        weekly:  Math.max(0, FREE_WEEKLY_LIMIT  - (weeklyCount + 1)),
        monthly: Math.max(0, FREE_MONTHLY_LIMIT - (monthCount  + 1)),
      };
    } else {
      remaining = {
        daily:   Math.max(0, PRO_DAILY_LIMIT   - (dayCount   + 1)),
        monthly: Math.max(0, PRO_MONTHLY_LIMIT - (monthCount + 1)),
      };
    }

    return res.json({ abPlan, remaining });
  } catch (err) {
    console.error("Generate plan error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate meal plan" });
  }
}
