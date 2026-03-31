import { NUTRITION_DB, NUTRITION_ALIASES, getNutrition, calculateIngredientMacros } from './nutritionDatabase.js';

// ── SECTION 1 — INGREDIENT POOLS ─────────────────────────────────────────────

const PROTEIN_POOL = [
  { name: 'chicken thighs',  proteinPer28g: 4.9,   costPerOz: 0.156,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['strict','moderate','flexible','premium'] },
  { name: 'chicken breast',  proteinPer28g: 6.6,   costPerOz: 0.343,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['moderate','flexible','premium'] },
  { name: 'ground turkey',   proteinPer28g: 5.6,   costPerOz: 0.312,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['strict','moderate','flexible','premium'] },
  { name: 'ground beef',     proteinPer28g: 5.7,   costPerOz: 0.562,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['flexible','premium'] },
  { name: 'canned tuna',     proteinPer28g: 7.2,   costPerOz: 0.20,    unit: 'oz',    maxPerMeal: 6,  tiers: ['strict','moderate','flexible','premium'] },
  { name: 'tilapia',         proteinPer28g: 5.7,   costPerOz: 0.313,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['moderate','flexible','premium'] },
  { name: 'salmon',          proteinPer28g: 5.8,   costPerOz: 0.687,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['flexible','premium'] },
  { name: 'shrimp',          proteinPer28g: 5.9,   costPerOz: 0.583,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['flexible','premium'] },
  { name: 'pork tenderloin', proteinPer28g: 5.9,   costPerOz: 0.249,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['moderate','flexible','premium'] },
  { name: 'pork chops',      proteinPer28g: 5.5,   costPerOz: 0.374,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['flexible','premium'] },
  { name: 'eggs',            proteinEach:   6.5,   costEach:  0.15,    unit: 'each',  maxPerMeal: 4,  tiers: ['strict','moderate','flexible','premium'] },
  { name: 'firm tofu',       proteinPer28g: 2.3,   costPerOz: 0.142,   unit: 'oz',    maxPerMeal: 8,  tiers: ['strict','moderate','flexible','premium'] },
  { name: 'deli turkey',     proteinPer28g: 5.0,   costPerOz: 0.443,   unit: 'oz',    maxPerMeal: 4,  tiers: ['moderate','flexible','premium'] },
  { name: 'bacon',           proteinPerSlice: 3.7, costPerSlice: 0.40, unit: 'slice', maxPerMeal: 3,  tiers: ['flexible','premium'] },
  { name: 'turkey bacon',    proteinPerSlice: 3.96, costPerSlice: 0.40, unit: 'slice', maxPerMeal: 3,  tiers: ['moderate','flexible','premium'] },
];

// carbs — macros are per 1 unit quantity; used for quantity planning and as DB fallback
const CARB_SOURCES = [
  { name: 'white rice',   protein: 5.0,  carbs: 52.5, fat: 0.6, calories: 242, cost: 0.11, unit: 'cup',  maxQty: 3 },
  { name: 'brown rice',   protein: 5.3,  carbs: 47.5, fat: 1.8, calories: 226, cost: 0.11, unit: 'cup',  maxQty: 3 },
  { name: 'jasmine rice', protein: 5.0,  carbs: 52.5, fat: 0.6, calories: 242, cost: 0.11, unit: 'cup',  maxQty: 3 },
  { name: 'pasta',        protein: 3.4,  carbs: 17.5, fat: 0.5, calories: 90,  cost: 0.13, unit: 'oz',   maxQty: 6 },
  { name: 'oats',         protein: 13.7, carbs: 53.7, fat: 5.6, calories: 315, cost: 0.11, unit: 'cup',  maxQty: 2 },
  { name: 'quinoa',       protein: 8.1,  carbs: 39.4, fat: 3.5, calories: 222, cost: 0.25, unit: 'cup',  maxQty: 3 },
  { name: 'black beans',  protein: 10.1, carbs: 28.6, fat: 0.7, calories: 156, cost: 0.18, unit: 'cup',  maxQty: 2 },
  { name: 'lentils',      protein: 17.8, carbs: 39.8, fat: 0.8, calories: 230, cost: 0.22, unit: 'cup',  maxQty: 2 },
  { name: 'sweet potato', protein: 2.1,  carbs: 26.1, fat: 0.1, calories: 112, cost: 1.49, unit: 'each', maxQty: 2 },
  { name: 'potato',       protein: 3.5,  carbs: 30.3, fat: 0.2, calories: 133, cost: 0.59, unit: 'each', maxQty: 2 },
  { name: 'bread',        protein: 2.6,  carbs: 13.3, fat: 0.8, calories: 69,  cost: 0.15, unit: 'slice', maxQty: 4 },
  { name: 'tortillas',    protein: 3.4,  carbs: 23.9, fat: 3.3, calories: 141, cost: 0.14, unit: 'each', maxQty: 3 },
  { name: 'pita',         protein: 5.8,  carbs: 35.7, fat: 0.8, calories: 176, cost: 0.75, unit: 'each', maxQty: 2 },
];

