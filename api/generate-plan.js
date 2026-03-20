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

// ── Rate limit constants ────────────────────────────────────────
const FREE_DAILY_LIMIT   = 1;   // Free: per calendar day
const FREE_WEEKLY_LIMIT  = 2;   // Free: per 7-day rolling window
const FREE_MONTHLY_LIMIT = 8;   // Free: per calendar month
const PRO_DAILY_LIMIT    = 3;   // Pro:  per calendar day
const PRO_MONTHLY_LIMIT  = 20;  // Pro:  per calendar month

// ── Time window helpers ─────────────────────────────────────────
const startOfDay = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();

const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1).toISOString();

const sevenDaysAgo = () =>
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

// ── Count helper — logs and returns 0 on error instead of silently skipping ──
async function countLogs(sb, userId, since, label) {
  const { count, error } = await sb
    .from("generation_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("generated_at", since);

  if (error) {
    console.error(`[rate-limit] SELECT ${label} FAILED — error:`, JSON.stringify(error));
    // Return a high number so generation is blocked when the DB can't be read.
    // This prevents the silent-failure bypass where count stays 0.
    return 999;
  }

  const n = count ?? 0;
  console.log(`[rate-limit] ${label} count for user ${userId}: ${n}`);
  return n;
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

    // ── Guard: userId is required for rate limiting ──────────────
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      console.error("[rate-limit] Request missing userId — rejecting");
      return res.status(400).json({ error: "userId is required" });
    }
    console.log(`[rate-limit] Request from userId: ${userId} isPro: ${isPro}`);

    // ── Supabase service client (bypasses RLS — server-side only) ──
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
      // Free tier: check all three windows in parallel
      [dayCount, weeklyCount, monthCount] = await Promise.all([
        countLogs(sb, userId, startOfDay(),    "daily"),
        countLogs(sb, userId, sevenDaysAgo(),  "weekly"),
        countLogs(sb, userId, startOfMonth(),  "monthly"),
      ]);

      console.log(`[rate-limit] FREE check — day:${dayCount}/${FREE_DAILY_LIMIT} week:${weeklyCount}/${FREE_WEEKLY_LIMIT} month:${monthCount}/${FREE_MONTHLY_LIMIT}`);

      if (dayCount >= FREE_DAILY_LIMIT) {
        console.log(`[rate-limit] BLOCKED — daily limit hit (${dayCount})`);
        return res.status(429).json({
          error: "You've used your free plan for today. Upgrade to Pro for more.",
          limitReached: true,
          isPro: false,
          remaining: { daily: 0, weekly: Math.max(0, FREE_WEEKLY_LIMIT - weeklyCount), monthly: Math.max(0, FREE_MONTHLY_LIMIT - monthCount) },
        });
      }
      if (weeklyCount >= FREE_WEEKLY_LIMIT) {
        console.log(`[rate-limit] BLOCKED — weekly limit hit (${weeklyCount})`);
        return res.status(429).json({
          error: "You've used your 2 free plans this week. Upgrade to Pro for more.",
          limitReached: true,
          isPro: false,
          remaining: { daily: 0, weekly: 0, monthly: Math.max(0, FREE_MONTHLY_LIMIT - monthCount) },
        });
      }
      if (monthCount >= FREE_MONTHLY_LIMIT) {
        console.log(`[rate-limit] BLOCKED — monthly limit hit (${monthCount})`);
        return res.status(429).json({
          error: "You've used your 8 free plans this month. Upgrade to Pro for more.",
          limitReached: true,
          isPro: false,
          remaining: { daily: 0, weekly: 0, monthly: 0 },
        });
      }

      console.log(`[rate-limit] FREE — PASSED`);
    } else {
      // Pro tier: check day and month in parallel
      [dayCount, monthCount] = await Promise.all([
        countLogs(sb, userId, startOfDay(),   "daily"),
        countLogs(sb, userId, startOfMonth(), "monthly"),
      ]);

      console.log(`[rate-limit] PRO check — day:${dayCount}/${PRO_DAILY_LIMIT} month:${monthCount}/${PRO_MONTHLY_LIMIT}`);

      if (dayCount >= PRO_DAILY_LIMIT) {
        console.log(`[rate-limit] BLOCKED — Pro daily limit hit (${dayCount})`);
        return res.status(429).json({
          error: "You've reached your daily generation limit. Resets tomorrow.",
          limitReached: true,
          isPro: true,
          remaining: { daily: 0, monthly: Math.max(0, PRO_MONTHLY_LIMIT - monthCount) },
        });
      }
      if (monthCount >= PRO_MONTHLY_LIMIT) {
        console.log(`[rate-limit] BLOCKED — Pro monthly limit hit (${monthCount})`);
        return res.status(429).json({
          error: "You've reached your monthly generation limit. Resets next month.",
          limitReached: true,
          isPro: true,
          remaining: { daily: Math.max(0, PRO_DAILY_LIMIT - dayCount), monthly: 0 },
        });
      }

      console.log(`[rate-limit] PRO — PASSED`);
    }

    // ── Build Claude prompt ──
    const macros = profile.macros || { target: 2200, proteinG: 180, carbG: 240, fatG: 70 };
    const goal = (profile.goal || "lean_bulk").replace("_", " ");

    // FIX 2: expanded 20-cuisine list, per-meal assignment, no day-level theme
    const ALL_CUISINES = [
      "Mediterranean","Japanese","Mexican","Indian","Middle Eastern","American Southern",
      "Thai","Korean","Greek","West African","German","Italian","French","Brazilian",
      "Caribbean","Ethiopian","Vietnamese","Chinese","Spanish","American BBQ",
    ];

    // Seeded LCG picker — picks n unique items from arr without replacement
    const pickUnique = (arr, n, s) => {
      const src = [...arr]; const out = []; let seed = Math.abs(s) >>> 0;
      for (let i = 0; i < Math.min(n, src.length); i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        out.push(...src.splice(seed % src.length, 1));
      }
      return out;
    };

    const userHash = (userId || "").split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    const seed = Math.abs((Date.now() ^ userHash) >>> 0);

    const dislikedCuisines = profile.dislikedCuisines || [];
    const excluded = [...new Set([...excludedCuisines, ...dislikedCuisines])];
    const pool = ALL_CUISINES.filter(c => !excluded.includes(c));
    const availPool = pool.length >= 4 ? pool : ALL_CUISINES; // need at least 4 unique

    const MEAL_TYPES = ["BREAKFAST", "LUNCH", "SNACK", "DINNER"];
    const dayCuisinesA = pickUnique(availPool, 4, seed);
    const dayCuisinesB = pickUnique(availPool, 4, seed + 99991);

    const cuisineAssignmentLines =
      `Day A — ${MEAL_TYPES.map((t, i) => `${t}: ${dayCuisinesA[i]}`).join(" | ")}\n` +
      `Day B — ${MEAL_TYPES.map((t, i) => `${t}: ${dayCuisinesB[i]}`).join(" | ")}`;

    console.log(`[prompt] Cuisine assignments: ${cuisineAssignmentLines.replace(/\n/g, " | ")}`);

    // FIX 3: full hard constraints block with per-preference rules
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
      dislikedFoods.length   > 0 ? `FOODS NEVER TO USE: ${dislikedFoods.join(", ")}` : "",
      dislikedCuisines.length > 0 ? `CUISINES TO NEVER USE: ${dislikedCuisines.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const prompt = `Generate an A/B day meal plan that matches these daily macro targets:
