import { NUTRITION_DB, NUTRITION_ALIASES, getNutrition, calculateIngredientMacros } from './nutritionDatabase.js';

// ── SECTION 1 — INGREDIENT POOLS ─────────────────────────────────────────────

// Change 1: max meat proteins per day by tier
const BUDGET_TIER_PROTEIN_RULES = {
  strict:   { maxMeatPerDay: 1 },
  moderate: { maxMeatPerDay: 1 },
  flexible: { maxMeatPerDay: 2 },
  premium:  { maxMeatPerDay: 3 },
};

// Change 2: proteins that count as "meat" for the per-day limit
const MEAT_PROTEINS = new Set([
  'chicken thighs', 'chicken breast', 'ground turkey', 'ground beef',
  'tilapia', 'salmon', 'shrimp', 'pork tenderloin', 'pork chops',
  'deli turkey', 'bacon', 'turkey bacon', 'canned tuna',
]);

// Change 5: package sizes for weekly cost calculation (subset of groceryCostEstimator.js)
const PKG = {
  'eggs':            { size: 12, unit: 'count', cost: 1.79 },
  'chicken thighs':  { size: 16, unit: 'oz',    cost: 2.49 },
  'chicken breast':  { size: 16, unit: 'oz',    cost: 5.49 },
  'ground turkey':   { size: 16, unit: 'oz',    cost: 4.99 },
  'ground beef':     { size: 16, unit: 'oz',    cost: 8.99 },
  'canned tuna':     { size: 5,  unit: 'oz',    cost: 1.00 },
  'tilapia':         { size: 16, unit: 'oz',    cost: 5.00 },
  'salmon':          { size: 16, unit: 'oz',    cost: 10.99 },
  'shrimp':          { size: 12, unit: 'oz',    cost: 6.99 },
  'pork tenderloin': { size: 16, unit: 'oz',    cost: 3.99 },
  'pork chops':      { size: 16, unit: 'oz',    cost: 5.99 },
  'firm tofu':       { size: 14, unit: 'oz',    cost: 1.99 },
  'deli turkey':     { size: 9,  unit: 'oz',    cost: 3.99 },
  'bacon':           { size: 12, unit: 'oz',    cost: 4.99 },
  'turkey bacon':    { size: 12, unit: 'oz',    cost: 4.79 },
  'white rice':      { size: 32, unit: 'oz',    cost: 1.79 },  // 1 cup dry ≈ 6.3 oz
  'brown rice':      { size: 32, unit: 'oz',    cost: 1.79 },
  'jasmine rice':    { size: 80, unit: 'oz',    cost: 7.49 },
  'oats':            { size: 42, unit: 'oz',    cost: 3.99 },  // 1 cup ≈ 3.2 oz
  'pasta':           { size: 16, unit: 'oz',    cost: 1.00 },  // 1 oz dry ≈ 1 oz
  'black beans':     { size: 15, unit: 'oz',    cost: 0.79 },  // 1 cup ≈ 8.8 oz
  'lentils':         { size: 16, unit: 'oz',    cost: 1.99 },
  'bread':           { size: 20, unit: 'slice',  cost: 2.49 },
  'tortillas':       { size: 10, unit: 'each',  cost: 2.99 },
  'sweet potato':    { size: 1,  unit: 'each',  cost: 1.49 },
  'potato':          { size: 1,  unit: 'each',  cost: 0.59 },
  'pita':            { size: 6,  unit: 'each',  cost: 2.49 },
  'cheddar cheese':  { size: 8,  unit: 'oz',    cost: 2.33 },
  'olive oil':       { size: 33, unit: 'tbsp',  cost: 6.99 },
  'coconut oil':     { size: 45, unit: 'tbsp',  cost: 7.99 },
  'peanut butter':   { size: 32, unit: 'tbsp',  cost: 3.49 },
  'avocado':         { size: 1,  unit: 'each',  cost: 1.50 },
  'almonds':         { size: 16, unit: 'oz',    cost: 7.99 },
  'spinach':         { size: 10, unit: 'oz',    cost: 2.19 },  // 1 cup ≈ 1 oz
  'kale':            { size: 16, unit: 'oz',    cost: 2.49 },  // 1 cup ≈ 1.4 oz
  'broccoli':        { size: 1,  unit: 'head',  cost: 1.71 },  // 1 cup ≈ 0.2 heads
  'frozen broccoli': { size: 12, unit: 'oz',    cost: 1.49 },  // 1 cup ≈ 3 oz
  'frozen mixed veg':{ size: 12, unit: 'oz',    cost: 0.88 },  // 1 cup ≈ 5 oz
  'tomato':          { size: 1,  unit: 'each',  cost: 0.45 },
  'onion':           { size: 1,  unit: 'each',  cost: 0.50 },
  'carrots':         { size: 16, unit: 'oz',    cost: 1.29 },  // "2 each" ≈ 3 oz
  'bell pepper':     { size: 1,  unit: 'each',  cost: 0.79 },
  'zucchini':        { size: 1,  unit: 'each',  cost: 0.85 },
  'cucumber':        { size: 1,  unit: 'each',  cost: 0.79 },
  'mushrooms':       { size: 8,  unit: 'oz',    cost: 2.39 },
};

// Cup → oz conversion for grains (dry weight)
const CUP_TO_OZ = {
  'white rice': 6.3, 'brown rice': 6.3, 'jasmine rice': 6.3,
  'oats': 3.2, 'black beans': 8.8, 'lentils': 7.0,
};

