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

    const prompt = `Generate an A/B day meal plan that matches these daily macro targets:
- Calories: ${macros.target} (within 3%)
- Protein: ${macros.proteinG}g (within 3%)
- Carbs: ${macros.carbG}g (within 3%)
- Fat: ${macros.fatG}g (within 3%)
- Dietary preferences: ${diet}
- Goal: ${goal}

Rules:
- Day A and Day B must have completely different meals
- Each day has exactly 4 meals: BREAKFAST, LUNCH, SNACK, DINNER
- Use varied cuisines and realistic grocery store ingredients
- Each meal needs an ingredients array

Return ONLY valid JSON. No markdown, no code blocks, no backticks, no explanation. Just the raw JSON object starting with { and ending with }.

The JSON must follow this exact structure:
{
  "A": [
    {"type":"BREAKFAST","name":"Meal name","desc":"Short ingredient list","cal":400,"p":30,"c":45,"f":12,"time":"10 min","ingredients":[{"name":"ingredient name","qty":"1","unit":"cup"}]},
    {"type":"LUNCH","name":"Meal name","desc":"Short ingredient list","cal":600,"p":50,"c":55,"f":18,"time":"20 min","ingredients":[{"name":"ingredient name","qty":"6","unit":"oz"}]},
    {"type":"SNACK","name":"Meal name","desc":"Short ingredient list","cal":300,"p":25,"c":20,"f":10,"time":"5 min","ingredients":[{"name":"ingredient name","qty":"1","unit":"serving"}]},
    {"type":"DINNER","name":"Meal name","desc":"Short ingredient list","cal":700,"p":55,"c":50,"f":22,"time":"30 min","ingredients":[{"name":"ingredient name","qty":"8","unit":"oz"}]}
  ],
  "B": [
    {"type":"BREAKFAST","name":"Different meal","desc":"Short ingredient list","cal":400,"p":30,"c":45,"f":12,"time":"10 min","ingredients":[{"name":"ingredient name","qty":"2","unit":"piece"}]},
    {"type":"LUNCH","name":"Different meal","desc":"Short ingredient list","cal":600,"p":50,"c":55,"f":18,"time":"20 min","ingredients":[{"name":"ingredient name","qty":"0.5","unit":"cup"}]},
    {"type":"SNACK","name":"Different meal","desc":"Short ingredient list","cal":300,"p":25,"c":20,"f":10,"time":"5 min","ingredients":[{"name":"ingredient name","qty":"1","unit":"oz"}]},
    {"type":"DINNER","name":"Different meal","desc":"Short ingredient list","cal":700,"p":55,"c":50,"f":22,"time":"30 min","ingredients":[{"name":"ingredient name","qty":"1","unit":"lbs"}]}
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