- Calories: ${macros.target} (within 3%)
- Protein: ${macros.proteinG}g (within 3%)
- Carbs: ${macros.carbG}g (within 3%)
- Fat: ${macros.fatG}g (within 3%)
- Goal: ${goal}

${hardConstraints}

Cuisine assignment for this generation — each meal slot has its own unique style:
${cuisineAssignmentLines}

Each meal must reflect its assigned cuisine style in ingredients, seasoning, and preparation. The goal is a realistic mixed day of eating — the way people actually eat — not a single-cuisine day. Breakfast might be American, lunch Mexican, snack Mediterranean, dinner Japanese. Make each meal feel authentic to its assigned style.

Across Day A and Day B, use overlapping base ingredients where practical (same protein prepared differently, same vegetables used in different ways) so the weekly grocery list stays efficient and affordable to shop for.

Never repeat the exact same meal across generations. Even if the cuisine style repeats, the specific dish must be different.

Rules:
- Day A and Day B must have completely different meals from each other
- Each day has exactly 4 meals: BREAKFAST, LUNCH, SNACK, DINNER — in that order
- Use realistic grocery store ingredients
- Each meal needs an ingredients array

Return ONLY valid JSON. No markdown, no code blocks, no backticks, no explanation. Just the raw JSON object starting with { and ending with }.

