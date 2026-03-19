/**
 * Macra — AI Meal Plan Generator (Server-side)
 *
 * Vercel Serverless Function
 * Endpoint: POST /api/generate-plan
 *
 * Generates an A/B day meal plan via Claude API with per-user rate limiting.
 *
 * Rate limits:
 *   Free  → 1 generation per 7 days
 *   Pro   → 3 per day, 20 per month
 *
 * Required Vercel env vars (in addition to ANTHROPIC_API_KEY):
 *   SUPABASE_URL          – your Supabase project URL
 *   SUPABASE_SERVICE_KEY  – service_role secret key (NOT the anon key)
 */

import { createClient } from "@supabase/supabase-js";

const FREE_WEEKLY_LIMIT  = 1;   // generations per 7-day rolling window
const PRO_DAILY_LIMIT    = 3;   // generations per calendar day
const PRO_MONTHLY_LIMIT  = 20;  // generations per calendar month

// ── helpers ────────────────────────────────────────────────────
const startOfDay = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();

const startOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1).toISOString();

const sevenDaysAgo = () =>
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

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
    const { profile, userId, isPro } = req.body;
    if (!profile) {
      return res.status(400).json({ error: "Missing profile data" });
    }

    // ── Supabase service client (bypasses RLS — server-side only) ──
    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_KEY;
    const sb = sbUrl && sbKey ? createClient(sbUrl, sbKey) : null;

    // ── Rate limiting ──
    let weeklyCount = 0, dayCount = 0, monthCount = 0;

    if (sb && userId) {
      if (!isPro) {
        // Free: count generations in the last 7 days
        const { count, error } = await sb
          .from("generation_log")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("generated_at", sevenDaysAgo());

        if (!error) weeklyCount = count || 0;

        if (weeklyCount >= FREE_WEEKLY_LIMIT) {
          return res.status(429).json({
            error: "Free plan allows 1 AI plan per week. Upgrade to Pro for more.",
            limitReached: true,
            isPro: false,
            remaining: { weekly: 0 },
          });
        }
      } else {
        // Pro: count per day and per month in parallel
        const [dayRes, monthRes] = await Promise.all([
          sb.from("generation_log")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("generated_at", startOfDay()),
          sb.from("generation_log")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("generated_at", startOfMonth()),
        ]);

        dayCount   = dayRes.count   || 0;
        monthCount = monthRes.count || 0;

        if (dayCount >= PRO_DAILY_LIMIT) {
          return res.status(429).json({
            error: "You've reached your daily generation limit. Your limit resets tomorrow.",
            limitReached: true,
            isPro: true,
            remaining: {
              daily: 0,
              monthly: Math.max(0, PRO_MONTHLY_LIMIT - monthCount),
            },
          });
        }

        if (monthCount >= PRO_MONTHLY_LIMIT) {
          return res.status(429).json({
            error: "You've reached your monthly generation limit. Your limit resets next month.",
            limitReached: true,
            isPro: true,
            remaining: {
              daily: Math.max(0, PRO_DAILY_LIMIT - dayCount),
              monthly: 0,
            },
          });
        }
      }
    }

    // ── Build Claude prompt ──
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

    // ── Call Claude API ──
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
        messages: [{ role: "user", content: prompt }],
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
    const text  = claudeData.content.map((b) => b.text || "").join("");
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

    // ── Log this generation (don't block response on failure) ──
    if (sb && userId) {
      sb.from("generation_log")
        .insert({ user_id: userId })
        .then(({ error }) => { if (error) console.error("generation_log insert error:", error.message); })
        .catch((e) => console.error("generation_log insert threw:", e.message));
    }

    // ── Compute remaining counts (after this generation) ──
    let remaining = null;
    if (sb && userId) {
      if (!isPro) {
        remaining = { weekly: Math.max(0, FREE_WEEKLY_LIMIT - (weeklyCount + 1)) };
      } else {
        remaining = {
          daily:   Math.max(0, PRO_DAILY_LIMIT   - (dayCount   + 1)),
          monthly: Math.max(0, PRO_MONTHLY_LIMIT  - (monthCount + 1)),
        };
      }
    }

    return res.json({ abPlan, remaining });
  } catch (err) {
    console.error("Generate plan error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate meal plan" });
  }
}