// Package-rounding cost: total quantity needed across the week → packages → cost
function pkgCost(name, totalQty, unit) {
  const p = PKG[name];
  if (!p) return 0;
  let qty = totalQty;
  // Convert cup units to oz for grains
  if (unit === 'cup' && CUP_TO_OZ[name]) {
    qty = totalQty * CUP_TO_OZ[name];
    // now in oz, compare to pkg.unit which should be oz
  }
  const packages = Math.ceil(qty / p.size);
  return Math.round(packages * p.cost * 100) / 100;
}

const PROTEIN_POOL = [
  { name: 'chicken thighs',  proteinPer28g: 4.9,   costPerOz: 0.156,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['strict','moderate','flexible','premium','chef'] },
  { name: 'chicken breast',  proteinPer28g: 6.6,   costPerOz: 0.343,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['strict','moderate','flexible','premium','chef'] },
  { name: 'ground turkey',   proteinPer28g: 5.6,   costPerOz: 0.312,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['strict','moderate','flexible','premium','chef'] },
  { name: 'ground beef',     proteinPer28g: 5.7,   costPerOz: 0.562,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['strict','moderate','flexible','premium','chef'] },
  { name: 'canned tuna',     proteinPer28g: 7.2,   costPerOz: 0.20,    unit: 'oz',    maxPerMeal: 6,  tiers: ['strict','moderate','flexible','premium','chef'] },
  { name: 'tilapia',         proteinPer28g: 5.7,   costPerOz: 0.313,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['strict','moderate','flexible','premium','chef'] },
  { name: 'salmon',          proteinPer28g: 5.8,   costPerOz: 0.687,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['flexible','premium','chef'] },
  { name: 'shrimp',          proteinPer28g: 5.9,   costPerOz: 0.583,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['moderate','flexible','premium','chef'] },
  { name: 'pork tenderloin', proteinPer28g: 5.9,   costPerOz: 0.249,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['strict','moderate','flexible','premium','chef'] },
  { name: 'pork chops',      proteinPer28g: 5.5,   costPerOz: 0.374,   unit: 'oz',    maxPerMeal: 8,  maxPerMealDinner: 12, tiers: ['flexible','premium','chef'] },
  { name: 'eggs',            proteinEach:   6.5,   costEach:  0.15,    unit: 'each',  maxPerMeal: 4,  tiers: ['strict','moderate','flexible','premium','chef'] },
  { name: 'firm tofu',       proteinPer28g: 2.3,   costPerOz: 0.142,   unit: 'oz',    maxPerMeal: 8,  tiers: ['strict','moderate','flexible','premium','chef'] },
  { name: 'deli turkey',     proteinPer28g: 5.0,   costPerOz: 0.443,   unit: 'oz',    maxPerMeal: 4,  tiers: ['moderate','flexible','premium','chef'] },
  { name: 'bacon',           proteinPerSlice: 3.7, costPerSlice: 0.40, unit: 'slice', maxPerMeal: 3,  tiers: ['flexible','premium','chef'] },
  { name: 'turkey bacon',    proteinPerSlice: 3.96, costPerSlice: 0.40, unit: 'slice', maxPerMeal: 3,  tiers: ['moderate','flexible','premium','chef'] },
  { name: 'pork shoulder',   proteinPer28g: 5.9,   costPerOz: 0.156,   unit: 'oz',    maxPerMeal: 12, maxPerMealDinner: 16, tiers: ['strict','moderate','flexible','premium','chef'] },
  { name: 'beef chuck roast', proteinPer28g: 6.0,  costPerOz: 0.281,   unit: 'oz',    maxPerMeal: 12, maxPerMealDinner: 16, tiers: ['strict','moderate','flexible','premium','chef'] },
];

const BUDGET_TIER_CONFIG = {
  strict:   { model: 'bulk',    primaryProteins: 1, secondaryProteins: 0, bulkCuts: ['ground turkey','pork tenderloin','canned tuna','chicken thighs'], eggBreakfast: true, maxProteinVariety: 2 },
  moderate: { model: 'bulk',    primaryProteins: 1, secondaryProteins: 1, bulkCuts: ['ground turkey','chicken breast','chicken thighs','pork tenderloin','tilapia'], eggBreakfast: true, maxProteinVariety: 3 },
  flexible: { model: 'hybrid',  primaryProteins: 2, secondaryProteins: 1, bulkCuts: null, eggBreakfast: true, maxProteinVariety: 4 },
  premium:  { model: 'variety', primaryProteins: 3, secondaryProteins: 1, bulkCuts: null, eggBreakfast: true, maxProteinVariety: 4 },
  chef:     { model: 'gourmet', primaryProteins: 5, secondaryProteins: 0, bulkCuts: null, eggBreakfast: true, maxProteinVariety: 5 },
};

