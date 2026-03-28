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
  "extra lean ground turkey":      { size: 16,  unit: "oz",    package: "lb",      avgCost: 8.49 },
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
  "pork chop":                     { size: 16,  unit: "oz",    package: "lb",      avgCost: 5.00 },
  "pork chops":                    { size: 16,  unit: "oz",    package: "lb",      avgCost: 5.00 },
  "boneless pork chops":           { size: 16,  unit: "oz",    package: "lb",      avgCost: 5.00 },
  "pork loin":                     { size: 16,  unit: "oz",    package: "lb",      avgCost: 1.79 },
  "pork tenderloin":               { size: 16,  unit: "oz",    package: "lb",      avgCost: 3.99 },
  "pork shoulder":                 { size: 16,  unit: "oz",    package: "lb",      avgCost: 2.29 },
  "pork":                          { size: 16,  unit: "oz",    package: "lb",      avgCost: 3.99 },
  "baby back ribs":                { size: 16,  unit: "oz",    package: "lb",      avgCost: 3.99 },
  "bacon":                         { size: 12,  unit: "oz",    package: "pack",    avgCost: 4.99 },
  "thick cut bacon":               { size: 12,  unit: "oz",    package: "pack",    avgCost: 7.99 },
  "turkey bacon":                  { size: 12,  unit: "oz",    package: "pack",    avgCost: 4.79 },
  "sausage":                       { size: 12,  unit: "oz",    package: "pack",    avgCost: 4.24 },
  "breakfast sausage":             { size: 12,  unit: "oz",    package: "pack",    avgCost: 4.24 },

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
  "tilapia":                       { size: 16,  unit: "oz",    package: "lb",      avgCost: 6.99 },
  "cod":                           { size: 16,  unit: "oz",    package: "lb",      avgCost: 8.99 },

  // ── Proteins — deli ─────────────────────────────────────────────────────
  "deli turkey":                   { size: 8,   unit: "oz",    package: "pack",    avgCost: 4.99 },
  "sliced turkey":                 { size: 8,   unit: "oz",    package: "pack",    avgCost: 4.99 },
  "deli ham":                      { size: 8,   unit: "oz",    package: "pack",    avgCost: 9.49 },
  "sliced ham":                    { size: 8,   unit: "oz",    package: "pack",    avgCost: 9.49 },
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
  "lactose free milk":             { size: 64,  unit: "oz",    package: "carton",  avgCost: 4.49 },
  "almond milk":                   { size: 64,  unit: "oz",    package: "carton",  avgCost: 2.49 },
  "unsweetened almond milk":       { size: 64,  unit: "oz",    package: "carton",  avgCost: 2.49 },
  "oat milk":                      { size: 64,  unit: "oz",    package: "carton",  avgCost: 4.99 },

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
  "feta":                          { size: 6,   unit: "oz",    package: "container", avgCost: 4.99 },
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
  "onion":                         { size: 1,   unit: "each",  package: "piece",   avgCost: 0.50 },
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
  "salad mix":                     { size: 12,  unit: "oz",    package: "bag",     avgCost: 2.19 },
  "spinach":                       { size: 10,  unit: "oz",    package: "bag",     avgCost: 3.99 },
  "kale":                          { size: 1,   unit: "bunch", package: "bunch",   avgCost: 2.49 },
  "avocado":                       { size: 1,   unit: "each",  package: "piece",   avgCost: 1.00 },
  "broccoli":                      { size: 1,   unit: "head",  package: "head",    avgCost: 1.71 },
  "broccoli crown":                { size: 1,   unit: "head",  package: "head",    avgCost: 1.71 },
  "cauliflower":                   { size: 1,   unit: "head",  package: "head",    avgCost: 3.76 },
  "cucumber":                      { size: 1,   unit: "each",  package: "piece",   avgCost: 0.79 },
  "zucchini":                      { size: 1,   unit: "each",  package: "piece",   avgCost: 1.49 },
  "celery":                        { size: 1,   unit: "bunch", package: "bunch",   avgCost: 1.99 },
  "cilantro":                      { size: 1,   unit: "bunch", package: "bunch",   avgCost: 0.99 },
  "mushroom":                      { size: 8,   unit: "oz",    package: "package", avgCost: 3.99 },
  "asparagus":                     { size: 1,   unit: "bunch", package: "bunch",   avgCost: 3.99 },
  "green beans":                   { size: 12,  unit: "oz",    package: "bag",     avgCost: 2.99 },
  "carrot":                        { size: 16,  unit: "oz",    package: "bag",     avgCost: 1.29 },
  "carrots":                       { size: 16,  unit: "oz",    package: "bag",     avgCost: 1.29 },
  "baby carrots":                  { size: 16,  unit: "oz",    package: "bag",     avgCost: 1.29 },
  "jalapeno":                      { size: 1,   unit: "each",  package: "piece",   avgCost: 0.15 },
  "cabbage":                       { size: 1,   unit: "head",  package: "head",    avgCost: 2.18 },
  "green cabbage":                 { size: 1,   unit: "head",  package: "head",    avgCost: 2.18 },
  "bok choy":                      { size: 1,   unit: "each",  package: "head",    avgCost: 1.99 },
  "potato":                        { size: 1,   unit: "each",  package: "piece",   avgCost: 0.59 },
  "russet potato":                 { size: 1,   unit: "each",  package: "piece",   avgCost: 0.59 },
  "russet potatoes":               { size: 80,  unit: "oz",    package: "bag",     avgCost: 1.99 },
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
  "apple":                         { size: 1,   unit: "each",  package: "piece",   avgCost: 1.25 },
  "orange":                        { size: 1,   unit: "each",  package: "piece",   avgCost: 0.79 },
  "lemon":                         { size: 1,   unit: "each",  package: "piece",   avgCost: 0.85 },
  "lime":                          { size: 1,   unit: "each",  package: "piece",   avgCost: 0.50 },
  "mango":                         { size: 1,   unit: "each",  package: "piece",   avgCost: 1.49 },
  "pineapple":                     { size: 1,   unit: "each",  package: "piece",   avgCost: 3.29 },
  "strawberry":                    { size: 16,  unit: "oz",    package: "container", avgCost: 3.49 },
  "strawberries":                  { size: 16,  unit: "oz",    package: "container", avgCost: 3.49 },
  "blueberry":                     { size: 6,   unit: "oz",    package: "container", avgCost: 2.99 },
  "blueberries":                   { size: 6,   unit: "oz",    package: "container", avgCost: 2.99 },
  "blackberries":                  { size: 6,   unit: "oz",    package: "container", avgCost: 2.99 },
  "raspberries":                   { size: 6,   unit: "oz",    package: "container", avgCost: 3.19 },
  "grapes":                        { size: 32,  unit: "oz",    package: "bag",     avgCost: 4.58 },

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
  "rice noodle":                   { size: 8,   unit: "oz",    package: "bag",     avgCost: 2.50 },
  "rice noodles":                  { size: 8,   unit: "oz",    package: "bag",     avgCost: 2.50 },
  "quinoa":                        { size: 16,  unit: "oz",    package: "bag",     avgCost: 5.99 },
  "oats":                          { size: 42,  unit: "oz",    package: "container", avgCost: 4.49 },
  "oatmeal":                       { size: 42,  unit: "oz",    package: "container", avgCost: 4.49 },
  "rolled oats":                   { size: 42,  unit: "oz",    package: "container", avgCost: 4.49 },
  "pita":                          { size: 12,  unit: "oz",    package: "pack",    avgCost: 3.49 },
  "panko":                         { size: 8,   unit: "oz",    package: "canister", avgCost: 2.99 },
  "panko breadcrumbs":             { size: 8,   unit: "oz",    package: "canister", avgCost: 2.99 },
  "breadcrumb":                    { size: 8,   unit: "oz",    package: "canister", avgCost: 2.49 },
  "breadcrumbs":                   { size: 15,  unit: "oz",    package: "canister", avgCost: 2.49 },
  "bread crumbs":                  { size: 15,  unit: "oz",    package: "canister", avgCost: 2.49 },

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
  "lentils":                       { size: 16,  unit: "oz",    package: "bag",     avgCost: 1.99 },
  "red lentils":                   { size: 16,  unit: "oz",    package: "bag",     avgCost: 1.99 },
  "tomato sauce":                  { size: 14.5, unit: "oz",   package: "can",     avgCost: 0.95 },
  "marinara sauce":                { size: 24,  unit: "oz",    package: "jar",     avgCost: 2.49 },
  "pasta sauce":                   { size: 24,  unit: "oz",    package: "jar",     avgCost: 2.49 },
  "spaghetti sauce":               { size: 24,  unit: "oz",    package: "jar",     avgCost: 2.49 },
  "diced tomatoes":                { size: 14.5, unit: "oz",   package: "can",     avgCost: 0.95 },
  "canned diced tomatoes":         { size: 14.5, unit: "oz",   package: "can",     avgCost: 0.95 },
  "petite diced tomatoes":         { size: 14.5, unit: "oz",   package: "can",     avgCost: 0.95 },
  "crushed tomatoes":              { size: 28,  unit: "oz",    package: "can",     avgCost: 2.29 },
  "tomato paste":                  { size: 6,   unit: "oz",    package: "can",     avgCost: 0.89 },
  "diced tomatoes and green chilies": { size: 10, unit: "oz",  package: "can",     avgCost: 1.59 },
  "coconut milk":                  { size: 13.5, unit: "oz",   package: "can",     avgCost: 2.29 },
  "chicken broth":                 { size: 32,  unit: "oz",    package: "carton",  avgCost: 1.59 },
  "beef broth":                    { size: 32,  unit: "oz",    package: "carton",  avgCost: 1.59 },
  "vegetable broth":               { size: 32,  unit: "oz",    package: "carton",  avgCost: 1.59 },
  "broth":                         { size: 32,  unit: "oz",    package: "carton",  avgCost: 1.59 },
  "peanut butter":                 { size: 16,  unit: "oz",    package: "jar",     avgCost: 3.99 },
  "almond butter":                 { size: 12,  unit: "oz",    package: "jar",     avgCost: 8.99 },
  "salsa":                         { size: 16,  unit: "oz",    package: "jar",     avgCost: 3.49 },

  // ── Oils & condiments ────────────────────────────────────────────────────
  "olive oil":                     { size: 16,  unit: "oz",    package: "bottle",  avgCost: 6.49 },
  "extra virgin olive oil":        { size: 16,  unit: "oz",    package: "bottle",  avgCost: 6.49 },
  "vegetable oil":                 { size: 48,  unit: "oz",    package: "bottle",  avgCost: 3.99 },
  "canola oil":                    { size: 48,  unit: "oz",    package: "bottle",  avgCost: 3.99 },
  "sesame oil":                    { size: 8,   unit: "oz",    package: "bottle",  avgCost: 5.99 },
  "coconut oil":                   { size: 14,  unit: "oz",    package: "jar",     avgCost: 7.99 },
  "soy sauce":                     { size: 15,  unit: "oz",    package: "bottle",  avgCost: 2.49 },
  "low sodium soy sauce":          { size: 15,  unit: "oz",    package: "bottle",  avgCost: 2.79 },
  "fish sauce":                    { size: 10,  unit: "oz",    package: "bottle",  avgCost: 4.99 },
  "hot sauce":                     { size: 5,   unit: "oz",    package: "bottle",  avgCost: 3.29 },
  "sriracha":                      { size: 17,  unit: "oz",    package: "bottle",  avgCost: 4.49 },
  "vinegar":                       { size: 16,  unit: "oz",    package: "bottle",  avgCost: 2.79 },
  "red wine vinegar":              { size: 16,  unit: "oz",    package: "bottle",  avgCost: 2.79 },
  "apple cider vinegar":           { size: 16,  unit: "oz",    package: "bottle",  avgCost: 2.49 },
  "balsamic vinegar":              { size: 16,  unit: "oz",    package: "bottle",  avgCost: 3.99 },
  "rice vinegar":                  { size: 10,  unit: "oz",    package: "bottle",  avgCost: 3.49 },
  "bbq sauce":                     { size: 15,  unit: "oz",    package: "bottle",  avgCost: 3.79 },
  "worcestershire":                { size: 10,  unit: "oz",    package: "bottle",  avgCost: 3.29 },
  "oyster sauce":                  { size: 9,   unit: "oz",    package: "bottle",  avgCost: 3.99 },
  "hoisin sauce":                  { size: 8,   unit: "oz",    package: "jar",     avgCost: 3.49 },
  "dijon mustard":                 { size: 8,   unit: "oz",    package: "jar",     avgCost: 3.49 },
  "mustard":                       { size: 8,   unit: "oz",    package: "jar",     avgCost: 2.49 },
  "ketchup":                       { size: 20,  unit: "oz",    package: "bottle",  avgCost: 2.99 },
  "tahini":                        { size: 16,  unit: "oz",    package: "jar",     avgCost: 6.99 },
  "maple syrup":                   { size: 12,  unit: "oz",    package: "bottle",  avgCost: 9.99 },
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
    const itemUnit = (unit || "").toLowerCase().trim();

    let pkgCount;

    if (COUNT_UNITS.has(pkgUnit) || pkgUnit === "each") {
      pkgCount = Math.ceil(qty / pkg.size);
    } else {
      const neededOz = toOz(qty, itemUnit) ?? qty;
      const pkgOz    = toOz(pkg.size, pkgUnit) ?? pkg.size;
      pkgCount = Math.max(1, Math.ceil(neededOz / pkgOz));
    }

    const cost = pkgCount * pkg.avgCost;
    const pkgLabel = pkgCount === 1
      ? `1 ${pkg.package}`
      : `${pkgCount} ${pkg.package}${pkg.package.endsWith("s") || pkg.package === "bunch" ? "" : "s"}`;

    console.log(`  Package size: ${pkg.size} ${pkg.unit} @ $${pkg.avgCost}`);
    console.log(`  Packages needed: Math.ceil(${qty} ${unit || ""} → oz / ${pkg.size} ${pkg.unit}) = ${pkgCount}`);
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