The JSON must follow this exact structure:
{
  "A": [
    {"type":"BREAKFAST","name":"Meal name","desc":"Short description","cal":400,"p":30,"c":45,"f":12,"time":"10 min","ingredients":[{"name":"ingredient name","qty":"1","unit":"cup"}]},
    {"type":"LUNCH","name":"Meal name","desc":"Short description","cal":600,"p":50,"c":55,"f":18,"time":"20 min","ingredients":[{"name":"ingredient name","qty":"6","unit":"oz"}]},
    {"type":"SNACK","name":"Meal name","desc":"Short description","cal":300,"p":25,"c":20,"f":10,"time":"5 min","ingredients":[{"name":"ingredient name","qty":"1","unit":"serving"}]},
    {"type":"DINNER","name":"Meal name","desc":"Short description","cal":700,"p":55,"c":50,"f":22,"time":"30 min","ingredients":[{"name":"ingredient name","qty":"8","unit":"oz"}]}
  ],
  "B": [
    {"type":"BREAKFAST","name":"Different meal","desc":"Short description","cal":400,"p":30,"c":45,"f":12,"time":"10 min","ingredients":[{"name":"ingredient name","qty":"2","unit":"piece"}]},
    {"type":"LUNCH","name":"Different meal","desc":"Short description","cal":600,"p":50,"c":55,"f":18,"time":"20 min","ingredients":[{"name":"ingredient name","qty":"0.5","unit":"cup"}]},
    {"type":"SNACK","name":"Different meal","desc":"Short description","cal":300,"p":25,"c":20,"f":10,"time":"5 min","ingredients":[{"name":"ingredient name","qty":"1","unit":"oz"}]},
    {"type":"DINNER","name":"Different meal","desc":"Short description","cal":700,"p":55,"c":50,"f":22,"time":"30 min","ingredients":[{"name":"ingredient name","qty":"1","unit":"lbs"}]}
  ]
}`;

    // ── Call Claude API ──
    // Prefill the assistant turn with "{" to guarantee the response starts
    // as a JSON object — the most reliable way to get pure JSON from Claude.
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [
          { role: "user",      content: prompt },
          { role: "assistant", content: "{"    }, // prefill: forces response to begin with {
        ],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("Claude API error:", errText);
      let errMsg = "AI generation failed";
      try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch {}
      return res.status(claudeRes.status).json({ error: errMsg });
    }

    const claudeData = await claudeRes.json();
    // Claude's reply is the continuation after the prefill "{", so prepend it back.
    const continuation = claudeData.content.map((b) => b.text || "").join("");
    const rawText = "{" + continuation;

    console.log("Claude raw response (first 500 chars):", rawText.slice(0, 500));

    // Extract the outermost {...} JSON object — handles any stray text or fences.
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON object found in response. Full raw:", rawText);
      return res.status(500).json({ error: "AI returned no JSON — please try again." });
    }
    const clean = jsonMatch[0];

    let abPlan;
    try {
      abPlan = JSON.parse(clean);
    } catch (parseErr) {
      console.error("JSON.parse failed:", parseErr.message);
      console.error("Full raw text from Claude:", rawText);
      console.error("Extracted clean string (first 600):", clean.slice(0, 600));
      return res.status(500).json({
        error: "AI returned malformed JSON — please try again.",
      });
    }

    if (!abPlan.A || !abPlan.B || !Array.isArray(abPlan.A) || !Array.isArray(abPlan.B)) {
      console.error("Parsed JSON missing A/B arrays. Keys:", Object.keys(abPlan));
      console.error("Full parsed object:", JSON.stringify(abPlan).slice(0, 400));
      return res.status(500).json({ error: "AI returned unexpected format — please try again." });
    }

    if (abPlan.A.length !== 4 || abPlan.B.length !== 4) {
      console.warn(`Meal count mismatch: A=${abPlan.A.length}, B=${abPlan.B.length} (expected 4 each)`);
      // Non-fatal: continue with whatever was returned
    }

    // ── Log this generation — awaited so the next request sees the updated count ──
    // generated_at is set explicitly (never rely solely on DB default)
    console.log(`[rate-limit] Inserting generation_log for user ${userId}`);
    const { error: insertError } = await sb
      .from("generation_log")
      .insert({ user_id: userId, generated_at: new Date().toISOString() });

    if (insertError) {
      // Log full error so it shows in Vercel function logs
      console.error("[rate-limit] generation_log INSERT FAILED:", JSON.stringify(insertError));
      console.error("[rate-limit] Insert error details — code:", insertError.code, "message:", insertError.message, "hint:", insertError.hint);
      // Do NOT block the response — the user gets their plan, but flag it
      console.warn("[rate-limit] Generation served WITHOUT being logged — this user's limit may not enforce correctly");
    } else {
      console.log(`[rate-limit] generation_log insert OK for user ${userId}`);
    }

    // ── Compute remaining counts (after this generation) ──
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
        monthly: Math.max(0, PRO_MONTHLY_LIMIT  - (monthCount + 1)),
      };
    }

    return res.json({ abPlan, remaining });
  } catch (err) {
    console.error("Generate plan error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate meal plan" });
  }
}
