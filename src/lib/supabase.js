/**
 * Macra — Supabase Client
 * 
 * Handles authentication and database operations.
 * 
 * Setup:
 * 1. Create Supabase project at supabase.com
 * 2. Run the SQL from README.md to create tables
 * 3. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Explicit auth options ensure session persists in localStorage across PWA launches.
// iOS Safari PWA runs in an isolated WKWebView — without these, the session can be
// lost between launches because the default storage detection may not pick up localStorage.
export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        autoRefreshToken: true,
        detectSessionInUrl: false, // PWA never has auth tokens in the URL
      },
    })
  : null;

// ── AUTH ────────────────────────────────────────────────────────

export async function signUp(email, password) {
  if (!supabase) return { error: "Supabase not configured" };
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error };
}

export async function signIn(email, password) {
  if (!supabase) return { error: "Supabase not configured" };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── PROFILE ────────────────────────────────────────────────────

export async function saveProfile(userId, profile) {
  if (!supabase) return;
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    name: profile.name,
    sex: profile.sex,
    age: profile.age,
    weight_lbs: profile.weightLbs,
    height_ft: profile.heightFt,
    height_in: profile.heightIn,
    activity: profile.activity,
    goal: profile.goal,
    diet: profile.diet,
    target_calories: profile.macros?.target,
    target_protein: profile.macros?.proteinG,
    target_carbs: profile.macros?.carbG,
    target_fat: profile.macros?.fatG,
    disliked_foods: profile.dislikedFoods || [],
    disliked_cuisines: profile.dislikedCuisines || [],
    updated_at: new Date().toISOString(),
  });
  return { error };
}

export async function saveProStatus(userId, isPro) {
  if (!supabase) return;
  const { error } = await supabase
    .from("profiles")
    .update({ is_pro: isPro, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) {
    console.error("[saveProStatus] failed", { code: error.code, message: error.message, hint: error.hint });
  } else {
    console.log("[saveProStatus] saved", { userId, isPro });
  }
  return { error };
}

export async function getProfile(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle(); // .single() returns 406 when no row exists (new user in onboarding)
  return { data, error };
}

// ── SAVED MEALS ────────────────────────────────────────────────

export async function saveMeal(userId, meal) {
  if (!supabase) return;
  const { error } = await supabase.from("saved_meals").insert({
    user_id: userId,
    name: meal.name,
    ingredients: meal.ingredients,
    total_calories: meal.totals.cal,
    total_protein: meal.totals.p,
    total_carbs: meal.totals.c,
    total_fat: meal.totals.f,
    source: 'custom',
  });
  return { error };
}

// Heart a meal (ai_plan or manual source) — returns the new row for optimistic state update
export async function heartMeal(userId, meal, source) {
  if (!supabase) return { data: null };
  const { data, error } = await supabase.from("saved_meals").insert({
    user_id: userId,
    name: meal.name,
    ingredients: meal.ingredients || [],
    total_calories: meal.cal ?? meal.totals?.cal ?? 0,
    total_protein: meal.p  ?? meal.totals?.p  ?? 0,
    total_carbs:   meal.c  ?? meal.totals?.c  ?? 0,
    total_fat:     meal.f  ?? meal.totals?.f  ?? 0,
    source,
  }).select().maybeSingle();
  if (error) console.error("[heartMeal] failed", { code: error.code, message: error.message });
  return { data, error };
}

export async function deleteSavedMeal(id) {
  if (!supabase) return;
  const { error } = await supabase.from("saved_meals").delete().eq("id", id);
  if (error) console.error("[deleteSavedMeal] failed", { code: error.code, message: error.message });
  return { error };
}

export async function getSavedMeals(userId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("saved_meals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data || [];
}

// ── MEAL LOG ───────────────────────────────────────────────────

export async function logMeal(userId, meal, dateStr = null) {
  if (!supabase) return;
  const row = {
    user_id: userId,
    meal_type: meal.type?.toLowerCase(),
    name: meal.name,
    calories: meal.cal,
    protein: meal.p,
    carbs: meal.c,
    fat: meal.f,
  };
  if (dateStr) row.date = dateStr;
  const { error } = await supabase.from("meal_log").insert(row);
  return { error };
}

export async function getTodayLog(userId) {
  if (!supabase) return [];
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("meal_log")
    .select("*")
    .eq("user_id", userId)
    .eq("date", today)
    .order("logged_at", { ascending: true });
  return data || [];
}

export async function getLogByDate(userId, dateStr) {
  if (!supabase) return [];
  const { data } = await supabase
    .from("meal_log")
    .select("*")
    .eq("user_id", userId)
    .eq("date", dateStr)
    .order("logged_at", { ascending: true });
  return data || [];
}

export async function deleteMealLog(logId) {
  if (!supabase) return;
  const { error } = await supabase.from("meal_log").delete().eq("id", logId);
  return { error };
}

// ── MEAL PLANS ─────────────────────────────────────────────────

export async function saveMealPlan(userId, dayOfWeek, meals) {
  if (!supabase) return;

  const row = {
    user_id: userId,
    day_of_week: dayOfWeek,
    meals: meals,
    generated_at: new Date().toISOString(),
  };
  console.log("[saveMealPlan] saving row", { userId, dayOfWeek, mealCount: meals?.length, generated_at: row.generated_at });

  // DELETE first (no unique constraint needed), then INSERT fresh
  const { error: delErr } = await supabase
    .from("meal_plans")
    .delete()
    .eq("user_id", userId)
    .eq("day_of_week", dayOfWeek);

  if (delErr) {
    console.error("[saveMealPlan] DELETE failed", { code: delErr.code, message: delErr.message, hint: delErr.hint });
  }

  const { error: insErr } = await supabase.from("meal_plans").insert(row);
  if (insErr) {
    console.error("[saveMealPlan] INSERT failed", { code: insErr.code, message: insErr.message, hint: insErr.hint });
  } else {
    console.log("[saveMealPlan] INSERT ok", { dayOfWeek });
  }

  return { error: insErr };
}

export async function getWeekPlans(userId) {
  if (!supabase) return {};
  const { data } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_id", userId);

  // Convert to { dayOfWeek: meals } map
  // With A/B format: key 0 = Day A, key 1 = Day B
  const plans = {};
  (data || []).forEach((row) => {
    plans[row.day_of_week] = row.meals;
  });
  return plans;
}

// ── GENERATION LOG ─────────────────────────────────────────────

/**
 * Returns how many AI plans this user has generated in different
 * time windows (used to display remaining count in the UI).
 * Reads via the anon key with the user's active session (RLS applies).
 */
