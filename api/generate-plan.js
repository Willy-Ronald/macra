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
import { calculateIngredientMacros, getNutrition } from '../src/utils/nutritionDatabase.js';
import { generateMealTemplate, allocateBudget } from '../src/utils/mealTemplateGenerator.js';

// ── Protein pools by budget tier ────────────────────────────────
// Plant proteins — breakfast and snack slots only, never lunch or dinner
const PLANT_PROTEIN_POOL = [
  { name: 'firm tofu',    unit: 'oz',  proteinPer28g:  2.3, costPerOz:  0.14 },
  { name: 'black beans',  unit: 'cup', proteinPerCup: 10.1, costPerCup: 0.18 },
  { name: 'lentils',      unit: 'cup', proteinPerCup: 17.9, costPerCup: 0.22 },
];

const PROTEIN_POOLS = {
  strict: [
    { name: 'chicken thighs', unit: 'oz',  proteinPer28g: 4.9, costPerOz: 0.156 },
    { name: 'ground turkey',  unit: 'oz',  proteinPer28g: 5.6, costPerOz: 0.312 },
    { name: 'canned tuna',    unit: 'oz',  proteinPer28g: 7.2, costPerOz: 0.20  },
    { name: 'eggs',           unit: 'each', proteinEach:  6.5, costEach:  0.15  },
  ],
  moderate: [
    { name: 'chicken thighs', unit: 'oz',  proteinPer28g: 4.9, costPerOz: 0.156 },
    { name: 'chicken breast',  unit: 'oz',  proteinPer28g: 6.6, costPerOz: 0.343 },
    { name: 'ground turkey',   unit: 'oz',  proteinPer28g: 5.6, costPerOz: 0.312 },
    { name: 'tilapia',         unit: 'oz',  proteinPer28g: 5.7, costPerOz: 0.313 },
    { name: 'canned tuna',     unit: 'oz',  proteinPer28g: 7.2, costPerOz: 0.20  },
    { name: 'eggs',            unit: 'each', proteinEach:  6.5, costEach:  0.15  },
    { name: 'deli turkey',     unit: 'oz',  proteinPer28g: 5.0, costPerOz: 0.443 },
  ],
  flexible: [
    { name: 'chicken breast',  unit: 'oz',  proteinPer28g: 6.6, costPerOz: 0.343 },
    { name: 'chicken thighs',  unit: 'oz',  proteinPer28g: 4.9, costPerOz: 0.156 },
    { name: 'ground beef',     unit: 'oz',  proteinPer28g: 5.7, costPerOz: 0.562 },
    { name: 'ground turkey',   unit: 'oz',  proteinPer28g: 5.6, costPerOz: 0.312 },
    { name: 'salmon',          unit: 'oz',  proteinPer28g: 5.8, costPerOz: 0.687 },
    { name: 'shrimp',          unit: 'oz',  proteinPer28g: 5.9, costPerOz: 0.583 },
    { name: 'tilapia',         unit: 'oz',  proteinPer28g: 5.7, costPerOz: 0.313 },
    { name: 'pork tenderloin', unit: 'oz',  proteinPer28g: 5.9, costPerOz: 0.249 },
    { name: 'pork chops',      unit: 'oz',  proteinPer28g: 5.5, costPerOz: 0.374 },
    { name: 'eggs',            unit: 'each', proteinEach:  6.5, costEach:  0.15  },
    { name: 'canned tuna',     unit: 'oz',  proteinPer28g: 7.2, costPerOz: 0.20  },
  ],
  premium: [
    { name: 'salmon',          unit: 'oz',   proteinPer28g:   5.8, costPerOz:    0.687 },
    { name: 'chicken breast',  unit: 'oz',   proteinPer28g:   6.6, costPerOz:    0.343 },
    { name: 'ground beef',     unit: 'oz',   proteinPer28g:   5.7, costPerOz:    0.562 },
    { name: 'beef sirloin',    unit: 'oz',   proteinPer28g:   6.0, costPerOz:    0.562 },
    { name: 'shrimp',          unit: 'oz',   proteinPer28g:   5.9, costPerOz:    0.583 },
    { name: 'pork tenderloin', unit: 'oz',   proteinPer28g:   5.9, costPerOz:    0.249 },
    { name: 'ground turkey',   unit: 'oz',   proteinPer28g:   5.6, costPerOz:    0.312 },
    { name: 'tilapia',         unit: 'oz',   proteinPer28g:   5.7, costPerOz:    0.313 },
    { name: 'turkey bacon',    unit: 'slice', proteinPerSlice: 3.96, costPerSlice: 0.40 },
    { name: 'eggs',            unit: 'each',  proteinEach:     6.5, costEach:     0.15  },
    { name: 'deli turkey',     unit: 'oz',   proteinPer28g:   5.0, costPerOz:    0.443 },
  ],
};