const VEGETABLE_SOURCES = [
  { name: 'broccoli',         protein: 2.6, carbs: 6.0,  fat: 0.4, calories: 31, cost: 0.57, unit: 'cup',   simple: true  },
  { name: 'spinach',          protein: 0.9, carbs: 1.1,  fat: 0.1, calories: 7,  cost: 0.22, unit: 'cup',   simple: false },
  { name: 'bell pepper',      protein: 1.2, carbs: 7.1,  fat: 0.4, calories: 37, cost: 0.79, unit: 'each',  simple: true  },
  { name: 'onion',            protein: 1.2, carbs: 10.2, fat: 0.1, calories: 44, cost: 0.50, unit: 'each',  simple: true  },
  { name: 'tomato',           protein: 1.1, carbs: 4.8,  fat: 0.2, calories: 22, cost: 0.45, unit: 'each',  simple: false },
  { name: 'zucchini',         protein: 2.4, carbs: 6.1,  fat: 0.6, calories: 33, cost: 0.85, unit: 'each',  simple: false },
  { name: 'carrots',          protein: 1.1, carbs: 12.2, fat: 0.2, calories: 50, cost: 0.50, unit: '2 each', simple: true  },
  { name: 'cucumber',         protein: 1.4, carbs: 7.2,  fat: 0.2, calories: 30, cost: 0.79, unit: 'each',  simple: false },
  { name: 'mushrooms',        protein: 2.2, carbs: 2.3,  fat: 0.2, calories: 15, cost: 1.50, unit: 'cup',   simple: false },
  { name: 'kale',             protein: 1.9, carbs: 2.9,  fat: 1.0, calories: 23, cost: 0.54, unit: 'cup',   simple: false },
  { name: 'frozen broccoli',  protein: 2.5, carbs: 6.9,  fat: 0.1, calories: 35, cost: 0.22, unit: 'cup',   simple: false },
  { name: 'frozen mixed veg', protein: 2.4, carbs: 9.6,  fat: 0.2, calories: 50, cost: 0.22, unit: 'cup',   simple: false },
];

const FAT_SOURCES = [
  { name: 'olive oil',     protein: 0,   carbs: 0,    fat: 13.5, calories: 119, cost: 0.41, unit: 'tbsp' },
  { name: 'coconut oil',   protein: 0,   carbs: 0,    fat: 14.0, calories: 121, cost: 0.23, unit: 'tbsp' },
  { name: 'peanut butter', protein: 4.0, carbs: 3.2,  fat: 8.1,  calories: 94,  cost: 0.23, unit: 'tbsp' },
  { name: 'avocado',       protein: 2.7, carbs: 11.6, fat: 20.0, calories: 218, cost: 1.50, unit: 'each' },
  { name: 'almonds',       protein: 6.0, carbs: 6.1,  fat: 14.2, calories: 164, cost: 0.83, unit: 'oz'   },
  { name: 'cheddar cheese', protein: 7.1, carbs: 0.4, fat: 9.4,  calories: 114, cost: 0.29, unit: 'oz'   },
];

// ── Pool helpers ──────────────────────────────────────────────────────────────

function getProteinPerUnit(p) {
  if (p.unit === 'each')  return p.proteinEach;
  if (p.unit === 'slice') return p.proteinPerSlice;
  if (p.unit === 'cup')   return p.proteinPerCup;
  return p.proteinPer28g; // oz
}

function getCostPerUnit(p) {
  if (p.unit === 'each')  return p.costEach;
  if (p.unit === 'slice') return p.costPerSlice;
  if (p.unit === 'cup')   return p.costPerCup;
  return p.costPerOz; // oz
}

function getCostPerGramProtein(p) {
  return getCostPerUnit(p) / getProteinPerUnit(p);
}

// Get macros from nutrition DB with pool-table fallback
function dbMacros(name, quantity, unit, poolEntry) {
  const result = calculateIngredientMacros(name, quantity, unit);
  if (result) return result;
  // fallback to pool table values scaled by quantity
  const p = poolEntry;
  if (!p) return { protein: 0, carbs: 0, fat: 0, calories: 0 };
  const scale = quantity;
  return {
    protein:  Math.round((p.protein  || 0) * scale * 10) / 10,
    carbs:    Math.round((p.carbs    || 0) * scale * 10) / 10,
    fat:      Math.round((p.fat      || 0) * scale * 10) / 10,
    calories: Math.round((p.calories || 0) * scale),
  };
}

function roundMacros(m) {
  return {
    calories: Math.round(m.calories || 0),
    protein:  Math.round((m.protein  || 0) * 10) / 10,
    carbs:    Math.round((m.carbs    || 0) * 10) / 10,
    fat:      Math.round((m.fat      || 0) * 10) / 10,
  };
}

function addMacros(a, b) {
  return {
    calories: (a.calories || 0) + (b.calories || 0),
    protein:  (a.protein  || 0) + (b.protein  || 0),
    carbs:    (a.carbs    || 0) + (b.carbs    || 0),
    fat:      (a.fat      || 0) + (b.fat      || 0),
  };
}

// ── SECTION 2 — BUDGET ALLOCATOR ─────────────────────────────────────────────

