// ─────────────────────────────────────────────────────────────────────────────
// Grocery Cost Estimator
// Prices verified against Kroger March 2026.
// ─────────────────────────────────────────────────────────────────────────────

// Each entry: { size, unit, package (display label), avgCost (USD) }
// 'count' / 'each' / 'head' / 'bunch' = sold by piece, not weight.
// NOTE: bare "tuna" is intentionally absent — fuzzy matching falls through
//   to "canned tuna" ($1.00/5oz can), which is always correct for budget plans.
const PACKAGE_SIZES = {

  // ── Proteins — eggs & poultry ───────────────────────────────────────────
  "eggs":                          { size: 12,  unit: "count", package: "dozen",   avgCost: 1.79 },
  "egg":                           { size: 12,  unit: "count", package: "dozen",   avgCost: 1.79 },
  "large eggs":                    { size: 18,  unit: "count", package: "pack",    avgCost: 2.65 },
  "chicken thigh":                 { size: 16,  unit: "oz",    package: "lb",      avgCost: 2.49 },
  "chicken thighs":                { size: 16,  unit: "oz",    package: "lb",      avgCost: 2.49 },
  "boneless chicken thighs":       { size: 16,  unit: "oz",    package: "lb",      avgCost: 2.49 },
  "bone-in chicken thighs":        { size: 16,  unit: "oz",    package: "lb",      avgCost: 1.79 },
  "chicken breast":                { size: 16,  unit: "oz",    package: "lb",      avgCost: 5.49 },
  "boneless skinless chicken breast": { size: 16, unit: "oz",  package: "lb",      avgCost: 5.49 },
  "ground turkey":                 { size: 16,  unit: "oz",    package: "lb",      avgCost: 4.99 },
  "lean ground turkey":            { size: 16,  unit: "oz",    package: "lb",      avgCost: 4.99 },
  "extra lean ground turkey":      { size: 16,  unit: "oz",    package: "lb",      avgCost: 4.99 },
  "turkey":                        { size: 16,  unit: "oz",    package: "lb",      avgCost: 4.99 },

  // ── Proteins — beef ─────────────────────────────────────────────────────
  "ground beef":                   { size: 16,  unit: "oz",    package: "lb",      avgCost: 8.99 },
  "lean ground beef":              { size: 16,  unit: "oz",    package: "lb",      avgCost: 8.99 },
  "extra lean ground beef":        { size: 16,  unit: "oz",    package: "lb",      avgCost: 10.99 },
  "beef":                          { size: 16,  unit: "oz",    package: "lb",      avgCost: 8.99 },
  "sirloin steak":                 { size: 8,   unit: "oz",    package: "steak",   avgCost: 9.68 },
  "ribeye steak":                  { size: 10,  unit: "oz",    package: "steak",   avgCost: 18.99 },
  "ny strip steak":                { size: 10,  unit: "oz",    package: "steak",   avgCost: 20.99 },
  "steak":                         { size: 8,   unit: "oz",    package: "steak",   avgCost: 9.68 },
  "lamb":                          { size: 16,  unit: "oz",    package: "lb",      avgCost: 11.99 },

  // ── Proteins — pork ─────────────────────────────────────────────────────
  "pork chop":                     { size: 16,  unit: "oz",    package: "lb",      avgCost: 5.99 },
  "pork chops":                    { size: 16,  unit: "oz",    package: "lb",      avgCost: 5.99 },
  "boneless pork chops":           { size: 16,  unit: "oz",    package: "lb",      avgCost: 5.99 },
  "pork loin":                     { size: 16,  unit: "oz",    package: "lb",      avgCost: 1.79 },
  "pork tenderloin":               { size: 16,  unit: "oz",    package: "lb",      avgCost: 3.99 },
  "pork shoulder":                 { size: 16,  unit: "oz",    package: "lb",      avgCost: 3.99 },
  "pork":                          { size: 16,  unit: "oz",    package: "lb",      avgCost: 3.99 },
  "baby back ribs":                { size: 16,  unit: "oz",    package: "lb",      avgCost: 3.99 },
  "bacon":                         { size: 12,  unit: "oz",    package: "pack",    avgCost: 4.99 },
  "thick cut bacon":               { size: 12,  unit: "oz",    package: "pack",    avgCost: 7.99 },
  "turkey bacon":                  { size: 12,  unit: "oz",    package: "pack",    avgCost: 4.79 },
  "sausage":                       { size: 12,  unit: "oz",    package: "pack",    avgCost: 2.99 },
  "breakfast sausage":             { size: 12,  unit: "oz",    package: "pack",    avgCost: 2.99 },

  // ── Proteins — seafood ───────────────────────────────────────────────────
  // NOTE: bare "tuna" intentionally omitted — falls through fuzzy to "canned tuna"
  "canned tuna":                   { size: 5,   unit: "oz",    package: "can",     avgCost: 1.00 },
  "tuna can":                      { size: 5,   unit: "oz",    package: "can",     avgCost: 1.00 },
  "tuna in water":                 { size: 5,   unit: "oz",    package: "can",     avgCost: 1.00 },
  "salmon":                        { size: 16,  unit: "oz",    package: "lb",      avgCost: 10.99 },
  "salmon fillet":                 { size: 16,  unit: "oz",    package: "lb",      avgCost: 10.99 },
  "frozen salmon":                 { size: 16,  unit: "oz",    package: "lb",      avgCost: 9.49 },
  "shrimp":                        { size: 12,  unit: "oz",    package: "bag",     avgCost: 6.99 },
  "cooked shrimp":                 { size: 12,  unit: "oz",    package: "bag",     avgCost: 6.99 },
  "raw shrimp":                    { size: 12,  unit: "oz",    package: "bag",     avgCost: 6.99 },
  "jumbo shrimp":                  { size: 16,  unit: "oz",    package: "lb",      avgCost: 10.99 },
  "tilapia":                       { size: 16,  unit: "oz",    package: "lb",      avgCost: 5.00 },
  "cod":                           { size: 16,  unit: "oz",    package: "lb",      avgCost: 8.99 },

  // ── Proteins — deli ─────────────────────────────────────────────────────
  "deli turkey":                   { size: 9,   unit: "oz",    package: "pack",    avgCost: 3.99 },
  "sliced turkey":                 { size: 9,   unit: "oz",    package: "pack",    avgCost: 3.99 },
  "deli ham":                      { size: 9,   unit: "oz",    package: "pack",    avgCost: 4.49 },
  "sliced ham":                    { size: 9,   unit: "oz",    package: "pack",    avgCost: 4.49 },
  "pepperoni":                     { size: 7,   unit: "oz",    package: "pack",    avgCost: 3.99 },
  "salami":                        { size: 15,  unit: "oz",    package: "pack",    avgCost: 6.99 },

  // ── Proteins — plant-based ───────────────────────────────────────────────
  "tofu":                          { size: 14,  unit: "oz",    package: "block",   avgCost: 1.99 },
  "firm tofu":                     { size: 14,  unit: "oz",    package: "block",   avgCost: 1.99 },
  "extra firm tofu":               { size: 14,  unit: "oz",    package: "block",   avgCost: 1.99 },
  "silken tofu":                   { size: 12,  unit: "oz",    package: "block",   avgCost: 2.29 },

  // ── Dairy — milk ────────────────────────────────────────────────────────
  "milk":                          { size: 128, unit: "oz",    package: "gallon",  avgCost: 3.09 },
  "whole milk":                    { size: 128, unit: "oz",    package: "gallon",  avgCost: 3.09 },
  "2% milk":                       { size: 128, unit: "oz",    package: "gallon",  avgCost: 2.79 },
  "skim milk":                     { size: 128, unit: "oz",    package: "gallon",  avgCost: 2.79 },
  "lactose free milk":             { size: 64,  unit: "fl oz", package: "carton",  avgCost: 3.49 },
  "almond milk":                   { size: 64,  unit: "fl oz", package: "carton",  avgCost: 2.69 },
  "unsweetened almond milk":       { size: 64,  unit: "fl oz", package: "carton",  avgCost: 2.69 },
  "oat milk":                      { size: 52,  unit: "fl oz", package: "carton",  avgCost: 3.69 },

  // ── Dairy — cheese ──────────────────────────────────────────────────────
  "shredded cheddar":              { size: 8,   unit: "oz",    package: "bag",     avgCost: 2.33 },
  "cheddar":                       { size: 8,   unit: "oz",    package: "bag",     avgCost: 2.33 },
  "cheese":                        { size: 8,   unit: "oz",    package: "bag",     avgCost: 2.33 },
  "shredded mozzarella":           { size: 8,   unit: "oz",    package: "bag",     avgCost: 2.33 },
  "mozzarella":                    { size: 8,   unit: "oz",    package: "bag",     avgCost: 2.33 },
  "shredded mexican blend":        { size: 8,   unit: "oz",    package: "bag",     avgCost: 2.33 },
  "mexican cheese":                { size: 8,   unit: "oz",    package: "bag",     avgCost: 2.33 },
  "parmesan":                      { size: 8,   unit: "oz",    package: "container", avgCost: 2.99 },
  "grated parmesan":               { size: 8,   unit: "oz",    package: "container", avgCost: 2.99 },
  "colby jack":                    { size: 8,   unit: "oz",    package: "bag",     avgCost: 2.33 },
  "feta":                          { size: 4,   unit: "oz",    package: "container", avgCost: 2.79 },
  "feta cheese":                   { size: 4,   unit: "oz",    package: "container", avgCost: 2.79 },
  "cream cheese":                  { size: 8,   unit: "oz",    package: "block",   avgCost: 2.49 },
  "cottage cheese":                { size: 16,  unit: "oz",    package: "container", avgCost: 2.49 },

  // ── Dairy — other ───────────────────────────────────────────────────────
  "butter":                        { size: 16,  unit: "oz",    package: "pack",    avgCost: 3.79 },
  "salted butter":                 { size: 16,  unit: "oz",    package: "pack",    avgCost: 3.79 },
  "unsalted butter":               { size: 16,  unit: "oz",    package: "pack",    avgCost: 3.79 },
  "sour cream":                    { size: 16,  unit: "oz",    package: "container", avgCost: 1.99 },
  "heavy cream":                   { size: 16,  unit: "oz",    package: "carton",  avgCost: 3.29 },
  "heavy whipping cream":          { size: 16,  unit: "oz",    package: "carton",  avgCost: 3.29 },
  "yogurt":                        { size: 5.3, unit: "oz",    package: "cup",     avgCost: 0.89 },
  "greek yogurt":                  { size: 32,  unit: "oz",    package: "container", avgCost: 4.99 },
  "plain greek yogurt":            { size: 32,  unit: "oz",    package: "container", avgCost: 4.99 },

  // ── Produce — vegetables ─────────────────────────────────────────────────
  "onion":                         { size: 8,   unit: "oz",    package: "piece",   avgCost: 0.50 },  // 1 medium onion ≈ 8 oz ≈ 1 cup diced
  "onions":                        { size: 8,   unit: "oz",    package: "piece",   avgCost: 0.50 },
  "yellow onion":                  { size: 1,   unit: "each",  package: "piece",   avgCost: 0.40 },
  "red onion":                     { size: 1,   unit: "each",  package: "piece",   avgCost: 0.65 },
  "sweet onion":                   { size: 1,   unit: "each",  package: "piece",   avgCost: 0.65 },
  "green onion":                   { size: 1,   unit: "bunch", package: "bunch",   avgCost: 1.29 },
  "green onions":                  { size: 1,   unit: "bunch", package: "bunch",   avgCost: 1.29 },
  "scallion":                      { size: 1,   unit: "bunch", package: "bunch",   avgCost: 1.29 },
  "scallions":                     { size: 1,   unit: "bunch", package: "bunch",   avgCost: 1.29 },
  "bell pepper":                   { size: 1,   unit: "each",  package: "piece",   avgCost: 0.79 },
  "green bell pepper":             { size: 1,   unit: "each",  package: "piece",   avgCost: 0.79 },
  "tomato":                        { size: 1,   unit: "each",  package: "piece",   avgCost: 0.45 },
  "tomatoes":                      { size: 1,   unit: "each",  package: "piece",   avgCost: 0.45 },
  "roma tomato":                   { size: 1,   unit: "each",  package: "piece",   avgCost: 0.45 },
  "cherry tomato":                 { size: 10,  unit: "oz",    package: "container", avgCost: 2.50 },
  "cherry tomatoes":               { size: 10,  unit: "oz",    package: "container", avgCost: 2.50 },
  "lettuce":                       { size: 1,   unit: "head",  package: "head",    avgCost: 2.19 },
  "iceberg lettuce":               { size: 1,   unit: "head",  package: "head",    avgCost: 2.19 },
  "romaine":                       { size: 1,   unit: "head",  package: "head",    avgCost: 2.19 },
  "butter lettuce":                { size: 1,   unit: "head",  package: "head",    avgCost: 2.49 },
  "lemongrass":                    { size: 1,   unit: "each",  package: "stalk",   avgCost: 0.99 },
  "lemongrass paste":              { size: 1,   unit: "each",  package: "tube",    avgCost: 2.99 },
  "salad mix":                     { size: 12,  unit: "oz",    package: "bag",     avgCost: 2.19 },
  "spinach":                       { size: 10,  unit: "oz",    package: "bag",     avgCost: 2.19 },
  "baby spinach":                  { size: 10,  unit: "oz",    package: "bag",     avgCost: 2.19 },
  "kale":                          { size: 16,  unit: "oz",    package: "bag",     avgCost: 2.49 },
  "chopped kale":                  { size: 5,   unit: "oz",    package: "bag",     avgCost: 2.69 },
  "avocado":                       { size: 1,   unit: "each",  package: "piece",   avgCost: 1.50 },
  "broccoli":                      { size: 1,   unit: "head",  package: "head",    avgCost: 1.71 },
  "broccoli crown":                { size: 1,   unit: "head",  package: "head",    avgCost: 1.71 },
  "cauliflower":                   { size: 1,   unit: "head",  package: "head",    avgCost: 3.76 },
  "cauliflower florets":           { size: 12,  unit: "oz",    package: "bag",     avgCost: 3.49 },
  "cucumber":                      { size: 1,   unit: "each",  package: "piece",   avgCost: 0.79 },
  "zucchini":                      { size: 1,   unit: "each",  package: "piece",   avgCost: 0.85 },
  "celery":                        { size: 1,   unit: "bunch", package: "bunch",   avgCost: 1.99 },
  "cilantro":                      { size: 1,   unit: "bunch", package: "bunch",   avgCost: 0.99 },
  "mushroom":                      { size: 8,   unit: "oz",    package: "package", avgCost: 2.39 },
  "mushrooms":                     { size: 8,   unit: "oz",    package: "package", avgCost: 2.39 },
  "asparagus":                     { size: 1,   unit: "bunch", package: "bunch",   avgCost: 3.99 },
  "green beans":                   { size: 12,  unit: "oz",    package: "bag",     avgCost: 0.88 },  // default to frozen price
  "carrot":                        { size: 16,  unit: "oz",    package: "bag",     avgCost: 1.29 },
  "carrots":                       { size: 16,  unit: "oz",    package: "bag",     avgCost: 1.29 },
  "baby carrots":                  { size: 16,  unit: "oz",    package: "bag",     avgCost: 1.29 },
  "shredded carrots":              { size: 10,  unit: "oz",    package: "bag",     avgCost: 1.99 },
  "jalapeno":                      { size: 1,   unit: "each",  package: "piece",   avgCost: 0.15 },
  "cabbage":                       { size: 32,  unit: "oz",    package: "head",    avgCost: 2.18 },  // 1 head ≈ 2 lbs ≈ 8 cups shredded
  "green cabbage":                 { size: 32,  unit: "oz",    package: "head",    avgCost: 2.18 },
  "shredded cabbage":              { size: 16,  unit: "oz",    package: "bag",     avgCost: 2.19 },
  "bok choy":                      { size: 1,   unit: "each",  package: "head",    avgCost: 1.99 },
  "potato":                        { size: 1,   unit: "each",  package: "piece",   avgCost: 0.59 },
  "russet potato":                 { size: 1,   unit: "each",  package: "piece",   avgCost: 0.59 },
  "russet potatoes":               { size: 80,  unit: "oz",    package: "bag",     avgCost: 1.99 },
  "potatoes":                      { size: 80,  unit: "oz",    package: "bag",     avgCost: 1.99 },  // 5 lb bag
  "sweet potato":                  { size: 1,   unit: "each",  package: "piece",   avgCost: 1.49 },
  "sweet potatoes":                { size: 1,   unit: "each",  package: "piece",   avgCost: 1.49 },
  "garlic":                        { size: 1,   unit: "head",  package: "head",    avgCost: 0.59 },
  "corn":                          { size: 1,   unit: "each",  package: "ear",     avgCost: 0.79 },
  "edamame":                       { size: 12,  unit: "oz",    package: "bag",     avgCost: 3.49 },
  "frozen broccoli":               { size: 12,  unit: "oz",    package: "bag",     avgCost: 1.49 },
  "frozen green beans":            { size: 12,  unit: "oz",    package: "bag",     avgCost: 0.88 },
  "frozen corn":                   { size: 12,  unit: "oz",    package: "bag",     avgCost: 0.88 },
  "frozen peas":                   { size: 12,  unit: "oz",    package: "bag",     avgCost: 0.88 },
  "frozen mixed vegetables":       { size: 12,  unit: "oz",    package: "bag",     avgCost: 0.88 },
  "frozen peas and carrots":       { size: 12,  unit: "oz",    package: "bag",     avgCost: 0.88 },
  "frozen peppers and onions":     { size: 12,  unit: "oz",    package: "bag",     avgCost: 1.49 },
  "frozen vegetables":             { size: 12,  unit: "oz",    package: "bag",     avgCost: 1.99 },
  "mixed vegetables":              { size: 12,  unit: "oz",    package: "bag",     avgCost: 1.99 },

  // ── Produce — fruits ─────────────────────────────────────────────────────
  "banana":                        { size: 1,   unit: "each",  package: "piece",   avgCost: 0.19 },
  "bananas":                       { size: 6,   unit: "count", package: "bunch",   avgCost: 1.16 },
  "apple":                         { size: 1,   unit: "each",  package: "piece",   avgCost: 0.60 },
  "gala apple":                    { size: 1,   unit: "each",  package: "piece",   avgCost: 0.60 },
  "honeycrisp apple":              { size: 1,   unit: "each",  package: "piece",   avgCost: 1.25 },
  "granny smith apple":            { size: 1,   unit: "each",  package: "piece",   avgCost: 1.00 },
  "pink lady apple":               { size: 1,   unit: "each",  package: "piece",   avgCost: 1.00 },
  "orange":                        { size: 1,   unit: "each",  package: "piece",   avgCost: 0.75 },
  "navel orange":                  { size: 1,   unit: "each",  package: "piece",   avgCost: 0.75 },
  "cara cara orange":              { size: 1,   unit: "each",  package: "piece",   avgCost: 0.87 },
  "mandarin":                      { size: 1,   unit: "each",  package: "piece",   avgCost: 0.87 },
  "mandarin orange":               { size: 1,   unit: "each",  package: "piece",   avgCost: 0.87 },
  "clementine":                    { size: 1,   unit: "each",  package: "piece",   avgCost: 0.87 },
  "lemon":                         { size: 1,   unit: "each",  package: "piece",   avgCost: 0.85 },
  "lime":                          { size: 1,   unit: "each",  package: "piece",   avgCost: 0.50 },
  "mango":                         { size: 1,   unit: "each",  package: "piece",   avgCost: 1.67 },
  "pineapple":                     { size: 1,   unit: "each",  package: "piece",   avgCost: 3.29 },
  "fresh pineapple":               { size: 1,   unit: "each",  package: "piece",   avgCost: 3.29 },
  "strawberry":                    { size: 16,  unit: "oz",    package: "container", avgCost: 3.49 },
  "strawberries":                  { size: 16,  unit: "oz",    package: "container", avgCost: 3.49 },
  "fresh strawberries":            { size: 16,  unit: "oz",    package: "container", avgCost: 3.49 },
  "blueberry":                     { size: 6,   unit: "oz",    package: "container", avgCost: 2.99 },
  "blueberries":                   { size: 6,   unit: "oz",    package: "container", avgCost: 2.99 },
  "blackberries":                  { size: 6,   unit: "oz",    package: "container", avgCost: 2.99 },
  "fresh blackberries":            { size: 6,   unit: "oz",    package: "container", avgCost: 2.99 },
  "raspberries":                   { size: 6,   unit: "oz",    package: "container", avgCost: 3.19 },
  "fresh raspberries":             { size: 6,   unit: "oz",    package: "container", avgCost: 3.19 },
  "grapes":                        { size: 32,  unit: "oz",    package: "bag",     avgCost: 4.58 },
  "red grapes":                    { size: 32,  unit: "oz",    package: "bag",     avgCost: 4.58 },
  "green grapes":                  { size: 32,  unit: "oz",    package: "bag",     avgCost: 4.58 },
  "seedless grapes":               { size: 32,  unit: "oz",    package: "bag",     avgCost: 4.58 },

  // ── Grains — rice ────────────────────────────────────────────────────────
  "rice":                          { size: 32,  unit: "oz",    package: "bag",     avgCost: 1.79 },
  "white rice":                    { size: 32,  unit: "oz",    package: "bag",     avgCost: 1.79 },
  "long grain white rice":         { size: 32,  unit: "oz",    package: "bag",     avgCost: 1.79 },
  "long grain rice":               { size: 80,  unit: "oz",    package: "bag",     avgCost: 3.59 },
  "brown rice":                    { size: 32,  unit: "oz",    package: "bag",     avgCost: 1.79 },
  "long grain brown rice":         { size: 16,  unit: "oz",    package: "bag",     avgCost: 0.99 },
  "jasmine rice":                  { size: 80,  unit: "oz",    package: "bag",     avgCost: 7.49 },
  "basmati rice":                  { size: 32,  unit: "oz",    package: "bag",     avgCost: 3.99 },
  "instant rice":                  { size: 14,  unit: "oz",    package: "box",     avgCost: 2.99 },
  "instant brown rice":            { size: 14,  unit: "oz",    package: "box",     avgCost: 2.99 },
  "cooked rice":                   { size: 32,  unit: "oz",    package: "bag",     avgCost: 1.79 },
  "dry rice":                      { size: 32,  unit: "oz",    package: "bag",     avgCost: 1.79 },
  "uncooked rice":                 { size: 32,  unit: "oz",    package: "bag",     avgCost: 1.79 },

  // ── Grains — pasta & noodles ─────────────────────────────────────────────
  "pasta":                         { size: 16,  unit: "oz",    package: "box",     avgCost: 1.00 },
  "spaghetti":                     { size: 16,  unit: "oz",    package: "box",     avgCost: 1.00 },
  "penne":                         { size: 16,  unit: "oz",    package: "box",     avgCost: 1.00 },
  "penne pasta":                   { size: 16,  unit: "oz",    package: "box",     avgCost: 1.00 },
  "cavatappi":                     { size: 16,  unit: "oz",    package: "box",     avgCost: 1.00 },
  "angel hair pasta":              { size: 16,  unit: "oz",    package: "box",     avgCost: 1.59 },
  "noodle":                        { size: 16,  unit: "oz",    package: "bag",     avgCost: 1.00 },
  "noodles":                       { size: 16,  unit: "oz",    package: "bag",     avgCost: 1.00 },
  "egg noodles":                   { size: 16,  unit: "oz",    package: "bag",     avgCost: 1.59 },
  "rice noodle":                   { size: 16,  unit: "oz",    package: "bag",     avgCost: 3.99 },
  "rice noodles":                  { size: 16,  unit: "oz",    package: "bag",     avgCost: 3.99 },
  "vermicelli rice noodles":       { size: 8.8, unit: "oz",    package: "bag",     avgCost: 3.79 },
  "rice paper":                    { size: 50,  unit: "count", package: "pack",    avgCost: 3.49 },
  "rice paper wrappers":           { size: 50,  unit: "count", package: "pack",    avgCost: 3.49 },
  "spring roll wrappers":          { size: 50,  unit: "count", package: "pack",    avgCost: 3.49 },
  "quinoa":                        { size: 16,  unit: "oz",    package: "bag",     avgCost: 3.99 },
  "oats":                          { size: 42,  unit: "oz",    package: "container", avgCost: 4.49 },
  "oatmeal":                       { size: 42,  unit: "oz",    package: "container", avgCost: 4.49 },
  "rolled oats":                   { size: 42,  unit: "oz",    package: "container", avgCost: 4.49 },
  "quick oats":                    { size: 42,  unit: "oz",    package: "container", avgCost: 4.49 },
  "old fashioned oats":            { size: 42,  unit: "oz",    package: "container", avgCost: 4.49 },
  "pita":                          { size: 16.8, unit: "oz",   package: "pack",    avgCost: 4.49 },
  "pita bread":                    { size: 16.8, unit: "oz",   package: "pack",    avgCost: 4.49 },
  "whole wheat pita":              { size: 16.8, unit: "oz",   package: "pack",    avgCost: 4.49 },
  "panko":                         { size: 8,   unit: "oz",    package: "canister", avgCost: 2.49 },
  "panko breadcrumbs":             { size: 8,   unit: "oz",    package: "canister", avgCost: 2.49 },
  "breadcrumb":                    { size: 8,   unit: "oz",    package: "canister", avgCost: 2.49 },
  "breadcrumbs":                   { size: 15,  unit: "oz",    package: "canister", avgCost: 1.69 },
  "bread crumbs":                  { size: 15,  unit: "oz",    package: "canister", avgCost: 1.69 },

  // ── Grains — bread & tortillas ───────────────────────────────────────────
  "bread":                         { size: 20,  unit: "oz",    package: "loaf",    avgCost: 2.99 },
  "white bread":                   { size: 24,  unit: "oz",    package: "loaf",    avgCost: 2.99 },
  "wheat bread":                   { size: 20,  unit: "oz",    package: "loaf",    avgCost: 2.99 },
  "whole wheat bread":             { size: 20,  unit: "oz",    package: "loaf",    avgCost: 2.99 },
  "tortilla":                      { size: 25,  unit: "count", package: "pack",    avgCost: 3.49 },
  "tortillas":                     { size: 25,  unit: "count", package: "pack",    avgCost: 3.49 },
  "flour tortillas":               { size: 25,  unit: "count", package: "pack",    avgCost: 3.49 },

  // ── Canned & packaged ────────────────────────────────────────────────────
  "black beans":                   { size: 15,  unit: "oz",    package: "can",     avgCost: 0.89 },
  "black bean":                    { size: 15,  unit: "oz",    package: "can",     avgCost: 0.89 },
  "canned black beans":            { size: 15,  unit: "oz",    package: "can",     avgCost: 0.89 },
  "pinto beans":                   { size: 15,  unit: "oz",    package: "can",     avgCost: 0.89 },
  "kidney beans":                  { size: 15,  unit: "oz",    package: "can",     avgCost: 0.89 },
  "cannellini beans":              { size: 15,  unit: "oz",    package: "can",     avgCost: 0.89 },
  "great northern beans":          { size: 15,  unit: "oz",    package: "can",     avgCost: 0.89 },
  "beans":                         { size: 15,  unit: "oz",    package: "can",     avgCost: 0.89 },
  "refried beans":                 { size: 16,  unit: "oz",    package: "can",     avgCost: 1.79 },
  "chickpeas":                     { size: 15,  unit: "oz",    package: "can",     avgCost: 0.89 },
  "lentils":                       { size: 16,  unit: "oz",    package: "bag",     avgCost: 1.79 },
  "red lentils":                   { size: 16,  unit: "oz",    package: "bag",     avgCost: 1.79 },
  "canned lentils":                { size: 15,  unit: "oz",    package: "can",     avgCost: 1.29 },
  "tomato sauce":                  { size: 14.5, unit: "oz",   package: "can",     avgCost: 0.95 },
  "marinara sauce":                { size: 24,  unit: "oz",    package: "jar",     avgCost: 2.49 },
  "pasta sauce":                   { size: 24,  unit: "oz",    package: "jar",     avgCost: 2.49 },
  "spaghetti sauce":               { size: 24,  unit: "oz",    package: "jar",     avgCost: 2.49 },
  "diced tomatoes":                { size: 14.5, unit: "oz",   package: "can",     avgCost: 0.95 },
  "canned diced tomatoes":         { size: 14.5, unit: "oz",   package: "can",     avgCost: 0.95 },
  "petite diced tomatoes":         { size: 14.5, unit: "oz",   package: "can",     avgCost: 0.95 },
  "crushed tomatoes":              { size: 28,  unit: "oz",    package: "can",     avgCost: 2.29 },
  "tomato paste":                  { size: 6,   unit: "oz",    package: "can",     avgCost: 0.99 },
  "diced tomatoes and green chilies": { size: 10, unit: "oz",  package: "can",     avgCost: 1.59 },
  "coconut milk":                  { size: 13.5, unit: "oz",   package: "can",     avgCost: 2.29 },
  "chicken broth":                 { size: 32,  unit: "oz",    package: "carton",  avgCost: 1.59 },
  "beef broth":                    { size: 32,  unit: "oz",    package: "carton",  avgCost: 1.59 },
  "vegetable broth":               { size: 32,  unit: "oz",    package: "carton",  avgCost: 1.59 },
  "broth":                         { size: 32,  unit: "oz",    package: "carton",  avgCost: 1.59 },
  "peanut butter":                 { size: 16,  unit: "oz",    package: "jar",     avgCost: 2.29 },
  "creamy peanut butter":          { size: 16,  unit: "oz",    package: "jar",     avgCost: 2.29 },
  "natural peanut butter":         { size: 16,  unit: "oz",    package: "jar",     avgCost: 2.99 },
  "almond butter":                 { size: 12,  unit: "oz",    package: "jar",     avgCost: 8.99 },
  "peanuts":                       { size: 16,  unit: "oz",    package: "bag",     avgCost: 3.99 },
  "dry roasted peanuts":           { size: 16,  unit: "oz",    package: "bag",     avgCost: 3.99 },
  "salsa":                         { size: 16,  unit: "oz",    package: "jar",     avgCost: 3.29 },
  "chunky salsa":                  { size: 16,  unit: "oz",    package: "jar",     avgCost: 3.29 },
  "mild salsa":                    { size: 16,  unit: "oz",    package: "jar",     avgCost: 3.29 },
  "medium salsa":                  { size: 14,  unit: "oz",    package: "jar",     avgCost: 2.69 },
  "sauerkraut":                    { size: 14.5, unit: "oz",   package: "jar",     avgCost: 1.49 },
  "shredded sauerkraut":           { size: 14.5, unit: "oz",   package: "jar",     avgCost: 1.49 },
  "kimchi":                        { size: 16,  unit: "oz",    package: "jar",     avgCost: 5.99 },

  // ── Oils & condiments ────────────────────────────────────────────────────
  "olive oil":                     { size: 16,  unit: "oz",    package: "bottle",  avgCost: 6.49 },
  "extra virgin olive oil":        { size: 16,  unit: "oz",    package: "bottle",  avgCost: 6.49 },
  "vegetable oil":                 { size: 48,  unit: "oz",    package: "bottle",  avgCost: 3.99 },
  "canola oil":                    { size: 48,  unit: "oz",    package: "bottle",  avgCost: 3.99 },
  "sesame oil":                    { size: 7.5, unit: "fl oz", package: "bottle",  avgCost: 4.99 },
  "toasted sesame oil":            { size: 7.5, unit: "fl oz", package: "bottle",  avgCost: 4.99 },
  "coconut oil":                   { size: 30,  unit: "fl oz", package: "jar",     avgCost: 6.99 },
  "refined coconut oil":           { size: 30,  unit: "fl oz", package: "jar",     avgCost: 6.99 },
  "soy sauce":                     { size: 15,  unit: "oz",    package: "bottle",  avgCost: 2.49 },
  "low sodium soy sauce":          { size: 15,  unit: "oz",    package: "bottle",  avgCost: 2.79 },
  "fish sauce":                    { size: 6.76, unit: "fl oz", package: "bottle",  avgCost: 5.99 },
  "hot sauce":                     { size: 6,   unit: "fl oz", package: "bottle",  avgCost: 1.99 },
  "sriracha":                      { size: 9,   unit: "oz",    package: "bottle",  avgCost: 3.29 },
  "vinegar":                       { size: 16,  unit: "oz",    package: "bottle",  avgCost: 2.79 },
  "red wine vinegar":              { size: 16,  unit: "oz",    package: "bottle",  avgCost: 2.79 },
  "apple cider vinegar":           { size: 16,  unit: "oz",    package: "bottle",  avgCost: 2.49 },
  "balsamic vinegar":              { size: 16,  unit: "oz",    package: "bottle",  avgCost: 3.99 },
  "rice vinegar":                  { size: 10,  unit: "oz",    package: "bottle",  avgCost: 3.49 },
  "bbq sauce":                     { size: 18,  unit: "oz",    package: "bottle",  avgCost: 1.99 },
  "worcestershire":                { size: 10,  unit: "fl oz", package: "bottle",  avgCost: 1.59 },
  "worcestershire sauce":          { size: 10,  unit: "fl oz", package: "bottle",  avgCost: 1.59 },
  "oyster sauce":                  { size: 9,   unit: "fl oz", package: "bottle",  avgCost: 3.79 },
  "hoisin sauce":                  { size: 15.3, unit: "oz",   package: "jar",     avgCost: 4.99 },
  "dijon mustard":                 { size: 12,  unit: "oz",    package: "jar",     avgCost: 1.89 },
  "organic dijon mustard":         { size: 12,  unit: "oz",    package: "jar",     avgCost: 2.49 },
  "mustard":                       { size: 8,   unit: "oz",    package: "jar",     avgCost: 2.49 },
  "ketchup":                       { size: 20,  unit: "oz",    package: "bottle",  avgCost: 2.99 },
  "tahini":                        { size: 16,  unit: "oz",    package: "jar",     avgCost: 6.49 },
  "tahini paste":                  { size: 16,  unit: "oz",    package: "jar",     avgCost: 6.49 },
  "sesame paste":                  { size: 16,  unit: "oz",    package: "jar",     avgCost: 6.49 },
  "organic tahini":                { size: 16,  unit: "oz",    package: "jar",     avgCost: 6.49 },
  "maple syrup":                   { size: 8,   unit: "fl oz", package: "bottle",  avgCost: 5.49 },
  "pure maple syrup":              { size: 8,   unit: "fl oz", package: "bottle",  avgCost: 5.49 },
  "organic maple syrup":           { size: 8,   unit: "fl oz", package: "bottle",  avgCost: 5.49 },
  "mayonnaise":                    { size: 30,  unit: "fl oz", package: "jar",     avgCost: 3.99 },
  "mayo":                          { size: 30,  unit: "fl oz", package: "jar",     avgCost: 3.99 },
  "quick grits":                   { size: 24,  unit: "oz",    package: "container", avgCost: 2.49 },
  "instant grits":                 { size: 24,  unit: "oz",    package: "container", avgCost: 2.49 },
  "coleslaw mix":                  { size: 14,  unit: "oz",    package: "bag",     avgCost: 2.49 },
  "almonds":                       { size: 6,   unit: "oz",    package: "bag",     avgCost: 4.99 },
  "sliced almonds":                { size: 6,   unit: "oz",    package: "bag",     avgCost: 4.99 },
  "miso paste":                    { size: 12,  unit: "oz",    package: "container", avgCost: 4.99 },
  "miso":                          { size: 12,  unit: "oz",    package: "container", avgCost: 4.99 },
};