const FLAVOR_DATABASE = {
  bulkCookSeasonings: [
    { name: 'garlic herb',        spices: ['garlic powder','dried thyme','dried rosemary','black pepper','salt'],         cookingFat: 'olive oil',   method: 'roast' },
    { name: 'smoky paprika',      spices: ['smoked paprika','garlic powder','onion powder','cumin','cayenne','salt'],     cookingFat: 'olive oil',   method: 'roast' },
    { name: 'lemon pepper',       spices: ['lemon zest','black pepper','garlic powder','salt'],                           cookingFat: 'olive oil',   method: 'pan-sear' },
    { name: 'tex-mex',            spices: ['chili powder','cumin','garlic powder','onion powder','oregano','salt'],       cookingFat: 'olive oil',   method: 'skillet' },
    { name: 'italian seasoning',  spices: ['italian seasoning','garlic powder','onion powder','red pepper flakes','salt'],cookingFat: 'olive oil',   method: 'bake' },
    { name: 'cajun',              spices: ['paprika','cayenne','garlic powder','onion powder','thyme','oregano','salt'],  cookingFat: 'olive oil',   method: 'skillet' },
    { name: 'curry',              spices: ['curry powder','cumin','coriander','turmeric','garlic powder','salt'],         cookingFat: 'coconut oil', method: 'skillet' },
    { name: 'teriyaki',           spices: ['soy sauce','garlic powder','ginger powder','brown sugar','sesame oil'],       cookingFat: 'coconut oil', method: 'stir-fry' },
    { name: 'mediterranean',      spices: ['oregano','garlic powder','lemon zest','cumin','coriander','salt'],            cookingFat: 'olive oil',   method: 'roast' },
    { name: 'simple salt pepper', spices: ['salt','black pepper','garlic powder'],                                        cookingFat: 'olive oil',   method: 'pan-sear' },
  ],
  saucesAndFinishing: {
    american:      ['hot sauce','BBQ sauce','ranch','honey mustard','buffalo sauce'],
    mexican:       ['salsa','guacamole','sour cream','chipotle sauce','lime crema'],
    asian:         ['soy sauce','sriracha','hoisin sauce','sesame oil','ponzu','gochujang'],
    mediterranean: ['tzatziki','hummus','tahini','harissa','lemon-herb yogurt'],
    italian:       ['marinara','pesto','alfredo','arrabbiata','lemon-caper butter'],
    indian:        ['raita','mango chutney','tikka sauce','coconut curry','mint chutney'],
    middleEastern: ['tahini sauce','garlic sauce','zhug','sumac yogurt'],
    french:        ['dijon vinaigrette','beurre blanc','herb butter','béarnaise'],
  },
  breakfastProfiles: {
    eggs: {
      styles: ['scrambled','over-easy','poached','hard-boiled','soft-boiled'],
      addIns: ['spinach','bell pepper','onion','mushroom','tomato','cheddar cheese','salsa','hot sauce'],
    },
    burritos: [
      { name: 'classic breakfast burrito',  fillings: ['scrambled eggs','cheddar cheese','salsa','black beans'] },
      { name: 'veggie burrito',             fillings: ['scrambled eggs','spinach','bell pepper','onion','cheddar cheese'] },
      { name: 'meat lovers burrito',        fillings: ['scrambled eggs','turkey bacon','cheddar cheese','salsa'] },
      { name: 'southwest burrito',          fillings: ['scrambled eggs','black beans','salsa','avocado','cumin'] },
      { name: 'spicy chorizo-style burrito',fillings: ['scrambled eggs','ground turkey (chorizo-spiced)','jalapeño','cheddar cheese'] },
      { name: 'greek burrito',              fillings: ['scrambled eggs','spinach','feta','tomato','olives'] },
      { name: 'avocado burrito',            fillings: ['scrambled eggs','avocado','tomato','onion','lime'] },
      { name: 'ham and cheese burrito',     fillings: ['scrambled eggs','deli turkey','cheddar cheese','mustard'] },
      { name: 'mushroom swiss burrito',     fillings: ['scrambled eggs','mushrooms','swiss cheese','thyme'] },
      { name: 'loaded potato burrito',      fillings: ['scrambled eggs','diced potato','cheddar cheese','sour cream','chives'] },
    ],
    toast: [
      { name: 'avocado toast',            toppings: ['avocado','lemon juice','red pepper flakes','salt'] },
      { name: 'peanut butter banana toast',toppings: ['peanut butter','banana','honey','cinnamon'] },
      { name: 'cottage cheese toast',     toppings: ['cottage cheese','tomato','black pepper','everything bagel seasoning'] },
      { name: 'egg and cheese toast',     toppings: ['fried egg','cheddar cheese','hot sauce'] },
      { name: 'smoked salmon toast',      toppings: ['cream cheese','smoked salmon','red onion','capers','dill'] },
      { name: 'greek toast',              toppings: ['hummus','cucumber','tomato','feta','olives'] },
      { name: 'turkey and avocado toast', toppings: ['deli turkey','avocado','spinach','mustard'] },
      { name: 'BLT toast',               toppings: ['turkey bacon','tomato','lettuce','mayo'] },
      { name: 'ricotta honey toast',      toppings: ['ricotta','honey','walnuts','cinnamon'] },
      { name: 'tuna melt toast',          toppings: ['canned tuna','cheddar cheese','tomato','pickle'] },
      { name: 'bruschetta toast',         toppings: ['tomato','basil','garlic','olive oil','balsamic'] },
      { name: 'almond butter apple toast',toppings: ['almond butter','apple slices','cinnamon','honey'] },
    ],
    yogurtBowls: {
      bases:   ['Greek yogurt','Icelandic yogurt','cottage cheese'],
      toppings: ['granola','blueberries','strawberries','banana','honey','chia seeds','almonds','walnuts','peanut butter','protein powder'],
    },
    cottageCheese: {
      savory: ['tomato','cucumber','black pepper','everything bagel seasoning','hot sauce'],
      sweet:  ['honey','berries','banana','cinnamon','granola'],
    },
  },
};

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

  // Sort cheapest cost-per-gram first, then pick randomly from top 3 to add variety
  // while still preferring budget-appropriate proteins
  pool = [...pool].sort((a, b) => getCostPerGramProtein(a) - getCostPerGramProtein(b));
  const pickIdx = Math.floor(Math.random() * Math.min(3, pool.length));
  // Rotate pool so the randomly chosen candidate is tried first, rest follow in cost order
  pool = [...pool.slice(pickIdx), ...pool.slice(0, pickIdx)];

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

    // Cap eggs at 3 for snack slots, 4 for breakfast slots
    let effectiveMax = (mealType === 'dinner' && p.maxPerMealDinner) ? p.maxPerMealDinner : p.maxPerMeal;
    if (mealType === 'snack'     && p.name === 'eggs') effectiveMax = Math.min(effectiveMax, 3);
    if (mealType === 'breakfast' && p.name === 'eggs') effectiveMax = Math.min(effectiveMax, 4);
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
  // ── Exact protein quantity correction ────────────────────────────────────────
  // Carbs + vegs typically contribute ~8g protein per meal; subtract that so the
  // meal TOTAL lands on target rather than the protein ingredient alone.
  const NON_PROTEIN_INGREDIENT_PROTEIN_OFFSET = 0;

  const poolEntry = PROTEIN_POOL.find(p => p.name === proteinIngredient.name);
  if (poolEntry) {
    const proteinPerUnit = getProteinPerUnit(poolEntry);
    const costPerUnit    = getCostPerUnit(poolEntry);
    const calPerUnit     = dbMacros(poolEntry.name, 1, poolEntry.unit, null)?.calories || 0;

    // Target for the protein ingredient = meal target minus what carbs/vegs will contribute
    const ingredientProteinTarget = Math.max(0, macroTargets.protein - NON_PROTEIN_INGREDIENT_PROTEIN_OFFSET);

    // Exact quantity needed
    let exactQty = ingredientProteinTarget / proteinPerUnit;

    // Round: nearest whole for eggs/slices, nearest 0.5 for oz
    if (poolEntry.unit === 'each' || poolEntry.unit === 'slice') {
      exactQty = Math.max(1, Math.round(exactQty));
    } else {
      exactQty = Math.max(0.5, Math.round(exactQty * 2) / 2);
    }

    // Calorie ceiling: if protein at exactQty leaves no room for carbs/fat/vegs, reduce
    if (calPerUnit > 0 && exactQty * calPerUnit > macroTargets.calories - 60) {
      if (poolEntry.unit === 'each' || poolEntry.unit === 'slice') {
        exactQty = Math.max(1, Math.floor((macroTargets.calories - 60) / calPerUnit));
      } else {
        exactQty = Math.max(0.5, Math.floor(((macroTargets.calories - 60) / calPerUnit) * 2) / 2);
      }
    }

    // Mutate in place — generateDay sees the updated values via object reference
    proteinIngredient.quantity       = exactQty;
    proteinIngredient.actualProteinG = Math.round(exactQty * proteinPerUnit * 10) / 10;
    proteinIngredient.actualCost     = Math.round(exactQty * costPerUnit * 100) / 100;
  }

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
    const remainingCalAfterProtein = macroTargets.calories - proteinMacros.calories - 60;
    let quantity = Math.round((remainingCalAfterProtein * 0.70 / c.calories) * 4) / 4;
    if (c.unit === 'each' || c.unit === 'slice') {
      quantity = Math.max(1, Math.round(quantity));
    } else {
      quantity = Math.max(0.25, quantity);
    }
    quantity = Math.min(quantity, c.maxQty);

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
      const remainingCalAfterCarbs = macroTargets.calories - proteinMacros.calories - carbIngredient.macros.calories - 60;
      let quantity = remainingCalAfterCarbs > 40 ? Math.round((remainingCalAfterCarbs / f.calories) * 4) / 4 : 0;
      if (quantity === 0) continue;
      quantity = Math.max(0.25, Math.min(quantity, 3));
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

  const proteinGap = macroTargets.protein - totalMacros.protein;
  if (Math.abs(proteinGap) > 2 && poolEntry) {
    const proteinPerUnit = getProteinPerUnit(poolEntry);
    const calPerUnit = dbMacros(poolEntry.name, 1, poolEntry.unit, null)?.calories || 0;
    const adjustQty = proteinGap / proteinPerUnit;
    const newQty = poolEntry.unit === 'each' || poolEntry.unit === 'slice'
      ? Math.round(proteinIngredient.quantity + adjustQty)
      : Math.round((proteinIngredient.quantity + adjustQty) * 2) / 2;
    const calDelta = (newQty - proteinIngredient.quantity) * calPerUnit;
    if (totalMacros.calories + calDelta <= macroTargets.calories * 1.05) {
      proteinIngredient.quantity = Math.max(poolEntry.unit === 'each' ? 1 : 0.5, newQty);
      const newProteinMacros = roundMacros(dbMacros(proteinIngredient.name, proteinIngredient.quantity, proteinIngredient.unit, null));
      totalMacros = roundMacros(addMacros(
        Object.fromEntries(['calories','protein','carbs','fat'].map(k => [k, totalMacros[k] - proteinMacros[k]])),
        newProteinMacros
      ));
    }
  }

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