function allocateBudget(weeklyBudget, mealsPerDay, days) {
  const dailyBudget = Math.round((weeklyBudget / days) * 100) / 100;
  return {
    dailyBudget,
    perMeal: {
      breakfast: Math.round(dailyBudget * 0.18 * 100) / 100,
      snack:     Math.round(dailyBudget * 0.12 * 100) / 100,
      lunch:     Math.round(dailyBudget * 0.28 * 100) / 100,
      dinner:    Math.round(dailyBudget * 0.42 * 100) / 100,
    },
  };
}

// ── SECTION 3 — PROTEIN SELECTOR ─────────────────────────────────────────────

const MEAT_PROTEINS = new Set([
  'chicken thighs','chicken breast','ground turkey','ground beef',
  'tilapia','salmon','shrimp','pork tenderloin','pork chops',
  'canned tuna','deli turkey','bacon','turkey bacon',
]);

function selectProtein(mealType, proteinTargetG, mealBudget, budgetTier, excludeProteins = [], dietaryRestrictions = [], mealCalorieTarget = null) {
  let pool = PROTEIN_POOL.filter(p => p.tiers.includes(budgetTier));
  pool = pool.filter(p => !excludeProteins.includes(p.name));

  if (dietaryRestrictions.includes('vegetarian')) {
    pool = pool.filter(p => !MEAT_PROTEINS.has(p.name));
  }
  if (dietaryRestrictions.includes('vegan')) {
    pool = pool.filter(p => !MEAT_PROTEINS.has(p.name) && p.name !== 'eggs');
  }
  if (pool.length === 0) return null;

  // Sort cheapest cost-per-gram-of-protein first
  pool = [...pool].sort((a, b) => getCostPerGramProtein(a) - getCostPerGramProtein(b));

  const budgetLimit = mealBudget * 0.65;

  for (const p of pool) {
    const proteinPerUnit = getProteinPerUnit(p);
    const costPerUnit    = getCostPerUnit(p);

    let quantity;
    if (p.unit === 'each' || p.unit === 'slice') {
      quantity = Math.ceil(proteinTargetG / proteinPerUnit);
    } else {
      // oz: round to nearest 0.5, minimum 1
      quantity = Math.round((proteinTargetG / proteinPerUnit) * 2) / 2;
      quantity = Math.max(1, quantity);
    }

    // Change 1: cap eggs at 3 for snack slots
    let effectiveMax = (mealType === 'dinner' && p.maxPerMealDinner) ? p.maxPerMealDinner : p.maxPerMeal;
    if (mealType === 'snack' && p.name === 'eggs') effectiveMax = Math.min(effectiveMax, 3);
    quantity = Math.min(quantity, effectiveMax);

    const actualProteinG = Math.round(quantity * proteinPerUnit * 10) / 10;
    const actualCost     = Math.round(quantity * costPerUnit * 100) / 100;

    if (actualCost > budgetLimit) continue;

    // Change 2: calorie pre-check — skip if protein alone exceeds 120% of meal calorie target
    if (mealCalorieTarget != null) {
      const proteinCal = dbMacros(p.name, quantity, p.unit, null).calories;
      if (proteinCal > mealCalorieTarget * 1.20) continue;
    }

    return { name: p.name, quantity, unit: p.unit, actualProteinG, actualCost, nutritionDbKey: p.name };
  }

  // Fallback: cheapest protein at max affordable quantity within budget
  const cheapest    = pool[0];
  const costPerUnit = getCostPerUnit(cheapest);
  let   quantity    = Math.floor((budgetLimit / costPerUnit) * 10) / 10;

  if (cheapest.unit === 'each' || cheapest.unit === 'slice') {
    quantity = Math.max(1, Math.floor(quantity));
  } else {
    quantity = Math.max(0.5, Math.round(quantity * 2) / 2);
  }
  const effectiveMaxFallback = (mealType === 'dinner' && cheapest.maxPerMealDinner) ? cheapest.maxPerMealDinner : cheapest.maxPerMeal;
  quantity = Math.min(quantity, effectiveMaxFallback);

  return {
    name: cheapest.name,
    quantity,
    unit: cheapest.unit,
    actualProteinG: Math.round(quantity * getProteinPerUnit(cheapest) * 10) / 10,
    actualCost:     Math.round(quantity * costPerUnit * 100) / 100,
    nutritionDbKey: cheapest.name,
  };
}

// ── SECTION 4 — MACRO BALANCER ───────────────────────────────────────────────

