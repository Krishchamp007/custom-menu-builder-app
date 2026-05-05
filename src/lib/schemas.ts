// Compact schemas — short field names cut output tokens significantly.
// Each "name", "qty", etc. is 1-2 tokens vs "ingredientName", "quantity" being 4-5.
// Per-day output drops from ~1500 tokens to ~700 tokens with this schema.

export const DISH_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Authentic dish name." },
    mins: { type: "number", description: "Total prep + cook time in minutes." },
    ing: {
      type: "array",
      description: "Ingredients. Each is a single object.",
      items: {
        type: "object",
        properties: {
          n: { type: "string", description: "Short lowercase name. Indian spices/dals can embed Hindi like 'haldi/turmeric', 'jeera', 'urad dal'. Skip Hindi for obvious items like tomato, onion, salt." },
          q: { type: "number", description: "Quantity." },
          u: { type: "string", enum: ["g", "ml", "tbsp", "tsp", "piece", "cup", "pinch"] },
          c: { type: "string", enum: ["produce", "dairy", "grains", "legumes", "spices", "pantry", "other"] },
        },
        required: ["n", "q", "u", "c"],
      },
    },
    rec: {
      type: "array",
      items: { type: "string" },
      minItems: 4,
      maxItems: 5,
      description: "4-5 terse numbered steps for an Indian home cook. One short sentence each. Include sensory cue (e.g. 'until oil separates'). Use desi terms where natural.",
    },
    tip: {
      type: "string",
      description: "Optional 1-sentence cook tip. Empty string if none.",
    },
    m: {
      type: "object",
      description: "Macros per serving.",
      properties: {
        p: { type: "number", description: "Protein in grams." },
        c: { type: "number", description: "Carbs in grams." },
        f: { type: "number", description: "Fat in grams." },
        k: { type: "number", description: "Calories." },
      },
      required: ["p", "c", "f", "k"],
    },
  },
  required: ["name", "mins", "ing", "rec", "m"],
} as const;

const PLAN_SLOT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Distinct dish name." },
    cuisine: { type: "string", enum: ["indian", "western"] },
  },
  required: ["name", "cuisine"],
} as const;

export const PLAN_SCHEMA = {
  type: "object",
  properties: {
    days: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          breakfast: PLAN_SLOT_SCHEMA,
          lunch: PLAN_SLOT_SCHEMA,
          dinner: PLAN_SLOT_SCHEMA,
        },
        required: ["breakfast", "lunch", "dinner"],
      },
    },
  },
  required: ["days"],
} as const;

export const DAY_SCHEMA = {
  type: "object",
  properties: {
    breakfast: DISH_SCHEMA,
    lunch: DISH_SCHEMA,
    dinner: DISH_SCHEMA,
  },
  required: ["breakfast", "lunch", "dinner"],
} as const;
