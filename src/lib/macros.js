/**
 * Macra — Macro Calculator Engine
 * 
 * Uses the Mifflin-St Jeor equation to calculate BMR,
 * then applies activity multiplier and goal adjustment.
 * 
 * Macro splits:
 * - Protein: ~1g per lb bodyweight (adjusted by goal)
 * - Fat: 25% of total calories
 * - Carbs: remainder
 */

export function calcMacros(profile) {
  const { sex, age, weightLbs, heightFt, heightIn, activity, goal } = profile;

  // Convert to metric
  const weightKg = weightLbs * 0.453592;
  const heightCm = (heightFt * 12 + heightIn) * 2.54;

  // Mifflin-St Jeor BMR
  let bmr;
  if (sex === "male") {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }

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
  const goalAdjustments = {
    cut: -500,
    maintain: 0,
    lean_bulk: 250,
    bulk: 500,
  };

  const target = Math.round(tdee + (goalAdjustments[goal] || 0));

  // Macro splits
  const proteinPerLb = {
    cut: 1.2,      // higher protein during cut to preserve muscle
    maintain: 1.0,
    lean_bulk: 1.0,
    bulk: 0.9,
  };

  let proteinG = Math.round(weightLbs * (proteinPerLb[goal] || 1.0));
  let fatG = Math.round((target * 0.25) / 9);
  let carbG = Math.round((target - proteinG * 4 - fatG * 9) / 4);

  // Floor on carbs
  if (carbG < 50) carbG = 50;

  return {
    bmr: Math.round(bmr),
    tdee,
    target,
    proteinG,
    fatG,
    carbG,
    proteinCal: proteinG * 4,
    carbCal: carbG * 4,
    fatCal: fatG * 9,
  };
}