function balanceMacros(proteinIngredient, mealType, macroTargets, mealBudget, dietaryRestrictions = [], pickinessLevel = 3, options = {}) {
  // Full protein macros from DB (includes fat, carbs, calories)
  const proteinMacros = dbMacros(
    proteinIngredient.name,
    proteinIngredient.quantity,
    proteinIngredient.unit,
    null
  );

  let remainingBudget  = mealBudget - proteinIngredient.actualCost;
  const remainingCarbs = Math.max(0, macroTargets.carbs - (proteinMacros.carbs || 0));
  const remainingFat   = Math.max(0, macroTargets.fat   - (proteinMacros.fat  || 0));

  // ── Carb source selection ──────────────────────────────────────────────────
  const breakfastPref = ['oats', 'bread'];
  const snackPref     = ['bread', 'tortillas'];
  const mainPref      = ['white rice', 'brown rice', 'black beans', 'lentils', 'potato'];

  const pref = mealType === 'breakfast' ? breakfastPref
             : mealType === 'snack'     ? snackPref
             : mainPref;

  const sortedCarbs = [...CARB_SOURCES].sort((a, b) => {
    const ap = pref.includes(a.name) ? 0 : 1;
    const bp = pref.includes(b.name) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.cost - b.cost;
  });

  // Day B: push the Day A carb choice to the end so a different option is preferred
  const skipCarbName = options.skipCarbName;
  const orderedCarbs = skipCarbName
    ? [...sortedCarbs.filter(c => c.name !== skipCarbName), ...sortedCarbs.filter(c => c.name === skipCarbName)]
    : sortedCarbs;

  let carbIngredient = null;

  for (const c of orderedCarbs) {
    const carbsPerUnit = c.carbs;
    let quantity;

    if (remainingCarbs <= 0) {
      // Meal doesn't need more carbs — use a token serving
      quantity = c.unit === 'cup' ? 0.5 : 1;
    } else if (c.unit === 'each' || c.unit === 'slice') {
      quantity = Math.max(1, Math.round(remainingCarbs / carbsPerUnit));
      quantity = Math.min(quantity, c.maxQty);
    } else {
      // cup or oz — round to nearest quarter
      quantity = Math.round((remainingCarbs / carbsPerUnit) * 4) / 4;
      quantity = Math.max(c.unit === 'cup' ? 0.25 : 0.5, quantity);
      quantity = Math.min(quantity, c.maxQty);
    }

    const cost = Math.round(quantity * c.cost * 100) / 100;
    if (cost <= remainingBudget * 0.50) {
      const macros = roundMacros(dbMacros(c.name, quantity, c.unit, c));
      carbIngredient = { name: c.name, quantity, unit: c.unit, macros, cost };
      break;
    }
  }

  // Last-resort carb: cheapest carb at minimum serving
  if (!carbIngredient) {
    const cheapest  = [...CARB_SOURCES].sort((a, b) => a.cost - b.cost)[0];
    const quantity  = cheapest.unit === 'cup' ? 0.5 : 1;
    const cost      = Math.round(quantity * cheapest.cost * 100) / 100;
    const macros    = roundMacros(dbMacros(cheapest.name, quantity, cheapest.unit, cheapest));
    carbIngredient  = { name: cheapest.name, quantity, unit: cheapest.unit, macros, cost };
  }

  remainingBudget -= carbIngredient.cost;

  // ── Calorie ceiling check after carb selection ────────────────────────────
  // If protein + carb already exceeds meal calorie target by >10%, reduce carbs
  {
    const projectedCal = proteinMacros.calories + carbIngredient.macros.calories;
    const calCeiling   = macroTargets.calories * 1.10;
    if (projectedCal > calCeiling && carbIngredient.quantity > 0) {
      const allowedCarbCal = Math.max(0, macroTargets.calories * 1.10 - proteinMacros.calories);
      const carbCalPerUnit = carbIngredient.macros.calories / carbIngredient.quantity;
      if (carbCalPerUnit > 0) {
        let newQty = allowedCarbCal / carbCalPerUnit;
        const src  = CARB_SOURCES.find(c => c.name === carbIngredient.name);
        if (carbIngredient.unit === 'cup') {
          newQty = Math.max(0.25, Math.round(newQty * 4) / 4);
        } else if (carbIngredient.unit === 'each' || carbIngredient.unit === 'slice') {
          newQty = Math.max(1, Math.floor(newQty));
        } else {
          newQty = Math.max(0.5, Math.round(newQty * 2) / 2);
        }
        if (newQty < carbIngredient.quantity) {
          const newMacros = roundMacros(dbMacros(carbIngredient.name, newQty, carbIngredient.unit, src || carbIngredient));
          const newCost   = Math.round(newQty * (src?.cost || 0) * 100) / 100;
          remainingBudget += carbIngredient.cost - newCost;
          carbIngredient  = { ...carbIngredient, quantity: newQty, macros: newMacros, cost: newCost };
        }
      }
    }
  }

  // ── Fat source selection ───────────────────────────────────────────────────
  const remainingFatAfterCarbs = Math.max(0, remainingFat - (carbIngredient.macros.fat || 0));
  let fatIngredient = null;

  if (remainingFatAfterCarbs > 5 && remainingBudget > 0.15) {
    const fatPref   = (mealType === 'breakfast' || mealType === 'snack')
                    ? ['peanut butter', 'coconut oil']
                    : ['olive oil', 'cheddar cheese'];
    const fatSorted = [...FAT_SOURCES].sort((a, b) => {
      const ap = fatPref.includes(a.name) ? 0 : 1;
      const bp = fatPref.includes(b.name) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.cost - b.cost;
    });

    for (const f of fatSorted) {
      let quantity = Math.round((remainingFatAfterCarbs / f.fat) * 2) / 2;
      quantity     = Math.max(0.5, Math.min(quantity, 3));
      const cost   = Math.round(quantity * f.cost * 100) / 100;

      if (cost <= remainingBudget * 0.60) {
        const macros = roundMacros(dbMacros(f.name, quantity, f.unit, f));
        fatIngredient = { name: f.name, quantity, unit: f.unit, macros, cost };
        break;
      }
    }
  }

  if (fatIngredient) remainingBudget -= fatIngredient.cost;

  // ── Calorie ceiling check after fat selection ─────────────────────────────
  // If protein + carb + fat already exceeds meal calorie target by >10%, drop fat
  if (fatIngredient) {
    const projectedCal = proteinMacros.calories + carbIngredient.macros.calories + fatIngredient.macros.calories;
    if (projectedCal > macroTargets.calories * 1.10) {
      remainingBudget += fatIngredient.cost;
      fatIngredient = null;
    }
  }

  // ── Vegetable selection ────────────────────────────────────────────────────
  const vegPool = pickinessLevel <= 2
    ? VEGETABLE_SOURCES.filter(v => v.simple)
    : [...VEGETABLE_SOURCES];

  const vegSorted = [...vegPool].sort((a, b) => a.cost - b.cost);
  const vegetables = [];
  const vegUsageCount = options.vegUsageCount || {};

  // Prefer vegetables used fewer than 2 times across the plan
  const eligibleVegs = vegSorted.filter(v => (vegUsageCount[v.name] || 0) < 2);
  const vegCandidates = eligibleVegs.length > 0 ? eligibleVegs : vegSorted;

  for (const v of vegCandidates) {
    if (vegetables.length >= 2) break;
    if (v.cost <= remainingBudget) {
      const macros = roundMacros(dbMacros(v.name, 1, v.unit, v));
      vegetables.push({ name: v.name, quantity: 1, unit: v.unit, macros, cost: v.cost });
      remainingBudget -= v.cost;
      vegUsageCount[v.name] = (vegUsageCount[v.name] || 0) + 1;
    }
  }
  // Fallback: if still need a second veg, allow any cheapest not yet in this meal
  if (vegetables.length < 2) {
    for (const v of vegSorted) {
      if (vegetables.length >= 2) break;
      if (vegetables.some(sel => sel.name === v.name)) continue;
      if (v.cost <= remainingBudget) {
        const macros = roundMacros(dbMacros(v.name, 1, v.unit, v));
        vegetables.push({ name: v.name, quantity: 1, unit: v.unit, macros, cost: v.cost });
        remainingBudget -= v.cost;
        vegUsageCount[v.name] = (vegUsageCount[v.name] || 0) + 1;
      }
    }
  }

  // ── Total macros ──────────────────────────────────────────────────────────
  let total = roundMacros(proteinMacros);
  total = addMacros(total, carbIngredient.macros);
  if (fatIngredient) total = addMacros(total, fatIngredient.macros);
  for (const v of vegetables) total = addMacros(total, v.macros);
  let totalMacros = roundMacros(total);

  let totalCost = Math.round((
    proteinIngredient.actualCost +
    carbIngredient.cost +
    (fatIngredient?.cost || 0) +
    vegetables.reduce((s, v) => s + v.cost, 0)
  ) * 100) / 100;

  // ── Budget reduction if over ───────────────────────────────────────────────
  if (totalCost > mealBudget && fatIngredient) {
    totalCost   = Math.round((totalCost - fatIngredient.cost) * 100) / 100;
    totalMacros = roundMacros(Object.fromEntries(
      ['calories','protein','carbs','fat'].map(k => [k, totalMacros[k] - fatIngredient.macros[k]])
    ));
    fatIngredient = null;
  }

  if (totalCost > mealBudget && vegetables.length > 1) {
    const removed = vegetables.pop();
    totalCost   = Math.round((totalCost - removed.cost) * 100) / 100;
    totalMacros = roundMacros(Object.fromEntries(
      ['calories','protein','carbs','fat'].map(k => [k, totalMacros[k] - removed.macros[k]])
    ));
  }

  if (totalCost > mealBudget) {
    // Reduce carb quantity by 25%
    const origQty   = carbIngredient.quantity;
    let   newQty    = carbIngredient.unit === 'cup'
                    ? Math.max(0.25, Math.round(origQty * 0.75 * 4) / 4)
                    : (carbIngredient.unit === 'each' || carbIngredient.unit === 'slice')
                    ? Math.max(1, Math.floor(origQty * 0.75))
                    : Math.max(0.5, Math.round(origQty * 0.75 * 2) / 2);
    const newMacros = roundMacros(dbMacros(carbIngredient.name, newQty, carbIngredient.unit, carbIngredient));
    const newCost   = Math.round(newQty * (CARB_SOURCES.find(c => c.name === carbIngredient.name)?.cost || 0) * 100) / 100;
    totalMacros     = roundMacros(addMacros(
      Object.fromEntries(['calories','protein','carbs','fat'].map(k => [k, totalMacros[k] - carbIngredient.macros[k]])),
      newMacros
    ));
    totalCost       = Math.round((totalCost - carbIngredient.cost + newCost) * 100) / 100;
    carbIngredient  = { ...carbIngredient, quantity: newQty, macros: newMacros, cost: newCost };
  }

  return { carbIngredient, fatIngredient, vegetables, totalMacros, totalCost };
}