// ─────────────────────────────────────────────────────────────────────────────
// Pantry staples — assumed already on hand, cost = $0
// ─────────────────────────────────────────────────────────────────────────────
const PANTRY_ITEMS = new Set([
  // Salt & pepper
  "salt", "pepper", "black pepper", "white pepper", "sea salt", "kosher salt",
  // Alliums (powders)
  "garlic powder", "onion powder",
  // Warm spices
  "cumin", "ground cumin", "coriander", "ground coriander",
  "paprika", "smoked paprika", "sweet paprika",
  "chili powder", "cayenne", "cayenne pepper", "red pepper flakes", "crushed red pepper",
  "cinnamon", "ground cinnamon", "nutmeg", "allspice", "ground allspice",
  "turmeric", "ground turmeric",
  "ginger powder", "ground ginger",
  "curry powder", "garam masala",
  // Herbs
  "oregano", "dried oregano",
  "basil", "dried basil",
  "thyme", "dried thyme",
  "rosemary", "dried rosemary",
  "parsley", "dried parsley",
  "bay leaf", "bay leaves",
  "italian seasoning", "mixed herbs", "dried herbs", "herb seasoning",
  "everything bagel seasoning", "lemon pepper", "garlic salt",
  "jerk seasoning", "cajun seasoning", "taco seasoning",
  "ranch seasoning", "fajita seasoning",
  // Baking
  "baking powder", "baking soda", "vanilla extract",
  "flour", "all purpose flour", "all-purpose flour",
  "sugar", "brown sugar", "cornstarch", "yeast",
  // Sweeteners treated as pantry
  "honey",
  // Cooking sprays
  "cooking spray", "olive oil spray", "nonstick spray",
  // Water
  "water",
  // Small citrus additions
  "lemon juice", "lime juice",
  // Packet condiments
  "soy sauce packet", "hot sauce packet",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Unit → ounces conversion table (weight & volume)
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
  "slice", "slices", "serving", "servings", "clove", "cloves", "bunch",
]);