// ── SECTION 4b — SHARED HELPERS ──────────────────────────────────────────────

// Build a protein ingredient object for a named protein, sized to macroTarget
function makeProteinIngredient(proteinName, mealType, macroTarget, mealBudget) {
  const p = PROTEIN_POOL.find(entry => entry.name === proteinName);
  if (!p) return null;
  const proteinPerUnit = getProteinPerUnit(p);
  const costPerUnit    = getCostPerUnit(p);
  const budgetLimit    = mealBudget * 0.65;

  let quantity;
  if (p.unit === 'each' || p.unit === 'slice') {
    quantity = Math.ceil(macroTarget.protein / proteinPerUnit);
  } else {
    quantity = Math.round((macroTarget.protein / proteinPerUnit) * 2) / 2;
    quantity = Math.max(1, quantity);
  }

  let effectiveMax = (mealType === 'dinner' && p.maxPerMealDinner) ? p.maxPerMealDinner : p.maxPerMeal;
  if (mealType === 'snack'     && p.name === 'eggs') effectiveMax = Math.min(effectiveMax, 3);
  if (mealType === 'breakfast' && p.name === 'eggs') effectiveMax = Math.min(effectiveMax, 4);
  quantity = Math.min(quantity, effectiveMax);

  // Budget cap
  let actualCost = Math.round(quantity * costPerUnit * 100) / 100;
  if (actualCost > budgetLimit) {
    if (p.unit === 'each' || p.unit === 'slice') {
      quantity = Math.max(1, Math.floor(budgetLimit / costPerUnit));
    } else {
      quantity = Math.max(0.5, Math.round((budgetLimit / costPerUnit) * 2) / 2);
    }
    actualCost = Math.round(quantity * costPerUnit * 100) / 100;
  }

  // Calorie pre-check — reduce quantity if protein alone exceeds meal calorie ceiling
  if (macroTarget.calories != null) {
    const calPerUnit = dbMacros(p.name, 1, p.unit, null).calories || 0;
    if (calPerUnit > 0 && quantity * calPerUnit > macroTarget.calories * 1.20) {
      if (p.unit === 'each' || p.unit === 'slice') {
        quantity = Math.max(1, Math.floor((macroTarget.calories * 1.20) / calPerUnit));
      } else {
        quantity = Math.max(0.5, Math.round(((macroTarget.calories * 1.20) / calPerUnit) * 2) / 2);
      }
      actualCost = Math.round(quantity * costPerUnit * 100) / 100;
    }
  }

  // Fat ceiling check — reduce quantity if protein fat contribution
  // would exceed the meal fat target. This prevents high-fat proteins
  // like ground turkey from blowing the daily fat budget.
  if (macroTarget.fat != null && macroTarget.fat > 0) {
    const nutritionPerUnit = dbMacros(p.name, 1, p.unit, null);
    const fatPerUnit = nutritionPerUnit?.fat || 0;
    if (fatPerUnit > 0) {
      const maxQtyByFat = macroTarget.fat / fatPerUnit;
      if (quantity > maxQtyByFat) {
        if (p.unit === 'each' || p.unit === 'slice') {
          quantity = Math.max(1, Math.floor(maxQtyByFat));
        } else {
          quantity = Math.max(0.5, Math.round(maxQtyByFat * 2) / 2);
        }
        actualCost = Math.round(quantity * costPerUnit * 100) / 100;
      }
    }
  }

  return {
    name: p.name,
    quantity,
    unit: p.unit,
    actualProteinG: Math.round(quantity * proteinPerUnit * 10) / 10,
    actualCost,
    nutritionDbKey: p.name,
  };
}