// ── SECTION 5 — PLAN ASSEMBLER ───────────────────────────────────────────────

function generateMealTemplate(profile) {
  const {
    weeklyBudget,
    macros,
    budgetTier,
    dietaryRestrictions = [],
    pickinessLevel = 3,
    days = 2,
    mealsPerDay = 4,
  } = profile;

  const budget = allocateBudget(weeklyBudget, mealsPerDay, days);

  // Per-meal macro targets (protein split matches generate-plan.js)
  const mealMacroTargets = {
    breakfast: {
      calories: Math.round(macros.target   * 0.18),
      protein:  Math.round(macros.proteinG * 0.18),
      carbs:    Math.round(macros.carbG    * 0.18),
      fat:      Math.round(macros.fatG     * 0.18),
    },
    snack: {
      calories: Math.round(macros.target   * 0.18),
      protein:  Math.round(macros.proteinG * 0.18),
      carbs:    Math.round(macros.carbG    * 0.18),
      fat:      Math.round(macros.fatG     * 0.18),
    },
    lunch: {
      calories: Math.round(macros.target   * 0.28),
      protein:  Math.round(macros.proteinG * 0.28),
      carbs:    Math.round(macros.carbG    * 0.28),
      fat:      Math.round(macros.fatG     * 0.28),
    },
    dinner: {
      calories: Math.round(macros.target   * 0.36),
      protein:  Math.round(macros.proteinG * 0.36),
      carbs:    Math.round(macros.carbG    * 0.36),
      fat:      Math.round(macros.fatG     * 0.36),
    },
  };

  const ORDER = ['breakfast', 'lunch', 'snack', 'dinner'];

  // Shared vegetable usage counter across both days (all 8 meal slots)
  const vegUsageCount = {};

  // dayAProteins: proteins used in Day A to exclude from Day B
  // dayACarbPerMeal: { breakfast: carbName, lunch: carbName, ... } from Day A, skipped in Day B
  function generateDay(dayLabel, dayAProteins = [], dayACarbPerMeal = {}) {
    const meals        = {};
    const usedProteins = [];
    const carbPerMeal  = {};

    for (const mealType of ORDER) {
      const mealBudget  = budget.perMeal[mealType];
      const macroTarget = mealMacroTargets[mealType];

      // Within-day exclusions + Day A protein exclusions for Day B
      const withinDay = mealType === 'dinner' ? [...usedProteins]
                      : mealType === 'lunch'  ? [usedProteins[0]].filter(Boolean)
                      : [];
      const excludeList = [...new Set([...withinDay, ...dayAProteins])];

      // Try selection with full exclusions; if pool empties, fall back to within-day only
      let proteinIngredient = selectProtein(
        mealType, macroTarget.protein, mealBudget, budgetTier, excludeList, dietaryRestrictions, macroTarget.calories
      );
      if (!proteinIngredient && dayAProteins.length > 0) {
        proteinIngredient = selectProtein(
          mealType, macroTarget.protein, mealBudget, budgetTier, withinDay, dietaryRestrictions, macroTarget.calories
        );
      }

      if (!proteinIngredient) {
        console.warn(`[mealTemplateGenerator] No protein found for ${dayLabel} ${mealType}`);
        meals[mealType] = {
          mealType, protein: null, carbs: null, fat: null, vegetables: [],
          totalMacros: { calories: 0, protein: 0, carbs: 0, fat: 0 }, totalCost: 0,
        };
        continue;
      }

      if (!usedProteins.includes(proteinIngredient.name)) {
        usedProteins.push(proteinIngredient.name);
      }

      const { carbIngredient, fatIngredient, vegetables, totalMacros, totalCost } = balanceMacros(
        proteinIngredient, mealType, macroTarget, mealBudget, dietaryRestrictions, pickinessLevel,
        { skipCarbName: dayACarbPerMeal[mealType], vegUsageCount }
      );

      carbPerMeal[mealType] = carbIngredient?.name;

      meals[mealType] = {
        mealType,
        protein:    proteinIngredient,
        carbs:      carbIngredient,
        fat:        fatIngredient,
        vegetables,
        totalMacros,
        totalCost,
      };

      console.log(
        `[template] ${dayLabel} ${mealType.padEnd(9)}: ` +
        `${proteinIngredient.name} ${proteinIngredient.quantity}${proteinIngredient.unit} + ` +
        `${carbIngredient?.name} ${carbIngredient?.quantity}${carbIngredient?.unit}` +
        (fatIngredient ? ` + ${fatIngredient.name} ${fatIngredient.quantity}${fatIngredient.unit}` : '') +
        ` | cal:${totalMacros.calories} P:${totalMacros.protein}g C:${totalMacros.carbs}g F:${totalMacros.fat}g` +
        ` | $${totalCost.toFixed(2)}`
      );
    }

    const dayTotals = {
      calories: Math.round(ORDER.reduce((s, mt) => s + (meals[mt]?.totalMacros?.calories || 0), 0)),
      protein:  Math.round(ORDER.reduce((s, mt) => s + (meals[mt]?.totalMacros?.protein  || 0), 0) * 10) / 10,
      carbs:    Math.round(ORDER.reduce((s, mt) => s + (meals[mt]?.totalMacros?.carbs    || 0), 0) * 10) / 10,
      fat:      Math.round(ORDER.reduce((s, mt) => s + (meals[mt]?.totalMacros?.fat      || 0), 0) * 10) / 10,
      cost:     Math.round(ORDER.reduce((s, mt) => s + (meals[mt]?.totalCost             || 0), 0) * 100) / 100,
    };

    console.log(
      `[template] ${dayLabel} TOTAL: cal:${dayTotals.calories} P:${dayTotals.protein}g ` +
      `C:${dayTotals.carbs}g F:${dayTotals.fat}g | $${dayTotals.cost.toFixed(2)}`
    );

    return { meals, dayTotals, usedProteins, carbPerMeal };
  }

  const dayAResult = generateDay('DayA');
  const dayBResult = generateDay('DayB', dayAResult.usedProteins, dayAResult.carbPerMeal);

  // Weekly projected cost: Day A × 4 + Day B × 3
  let weeklyProjectedCost = Math.round(
    (dayAResult.dayTotals.cost * 4 + dayBResult.dayTotals.cost * 3) * 100
  ) / 100;

  // If over 110% of weeklyBudget, reduce non-protein ingredients by 20%
  if (weeklyProjectedCost > weeklyBudget * 1.10) {
    console.log(
      `[template] Weekly cost $${weeklyProjectedCost} exceeds 110% of $${weeklyBudget} — trimming non-protein by 20%`
    );
    for (const dayResult of [dayAResult, dayBResult]) {
      for (const mealType of ORDER) {
        const meal = dayResult.meals[mealType];
        if (!meal) continue;
        for (const field of ['carbs', 'fat']) {
          if (!meal[field]) continue;
          meal[field].quantity = field === 'carbs'
            ? (meal[field].unit === 'cup' ? Math.max(0.25, Math.round(meal[field].quantity * 0.8 * 4) / 4)
               : (meal[field].unit === 'slice' || meal[field].unit === 'each')
               ? Math.max(1, Math.floor(meal[field].quantity * 0.8))
               : Math.max(0.5, Math.round(meal[field].quantity * 0.8 * 2) / 2))
            : Math.max(0.5, Math.round(meal[field].quantity * 0.8 * 2) / 2);
          const src = field === 'carbs'
            ? CARB_SOURCES.find(c => c.name === meal[field].name)
            : FAT_SOURCES.find(f => f.name === meal[field].name);
          if (src) {
            meal[field].cost   = Math.round(meal[field].quantity * src.cost * 100) / 100;
            meal[field].macros = roundMacros(dbMacros(meal[field].name, meal[field].quantity, meal[field].unit, src));
          }
        }
        // Recompute meal total cost
        meal.totalCost = Math.round((
          (meal.protein?.actualCost || 0) +
          (meal.carbs?.cost || 0) +
          (meal.fat?.cost || 0) +
          meal.vegetables.reduce((s, v) => s + v.cost, 0)
        ) * 100) / 100;

        // Recompute meal total macros
        let m = roundMacros(dbMacros(
          meal.protein.name, meal.protein.quantity, meal.protein.unit, null
        ));
        if (meal.carbs) m = addMacros(m, meal.carbs.macros);
        if (meal.fat)   m = addMacros(m, meal.fat.macros);
        for (const v of meal.vegetables) m = addMacros(m, v.macros);
        meal.totalMacros = roundMacros(m);
      }

      dayResult.dayTotals.cost = Math.round(
        ORDER.reduce((s, mt) => s + (dayResult.meals[mt]?.totalCost || 0), 0) * 100
      ) / 100;
    }

    weeklyProjectedCost = Math.round(
      (dayAResult.dayTotals.cost * 4 + dayBResult.dayTotals.cost * 3) * 100
    ) / 100;
  }

  const weeklyProjectedMacros = {
    avgDailyCalories: Math.round((dayAResult.dayTotals.calories * 4 + dayBResult.dayTotals.calories * 3) / 7),
    avgDailyProtein:  Math.round(((dayAResult.dayTotals.protein * 4 + dayBResult.dayTotals.protein * 3) / 7) * 10) / 10,
    avgDailyCarbs:    Math.round(((dayAResult.dayTotals.carbs   * 4 + dayBResult.dayTotals.carbs   * 3) / 7) * 10) / 10,
    avgDailyFat:      Math.round(((dayAResult.dayTotals.fat     * 4 + dayBResult.dayTotals.fat     * 3) / 7) * 10) / 10,
  };

  return {
    dayA: dayAResult.meals,
    dayB: dayBResult.meals,
    verifiedTotals: {
      dayA: dayAResult.dayTotals,
      dayB: dayBResult.dayTotals,
    },
    weeklyProjectedCost,
    weeklyProjectedMacros,
  };
}