function selectProteinsForPlan(tier, macros, weeklyBudget) {
  const mainPool = PROTEIN_POOLS[tier] || PROTEIN_POOLS.moderate;

  // Number of distinct proteins for the whole plan (before diversity overflow)
  const numProteins = tier === 'flexible' ? 3 : tier === 'premium' ? 4 : 2;

  // Base slot distribution: cheapest protein (index 0) → highest-protein meal slots
  // N=2: [3,5], N=3: [3,3,2], N=4: [2,2,2,2]
  const slotRanges = { 2: [3,5], 3: [3,3,2], 4: [2,2,2,2] };
  const baseRanges = slotRanges[numProteins] || [3,5];

  // Per-protein slot caps — limits how many of the 8 slots a protein can cover
  // Overflow slots are absorbed by an additional protein pulled from the pool
  const SLOT_CAPS = { 'eggs': 2, 'canned tuna': 2 };

  const dailyProteinG = macros.proteinG;
  const proteinPerMeal = {
    breakfast: Math.round(dailyProteinG * 0.22),
    lunch:     Math.round(dailyProteinG * 0.28),
    snack:     Math.round(dailyProteinG * 0.14),
    dinner:    Math.round(dailyProteinG * 0.36),
  };

  // 8 slots sorted descending by protein target (fixed order — dinner highest, snack lowest)
  const mealSlots = [
    { meal: 'dayA_dinner',    target: proteinPerMeal.dinner    },
    { meal: 'dayB_dinner',    target: proteinPerMeal.dinner    },
    { meal: 'dayA_lunch',     target: proteinPerMeal.lunch     },
    { meal: 'dayB_lunch',     target: proteinPerMeal.lunch     },
    { meal: 'dayA_breakfast', target: proteinPerMeal.breakfast },
    { meal: 'dayB_breakfast', target: proteinPerMeal.breakfast },
    { meal: 'dayA_snack',     target: proteinPerMeal.snack     },
    { meal: 'dayB_snack',     target: proteinPerMeal.snack     },
  ];

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Actual cost per gram — used for budget calculations only
  const costPerGram = (p) => {
    if (p.unit === 'each')  return p.costEach  / p.proteinEach;
    if (p.unit === 'cup')   return p.costPerCup / p.proteinPerCup;
    if (p.unit === 'slice') return p.costPerSlice / p.proteinPerSlice;
    return p.costPerOz / p.proteinPer28g;
  };

  // Sort cost per gram — applies diversity penalties so eggs/tuna are de-prioritised in sort
  // This makes real meal proteins (chicken, turkey) preferred over eggs/tuna when costs are close
  const costPerGramForSort = (p) => {
    const raw = costPerGram(p);
    if (p.name === 'eggs') return raw * 1.5;
    if (p.name === 'canned tuna') return raw * 1.2;
    return raw;
  };

  // Pick N unique proteins at random, then sort cheapest→most expensive using sort cost
  const pickAndSort = (pool) =>
    shuffle(pool).slice(0, numProteins).sort((a, b) => costPerGramForSort(a) - costPerGramForSort(b));

  // Apply per-protein slot caps; if overflow slots remain, pull in a cheapest extra protein
  const applyCaps = (sel, baseSlots) => {
    let slots = [...baseSlots];
    let overflow = 0;
    for (let i = 0; i < sel.length; i++) {
      const cap = SLOT_CAPS[sel[i].name];
      if (cap !== undefined && slots[i] > cap) {
        overflow += slots[i] - cap;
        slots[i] = cap;
      }
    }
    let adjusted = [...sel];
    if (overflow > 0) {
      const names = new Set(sel.map(p => p.name));
      const extra = mainPool
        .filter(p => !names.has(p.name))
        .sort((a, b) => costPerGramForSort(a) - costPerGramForSort(b))[0];
      if (extra) {
        adjusted = [...sel, extra];
        slots = [...slots, overflow];
      }
    }
    return { adjustedSelected: adjusted, slotsPerProtein: slots };
  };

  // Build inventory totals — tracks total quantity, protein gap, and slot count per protein
  const buildTotals = (sel, slotsPerProtein) => {
    const totalsMap = {};
    let slotIdx = 0;
    for (let pi = 0; pi < sel.length; pi++) {
      const protein = sel[pi];
      for (let i = 0; i < slotsPerProtein[pi]; i++) {
        const { target } = mealSlots[slotIdx++];
        let quantity;
        let slotGap = 0;
        if (protein.unit === 'each') {
          const raw = Math.max(1, Math.round(target / protein.proteinEach));
          quantity = Math.min(raw, 4);
          slotGap = Math.max(0, target - quantity * protein.proteinEach);
        } else if (protein.unit === 'cup') {
          quantity = Math.max(0.5, Math.round((target / protein.proteinPerCup) * 2) / 2);
        } else {
          quantity = Math.max(2, Math.round(target / protein.proteinPer28g));
        }
        if (!totalsMap[protein.name]) totalsMap[protein.name] = { protein, total: 0, totalProteinGap: 0, slotCount: 0 };
        totalsMap[protein.name].total += quantity;
        totalsMap[protein.name].totalProteinGap += slotGap;
        totalsMap[protein.name].slotCount += 1;
      }
    }
    return totalsMap;
  };

  // Estimated total protein cost from a totalsMap (uses real costPerGram, not sort cost)
  const estimateCost = (totalsMap) =>
    Object.values(totalsMap).reduce((sum, { protein, total }) => {
      const unitCost = protein.unit === 'each'  ? protein.costEach  :
                       protein.unit === 'cup'   ? protein.costPerCup :
                       protein.unit === 'slice' ? protein.costPerSlice : protein.costPerOz;
      return sum + total * unitCost;
    }, 0);

  let selected = pickAndSort(mainPool);
  let { adjustedSelected, slotsPerProtein } = applyCaps(selected, baseRanges);
  let totalsMap = buildTotals(adjustedSelected, slotsPerProtein);

  // Budget cost-check for strict (60%) and moderate (55%) tiers
  const budgetCap = tier === 'strict' ? 0.60 : tier === 'moderate' ? 0.55 : null;
  if (budgetCap && weeklyBudget) {
    const proteinCost = estimateCost(totalsMap);
    if (proteinCost > weeklyBudget * budgetCap) {
      // Swap most expensive protein in adjusted selection for cheapest unselected in pool
      const mostExpensive = [...adjustedSelected].sort((a, b) => costPerGram(b) - costPerGram(a))[0];
      const selectedNames = new Set(adjustedSelected.map(p => p.name));
      const cheapestReplacement = mainPool
        .filter(p => !selectedNames.has(p.name))
        .sort((a, b) => costPerGram(a) - costPerGram(b))[0];
      if (cheapestReplacement) {
        const swapped = selected
          .map(p => p.name === mostExpensive.name ? cheapestReplacement : p)
          .sort((a, b) => costPerGramForSort(a) - costPerGramForSort(b));
        ({ adjustedSelected, slotsPerProtein } = applyCaps(swapped, baseRanges));
        totalsMap = buildTotals(adjustedSelected, slotsPerProtein);
      }
    }
  }

  // Return flat inventory array + estimated protein cost
  const estimatedProteinCost = estimateCost(totalsMap);
  const assignments = Object.values(totalsMap).map(({ protein, total, totalProteinGap, slotCount }) => {
    if (protein.unit === 'each') {
      const obj = { name: protein.name, totalCount: Math.round(total), unit: 'each', slotCount };
      if (totalProteinGap > 0) obj.proteinGap = Math.round(totalProteinGap);
      return obj;
    } else if (protein.unit === 'cup') {
      return { name: protein.name, totalQuantity: Math.round(total * 2) / 2, unit: 'cup' };
    } else {
      return { name: protein.name, totalQuantity: Math.round(total), unit: protein.unit };
    }
  });
  return { assignments, estimatedProteinCost };
}

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
- instructions: 5 to 8 steps total per meal, aim for 5 but use up to 8 if needed for clear instructions, each under 20 words, starting with an action verb
- instructions must include: specific heat level AND temperature in °F (e.g. "medium-high heat (375°F)"), pan/pot size (e.g. "large 12-inch skillet"), exact cook time in minutes, and a visual doneness cue (e.g. "until golden brown", "until internal temp reaches 165°F"). No vague steps like "cook until done".
- equipment: comma-separated string, max 3 items
- desc: max 8 words
- Return ONLY raw JSON starting with { and ending with } — no markdown, no explanation
- MEAL PREP MODE — FIXED INGREDIENT TEMPLATES: When the user message contains a MEAL TEMPLATES section, you are operating in Meal Prep Mode. In this mode your ONLY job is to write creative meal names, one-sentence descriptions, and cooking instructions for each meal slot. The ingredients, quantities, and units are ALREADY CALCULATED and FIXED by our nutrition engine. You MUST use the exact ingredients listed — do not add any ingredients except spices and seasonings. Do not change any quantities. Do not substitute any ingredients. The macro numbers shown in the template are already verified — do not try to hit different macro targets. Your creativity applies ONLY to the meal name, description, cuisine style, and cooking method. Treat this exactly like a recipe writing task where someone hands you a fixed ingredient list and asks you to make it sound delicious.
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
  const continuation = data.content.map(b => b.text || "").join("");
  return { rawText: "{" + continuation, usage };
}

