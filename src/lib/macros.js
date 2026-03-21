/**
 * Macra — Macro Calculator Engine
 *
 * Uses the Mifflin-St Jeor equation to calculate BMR,
 * then applies activity multiplier and goal adjustment.
 *
 * Protein multiplier is based on goal + activity level,
 * with a hard BMI cap above 35.
 */

function getProteinMultiplier(bmi, goal, activity) {
  // Hard cap for BMI > 35 regardless of goal/activity
  if (bmi > 35) return 0.7;

  // Sedentary overrides first (except cut gets a bump)
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
  const { sex, age, weightLbs, heightFt, heightIn, activity, goal } = profile;

  // Convert to metric
  const weightKg = weightLbs * 0.453592;
  const heightCm = (heightFt * 12 + heightIn) * 2.54;

  // Mifflin-St Jeor BMR
  const bmr = sex === "male"
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  // Activity multiplier
  const activityMultipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  const tdee = Math.round(bmr * (activityMultipliers[activity] || 1.55));

  // Goal adjustment
  const goalAdjustments = { cut: -500, maintain: 0, lean_bulk: 250, bulk: 500 };
  const target = Math.round(tdee + (goalAdjustments[goal] || 0));

  // BMI for protein multiplier
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  const proteinMult = getProteinMultiplier(bmi, goal, activity);
  const proteinG = Math.max(100, Math.round(weightLbs * proteinMult));

  // Fat: 25% of target calories
  const fatG = Math.round((target * 0.25) / 9);

  // Carbs fill remaining (floor at 50g)
  const carbG = Math.max(50, Math.round((target - proteinG * 4 - fatG * 9) / 4));

  return { bmr: Math.round(bmr), tdee, target, proteinG, fatG, carbG,
    proteinCal: proteinG * 4, carbCal: carbG * 4, fatCal: fatG * 9 };
}