// ── SECTION 6 — EXPORT AND SELF-TEST ─────────────────────────────────────────

export { allocateBudget, selectProtein, balanceMacros, generateMealTemplate };

if (process.env.NODE_ENV !== 'production') {
  // ── Test 1: moderate $75 ──────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('SELF-TEST 1: moderate tier / $75 / 185g protein / 2018 cal');
  console.log('═'.repeat(60));

  const result1 = generateMealTemplate({
    weeklyBudget: 75,
    macros: { target: 2018, proteinG: 185, carbG: 160, fatG: 71 },
    budgetTier: 'moderate',
    dietaryRestrictions: [],
    pickinessLevel: 3,
    days: 2,
    mealsPerDay: 4,
  });

  console.log('\n── Detailed ingredient breakdown ─────────────────────────');
  for (const [dayKey, dayMeals] of [['dayA', result1.dayA], ['dayB', result1.dayB]]) {
    console.log(`\n${dayKey.toUpperCase()}:`);
    for (const [mealType, meal] of Object.entries(dayMeals)) {
      console.log(`  ${mealType}:`);
      if (meal.protein)    console.log(`    protein:  ${meal.protein.quantity}${meal.protein.unit} ${meal.protein.name} → ${meal.protein.actualProteinG}g protein, $${meal.protein.actualCost.toFixed(2)}`);
      if (meal.carbs)      console.log(`    carbs:    ${meal.carbs.quantity}${meal.carbs.unit} ${meal.carbs.name} → P:${meal.carbs.macros.protein}g C:${meal.carbs.macros.carbs}g F:${meal.carbs.macros.fat}g cal:${meal.carbs.macros.calories}, $${meal.carbs.cost.toFixed(2)}`);
      if (meal.fat)        console.log(`    fat:      ${meal.fat.quantity}${meal.fat.unit} ${meal.fat.name} → P:${meal.fat.macros.protein}g C:${meal.fat.macros.carbs}g F:${meal.fat.macros.fat}g cal:${meal.fat.macros.calories}, $${meal.fat.cost.toFixed(2)}`);
      if (meal.vegetables?.length) {
        meal.vegetables.forEach(v => {
          console.log(`    veg:      ${v.quantity}${v.unit} ${v.name} → P:${v.macros.protein}g C:${v.macros.carbs}g F:${v.macros.fat}g cal:${v.macros.calories}, $${v.cost.toFixed(2)}`);
        });
      }
      console.log(`    TOTAL:    cal:${meal.totalMacros.calories} P:${meal.totalMacros.protein}g C:${meal.totalMacros.carbs}g F:${meal.totalMacros.fat}g | $${meal.totalCost.toFixed(2)}`);
    }
  }

  console.log('\n── Verified totals ───────────────────────────────────────');
  console.log('Day A:', result1.verifiedTotals.dayA);
  console.log('Day B:', result1.verifiedTotals.dayB);
  console.log(`Weekly projected cost: $${result1.weeklyProjectedCost.toFixed(2)}`);
  console.log('Weekly projected macros:', result1.weeklyProjectedMacros);

  // ── Test 2: flexible $165 ─────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('SELF-TEST 2: flexible tier / $165 / 180g protein / 2400 cal');
  console.log('═'.repeat(60));

  const result2 = generateMealTemplate({
    weeklyBudget: 165,
    macros: { target: 2400, proteinG: 180, carbG: 220, fatG: 85 },
    budgetTier: 'flexible',
    dietaryRestrictions: [],
    pickinessLevel: 3,
    days: 2,
    mealsPerDay: 4,
  });

  console.log('\n── Detailed ingredient breakdown ─────────────────────────');
  for (const [dayKey, dayMeals] of [['dayA', result2.dayA], ['dayB', result2.dayB]]) {
    console.log(`\n${dayKey.toUpperCase()}:`);
    for (const [mealType, meal] of Object.entries(dayMeals)) {
      console.log(`  ${mealType}:`);
      if (meal.protein)    console.log(`    protein:  ${meal.protein.quantity}${meal.protein.unit} ${meal.protein.name} → ${meal.protein.actualProteinG}g protein, $${meal.protein.actualCost.toFixed(2)}`);
      if (meal.carbs)      console.log(`    carbs:    ${meal.carbs.quantity}${meal.carbs.unit} ${meal.carbs.name} → P:${meal.carbs.macros.protein}g C:${meal.carbs.macros.carbs}g F:${meal.carbs.macros.fat}g cal:${meal.carbs.macros.calories}, $${meal.carbs.cost.toFixed(2)}`);
      if (meal.fat)        console.log(`    fat:      ${meal.fat.quantity}${meal.fat.unit} ${meal.fat.name} → P:${meal.fat.macros.protein}g C:${meal.fat.macros.carbs}g F:${meal.fat.macros.fat}g cal:${meal.fat.macros.calories}, $${meal.fat.cost.toFixed(2)}`);
      if (meal.vegetables?.length) {
        meal.vegetables.forEach(v => {
          console.log(`    veg:      ${v.quantity}${v.unit} ${v.name} → P:${v.macros.protein}g C:${v.macros.carbs}g F:${v.macros.fat}g cal:${v.macros.calories}, $${v.cost.toFixed(2)}`);
        });
      }
      console.log(`    TOTAL:    cal:${meal.totalMacros.calories} P:${meal.totalMacros.protein}g C:${meal.totalMacros.carbs}g F:${meal.totalMacros.fat}g | $${meal.totalCost.toFixed(2)}`);
    }
  }

  console.log('\n── Verified totals ───────────────────────────────────────');
  console.log('Day A:', result2.verifiedTotals.dayA);
  console.log('Day B:', result2.verifiedTotals.dayB);
  console.log(`Weekly projected cost: $${result2.weeklyProjectedCost.toFixed(2)}`);
  console.log('Weekly projected macros:', result2.weeklyProjectedMacros);
}