// Accumulate weekly ingredient quantities and compute package-rounded total cost
function computeWeeklyPkgCost(dayAMeals, dayBMeals, order) {
  const totals = {}; // name → { qty, unit }

  function add(name, qty, unit) {
    if (!name || !qty) return;
    if (!totals[name]) totals[name] = { qty: 0, unit };
    totals[name].qty += qty;
  }

  function accumulate(meals, multiplier) {
    for (const mt of order) {
      const meal = meals[mt];
      if (!meal) continue;
      if (meal.protein) add(meal.protein.name, meal.protein.quantity * multiplier, meal.protein.unit);
      if (meal.carbs)   add(meal.carbs.name,   meal.carbs.quantity   * multiplier, meal.carbs.unit);
      if (meal.fat)     add(meal.fat.name,      meal.fat.quantity     * multiplier, meal.fat.unit);
      for (const v of (meal.vegetables || [])) add(v.name, v.quantity * multiplier, v.unit);
    }
  }

  accumulate(dayAMeals, 4);
  accumulate(dayBMeals, 3);

  let total = 0;
  for (const [name, { qty, unit }] of Object.entries(totals)) {
    total += pkgCost(name, qty, unit);
  }
  return Math.round(total * 100) / 100;
}

// ── SECTION 5 — PLAN ASSEMBLER ───────────────────────────────────────────────

function calculateBulkProteinOz(protein, dailyProteinG, mealType) {
  const mealProteinTarget = mealType === 'dinner'
    ? Math.round(dailyProteinG * 0.36)
    : Math.round(dailyProteinG * 0.28);
  const proteinPerOz = protein.proteinPer28g / 28;
  const ozNeeded = mealProteinTarget / proteinPerOz;
  const cap = protein.maxPerMealDinner || protein.maxPerMeal || 12;
  return Math.min(ozNeeded, cap);
}

