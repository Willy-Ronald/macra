// ─────────────────────────────────────────────────────────────────────────────
// Grocery Cost Estimator
// Converts AI-generated ingredient quantities into real package counts and
// approximate retail costs.  All prices are US national averages (2024).
// ─────────────────────────────────────────────────────────────────────────────

// Each entry: { size, unit, package (display label), avgCost (USD) }
// unit is the unit of the package size field.
// 'count' / 'each' / 'head' = sold by piece, not weight.
const PACKAGE_SIZES = {
  // ── Oils & condiments ───────────────────────────────────────────────────
  "olive oil":       { size: 16,   unit: "oz",    package: "bottle",      avgCost: 8.99 },
  "extra virgin olive oil": { size: 16, unit: "oz", package: "bottle",    avgCost: 9.99 },
  "vegetable oil":   { size: 48,   unit: "oz",    package: "bottle",      avgCost: 5.99 },
  "canola oil":      { size: 48,   unit: "oz",    package: "bottle",      avgCost: 4.99 },
  "sesame oil":      { size: 8,    unit: "oz",    package: "bottle",      avgCost: 6.49 },
  "coconut oil":     { size: 14,   unit: "oz",    package: "jar",         avgCost: 7.99 },
  "soy sauce":       { size: 10,   unit: "oz",    package: "bottle",      avgCost: 3.49 },
  "fish sauce":      { size: 10,   unit: "oz",    package: "bottle",      avgCost: 4.99 },
  "hot sauce":       { size: 5,    unit: "oz",    package: "bottle",      avgCost: 3.29 },
  "sriracha":        { size: 17,   unit: "oz",    package: "bottle",      avgCost: 4.49 },
  "vinegar":         { size: 16,   unit: "oz",    package: "bottle",      avgCost: 2.99 },
  "rice vinegar":    { size: 10,   unit: "oz",    package: "bottle",      avgCost: 3.49 },
  "honey":           { size: 12,   unit: "oz",    package: "bottle",      avgCost: 5.99 },
  "maple syrup":     { size: 12,   unit: "oz",    package: "bottle",      avgCost: 9.99 },
  "worcestershire":  { size: 10,   unit: "oz",    package: "bottle",      avgCost: 3.29 },
  "oyster sauce":    { size: 9,    unit: "oz",    package: "bottle",      avgCost: 3.99 },
  "hoisin sauce":    { size: 8,    unit: "oz",    package: "jar",         avgCost: 3.49 },
  "tomato paste":    { size: 6,    unit: "oz",    package: "can",         avgCost: 1.29 },
  "dijon mustard":   { size: 8,    unit: "oz",    package: "jar",         avgCost: 3.49 },

  // ── Proteins – meat ─────────────────────────────────────────────────────
  "chicken breast":  { size: 16,   unit: "oz",    package: "lb",          avgCost: 4.99 },
  "chicken thigh":   { size: 16,   unit: "oz",    package: "lb",          avgCost: 3.99 },
  "ground beef":     { size: 16,   unit: "oz",    package: "lb",          avgCost: 5.99 },
  "ground turkey":   { size: 16,   unit: "oz",    package: "lb",          avgCost: 4.49 },
  "pork chop":       { size: 16,   unit: "oz",    package: "lb",          avgCost: 4.99 },
  "pork":            { size: 16,   unit: "oz",    package: "lb",          avgCost: 4.99 },
  "bacon":           { size: 12,   unit: "oz",    package: "pack",        avgCost: 6.99 },
  "sausage":         { size: 12,   unit: "oz",    package: "pack",        avgCost: 5.99 },
  "steak":           { size: 16,   unit: "oz",    package: "lb",          avgCost: 12.99 },
  "beef":            { size: 16,   unit: "oz",    package: "lb",          avgCost: 8.99 },
  "turkey":          { size: 16,   unit: "oz",    package: "lb",          avgCost: 5.99 },
  "lamb":            { size: 16,   unit: "oz",    package: "lb",          avgCost: 11.99 },

  // ── Proteins – seafood ───────────────────────────────────────────────────
  "salmon":          { size: 16,   unit: "oz",    package: "lb",          avgCost: 12.99 },
  "tuna":            { size: 16,   unit: "oz",    package: "lb",          avgCost: 9.99 },
  "shrimp":          { size: 16,   unit: "oz",    package: "lb",          avgCost: 11.99 },
  "tilapia":         { size: 16,   unit: "oz",    package: "lb",          avgCost: 6.99 },
  "cod":             { size: 16,   unit: "oz",    package: "lb",          avgCost: 8.99 },
  "canned tuna":     { size: 5,    unit: "oz",    package: "can",         avgCost: 1.49 },

  // ── Proteins – other ─────────────────────────────────────────────────────
  "eggs":            { size: 12,   unit: "count", package: "dozen",       avgCost: 4.29 },
  "egg":             { size: 12,   unit: "count", package: "dozen",       avgCost: 4.29 },
  "tofu":            { size: 14,   unit: "oz",    package: "block",       avgCost: 2.99 },

  // ── Produce – vegetables ─────────────────────────────────────────────────
  "tomato":          { size: 1,    unit: "each",  package: "piece",       avgCost: 0.89 },
  "tomatoes":        { size: 1,    unit: "each",  package: "piece",       avgCost: 0.89 },
  "cherry tomato":   { size: 10,   unit: "oz",    package: "container",   avgCost: 3.49 },
  "bell pepper":     { size: 1,    unit: "each",  package: "piece",       avgCost: 1.29 },
  "onion":           { size: 1,    unit: "each",  package: "piece",       avgCost: 0.79 },
  "red onion":       { size: 1,    unit: "each",  package: "piece",       avgCost: 0.99 },
  "garlic":          { size: 1,    unit: "head",  package: "head",        avgCost: 0.59 },
  "potato":          { size: 1,    unit: "each",  package: "piece",       avgCost: 0.69 },
  "sweet potato":    { size: 1,    unit: "each",  package: "piece",       avgCost: 1.29 },
  "carrot":          { size: 16,   unit: "oz",    package: "bag",         avgCost: 1.49 },
  "broccoli":        { size: 1,    unit: "head",  package: "head",        avgCost: 2.49 },
  "cauliflower":     { size: 1,    unit: "head",  package: "head",        avgCost: 3.49 },
  "spinach":         { size: 10,   unit: "oz",    package: "bag",         avgCost: 3.99 },
  "lettuce":         { size: 1,    unit: "head",  package: "head",        avgCost: 2.49 },
  "romaine":         { size: 1,    unit: "head",  package: "head",        avgCost: 2.99 },
  "cucumber":        { size: 1,    unit: "each",  package: "piece",       avgCost: 0.99 },
  "zucchini":        { size: 1,    unit: "each",  package: "piece",       avgCost: 1.49 },
  "mushroom":        { size: 8,    unit: "oz",    package: "package",     avgCost: 3.99 },
  "asparagus":       { size: 12,   unit: "oz",    package: "bunch",       avgCost: 4.99 },
  "green beans":     { size: 12,   unit: "oz",    package: "bag",         avgCost: 2.99 },
  "kale":            { size: 1,    unit: "bunch", package: "bunch",       avgCost: 2.49 },
  "celery":          { size: 1,    unit: "bunch", package: "bunch",       avgCost: 1.99 },
  "corn":            { size: 1,    unit: "each",  package: "ear",         avgCost: 0.79 },
  "edamame":         { size: 12,   unit: "oz",    package: "bag",         avgCost: 3.49 },

  // ── Produce – fruits ─────────────────────────────────────────────────────
  "banana":          { size: 1,    unit: "each",  package: "piece",       avgCost: 0.25 },
  "apple":           { size: 1,    unit: "each",  package: "piece",       avgCost: 0.69 },
  "orange":          { size: 1,    unit: "each",  package: "piece",       avgCost: 0.79 },
  "lemon":           { size: 1,    unit: "each",  package: "piece",       avgCost: 0.59 },
  "lime":            { size: 1,    unit: "each",  package: "piece",       avgCost: 0.39 },
  "avocado":         { size: 1,    unit: "each",  package: "piece",       avgCost: 1.49 },
  "strawberry":      { size: 16,   unit: "oz",    package: "container",   avgCost: 4.99 },
  "blueberry":       { size: 6,    unit: "oz",    package: "container",   avgCost: 4.99 },
  "mango":           { size: 1,    unit: "each",  package: "piece",       avgCost: 1.49 },

  // ── Grains & pantry ──────────────────────────────────────────────────────
  "rice":            { size: 32,   unit: "oz",    package: "bag",         avgCost: 3.99 },
  "brown rice":      { size: 32,   unit: "oz",    package: "bag",         avgCost: 4.99 },
  "jasmine rice":    { size: 32,   unit: "oz",    package: "bag",         avgCost: 4.49 },
  "white rice":      { size: 32,   unit: "oz",    package: "bag",         avgCost: 3.99 },
  "pasta":           { size: 16,   unit: "oz",    package: "box",         avgCost: 1.99 },
  "spaghetti":       { size: 16,   unit: "oz",    package: "box",         avgCost: 1.99 },
  "quinoa":          { size: 16,   unit: "oz",    package: "bag",         avgCost: 5.99 },
  "oats":            { size: 42,   unit: "oz",    package: "container",   avgCost: 5.49 },
  "oatmeal":         { size: 42,   unit: "oz",    package: "container",   avgCost: 5.49 },
  "bread":           { size: 20,   unit: "oz",    package: "loaf",        avgCost: 3.49 },
  "tortilla":        { size: 12,   unit: "count", package: "pack",        avgCost: 3.99 },
  "pita":            { size: 12,   unit: "oz",    package: "pack",        avgCost: 3.49 },
  "flour":           { size: 80,   unit: "oz",    package: "bag",         avgCost: 4.99 },
  "cornstarch":      { size: 16,   unit: "oz",    package: "box",         avgCost: 2.29 },
  "panko":           { size: 8,    unit: "oz",    package: "canister",    avgCost: 2.99 },

  // ── Dairy ────────────────────────────────────────────────────────────────
  "milk":            { size: 64,   unit: "oz",    package: "half gallon", avgCost: 3.49 },
  "cheese":          { size: 8,    unit: "oz",    package: "bag",         avgCost: 4.99 },
  "cheddar":         { size: 8,    unit: "oz",    package: "block",       avgCost: 4.99 },
  "mozzarella":      { size: 8,    unit: "oz",    package: "bag",         avgCost: 4.49 },
  "parmesan":        { size: 5,    unit: "oz",    package: "container",   avgCost: 5.99 },
  "feta":            { size: 6,    unit: "oz",    package: "container",   avgCost: 4.99 },
  "yogurt":          { size: 32,   unit: "oz",    package: "container",   avgCost: 4.99 },
  "greek yogurt":    { size: 32,   unit: "oz",    package: "container",   avgCost: 5.99 },
  "butter":          { size: 16,   unit: "oz",    package: "pack",        avgCost: 5.49 },
  "cream cheese":    { size: 8,    unit: "oz",    package: "block",       avgCost: 3.49 },
  "sour cream":      { size: 16,   unit: "oz",    package: "container",   avgCost: 3.29 },
  "cottage cheese":  { size: 16,   unit: "oz",    package: "container",   avgCost: 3.99 },
  "heavy cream":     { size: 16,   unit: "oz",    package: "carton",      avgCost: 3.99 },

  // ── Canned & packaged ────────────────────────────────────────────────────
  "black beans":     { size: 15,   unit: "oz",    package: "can",         avgCost: 1.29 },
  "beans":           { size: 15,   unit: "oz",    package: "can",         avgCost: 1.29 },
  "chickpeas":       { size: 15,   unit: "oz",    package: "can",         avgCost: 1.49 },
  "lentils":         { size: 16,   unit: "oz",    package: "bag",         avgCost: 2.49 },
  "tomato sauce":    { size: 15,   unit: "oz",    package: "can",         avgCost: 1.49 },
  "diced tomatoes":  { size: 14.5, unit: "oz",    package: "can",         avgCost: 1.29 },
  "coconut milk":    { size: 13.5, unit: "oz",    package: "can",         avgCost: 2.49 },
  "chicken broth":   { size: 32,   unit: "oz",    package: "carton",      avgCost: 2.99 },
  "beef broth":      { size: 32,   unit: "oz",    package: "carton",      avgCost: 2.99 },
  "broth":           { size: 32,   unit: "oz",    package: "carton",      avgCost: 2.99 },
  "peanut butter":   { size: 16,   unit: "oz",    package: "jar",         avgCost: 4.49 },
  "almond butter":   { size: 12,   unit: "oz",    package: "jar",         avgCost: 8.99 },
};

