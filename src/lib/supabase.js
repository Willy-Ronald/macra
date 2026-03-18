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

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
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
    updated_at: new Date().toISOString(),
  });
  return { error };
}

export async function getProfile(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
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
  });
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

export async function logMeal(userId, meal) {
  if (!supabase) return;
  const { error } = await supabase.from("meal_log").insert({
    user_id: userId,
    meal_type: meal.type?.toLowerCase(),
    name: meal.name,
    calories: meal.cal,
    protein: meal.p,
    carbs: meal.c,
    fat: meal.f,
  });
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

// ── MEAL PLANS ─────────────────────────────────────────────────

export async function saveMealPlan(userId, dayOfWeek, meals) {
  if (!supabase) return;
  // Upsert: replace existing plan for this day
  const { error } = await supabase.from("meal_plans").upsert(
    {
      user_id: userId,
      day_of_week: dayOfWeek,
      meals: meals,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,day_of_week" }
  );
  return { error };
}

export async function getWeekPlans(userId) {
  if (!supabase) return {};
  const { data } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_id", userId);
  
  // Convert to { dayOfWeek: meals } map
  const plans = {};
  (data || []).forEach((row) => {
    plans[row.day_of_week] = row.meals;
  });
  return plans;
}