function selectWeeklyProteins(budgetTier, weeklyBudget, proteinG, dietaryRestrictions, days, mealsPerDay) {
  const config = BUDGET_TIER_CONFIG[budgetTier] || BUDGET_TIER_CONFIG.moderate;

  // Filter protein pool by tier and dietary restrictions, exclude eggs and tofu
  // (those are handled separately as breakfast/snack proteins)
  const NON_BULK = new Set(['eggs', 'firm tofu']);
  let pool = PROTEIN_POOL.filter(p =>
    p.tiers.includes(budgetTier) &&
    !NON_BULK.has(p.name)
  );

  if (dietaryRestrictions.includes('vegetarian')) {
    pool = pool.filter(p => !MEAT_PROTEINS.has(p.name));
  }
  if (dietaryRestrictions.includes('vegan')) {
    pool = pool.filter(() => false); // no animal proteins
  }

  // For bulk model tiers prefer bulk cuts if defined
  if (config.model === 'bulk' && config.bulkCuts) {
    const bulkPool = pool.filter(p => config.bulkCuts.includes(p.name));
    if (bulkPool.length > 0) pool = bulkPool;
  }

  if (pool.length === 0) return { primaryProtein: null, secondaryProtein: null, weeklyProteinCost: 0, primarySeasoning: null, secondarySeasoning: null, sauceSuggestions: [] };

  // Sort by cost per gram then pick randomly from top 3
  pool = [...pool].sort((a, b) => getCostPerGramProtein(a) - getCostPerGramProtein(b));
  const pickIdx = Math.floor(Math.random() * Math.min(3, pool.length));
  pool = [...pool.slice(pickIdx), ...pool.slice(0, pickIdx)];

  const primaryProtein = pool[0];

  // Secondary protein — exclude primary, pick again
  let secondaryProtein = null;
  if (config.secondaryProteins > 0) {
    const secondaryPool = pool.filter(p => p.name !== primaryProtein.name);
    if (secondaryPool.length > 0) {
      const pickIdx2 = Math.floor(Math.random() * Math.min(3, secondaryPool.length));
      secondaryProtein = [...secondaryPool.slice(pickIdx2), ...secondaryPool.slice(0, pickIdx2)][0];
    }
  }

  // Calculate weekly protein cost based on bulk purchasing
  // Lunch and dinner slots need the full protein target
  // Day A repeats 4x per week, Day B repeats 3x per week
  const dayALunchDinnerOz = calculateBulkProteinOz(primaryProtein, proteinG, 'lunch') +
                             calculateBulkProteinOz(primaryProtein, proteinG, 'dinner');
  const dayBLunchDinnerOz = secondaryProtein
    ? calculateBulkProteinOz(secondaryProtein, proteinG, 'lunch') +
      calculateBulkProteinOz(secondaryProtein, proteinG, 'dinner')
    : dayALunchDinnerOz;

  const totalPrimaryOz   = dayALunchDinnerOz * 4; // Day A repeats 4x
  const totalSecondaryOz = dayBLunchDinnerOz * 3; // Day B repeats 3x

  const primaryCost   = Math.ceil(totalPrimaryOz / 16) * (primaryProtein.costPerOz * 16);
  const secondaryCost = secondaryProtein
    ? Math.ceil(totalSecondaryOz / 16) * (secondaryProtein.costPerOz * 16)
    : 0;

  const weeklyProteinCost = Math.round((primaryCost + secondaryCost) * 100) / 100;

  // Pick random bulk cook seasonings from the flavor database
  const seasonings = FLAVOR_DATABASE.bulkCookSeasonings;
  const primarySeasoning   = seasonings[Math.floor(Math.random() * seasonings.length)];
  const secondarySeasoning = secondaryProtein
    ? seasonings[Math.floor(Math.random() * seasonings.length)]
    : null;

  // Pick 3 random sauce options for Claude to vary meals with
  const allSauces = Object.values(FLAVOR_DATABASE.saucesAndFinishing).flat();
  const shuffled = [...allSauces].sort(() => Math.random() - 0.5);
  const sauceSuggestions = shuffled.slice(0, 3);

  return {
    primaryProtein,
    secondaryProtein,
    weeklyProteinCost,
    primarySeasoning,
    secondarySeasoning,
    sauceSuggestions,
  };
}

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

  const weeklyProteins = selectWeeklyProteins(
    budgetTier,
    weeklyBudget,
    macros.proteinG,
    dietaryRestrictions,
    days,
    mealsPerDay
  );

  // Per-meal macro targets (protein split matches generate-plan.js)
  // Meal plan targets 85% of daily macro targets.
  // This produces realistic portion sizes within budget constraints
  // and leaves ~15% for users to fill with snacks and personal choices.
  const PLAN_TARGET_RATIO = 0.85;
  const mealMacroTargets = {
    breakfast: {
      calories: Math.round(macros.target   * 0.18 * PLAN_TARGET_RATIO),
      protein:  Math.round(macros.proteinG * 0.18 * PLAN_TARGET_RATIO),
      carbs:    Math.round(macros.carbG    * 0.18 * PLAN_TARGET_RATIO),
      fat:      Math.round(macros.fatG     * 0.18 * PLAN_TARGET_RATIO),
    },
    snack: {
      calories: Math.round(macros.target   * 0.18 * PLAN_TARGET_RATIO),
      protein:  Math.round(macros.proteinG * 0.18 * PLAN_TARGET_RATIO),
      carbs:    Math.round(macros.carbG    * 0.18 * PLAN_TARGET_RATIO),
      fat:      Math.round(macros.fatG     * 0.18 * PLAN_TARGET_RATIO),
    },
    lunch: {
      calories: Math.round(macros.target   * 0.28 * PLAN_TARGET_RATIO),
      protein:  Math.round(macros.proteinG * 0.28 * PLAN_TARGET_RATIO),
      carbs:    Math.round(macros.carbG    * 0.28 * PLAN_TARGET_RATIO),
      fat:      Math.round(macros.fatG     * 0.28 * PLAN_TARGET_RATIO),
    },
    dinner: {
      calories: Math.round(macros.target   * 0.36 * PLAN_TARGET_RATIO),
      protein:  Math.round(macros.proteinG * 0.36 * PLAN_TARGET_RATIO),
      carbs:    Math.round(macros.carbG    * 0.36 * PLAN_TARGET_RATIO),
      fat:      Math.round(macros.fatG     * 0.36 * PLAN_TARGET_RATIO),
    },
  };

  const ORDER = ['breakfast', 'lunch', 'snack', 'dinner'];

  // Shared vegetable usage counter across both days (all 8 meal slots)
  const vegUsageCount = {};

  // dayAMeats: meat protein name(s) used on Day A — Day B must pick different meat(s)
  // dayACarbPerMeal: { breakfast: carbName, ... } from Day A, deprioritised in Day B
  function generateDay(dayLabel, dayAMeats = [], dayACarbPerMeal = {}, weeklyProteins = null) {
    const meals       = {};
    const carbPerMeal = {};
    const tierRules   = BUDGET_TIER_PROTEIN_RULES[budgetTier] || { maxMeatPerDay: 1 };
    const maxMeat     = tierRules.maxMeatPerDay;

    const eggsExcluded = dietaryRestrictions.some(r =>
      ['vegan', 'egg-free', 'no eggs'].includes(r.toLowerCase())
    );

    // ── Pre-select the day meat(s) ──────────────────────────────────────────
    // Day B excludes Day A meats so a different protein is chosen
    // Only run old selectProtein logic when bulk model is not active
    const dayMeats = [];

    if (!weeklyProteins || !weeklyProteins.primaryProtein) {
      // Force meat-only selection by excluding all non-meat protein names from the pool
      const nonMeatNames = PROTEIN_POOL
        .filter(p => !MEAT_PROTEINS.has(p.name))
        .map(p => p.name);

      // First meat (used for lunch; also for dinner if strict/moderate)
      // Exclude Day A meats AND all non-meat proteins so selectProtein must pick a meat
      // Also exclude canned tuna if the plan-wide 2-slot cap has been reached
      const tunaExclude = tunaSlotCount >= 2 ? ['canned tuna'] : [];
      let firstMeatResult = selectProtein(
        'lunch', mealMacroTargets.lunch.protein, budget.perMeal.lunch,
        budgetTier, [...dayAMeats, ...nonMeatNames, ...tunaExclude], dietaryRestrictions, mealMacroTargets.lunch.calories
      );
      // If exclusion of Day A meats left the pool empty, allow any meat (relax Day A exclusion)
      if (!firstMeatResult) {
        firstMeatResult = selectProtein(
          'lunch', mealMacroTargets.lunch.protein, budget.perMeal.lunch,
          budgetTier, [...nonMeatNames, ...tunaExclude], dietaryRestrictions, mealMacroTargets.lunch.calories
        );
      }
      if (firstMeatResult && MEAT_PROTEINS.has(firstMeatResult.name)) {
        dayMeats.push(firstMeatResult.name);
        if (firstMeatResult.name === 'canned tuna') tunaSlotCount++;
      }

      // Second meat for dinner (flexible+) — must differ from first and from Day A meats
      if (maxMeat >= 2) {
        const tunaExclude2 = tunaSlotCount >= 2 ? ['canned tuna'] : [];
        const secondMeatResult = selectProtein(
          'dinner', mealMacroTargets.dinner.protein, budget.perMeal.dinner,
          budgetTier, [...dayAMeats, ...dayMeats, ...nonMeatNames, ...tunaExclude2], dietaryRestrictions, mealMacroTargets.dinner.calories
        );
        if (secondMeatResult && MEAT_PROTEINS.has(secondMeatResult.name)) {
          dayMeats.push(secondMeatResult.name);
          if (secondMeatResult.name === 'canned tuna') tunaSlotCount++;
        }
      }
    }

    const lunchMeatName  = dayMeats[0] || null;
    const dinnerMeatName = dayMeats[1] || dayMeats[0] || null; // same meat for strict/moderate

    // When bulk model is active, derive effective proteins from weeklyProteins
    const effectiveLunchMeat = (weeklyProteins?.primaryProtein && dayLabel === 'DayA')
      ? weeklyProteins.primaryProtein.name
      : (weeklyProteins?.secondaryProtein && dayLabel === 'DayB')
        ? weeklyProteins.secondaryProtein.name
        : (weeklyProteins?.primaryProtein?.name || lunchMeatName);
    const effectiveDinnerMeat = effectiveLunchMeat; // same bulk protein for both lunch and dinner

    const usedProteins = [...dayMeats];

    // ── Assign proteins to slots ────────────────────────────────────────────
    for (const mealType of ORDER) {
      const mealBudget  = budget.perMeal[mealType];
      const macroTarget = mealMacroTargets[mealType];

      let proteinIngredient;
      let coldFormatOnly = false;

      if (weeklyProteins && weeklyProteins.primaryProtein && (mealType === 'lunch' || mealType === 'dinner')) {
        const bulkProtein = dayLabel === 'DayA'
          ? weeklyProteins.primaryProtein
          : (weeklyProteins.secondaryProtein || weeklyProteins.primaryProtein);
        proteinIngredient = makeProteinIngredient(bulkProtein.name, mealType, macroTarget, mealBudget);
      } else if (mealType === 'breakfast') {
        if (!eggsExcluded) {
          proteinIngredient = makeProteinIngredient('eggs', 'breakfast', macroTarget, mealBudget);
        } else {
          proteinIngredient = effectiveLunchMeat
            ? makeProteinIngredient(effectiveLunchMeat, 'breakfast', macroTarget, mealBudget)
            : selectProtein('breakfast', macroTarget.protein, mealBudget, budgetTier, [], dietaryRestrictions, macroTarget.calories);
        }
      } else if (mealType === 'snack') {
        if (!eggsExcluded) {
          proteinIngredient = makeProteinIngredient('eggs', 'snack', macroTarget, mealBudget);
          coldFormatOnly = true;
        } else {
          proteinIngredient = effectiveLunchMeat
            ? makeProteinIngredient(effectiveLunchMeat, 'snack', macroTarget, mealBudget)
            : selectProtein('snack', macroTarget.protein, mealBudget, budgetTier, [], dietaryRestrictions, macroTarget.calories);
        }
      } else if (mealType === 'lunch') {
        proteinIngredient = effectiveLunchMeat
          ? makeProteinIngredient(effectiveLunchMeat, 'lunch', macroTarget, mealBudget)
          : selectProtein('lunch', macroTarget.protein, mealBudget, budgetTier, [], dietaryRestrictions, macroTarget.calories);
      } else { // dinner
        proteinIngredient = effectiveDinnerMeat
          ? makeProteinIngredient(effectiveDinnerMeat, 'dinner', macroTarget, mealBudget)
          : selectProtein('dinner', macroTarget.protein, mealBudget, budgetTier, [], dietaryRestrictions, macroTarget.calories);
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
        ...(coldFormatOnly ? { coldFormatOnly: true } : {}),
      };

    }

    // ── Budget enforcement swap (strict/moderate only) ──────────────────────
    // Check before dayTotals so all variables (budget, mealMacroTargets, dayMeats) are in scope.
    // Proxy weekly cost = dayCost × 7 / days (days = 2 for a standard A/B week split 4/3).
    if ((budgetTier === 'strict' || budgetTier === 'moderate') && !weeklyProteins) {
      const dayCost = ORDER.reduce((s, mt) => s + (meals[mt]?.totalCost || 0), 0);
      const projectedWeekly = dayCost * (7 / days);
      if (projectedWeekly > weeklyBudget * 1.15) {
        // Find the most expensive protein used in this day's meals (by per-meal actualCost)
        let mostExpensiveName = null;
        let mostExpensiveCost = -1;
        for (const mealType of ORDER) {
          const protein = meals[mealType]?.protein;
          if (!protein) continue;
          if (protein.actualCost > mostExpensiveCost) {
            mostExpensiveCost = protein.actualCost;
            mostExpensiveName = protein.name;
          }
        }

        if (mostExpensiveName) {
          const usedThisDay = new Set(dayMeats);
          usedThisDay.add(mostExpensiveName);
          // Replacement must be a meat not already used today, cheapest first
          const candidates = PROTEIN_POOL
            .filter(p => MEAT_PROTEINS.has(p.name) && !usedThisDay.has(p.name))
            .sort((a, b) => getCostPerGramProtein(a) - getCostPerGramProtein(b));

          if (candidates.length > 0) {
            const replacement = candidates[0];
            for (const mealType of ORDER) {
              const meal = meals[mealType];
              if (!meal?.protein || meal.protein.name !== mostExpensiveName) continue;
              const swapped = makeProteinIngredient(replacement.name, mealType, mealMacroTargets[mealType], budget.perMeal[mealType]);
              if (swapped) {
                meal.protein = { name: swapped.name, quantity: swapped.quantity, unit: swapped.unit, actualProteinG: swapped.actualProteinG, actualCost: swapped.actualCost, nutritionDbKey: swapped.nutritionDbKey };
                let m = roundMacros(dbMacros(meal.protein.name, meal.protein.quantity, meal.protein.unit, null));
                if (meal.carbs)  m = addMacros(m, meal.carbs.macros);
                if (meal.fat)    m = addMacros(m, meal.fat.macros);
                for (const v of meal.vegetables) m = addMacros(m, v.macros);
                meal.totalMacros = roundMacros(m);
                meal.totalCost = Math.round(((meal.protein.actualCost || 0) + (meal.carbs?.cost || 0) + (meal.fat?.cost || 0) + meal.vegetables.reduce((s, v) => s + v.cost, 0)) * 100) / 100;
              }
            }
            const newDayCost = ORDER.reduce((s, mt) => s + (meals[mt]?.totalCost || 0), 0);
            if (newDayCost * (7 / days) > weeklyBudget * 1.15) {
              console.warn(`[template] ${dayLabel} budget swap (${mostExpensiveName} → ${replacement.name}) still over 115% of $${weeklyBudget}`);
            }
          }
        }
      }
    }

    const dayTotals = {
      calories: Math.round(ORDER.reduce((s, mt) => s + (meals[mt]?.totalMacros?.calories || 0), 0)),
      protein:  Math.round(ORDER.reduce((s, mt) => s + (meals[mt]?.totalMacros?.protein  || 0), 0) * 10) / 10,
      carbs:    Math.round(ORDER.reduce((s, mt) => s + (meals[mt]?.totalMacros?.carbs    || 0), 0) * 10) / 10,
      fat:      Math.round(ORDER.reduce((s, mt) => s + (meals[mt]?.totalMacros?.fat      || 0), 0) * 10) / 10,
      cost:     Math.round(ORDER.reduce((s, mt) => s + (meals[mt]?.totalCost             || 0), 0) * 100) / 100,
    };

    return { meals, dayTotals, dayMeats, carbPerMeal };
  }

  // Shared tuna slot counter across both days — cap at 2 slots total (mercury safety)
  let tunaSlotCount = 0;

  const dayAResult = generateDay('DayA', [], {}, weeklyProteins);
  const dayBResult = generateDay('DayB', dayAResult.dayMeats, dayAResult.carbPerMeal, weeklyProteins);

  // Weekly projected cost: package-rounding math (Change 5)
  let weeklyProjectedCost = computeWeeklyPkgCost(dayAResult.meals, dayBResult.meals, ORDER);

  // If over 110% of weeklyBudget, reduce non-protein ingredients by 20%
  if (weeklyProjectedCost > weeklyBudget * 1.10) {
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

    weeklyProjectedCost = computeWeeklyPkgCost(dayAResult.meals, dayBResult.meals, ORDER);
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
    weeklyProteins,
  };
}

// ── SECTION 6 — EXPORT ───────────────────────────────────────────────────────

export { allocateBudget, selectProtein, balanceMacros, generateMealTemplate };