// Spices / pantry staples assumed already on-hand — excluded from cost total
const PANTRY_ITEMS = new Set([
  "salt", "pepper", "black pepper", "white pepper",
  "garlic powder", "onion powder", "cumin", "paprika", "smoked paprika",
  "chili powder", "cayenne", "cayenne pepper", "red pepper flakes",
  "oregano", "basil", "thyme", "rosemary", "bay leaf", "bay leaves",
  "cinnamon", "nutmeg", "turmeric", "ginger powder", "curry powder",
  "italian seasoning", "everything bagel seasoning",
  "baking powder", "baking soda", "vanilla extract",
  "cooking spray", "olive oil spray",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Unit → ounces conversion table (for weight & volume)
// Count-based units are handled separately.
// ─────────────────────────────────────────────────────────────────────────────
const TO_OZ = {
  "oz": 1, "ounce": 1, "ounces": 1,
  "fl oz": 1, "fluid oz": 1,
  "lb": 16, "lbs": 16, "pound": 16, "pounds": 16,
  "g": 0.03527, "gram": 0.03527, "grams": 0.03527,
  "kg": 35.274, "kilogram": 35.274,
  "cup": 8, "cups": 8,
  "tbsp": 0.5, "tablespoon": 0.5, "tablespoons": 0.5,
  "tsp": 0.167, "teaspoon": 0.167, "teaspoons": 0.167,
  "ml": 0.0338, "milliliter": 0.0338, "milliliters": 0.0338,
  "l": 33.814, "liter": 33.814, "liters": 33.814,
};

const COUNT_UNITS = new Set([
  "each", "count", "head", "heads", "piece", "pieces",
  "slice", "slices", "serving", "servings", "clove", "cloves",
]);

function toOz(amount, unit) {
  const u = (unit || "").toLowerCase().trim();
  if (COUNT_UNITS.has(u)) return null; // count-based, handle separately
  return (TO_OZ[u] ?? 1) * amount;    // unknown unit → treat as oz
}

// ─────────────────────────────────────────────────────────────────────────────
// Name normalization — strip adjectives, de-plural, return lowercase base
// ─────────────────────────────────────────────────────────────────────────────
const STRIP_PREFIXES = /^(fresh|frozen|raw|cooked|dried|organic|large|small|medium|extra|whole|boneless|skinless|bone-in|shredded|chopped|diced|sliced|minced|grated|crumbled|extra\s+virgin)\s+/gi;
const STRIP_SUFFIXES = /\s+(breast|thigh|fillet|filet|steak|chop|loin|wing|leg|drumstick)s?$/i;

function normalizeName(name) {
  let n = name.toLowerCase().trim();
  // Strip common prep/quality adjectives iteratively (some items have multiple)
  let prev;
  do {
    prev = n;
    n = n.replace(STRIP_PREFIXES, "");
  } while (n !== prev);
  n = n.replace(STRIP_SUFFIXES, "");
  return n.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Find the best PACKAGE_SIZES match for a normalized ingredient name.
// Strategy: exact → prefix → superstring → substring (longest match wins)
// ─────────────────────────────────────────────────────────────────────────────
function findPackage(rawName) {
  const n = normalizeName(rawName);

  if (PACKAGE_SIZES[n]) return PACKAGE_SIZES[n];

  // Try removing trailing 's'/'es' for plurals
  const depl = n.endsWith("es") ? n.slice(0, -2) : n.endsWith("s") ? n.slice(0, -1) : null;
  if (depl && PACKAGE_SIZES[depl]) return PACKAGE_SIZES[depl];

  // Fuzzy: find all keys that are substrings of n, pick longest
  const keys = Object.keys(PACKAGE_SIZES);
  const contained = keys.filter(k => n.includes(k)).sort((a, b) => b.length - a.length);
  if (contained.length) return PACKAGE_SIZES[contained[0]];

  // Fuzzy: find all keys where n is a substring of key, pick shortest
  const containing = keys.filter(k => k.includes(n)).sort((a, b) => a.length - b.length);
  if (containing.length) return PACKAGE_SIZES[containing[0]];

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimate packages + cost for a single grocery item
// Returns { pkgCount, pkgLabel, cost, isPantry }
// ─────────────────────────────────────────────────────────────────────────────
export function estimateItem(name, qty, unit) {
  const normalized = normalizeName(name);
  const isPantry = PANTRY_ITEMS.has(normalized);

  if (isPantry) return { pkgCount: 0, pkgLabel: null, cost: 0, isPantry: true };

  const pkg = findPackage(name);
  if (!pkg) return { pkgCount: null, pkgLabel: null, cost: null, isPantry: false };

  const pkgUnit = pkg.unit.toLowerCase();
  const itemUnit = (unit || "").toLowerCase().trim();

  let pkgCount;

  // ── Count-based (eggs, tortillas, etc.) ────────────────────────────────
  if (pkgUnit === "count" || pkgUnit === "each" || pkgUnit === "head" || pkgUnit === "bunch") {
    // qty is already a count
    pkgCount = Math.ceil(qty / pkg.size);
  } else {
    // ── Weight / volume ────────────────────────────────────────────────────
    const neededOz = toOz(qty, itemUnit) ?? qty; // fallback: treat as oz
    const pkgOz    = toOz(pkg.size, pkgUnit) ?? pkg.size;
    pkgCount = Math.max(1, Math.ceil(neededOz / pkgOz));
  }

  const cost = pkgCount * pkg.avgCost;

  // Build label: "1 lb", "2 cans", "1 dozen", etc.
  const pkgLabel = pkgCount === 1
    ? `1 ${pkg.package}`
    : `${pkgCount} ${pkg.package}${pkg.package.endsWith("s") || pkg.package === "bunch" ? "" : "s"}`;

  return { pkgCount, pkgLabel, cost, isPantry: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimate cost for an entire planCategories array
// Returns: { itemMap, totalCost, withinBudget, overBy, underBy, pctOfBudget }
// itemMap: Map<itemId, { pkgLabel, cost, isPantry }>
// ─────────────────────────────────────────────────────────────────────────────
export function estimateGroceryList(planCategories, weeklyBudget) {
  const itemMap = new Map();
  let totalCost = 0;
  let unknownCount = 0;

  for (const cat of planCategories) {
    for (const item of cat.items) {
      const est = estimateItem(item.name, item.qty, item.unit);
      itemMap.set(item.id, est);
      if (est.cost !== null) {
        totalCost += est.cost;
      } else {
        unknownCount++;
      }
    }
  }

  // Add a $3 buffer per item with no pricing data (covers misc spices, produce, etc.)
  const buffer = unknownCount * 3;
  const total = totalCost + buffer;

  const budget = weeklyBudget ?? null;
  const withinBudget = budget !== null ? total <= budget : null;
  const diff = budget !== null ? Math.abs(budget - total) : null;
  const pct  = budget !== null ? Math.min(Math.round((total / budget) * 100), 999) : null;

  return { itemMap, totalCost, buffer, total, budget, withinBudget, diff, pct, unknownCount };
}