function toOz(amount, unit) {
  const u = (unit || "").toLowerCase().trim();
  if (COUNT_UNITS.has(u)) return null;
  return (TO_OZ[u] ?? 1) * amount;
}

// ─────────────────────────────────────────────────────────────────────────────
// Name normalization — strip adjectives, return lowercase base
// ─────────────────────────────────────────────────────────────────────────────
const STRIP_PREFIXES = /^(fresh|frozen|raw|cooked|dried|organic|large|small|medium|extra|whole|lean|boneless|skinless|bone-in|shredded|chopped|diced|sliced|minced|grated|crumbled|extra\s+virgin|canned|low-sodium|low\s+sodium|reduced-fat|fat-free|unsweetened|sweetened)\s+/i;
const STRIP_SUFFIXES = /\s+(breast|thigh|fillet|filet|steak|chop|loin|wing|leg|drumstick)s?$/i;

function normalizeName(name) {
  if (!name) return "";
  let n = String(name).toLowerCase().trim();
  let prev;
  do {
    prev = n;
    n = n.replace(STRIP_PREFIXES, "");
  } while (n !== prev);
  n = n.replace(STRIP_SUFFIXES, "");
  return n.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Find the best PACKAGE_SIZES match for an ingredient name
// Strategy: exact → depluralised → key-in-name (longest) → name-in-key (shortest)
// ─────────────────────────────────────────────────────────────────────────────
function findPackage(rawName) {
  // Check raw lowercased name first — preserves explicit "frozen X" entries before
  // normalization strips the "frozen" prefix and hits the wrong (fresh) entry.
  const raw = rawName.toLowerCase().trim();
  if (PACKAGE_SIZES[raw]) return PACKAGE_SIZES[raw];

  const n = normalizeName(rawName);
  if (!n) return null;

  if (PACKAGE_SIZES[n]) return PACKAGE_SIZES[n];

  const depl = n.endsWith("es") ? n.slice(0, -2) : n.endsWith("s") ? n.slice(0, -1) : null;
  if (depl && PACKAGE_SIZES[depl]) return PACKAGE_SIZES[depl];

  const keys = Object.keys(PACKAGE_SIZES);
  const contained = keys.filter(k => n.includes(k)).sort((a, b) => b.length - a.length);
  if (contained.length) return PACKAGE_SIZES[contained[0]];

  const containing = keys.filter(k => k.includes(n)).sort((a, b) => a.length - b.length);
  if (containing.length) return PACKAGE_SIZES[containing[0]];

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimate packages + cost for a single item
// Returns { pkgCount, pkgLabel, cost, isPantry }
// ─────────────────────────────────────────────────────────────────────────────
export function estimateItem(name, qty, unit) {
  try {
    if (!name) return { pkgCount: null, pkgLabel: null, cost: null, isPantry: false };
    const normalized = normalizeName(name);
    const isPantry = PANTRY_ITEMS.has(normalized);

    console.log(`\n--- Estimating: ${name} (${qty} ${unit || ""}) ---`);
    console.log(`  Original name: "${name}"`);
    console.log(`  Normalized name: "${normalized}"`);

    if (isPantry) {
      console.log(`  ✓ Found in pantry items - Cost: $0.00`);
      return { pkgCount: 0, pkgLabel: null, cost: 0, isPantry: true };
    }

    const pkg = findPackage(name);
    if (!pkg) {
      console.log(`  Database match: NO`);
      console.log(`  ⚠️ NO DATABASE MATCH - will use buffer in list estimator`);
      return { pkgCount: null, pkgLabel: null, cost: null, isPantry: false };
    }

    console.log(`  Database match: YES`);

    const pkgUnit = pkg.unit.toLowerCase();
    let workUnit = (unit || "").toLowerCase().trim();
    let workQty  = qty;

    // Unit conversion: garlic cloves → heads (1 head garlic ≈ 10 cloves)
    if (normalized === "garlic" && (workUnit === "clove" || workUnit === "cloves")) {
      workQty  = Math.ceil(workQty / 10);
      workUnit = "head";
      console.log(`  Unit conversion: ${qty} cloves → ${workQty} heads`);
    }

    // Unit conversion: sweet potato oz → each (1 medium sweet potato ≈ 8 oz)
    if ((normalized === "sweet potato" || normalized === "sweet potatoes") &&
        (workUnit === "oz" || workUnit === "ounce" || workUnit === "ounces")) {
      workQty  = Math.ceil(workQty / 8);
      workUnit = "each";
      console.log(`  Unit conversion: ${qty} oz sweet potato → ${workQty} each`);
    }

    // Unit conversion: lettuce/romaine cups → heads (1 head ≈ 8 cups shredded); max 2 heads
    if ((normalized.includes("lettuce") || normalized === "romaine") &&
        (workUnit === "cup" || workUnit === "cups")) {
      workQty  = Math.min(2, Math.ceil(workQty / 8));
      workUnit = "head";
      console.log(`  Unit conversion: ${qty} cups lettuce → ${workQty} heads (max 2 cap)`);
    }

    // Unit conversion: lettuce leaves → heads (1 head ≈ 18 leaves); min 1, max 2 heads
    if ((normalized.includes("lettuce") || normalized === "romaine") &&
        (workUnit === "leaf" || workUnit === "leaves")) {
      workQty  = Math.min(2, Math.max(1, Math.ceil(workQty / 18)));
      workUnit = "head";
      console.log(`  Unit conversion: ${qty} leaves lettuce → ${workQty} heads (min 1, max 2 cap)`);
    }

    // Unit conversion: lemongrass/lemongrass paste tbsp → each (< 6 tbsp = 1 unit; >= 6 tbsp = 2 max)
    if ((normalized === "lemongrass" || normalized === "lemongrass paste") &&
        (workUnit === "tbsp" || workUnit === "tablespoon" || workUnit === "tablespoons")) {
      workQty  = workQty < 6 ? 1 : 2;
      workUnit = "each";
      console.log(`  Unit conversion: ${qty} tbsp lemongrass → ${workQty} each`);
    }

    // Unit conversion: broccoli cups → heads (÷2) OR oz → heads (÷12); max 3 heads
    if (normalized === "broccoli" || normalized === "broccoli crown") {
      if (workUnit === "cup" || workUnit === "cups") {
        workQty  = Math.min(3, Math.ceil(workQty / 2));
        workUnit = "head";
        console.log(`  Unit conversion: ${qty} cups broccoli → ${workQty} heads (max 3 cap)`);
      } else if (workUnit === "oz" || workUnit === "ounce" || workUnit === "ounces") {
        workQty  = Math.min(3, Math.ceil(workQty / 12));
        workUnit = "head";
        console.log(`  Unit conversion: ${qty} oz broccoli → ${workQty} heads (max 3 cap)`);
      }
    }

    // Unit conversion: cauliflower cups → heads (÷2) OR oz → heads (÷24); max 2 heads
    if (normalized === "cauliflower") {
      if (workUnit === "cup" || workUnit === "cups") {
        workQty  = Math.min(2, Math.ceil(workQty / 2));
        workUnit = "head";
        console.log(`  Unit conversion: ${qty} cups cauliflower → ${workQty} heads (max 2 cap)`);
      } else if (workUnit === "oz" || workUnit === "ounce" || workUnit === "ounces") {
        workQty  = Math.min(2, Math.ceil(workQty / 24));
        workUnit = "head";
        console.log(`  Unit conversion: ${qty} oz cauliflower → ${workQty} heads (max 2 cap)`);
      }
    }

    // Unit conversion: celery stalks → bunches (1 bunch ≈ 10 stalks); max 2 bunches
    if ((normalized === "celery" || normalized === "celery stalks") &&
        (workUnit === "stalk" || workUnit === "stalks" || workUnit === "large")) {
      workQty  = Math.min(2, Math.ceil(workQty / 10));
      workUnit = "bunch";
      console.log(`  Unit conversion: ${qty} stalks celery → ${workQty} bunches (max 2 cap)`);
    }

    // Unit conversion: asparagus spears → bunches (÷20) OR oz → bunches (÷16); max 2 bunches
    if (normalized === "asparagus") {
      if (workUnit === "spear" || workUnit === "spears") {
        workQty  = Math.min(2, Math.ceil(workQty / 20));
        workUnit = "bunch";
        console.log(`  Unit conversion: ${qty} spears asparagus → ${workQty} bunches (max 2 cap)`);
      } else if (workUnit === "oz" || workUnit === "ounce" || workUnit === "ounces") {
        workQty  = Math.min(2, Math.ceil(workQty / 16));
        workUnit = "bunch";
        console.log(`  Unit conversion: ${qty} oz asparagus → ${workQty} bunches (max 2 cap)`);
      }
    }

    // Unit conversion: spinach/baby spinach cups → oz (1 cup fresh spinach ≈ 1 oz, not 8 oz)
    if ((normalized === "spinach" || normalized === "baby spinach") &&
        (workUnit === "cup" || workUnit === "cups")) {
      workQty  = workQty * 1;  // 1 oz per cup
      workUnit = "oz";
      console.log(`  Unit conversion: ${qty} cups spinach → ${workQty} oz (spinach density: 1 oz/cup)`);
    }

    // Unit conversion: shredded cheese cups → oz (1 cup shredded ≈ 4 oz, not 8 oz — air-filled)
    if ((normalized === "cheddar" || normalized === "cheese" || normalized === "mozzarella" ||
         normalized === "mexican blend" || normalized === "mexican cheese" || normalized === "colby jack") &&
        (workUnit === "cup" || workUnit === "cups")) {
      workQty  = workQty * 4;  // 4 oz per cup shredded
      workUnit = "oz";
      console.log(`  Unit conversion: ${qty} cups shredded cheese → ${workQty} oz (4 oz/cup density)`);
    }

    // Unit conversion: onion/onions each/medium/large → oz (1 medium onion ≈ 8 oz)
    if ((normalized === "onion" || normalized === "onions") &&
        (workUnit === "each" || workUnit === "medium" || workUnit === "large")) {
      workQty  = workQty * 8;  // 8 oz per onion
      workUnit = "oz";
      console.log(`  Unit conversion: ${qty} ${unit} onion → ${workQty} oz (8 oz/onion)`);
    }

    // Unit conversion: pepperoni slices → oz (1 slice ≈ 0.35 oz)
    if (normalized === "pepperoni" && (workUnit === "slice" || workUnit === "slices")) {
      workQty  = workQty * 0.35;
      workUnit = "oz";
      console.log(`  Unit conversion: ${qty} slices pepperoni → ${workQty.toFixed(1)} oz (0.35 oz/slice)`);
    }

    // Unit conversion: pita each/pita/piece → oz (1 pita ≈ 2.8 oz)
    if (normalized.includes("pita") &&
        (workUnit === "each" || workUnit === "pita" || workUnit === "piece" || workUnit === "pieces")) {
      workQty  = workQty * 2.8;
      workUnit = "oz";
      console.log(`  Unit conversion: ${qty} pitas → ${workQty} oz (2.8 oz/pita)`);
    }

    // Unit conversion: scallion/green onion tbsp → cap at 1 bunch (garnish amount)
    if ((normalized === "scallion" || normalized === "scallions" ||
         normalized === "green onion" || normalized === "green onions") &&
        (workUnit === "tbsp" || workUnit === "tablespoon" || workUnit === "tablespoons")) {
      workQty  = 1;
      workUnit = "bunch";
      console.log(`  Unit conversion: ${qty} tbsp scallion → 1 bunch (garnish cap)`);
    }

    // Unit conversion: scallion/green onion stalks → bunches (1 bunch ≈ 8 stalks); max 2 bunches
    if ((normalized === "scallion" || normalized === "scallions" ||
         normalized === "green onion" || normalized === "green onions") &&
        (workUnit === "stalk" || workUnit === "stalks")) {
      workQty  = Math.min(2, Math.ceil(workQty / 8));
      workUnit = "bunch";
      console.log(`  Unit conversion: ${qty} stalks → ${workQty} bunches (max 2 cap applied)`);
    }

    // Unit conversion: cilantro tbsp → bunches (1 bunch yields ~24 tbsp)
    if (normalized === "cilantro" && (workUnit === "tbsp" || workUnit === "tablespoon" || workUnit === "tablespoons")) {
      workQty  = Math.ceil(workQty / 24);
      workUnit = "bunch";
      console.log(`  Unit conversion: ${qty} tbsp cilantro → ${workQty} bunches`);
    }

    // Unit conversion: coleslaw mix cups → oz (1 cup coleslaw mix ≈ 2 oz, not 8 oz)
    if (normalized === "coleslaw mix" && (workUnit === "cup" || workUnit === "cups")) {
      workQty  = workQty * 2;
      workUnit = "oz";
      console.log(`  Unit conversion: ${qty} cups coleslaw mix → ${workQty} oz (2 oz/cup density)`);
    }

    let pkgCount;

    // Volume-to-count conversions for produce items sold individually:
    // Prefer oz-based DB entries for volume-measured produce (onion=8oz, cabbage=32oz)
    // so that "1 cup diced onion" → 8oz needed / 8oz per piece = 1 onion (not Math.ceil(1/1)=1 count).
    // Items still using count (yellow/red onion, potato, garlic) are typically
    // specified by the AI as "2 each" or "3 medium" — count math stays correct there.
    if (COUNT_UNITS.has(pkgUnit) || pkgUnit === "each") {
      pkgCount = Math.ceil(workQty / pkg.size);
    } else {
      // Special density conversions for cup-measured items:
      // 1 cup dry rice ≈ 6 oz (denser than water's 8 oz/cup)
      // 1 cup frozen veg ≈ 5 oz (denser than fresh)
      const isDryRiceCups = (workUnit === "cup" || workUnit === "cups") &&
                            normalized.includes("rice") &&
                            !normalized.includes("cooked") && !normalized.includes("instant");
      const isFrozenCups  = (workUnit === "cup" || workUnit === "cups") &&
                            name.toLowerCase().includes("frozen");
      const neededOz = isDryRiceCups ? workQty * 6
                     : isFrozenCups  ? workQty * 5
                     : (toOz(workQty, workUnit) ?? workQty);
      const pkgOz    = toOz(pkg.size, pkgUnit) ?? pkg.size;
      pkgCount = Math.max(1, Math.ceil(neededOz / pkgOz));
    }

    const cost = pkgCount * pkg.avgCost;
    const pkgLabel = pkgCount === 1
      ? `1 ${pkg.package}`
      : `${pkgCount} ${pkg.package}${pkg.package.endsWith("s") || pkg.package === "bunch" ? "" : "s"}`;

    console.log(`  Package size: ${pkg.size} ${pkg.unit} @ $${pkg.avgCost}`);
    const _densityNote = name.toLowerCase().includes("frozen") && workUnit.startsWith("cup") ? " [frozen density: 5 oz/cup]"
                       : normalized.includes("rice") && workUnit.startsWith("cup")           ? " [dry rice: 6 oz/cup]"
                       : "";
    console.log(`  Packages needed: Math.ceil(${workQty} ${workUnit} → oz / ${pkg.size} ${pkg.unit}) = ${pkgCount}${_densityNote}`);
    console.log(`  Item cost: ${pkgCount} × $${pkg.avgCost} = $${cost.toFixed(2)}`);

    return { pkgCount, pkgLabel, cost, isPantry: false };
  } catch (e) {
    console.error("[estimateItem] error for:", name, e);
    return { pkgCount: null, pkgLabel: null, cost: null, isPantry: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimate cost for an entire planCategories array
// Returns { itemMap, totalCost, buffer, total, budget, withinBudget, diff, pct, unknownCount }
// ─────────────────────────────────────────────────────────────────────────────
export function estimateGroceryList(planCategories, weeklyBudget) {
  const itemMap = new Map();
  let totalCost = 0;
  let unknownCount = 0;
  let databaseMatchCount = 0;
  let pantryCount = 0;

  const allItems = (planCategories || []).flatMap(cat => (cat.items || []).filter(Boolean));
  console.log("=== GROCERY COST ESTIMATOR DEBUG ===");
  console.log("Total items to estimate:", allItems.length);

  for (const item of allItems) {
    const est = estimateItem(item.name, item.qty, item.unit);
    itemMap.set(item.id, est);
    if (est.isPantry) {
      pantryCount++;
    } else if (est.cost !== null) {
      databaseMatchCount++;
      totalCost += est.cost;
    } else {
      unknownCount++;
    }
  }

  // Tiered buffer per unknown item — tight budgets get a lower estimate
  // since they use cheaper/simpler ingredients
  const budget = weeklyBudget ?? null;
  const budgetTier = budget !== null && budget < 60  ? "strict (<$60)"
                   : budget !== null && budget < 90  ? "moderate (<$90)"
                   :                                   "flexible";
  const bufferPerItem = budget !== null && budget < 60  ? 2.00
                      : budget !== null && budget < 90  ? 3.00
                      :                                   3.50;

  if (unknownCount > 0) {
    console.log(`\n--- Buffer items (no database match) ---`);
    console.log(`  Budget tier: ${budgetTier}`);
    console.log(`  Buffer amount: $${bufferPerItem.toFixed(2)} × ${unknownCount} items = $${(unknownCount * bufferPerItem).toFixed(2)}`);
  }

  const buffer = unknownCount * bufferPerItem;
  const total  = totalCost + buffer;

  const withinBudget = budget !== null ? total <= budget : null;
  const diff = budget !== null ? Math.abs(budget - total) : null;
  const pct  = budget !== null ? Math.min(Math.round((total / budget) * 100), 999) : null;

  console.log("\n=== FINAL COST BREAKDOWN ===");
  console.log(`Total estimated cost: $${total.toFixed(2)}`);
  console.log(`Items from database: ${databaseMatchCount}`);
  console.log(`Items using buffer: ${unknownCount}`);
  console.log(`Pantry items (free): ${pantryCount}`);
  console.log(`[costEstimator] total=$${total.toFixed(2)} (items=$${totalCost.toFixed(2)} + buffer=$${buffer.toFixed(2)} × ${unknownCount} unknowns @ $${bufferPerItem}) budget=${budget ?? "none"}${pct != null ? " "+pct+"%" : ""}`);

  return { itemMap, totalCost, buffer, total, budget, withinBudget, diff, pct, unknownCount };
}
