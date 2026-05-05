// Schemas for tool_use calls (day + swap). Use natural field names so the
// model is less likely to misformat the response. The prefilled JSON path
// (used by generateWeek) uses tighter compact names because it's documented
// inline in the prompt; that's a separate format defined in generateWeek.ts.

export const DISH_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Authentic dish name." },
    cuisine: { type: "string", enum: ["indian", "western"] },
    meal: { type: "string", enum: ["breakfast", "lunch", "dinner"] },
    totalMinutes: { type: "number", description: "Total prep + cook time." },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short lowercase name. Indian spices/dals can embed Hindi like 'haldi/turmeric', 'jeera', 'urad dal'. Skip Hindi for obvious items." },
          quantity: { type: "number" },
          unit: { type: "string", enum: ["g", "ml", "tbsp", "tsp", "piece", "cup", "pinch"] },
          category: { type: "string", enum: ["produce", "dairy", "grains", "legumes", "spices", "pantry", "other"] },
        },
        required: ["name", "quantity", "unit", "category"],
      },
    },
    recipe: {
      type: "array",
      items: { type: "string" },
      minItems: 4,
      maxItems: 5,
      description: "4-5 terse numbered steps. Each step: one short sentence with action + sensory cue (e.g. 'until oil separates'). Use desi terms (tadka, bhuno) where natural.",
    },
    tip: {
      type: "string",
      description: "Optional 1-sentence cook tip. Empty string if none.",
    },
    macros: {
      type: "object",
      description: "Per serving.",
      properties: {
        protein: { type: "number", description: "grams" },
        carbs: { type: "number", description: "grams" },
        fat: { type: "number", description: "grams" },
        calories: { type: "number" },
      },
      required: ["protein", "carbs", "fat", "calories"],
    },
  },
  required: ["name", "cuisine", "meal", "totalMinutes", "ingredients", "recipe", "macros"],
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
