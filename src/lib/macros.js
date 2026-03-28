/**
 * Macra — Macro Calculator Engine
 *
 * Uses the Mifflin-St Jeor equation to calculate BMR,
 * then applies activity multiplier and goal adjustment.
 *
 * Protein multiplier priority:
 *  1. BMI > 35 → hard cap 0.7g/lb (safety override)
 *  2. "High Protein" diet preference → 1.2g/lb
 *  3. Goal + activity level rules
 *  Floor: 100g minimum
 */

function getProteinMultiplier(bmi, goal, activity, diet = []) {
  // 1. Safety cap — applies even with High Protein preference
  if (bmi > 35) return 0.7;

  // 2. High Protein dietary preference
  if (diet.includes("High Protein")) return 1.2;

  // 3. Sedentary (except cut gets a small bump)
  if (activity === "sedentary") {
    return goal === "cut" ? 0.85 : 0.75;
  }

  if (goal === "cut") {
    if (activity === "light" || activity === "moderate") return 1.0;
    if (activity === "active") return 1.1;
    if (activity === "very_active") return 1.2;
  }

  if (goal === "maintain") {
    if (activity === "light") return 0.85;
    if (activity === "moderate") return 0.9;
    if (activity === "active" || activity === "very_active") return 1.0;
  }

  if (goal === "lean_bulk" || goal === "bulk") {
    if (activity === "light" || activity === "moderate") return 1.0;
    if (activity === "active") return 1.1;
    if (activity === "very_active") return 1.2;
  }

  return 1.0; // fallback
}

export function calcMacros(profile) {
  const { sex, age, weightLbs, heightFt, heightIn, activity, goal, diet = [] } = profile;

  // Convert to metric
  const weightKg = weightLbs * 0.453592;
  const heightCm = (heightFt * 12 + heightIn) * 2.54;

  // Mifflin-St Jeor BMR
  const bmr = sex === "male"
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  // Activity multiplier
  const activityMultipliers = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9,
  };
  const tdee = Math.round(bmr * (activityMultipliers[activity] || 1.55));

  // Goal adjustment
  const goalAdjustments = { cut: -500, maintain: 0, lean_bulk: 250, bulk: 500 };
  const target = Math.round(tdee + (goalAdjustments[goal] || 0));

  // BMI for protein multiplier
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  const proteinMult = getProteinMultiplier(bmi, goal, activity, diet);
  const baseProteinG = Math.max(100, Math.round(weightLbs * proteinMult));
  const proteinG = baseProteinG;

  // Remaining calories after protein; split 50/50 between carbs and fat
  const proteinCal = proteinG * 4;
  const remaining = target - proteinCal;
  const fatG   = Math.max(40, Math.round((remaining * 0.50) / 9));
  const carbG  = Math.max(50, Math.round((remaining * 0.50) / 4));

  const proteinPct = Math.round((proteinCal / target) * 100);
  const carbPct    = Math.round((carbG * 4   / target) * 100);
  const fatPct     = Math.round((fatG  * 9   / target) * 100);

  const rule = bmi > 35 ? "BMI>35 cap" : diet.includes("High Protein") ? "high_protein preference" : `${goal}+${activity}`;
  console.log(`[macros] protein rule: ${rule} → ${proteinMult}g/lb = ${proteinG}g | BMR:${Math.round(bmr)} TDEE:${tdee} target:${target}`);
  console.log(`[macros] split — protein: ${proteinPct}% carbs: ${carbPct}% fat: ${fatPct}% (${proteinG}g / ${carbG}g / ${fatG}g)`);

  return { bmr: Math.round(bmr), tdee, target, proteinG, fatG, carbG,
    proteinCal, carbCal: carbG * 4, fatCal: fatG * 9 };
}