export async function getGenerationUsage(userId) {
  if (!supabase) return null;
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dayStart     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [weeklyRes, dailyRes, monthlyRes] = await Promise.all([
      supabase
        .from("generation_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("generated_at", sevenDaysAgo),
      supabase
        .from("generation_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("generated_at", dayStart),
      supabase
        .from("generation_log")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("generated_at", monthStart),
    ]);

    return {
      weeklyCount:  weeklyRes.count  || 0,
      dailyCount:   dailyRes.count   || 0,
      monthlyCount: monthlyRes.count || 0,
    };
  } catch {
    return null;
  }
}

// ── FREQUENT MEALS ─────────────────────────────────────────────

export async function getFrequentMeals(userId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("meal_log")
    .select("name, calories, protein, carbs, fat")
    .eq("user_id", userId)
    .order("logged_at", { ascending: false }); // newest first → most-recent macros
  if (error) {
    console.error("[getFrequentMeals] failed", { code: error.code, message: error.message, hint: error.hint });
    return [];
  }
  // Count occurrences per name; capture macros from the most-recent entry
  const counts = {};
  const macros = {};
  (data || []).forEach(row => {
    const key = (row.name || "").trim();
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
    if (!macros[key]) macros[key] = { cal: row.calories || 0, p: row.protein || 0, c: row.carbs || 0, f: row.fat || 0 };
  });
  return Object.entries(counts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]) // most frequent first
    .map(([name]) => ({ name, ...macros[name] }));
}

// ── CUSTOM GROCERY LIST ─────────────────────────────────────────

export async function getCustomGroceryList(userId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("custom_grocery_lists")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle(); // .single() returns 406 when no row exists; .maybeSingle() returns null safely
  if (error) {
    console.error("[getCustomGroceryList] failed", { code: error.code, message: error.message, hint: error.hint });
  }
  return data?.items || [];
}

export async function saveCustomGroceryList(userId, items) {
  if (!supabase) return;
  const { error } = await supabase.from("custom_grocery_lists").upsert(
    { user_id: userId, items: items, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  return { error };
}