// ── Parse and validate a Claude response ───────────────────────
function parsePlan(rawText) {
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
    // ── Rate limiting ───────────────────────────────────────────
    let lifetimeCount = 0, weeklyCount = 0, dayCount = 0, monthCount = 0;
    let remaining = null;

    if (isDevAccount) {
      // Dev accounts bypass all rate limits entirely
      remaining = { phase: "dev", daily: 999, monthly: 999 };
    } else if (!isPro) {
      // Phase 1 — Intro: first FREE_INTRO_LIMIT lifetime gens, no time restriction
      lifetimeCount = await countLogs(sb, userId, "1970-01-01T00:00:00Z", "lifetime");

      if (lifetimeCount < FREE_INTRO_LIMIT) {
        remaining = { phase: "intro", introRemaining: Math.max(0, FREE_INTRO_LIMIT - lifetimeCount - 1) };
      } else {
        // Phase 2 — Ongoing: 1 per rolling 7-day window
        weeklyCount = await countLogs(sb, userId, sevenDaysAgo(), "7-day");

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

        remaining = { phase: "weekly", resetDays: 7 };
      }
    } else {
      // Pro: 2 per rolling 24h, 30 per calendar month
      [dayCount, monthCount] = await Promise.all([
        countLogs(sb, userId, rollingDayStart(), "pro-daily"),
        countLogs(sb, userId, startOfMonth(),    "pro-monthly"),
      ]);

      if (dayCount >= PRO_DAILY_LIMIT) {
        return res.status(429).json({ error: "Daily limit reached. Resets tomorrow at midnight.", limitReached: true, isPro: true, remaining: { phase: "pro", daily: 0, monthly: Math.max(0, PRO_MONTHLY_LIMIT - monthCount) } });
      }
      if (monthCount >= PRO_MONTHLY_LIMIT) {
        return res.status(429).json({ error: "Monthly limit reached. Resets on the 1st of next month.", limitReached: true, isPro: true, remaining: { phase: "pro", daily: Math.max(0, PRO_DAILY_LIMIT - dayCount), monthly: 0 } });
      }

      remaining = { phase: "pro", daily: Math.max(0, PRO_DAILY_LIMIT - dayCount - 1), monthly: Math.max(0, PRO_MONTHLY_LIMIT - monthCount - 1) };
    }

    // ── Model selection ─────────────────────────────────────────
    // NOTE: Haiku tiering temporarily disabled — Haiku does not reliably hit
    // numerical macro targets (30-50g protein deficits observed in QA).
    // Force Sonnet for all generations until Haiku accuracy is verified.
    const complexityScore = getComplexityScore(profile);
    const model = MODEL_SONNET;

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
        budgetLine = `=== MODERATE BUDGET MODE ($60-$90) ===
Your job is to hit the user's macro targets (${macros.proteinG}g protein, ${macros.carbG}g carbs, ${macros.fatG}g fat per day) while keeping total weekly grocery cost at or under $${weeklyBudget}.

STEP 1 — PROTEIN SOURCES (choose from this list):
  Budget proteins (use most meals): eggs ($2.50/doz), canned tuna ($1.50/can), canned beans ($1.00/can), chicken thighs ($1.50/lb), ground turkey ($3.50/lb)
  Mid-range proteins (1-2 meals/week max): chicken breast ($2.50/lb), ground beef 80/20 ($4.00/lb), pork chops ($3.00/lb)
  Occasional proteins (1 meal/week max): salmon ($6.00/lb), shrimp ($7.00/lb)
  AVOID: steak, lamb, anything over $8/lb

STEP 2 — PRODUCE & CARBS:
  Produce: mix fresh staples (onion, garlic, cabbage, carrot) with frozen veg (broccoli $1.49/bag, green beans $0.88/bag, mixed veg $1.29/bag). Seasonal fruit only (apple, banana, orange). Limit avocado to 1 meal max. Frozen berries preferred over fresh.
  Carbs: rice, pasta, potatoes, oats as primary starches. Bread/tortillas allowed.

STEP 3 — COST VERIFICATION:
Before returning the plan, estimate total grocery cost:
  • List each unique ingredient with estimated package cost
  • Sum all costs
  • Confirm total ≤ $${weeklyBudget}
  • If over budget, swap expensive proteins or produce for cheaper alternatives

STEP 4 — OUTPUT
Return the meal plan JSON only after confirming budget compliance.`;
      } else if (weeklyBudget < 150) {
        budgetLine = `=== FLEXIBLE BUDGET MODE ($90-$149) ===
Your job is to hit the user's macro targets (${macros.proteinG}g protein, ${macros.carbG}g carbs, ${macros.fatG}g fat per day) while keeping total weekly grocery cost near $${weeklyBudget}.

STEP 1 — PROTEIN SOURCES:
  All proteins allowed. Vary sources across the week for nutritional diversity.
  Suggested: chicken breast, salmon, ground beef, shrimp, eggs, Greek yogurt, cottage cheese.
  Premium options OK (steak, lamb, sushi-grade fish) but use sparingly — 1 meal max per week.

STEP 2 — PRODUCE & CARBS:
  Fresh produce encouraged. Variety of vegetables and fruits.
  Still avoid unnecessary waste — no exotic specialty items that spike cost without nutritional benefit.
  Carbs: rice, pasta, potatoes, quinoa, whole grains all allowed.

STEP 3 — COST VERIFICATION:
Before returning the plan, estimate total grocery cost:
  • List each unique ingredient with estimated package cost
  • Sum all costs
  • Confirm total is near $${weeklyBudget} (within 15%)
  • If significantly over, swap the priciest items for comparable alternatives

STEP 4 — OUTPUT
Return the meal plan JSON only after confirming budget compliance.`;
      } else {
        budgetLine = `=== PREMIUM BUDGET MODE ($150+) ===

🌟 CULINARY EXCELLENCE WITHIN BUDGET 🌟

You MUST generate a plan that costs within 110% of the weekly budget ($${weeklyBudget}).

Budget target: $${weeklyBudget} (max $${Math.ceil(weeklyBudget * 1.1)})

CORE PRINCIPLE:
Hit macro targets (${macros.proteinG}g protein, ${macros.carbG}g carbs, ${macros.fatG}g fat per day) using PREMIUM INGREDIENTS while staying within budget.

With a $${weeklyBudget} budget, you have the financial flexibility to prioritize QUALITY and VARIETY over cost savings.

---

STEP 1: PREMIUM INGREDIENT PHILOSOPHY

You have a HIGH BUDGET. This changes your priorities:

PROTEINS (choose BEST, not cheapest):
- Fresh salmon: $10.99/lb — USE FREELY for omega-3s and flavor
- Fresh shrimp: $6.99/12oz — excellent for variety
- Grass-fed beef: $7.99/lb — superior to regular beef
- Pork tenderloin: $3.99/lb — lean and delicious
- Organic chicken: $4.99/lb — better than regular chicken
- Lamb: available for Mediterranean/Middle Eastern cuisine
- Eggs, tofu, beans: still great, use for variety

PRODUCE (choose FRESH over FROZEN):
- Fresh vegetables: asparagus, bell peppers, zucchini, cherry tomatoes, arugula
- Fresh fruits: berries, avocados, fresh herbs
- Fresh herbs: basil, cilantro, mint, parsley, dill (use freely)
- Specialty produce: heirloom tomatoes, fresh ginger, fresh garlic

GRAINS & SPECIALTY:
- Quinoa, farro, wild rice (nutritionally superior)
- Whole grain artisan bread
- Fresh pasta if desired

FATS & FLAVOR:
- Extra virgin olive oil (use as primary fat)
- Avocado oil
- Nuts and seeds (almonds, walnuts, pine nuts for salads/toppings)
- Specialty cheeses (feta, goat cheese, parmesan, gruyere)

INTERNATIONAL INGREDIENTS:
- Tahini, hummus (for Mediterranean)
- Coconut milk (for Thai/Indian)
- Miso paste (for Japanese)
- Fresh lime, lemon (not bottled juice)

---

STEP 2: WHAT THIS BUDGET ALLOWS

At $${weeklyBudget}/week, you can:
✓ Use fresh salmon 2-3 times per week
✓ Include grass-fed beef or lamb
✓ Buy fresh herbs instead of dried
✓ Use premium cheeses
✓ Include nuts and seeds as ingredients
✓ Choose fresh vegetables over frozen
✓ Create 8-10 different cuisine styles
✓ Focus on restaurant-quality flavor

You are NOT constrained by cost per meal — you're constrained by TOTAL weekly budget.

---

STEP 3: STILL AVAILABLE AT KROGER

Important: ALL ingredients must be available at a standard American grocery store (Kroger, Safeway, Whole Foods).

DO NOT suggest:
❌ Truffle oil, caviar, wagyu beef (too specialty)
❌ Obscure international ingredients not at Kroger
❌ Fresh lobster, king crab (too expensive even for premium)
❌ Ingredients requiring specialty shops

KEEP IT: Premium but accessible.

---

STEP 4: APPROACH FOR PREMIUM BUDGETS

PROTEIN STRATEGY:
- Rotate between salmon, shrimp, grass-fed beef, pork, chicken
- Use premium proteins 5-6 days/week
- Quality over quantity

CUISINE VARIETY:
- 8-10 different cuisine styles across the week
- Mediterranean, Thai, Japanese, Indian, Mexican, Italian, French, etc.
- Each meal should be INTERESTING

FLAVOR FOCUS:
- Use fresh herbs generously
- Include nuts/seeds for texture
- Use premium oils (olive, avocado)
- Create complex flavor profiles
- Focus on presentation-worthy meals

COST MANAGEMENT (STILL REQUIRED):
- You MUST stay within $${Math.ceil(weeklyBudget * 1.1)}
- Track premium items: salmon ($22), grass-fed beef ($15), specialty cheese ($5), etc.
- Balance premium proteins with affordable sides (rice, beans, vegetables)
- Don't use EVERY expensive ingredient in EVERY meal

---

STEP 5: VERIFICATION (MANDATORY)

Before returning your plan, estimate total cost:

Proteins (salmon, beef, chicken, etc.): $___
Produce (fresh vegetables, herbs, fruits): $___
Grains & specialty items: $___
Oils, nuts, cheese: $___

ESTIMATED TOTAL COST: $___

Must be ≤ $${Math.ceil(weeklyBudget * 1.1)}

IF OVER BUDGET:
- Still prioritize quality, but reduce quantities
- Use salmon 2x instead of 3x
- Mix premium and standard proteins
- Reduce specialty cheese usage

TARGET: Within 110% of $${weeklyBudget}

---

Return meal plan JSON that delivers culinary excellence within budget.`;
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
    const buildDynamicContent = (retryPrefix = "", proteinAssignments = null, budgetForPrompt = null, estimatedProteinCostForPrompt = null, mealTemplates = null) => {
      const parts = [];

      if (retryPrefix) parts.push(retryPrefix);

      // Budget goes FIRST — highest priority so Claude never forgets it
      if (budgetLine) parts.push(budgetLine);

      parts.push(`Cuisine per slot:\n${cuisineAssignmentLines}`);

      const ingredientConstraints = `APPROVED INGREDIENTS — CRITICAL RULE: You may ONLY use ingredients from the approved list below. Do not generate any ingredient not on this list under any circumstances. Using unlisted ingredients breaks the grocery cost estimator and will cause the plan to fail. If a cuisine style calls for an ingredient not on this list, substitute with the closest approved alternative. Never use any ingredient from the PROHIBITED list regardless of cuisine style or budget tier.

PROTEINS — subject to budget tier restrictions above: eggs, egg whites, chicken thighs, boneless chicken thighs, chicken breast, boneless skinless chicken breast, ground turkey, lean ground turkey, ground beef, lean ground beef, salmon fillet, fresh salmon, frozen salmon, shrimp, cooked shrimp, raw shrimp, canned tuna, tuna in water, tilapia, cod, pork tenderloin, pork chops, boneless pork chops, pork shoulder, bacon, turkey bacon, breakfast sausage, deli turkey, firm tofu, extra firm tofu, silken tofu.

BEANS AND LEGUMES: black beans, canned black beans, pinto beans, kidney beans, chickpeas, cannellini beans, great northern beans, lentils, red lentils, canned lentils, refried beans, edamame, frozen edamame.

DAIRY: milk, whole milk, 2% milk, skim milk, butter, salted butter, unsalted butter, heavy cream, heavy whipping cream, sour cream, cream cheese, cottage cheese, greek yogurt, plain greek yogurt, yogurt, shredded cheddar, cheddar cheese, shredded mozzarella, mozzarella cheese, parmesan cheese, grated parmesan, colby jack cheese, feta cheese, ricotta cheese, almond milk, unsweetened almond milk, oat milk, lactose free milk.

PRODUCE VEGETABLES: onion, yellow onion, red onion, sweet onion, green onions, scallions, bell pepper, green bell pepper, red bell pepper, tomato, roma tomato, cherry tomatoes, lettuce, iceberg lettuce, romaine, spinach, baby spinach, kale, avocado, broccoli, broccoli crown, frozen broccoli, cauliflower, cucumber, zucchini, celery, cilantro, mushrooms, asparagus, green beans, frozen green beans, carrots, baby carrots, shredded carrots, jalapeno, cabbage, green cabbage, shredded cabbage, bok choy, potato, russet potato, sweet potato, garlic, corn, frozen corn, frozen peas, frozen mixed vegetables, frozen peas and carrots, frozen peppers and onions, salad mix.

PRODUCE FRUITS: banana, apple, gala apple, orange, lemon, lime, mango, pineapple, strawberries, blueberries, blackberries, raspberries, grapes, red grapes, green grapes.

GRAINS: white rice, brown rice, jasmine rice, basmati rice, instant rice, pasta, spaghetti, penne, penne pasta, cavatappi, noodles, egg noodles, rice noodles, rice paper, rice paper wrappers, bread, white bread, wheat bread, whole wheat bread, tortillas, flour tortillas, oats, rolled oats, quick oats, quinoa, pita, pita bread.

PANTRY OILS: olive oil, extra virgin olive oil, vegetable oil, canola oil, sesame oil, coconut oil.

PANTRY SAUCES AND CONDIMENTS: soy sauce, low sodium soy sauce, fish sauce, oyster sauce, hoisin sauce, sriracha, hot sauce, worcestershire sauce, dijon mustard, mustard, ketchup, bbq sauce, salsa, marinara sauce, pasta sauce, mayonnaise, peanut butter, almond butter, tahini, miso paste, coconut milk, rice vinegar, red wine vinegar, apple cider vinegar, balsamic vinegar.

PANTRY CANNED AND PACKAGED: chicken broth, beef broth, vegetable broth, diced tomatoes, canned diced tomatoes, crushed tomatoes, tomato sauce, tomato paste, sauerkraut, kimchi, coleslaw mix, breadcrumbs, panko breadcrumbs, peanuts, almonds, sliced almonds, cashews, walnuts, sesame seeds.

PANTRY BAKING AND SWEETENERS: honey, maple syrup, sugar, brown sugar, vanilla extract, flour, all purpose flour, baking powder, baking soda, cornstarch.

FRESH HERBS — maximum 1 per plan, use sparingly as garnish only, never as a primary ingredient: cilantro, parsley, basil, dill, mint, rosemary, thyme.

SPICES — use freely, all are zero cost pantry items: salt, black pepper, garlic powder, onion powder, paprika, smoked paprika, chili powder, cumin, oregano, dried basil, dried thyme, dried rosemary, ground cinnamon, cinnamon, cayenne pepper, red pepper flakes, italian seasoning, bay leaves, dried parsley, ground ginger, turmeric, curry powder, garam masala, coriander, ground coriander, nutmeg, allspice, lemon juice, lime juice, cooking spray, jerk seasoning, cajun seasoning, five spice powder, berbere spice.

PERMANENTLY PROHIBITED — never generate under any circumstances: sake, galangal, makrut lime, sumac, preserved lemon, lemongrass stalks, pomegranate molasses, doubanjiang, dashi, collagen powder, fermented black beans, dried shrimp, cassava flour, jackfruit, cassava, breadfruit, durian, rambutan, dragonfruit, starfruit, persimmon, quince, gooseberry, pita chips, psyllium husk, nutritional yeast, glutinous rice, sticky rice, sushi rice, matzo, lavash, bone broth, cacao powder, carob, white chocolate, lemongrass paste, lemongrass, lemongrass stalks, tamarind paste, shrimp paste, bonito flakes, oat flour, almond flour, coconut flour, arrowroot, protein powder, whey, matcha, taro, yuca, fig, date, pomegranate, papaya, lychee, guava, passion fruit, elderberry, mulberry, stone ground grits, freekeh, bulgur wheat, wheat berries, spelt, teff, amaranth, millet, sorghum, orzo, couscous, fregola, gnocchi, pierogi, gyoza wrappers, wonton wrappers, spring roll wrappers, rice flour, bagels, croissants, brioche, sourdough, baguette, naan, chapati, roti, injera, english muffins, whole grain crackers, crackers, granola, muesli, cereal, manchego cheese, gruyere, brie, camembert, gouda, havarti, provolone, swiss cheese, pepper jack, blue cheese, gorgonzola, stilton, halloumi, burrata, buffalo mozzarella, queso fresco, queso blanco, paneer, labneh, goat cheese, mascarpone, creme fraiche, kefir, buttermilk, evaporated milk, condensed milk, powdered milk, coconut cream, coconut water, coconut flakes, shredded coconut, coconut butter, chocolate chips, dark chocolate, vanilla bean, black bean sauce, harissa, za atar.`;
      parts.push(ingredientConstraints);

      if (mealTemplates) {
        try {
          const dayLabels = { dayA: 'A', dayB: 'B' };
          const mealOrder = ['breakfast', 'lunch', 'snack', 'dinner'];
          const templateLines = ['MEAL TEMPLATES — MANDATORY: Use exactly these ingredients at the specified quantities for each meal slot. Write creative dish names, descriptions, and instructions around these fixed ingredients.'];
          for (const [dayKey, dayLabel] of Object.entries(dayLabels)) {
            const day = mealTemplates[dayKey];
            if (!day) continue;
            for (const mealType of mealOrder) {
              const meal = day[mealType];
              if (!meal) continue;
              templateLines.push(`\nDAY ${dayLabel} ${mealType.toUpperCase()}:`);
              if (meal.protein) {
                templateLines.push(`Protein: ${meal.protein.quantity} ${meal.protein.unit} ${meal.protein.name}`);
              }
              if (meal.carbs) {
                templateLines.push(`Carbs: ${meal.carbs.quantity} ${meal.carbs.unit} ${meal.carbs.name}`);
              }
              if (meal.fat) {
                templateLines.push(`Fat: ${meal.fat.quantity} ${meal.fat.unit} ${meal.fat.name}`);
              }
              if (meal.vegetables && meal.vegetables.length > 0) {
                for (const veg of meal.vegetables) {
                  templateLines.push(`Vegetable: ${veg.quantity} ${veg.unit} ${veg.name}`);
                }
              }
              if (meal.totalMacros) {
                templateLines.push(`Target macros: ${Math.round(meal.totalMacros.calories)} cal, ${meal.totalMacros.protein.toFixed(1)}g protein, ${meal.totalMacros.carbs.toFixed(1)}g carbs, ${meal.totalMacros.fat.toFixed(1)}g fat`);
              }
              templateLines.push(`Cuisine style: [Claude picks based on user preferences and variety]`);
            }
          }
          if (budgetForPrompt != null && estimatedProteinCostForPrompt != null) {
            templateLines.push(`\nWEEKLY GROCERY BUDGET: $${budgetForPrompt}\nEstimated protein cost: $${estimatedProteinCostForPrompt.toFixed(2)}. Remaining budget for all other ingredients: $${(budgetForPrompt - estimatedProteinCostForPrompt).toFixed(2)}. Keep all non-protein ingredients affordable and within this remaining budget. Use simple staple ingredients only — no premium items.`);
          }
          const templateSpec = templateLines.join('\n');
          parts.push(templateSpec);
        } catch (e) {
          // template spec build failed — continue without template injection
        }
      } else if (proteinAssignments && proteinAssignments.length > 0) {
        const lines = proteinAssignments.map(item => {
          if (item.unit === 'each') {
            let line = `${item.totalCount} eggs`;
            if (item.proteinGap && item.proteinGap > 0) {
              line += ` (Note: egg cap applied across ${item.slotCount} meal slots totaling ${item.proteinGap}g protein gap — supplement egg meals with cottage cheese or Greek yogurt as needed to reach macro targets.)`;
            }
            return line;
          } else {
            return `${item.totalQuantity} ${item.unit} ${item.name}`;
          }
        }).join('\n');
        let proteinSpec = 'PROTEIN SHOPPING LIST — MANDATORY: The following proteins have been pre-purchased for this plan. You must use ALL of them across the 8 meals (4 meals Day A, 4 meals Day B). Do not add any additional proteins beyond this list. Do not use less than what is listed — all quantities must be used. Distribute them across meals in a way that makes nutritional and culinary sense. Each meal must contain at least one protein from this list.\n\n' + lines;
        if (budgetForPrompt != null && estimatedProteinCostForPrompt != null) {
          proteinSpec += `\n\nWEEKLY GROCERY BUDGET: $${budgetForPrompt}\nEstimated protein cost: $${estimatedProteinCostForPrompt.toFixed(2)}. Remaining budget for all other ingredients: $${(budgetForPrompt - estimatedProteinCostForPrompt).toFixed(2)}. Keep all non-protein ingredients affordable and within this remaining budget. Use simple staple ingredients only — no premium items.`;
        }
        parts.push(proteinSpec);
      }

      parts.push(mealTemplates
        ? `Generate an A/B day meal plan using the MEAL TEMPLATES above. Your job is recipe writing only — name each meal creatively, write an appetizing description under 10 words, and write 5 to 8 clear cooking steps. The ingredients are fixed.`
        : `Generate an A/B day meal plan. Goal: ${goal}.`);

      // Dietary constraints — second highest priority
      if (hardConstraints) {
        parts.push(hardConstraints);
      }

      // Macros — only inject daily targets when not in template mode
      if (!mealTemplates) {
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
      } else {
        parts.push('Daily macro targets are already embedded in each meal template above. Use those per-meal targets as your reference.');
      }

      parts.push(complexityLine);

      const content = parts.join("\n\n");
      return content;
    };

    // ── First Claude call ────────────────────────────────────────
    let totalUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    let finalUsage = null;

    const budgetTier = weeklyBudget < 60 ? 'strict' : weeklyBudget < 90 ? 'moderate' : weeklyBudget < 150 ? 'flexible' : 'premium';
    const { assignments: proteinAssignments, estimatedProteinCost } = selectProteinsForPlan(budgetTier, macros, weeklyBudget);
    const mealTemplates = generateMealTemplate({ weeklyBudget, macros, budgetTier, dietaryRestrictions: dietList, pickinessLevel: pickinessLevel, days: 2, mealsPerDay: 4 });

    const firstResult = await callClaude(apiKey, model, buildDynamicContent('', null, weeklyBudget, estimatedProteinCost, mealTemplates), { useCache: true });

    if (firstResult.error) {
      console.error("CLAUDE API ERROR:", firstResult.error);
      return res.status(firstResult.status || 500).json({ error: firstResult.error });
    }

    totalUsage = mergeUsage(totalUsage, firstResult.usage || {});
    finalUsage = firstResult.usage || null;

    const firstParsed = parsePlan(firstResult.rawText);

    // Truncation on first attempt → retry with conciseness constraint
    if (firstParsed.truncated) {
      console.warn("[truncation] First response cut off — retrying with conciseness cap");
      const truncRetryContent =
        "Your previous response was cut off. Provide the complete plan with all 8 meals. " +
        "Keep instructions to exactly 5 steps per meal, each under 12 words.\n\n" +
        buildDynamicContent('', null, weeklyBudget, estimatedProteinCost, mealTemplates);

      const truncRetry = await callClaude(apiKey, model, truncRetryContent, { useCache: true });
      totalUsage = mergeUsage(totalUsage, truncRetry.usage || {});
      if (truncRetry.usage) finalUsage = truncRetry.usage;

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

      const retryResult = await callClaude(apiKey, MODEL_SONNET, buildDynamicContent(retryPrefix, null, weeklyBudget, estimatedProteinCost, mealTemplates), { useCache: true });
      totalUsage = mergeUsage(totalUsage, retryResult.usage || {});
      if (retryResult.usage) finalUsage = retryResult.usage;

      if (!retryResult.error) {
        const retryParsed = parsePlan(retryResult.rawText);
        if (!retryParsed.error && retryParsed.abPlan) {
          const retryA = validateMacros(retryParsed.abPlan.A, macros, "Day A (retry)");
          const retryB = validateMacros(retryParsed.abPlan.B, macros, "Day B (retry)");
          if (!retryA.failed && !retryB.failed) {
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

    // ── Log this generation ──────────────────────────────────────
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
    }

    // ── Layer 3: Nutrition verification against local database ───
    function verifyMealMacrosWithDatabase(meal) {
      if (!meal || !meal.ingredients) return { verified: false, reason: 'no ingredients' };
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;
      let totalCalories = 0;
      let matchedCount = 0;
      for (const ingredient of meal.ingredients) {
        if (!ingredient.name || !ingredient.quantity || !ingredient.unit) continue;
        const result = calculateIngredientMacros(ingredient.name, parseFloat(ingredient.quantity), ingredient.unit);
        if (result) {
          totalProtein  += result.protein;
          totalCarbs    += result.carbs;
          totalFat      += result.fat;
          totalCalories += result.calories;
          matchedCount++;
        }
      }
      if (matchedCount < 2) return { verified: false, reason: 'insufficient matches' };
      return {
        verified: true,
        calculatedProtein:  Math.round(totalProtein),
        calculatedCarbs:    Math.round(totalCarbs),
        calculatedFat:      Math.round(totalFat),
        calculatedCalories: Math.round(totalCalories),
        matchedIngredients: matchedCount,
      };
    }

    for (const day of ['A', 'B']) {
      for (const mealType of ['breakfast', 'lunch', 'snack', 'dinner']) {
        const meal = abPlan[day]?.[mealType];
        if (!meal) continue;
        const verification = verifyMealMacrosWithDatabase(meal);
        meal.nutritionVerification = verification;
      }
    }

    // TODO V1.5: Validate estimated cost here and retry if >150% of budget
    return res.json({ abPlan, remaining, debug: { templateInjected: mealTemplates !== null, templateProjectedCost: mealTemplates?.weeklyProjectedCost, templateDayAProteins: ['breakfast','lunch','snack','dinner'].map(mt => mt + ':' + (mealTemplates?.dayA?.[mt]?.protein?.name ?? 'null')), dayAKeys: mealTemplates?.dayA ? Object.keys(mealTemplates.dayA) : null, inputTokens: finalUsage?.input_tokens || 0, outputTokens: finalUsage?.output_tokens || 0, estimatedCostUSD: finalUsage ? Math.round(((finalUsage.input_tokens * 0.000003) + (finalUsage.output_tokens * 0.000015)) * 10000) / 10000 : null, modelUsed: model } });
  } catch (err) {
    console.error("Generate plan error:", err);
    return res.status(500).json({ error: err.message || "Failed to generate meal plan" });
  }
}
