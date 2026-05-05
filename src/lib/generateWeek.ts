import type Anthropic from "@anthropic-ai/sdk";
import { getClient, MODEL_ID } from "./anthropic";
import { DAY_SCHEMA, DISH_SCHEMA } from "./schemas";
import { withRetry } from "./concurrency";
import type {
  Cuisine,
  Dish,
  Ingredient,
  IngredientCategory,
  MealSlot,
  RunOptions,
  Settings,
  WeeklyMenu,
} from "@/types";

const COST_PER_MTOK_INPUT = 1.0;
const COST_PER_MTOK_OUTPUT = 5.0;
const COST_PER_MTOK_CACHE_WRITE = 1.25;
const COST_PER_MTOK_CACHE_READ = 0.1;

const SYSTEM_PROMPT = `You plan vegetarian menus for an Indian household that also enjoys western food. The cook is an Indian home cook.

Rules:
- Strictly vegetarian (eggs, dairy OK).
- High-protein. Vary sources: paneer, tofu, soya chunks, dal, chickpeas, rajma, sprouts, Greek yogurt, eggs, peanuts.
- Cuisine follows the per-slot preference.
- All dishes in one menu must be distinct.
- Practical for a typical Indian kitchen.

Recipe steps (the cook reads this directly):
- 4-5 short numbered steps. One sentence each, ≤100 characters.
- Use desi verbs: tadka, bhuno, dum.
- Each step has a sensory cue ("until oil separates", "till golden").

Ingredient names: short lowercase. For spices/dals/less-obvious items, embed Hindi like "haldi/turmeric", "jeera", "urad dal". Skip Hindi for obvious items.

Macros: per serving, realistic.`;

type ToolSchema = Anthropic.Messages.Tool["input_schema"];

export type ProgressCb = (msg: string, done?: number, total?: number) => void;
export type RunCost = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  usd: number;
};

const ZERO_COST: RunCost = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  usd: 0,
};

function calcCost(usage: Anthropic.Messages.Usage): RunCost {
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  return {
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    usd:
      (input * COST_PER_MTOK_INPUT) / 1_000_000 +
      (output * COST_PER_MTOK_OUTPUT) / 1_000_000 +
      (cacheRead * COST_PER_MTOK_CACHE_READ) / 1_000_000 +
      (cacheWrite * COST_PER_MTOK_CACHE_WRITE) / 1_000_000,
  };
}

function slotCuisineLine(opts: RunOptions): string {
  const map = {
    indian: "Indian",
    western: "Western",
    either: "Indian OR western (varied)",
  } as const;
  return `B: ${map[opts.slotCuisine.breakfast]}. L: ${map[opts.slotCuisine.lunch]}. D: ${map[opts.slotCuisine.dinner]}.`;
}

function preferencesBlock(opts: RunOptions): string {
  const dislikes = opts.dislikedIngredients.length
    ? `Avoid: ${opts.dislikedIngredients.join(", ")}.`
    : "";
  const notes = opts.notes?.trim() ? `Notes: "${opts.notes.trim()}".` : "";
  return `Daily protein ~${opts.proteinTargetG}g. Daily kcal ~${opts.caloriesTarget}. Servings: ${opts.servings}.
Cuisine ${slotCuisineLine(opts)}
${dislikes}
${notes}`.trim();
}

function settingsToOptions(settings: Settings, override?: Partial<RunOptions>): RunOptions {
  return {
    proteinTargetG: settings.proteinTargetG,
    caloriesTarget: settings.caloriesTarget,
    servings: settings.servings,
    slotCuisine: settings.slotCuisine,
    dislikedIngredients: settings.dislikedIngredients,
    ...override,
  };
}

// Heuristic categorization for shopping-list aggregation.
function guessCategory(name: string): IngredientCategory {
  const n = name.toLowerCase();
  if (/\b(tomato|onion|potato|aloo|carrot|gajar|spinach|palak|coriander|cilantro|mint|pudina|chili|chilli|mirch|garlic|lehsun|ginger|adrak|capsicum|shimla|cauliflower|gobhi|broccoli|cucumber|kakdi|lemon|nimbu|lime|kale|sprout|methi|fenugreek|peas|matar|beetroot|pumpkin|kaddu|brinjal|baingan|bhindi|okra|mushroom|zucchini)\b/.test(n)) return "produce";
  if (/\b(milk|doodh|paneer|curd|dahi|yogurt|cheese|butter|makhan|ghee|cream|malai|egg|anda)\b/.test(n)) return "dairy";
  if (/\b(rice|chawal|basmati|atta|flour|maida|bread|pasta|noodle|quinoa|oats|poha|suji|rava|breadcrumb|tortilla|roti|naan)\b/.test(n)) return "grains";
  if (/\b(dal|daal|chickpea|chana|rajma|kidney|lentil|bean|sprout|moong|toor|urad|masoor|tofu|soya|tempeh|lobia|kabuli)\b/.test(n)) return "legumes";
  if (/\b(haldi|turmeric|jeera|cumin|dhaniya|coriander seed|garam masala|chili powder|lal mirch|salt|namak|pepper|kali mirch|hing|asafoetida|rai|mustard seed|saunf|fennel|elaichi|cardamom|dalchini|cinnamon|tej patta|bay leaf|kasuri|methi|clove|laung|star anise|kala namak|chaat masala|amchur)\b/.test(n)) return "spices";
  if (/\b(oil|tel|sugar|chini|water|pani|honey|shahad|vinegar|sirka|sauce|paste|stock|broth|baking|yeast|cocoa|chocolate|nuts|cashew|kaju|almond|badam|peanut|moongphali|sesame|til|raisin|kishmish|date|khajoor)\b/.test(n)) return "pantry";
  return "other";
}

// Parse "200 g paneer" -> { name: "paneer", quantity: 200, unit: "g" }
// Handles fractions, missing quantities, parenthetical translations.
function parseIngredient(raw: string): Ingredient {
  const trimmed = raw.trim();
  const m = trimmed.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)\s+(g|ml|tbsp|tsp|piece|pc|cup|katori|pinch|kg|l)\s+(.+)$/i);
  if (m) {
    let qty = parseFloat(m[1]);
    if (m[1].includes("/")) {
      const [n, d] = m[1].split("/").map(Number);
      qty = n / d;
    }
    let unit = m[2].toLowerCase();
    if (unit === "pc") unit = "piece";
    if (unit === "kg") {
      qty *= 1000;
      unit = "g";
    } else if (unit === "l") {
      qty *= 1000;
      unit = "ml";
    }
    return {
      name: m[3].toLowerCase().trim(),
      quantity: qty,
      unit,
      category: guessCategory(m[3]),
    };
  }
  // No quantity given (e.g. "salt", "to taste") — store as 1 piece
  return {
    name: trimmed.toLowerCase(),
    quantity: 1,
    unit: "piece",
    category: guessCategory(trimmed),
  };
}

type CompactDish = {
  n: string;          // name
  c: "i" | "w";       // cuisine
  t: number;          // total minutes
  i: string[];        // ingredient strings
  r: string[];        // recipe steps
  m: { p: number; c: number; f: number; k: number };
  x?: string;         // optional tip
};

function compactToDish(d: CompactDish, slot: MealSlot, servings: number): Dish {
  return {
    id: crypto.randomUUID(),
    name: d.n,
    cuisine: d.c === "w" ? "western" : "indian",
    meal: slot,
    servings,
    totalMinutes: d.t,
    ingredients: (d.i || []).map(parseIngredient),
    recipe: d.r || [],
    tip: d.x?.trim() || undefined,
    macros: {
      protein: d.m.p,
      carbs: d.m.c,
      fat: d.m.f,
      calories: d.m.k,
    },
  };
}

const COMPACT_FORMAT_INSTRUCTIONS = `Output a single JSON array of 21 dish objects. Order: day1.B, day1.L, day1.D, day2.B, day2.L, day2.D, ... day7.B, day7.L, day7.D. NO prose, NO markdown fences, JUST the array.

Each dish:
{"n":"Dish Name","c":"i" or "w","t":<total minutes>,"i":["<qty> <unit> <name>", ...],"r":["step 1.","step 2."],"m":{"p":<g>,"c":<g>,"f":<g>,"k":<kcal>},"x":"<optional tip or omit>"}

- 8-12 ingredients per dish, lowercase. Format: "<number> <unit> <name>". Unit: g, ml, tbsp, tsp, piece, cup, katori, pinch.
- 4-5 recipe steps, ≤100 chars each, with sensory cue and desi terms where natural.
- Macros per serving, realistic.
- All 21 dishes distinct.
- DO NOT use unicode quotes — only standard ASCII " for JSON strings.`;

export async function generateWeek(
  settings: Settings,
  onProgress?: ProgressCb,
  override?: Partial<RunOptions>,
): Promise<{ menu: WeeklyMenu; cost: RunCost }> {
  const client = getClient(settings);
  const opts = settingsToOptions(settings, override);
  onProgress?.("Generating menu…");

  const userMsg = `Plan a 7-day vegetarian menu (21 distinct dishes total).

${preferencesBlock(opts)}

Vary breakfast styles across the week (parathas, dosa, oats, eggs, smoothie, poha, chillas).

${COMPACT_FORMAT_INSTRUCTIONS}`;

  const res = await withRetry(() =>
    client.messages.create({
      model: MODEL_ID,
      max_tokens: 7000,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        { role: "user", content: userMsg },
        { role: "assistant", content: "[" }, // prefill — model continues the JSON array
      ],
    }),
  );

  console.log("[generateWeek] usage:", res.usage, "stop_reason:", res.stop_reason);

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Model returned no text content.");
  }

  // Reconstruct full JSON: prefill "[" + continuation.
  let body = "[" + textBlock.text;
  // Trim anything after the closing bracket (if model added prose despite instructions).
  const lastClose = body.lastIndexOf("]");
  if (lastClose >= 0) body = body.slice(0, lastClose + 1);

  let dishes: CompactDish[];
  try {
    dishes = JSON.parse(body);
  } catch (e) {
    console.error("[generateWeek] JSON parse failed. body:", body.slice(0, 500), "...");
    throw new Error(`Could not parse menu JSON. ${(e as Error).message}`);
  }

  if (!Array.isArray(dishes) || dishes.length !== 21) {
    throw new Error(`Expected 21 dishes, got ${dishes?.length ?? "none"}. Try again.`);
  }

  // Validate every dish has required fields.
  for (let i = 0; i < dishes.length; i++) {
    const d = dishes[i];
    if (!d?.n || !d?.m || !Array.isArray(d?.i) || !Array.isArray(d?.r)) {
      console.error(`[generateWeek] dish ${i} malformed:`, d);
      throw new Error(`Dish ${i + 1} is malformed. Try again.`);
    }
  }

  if (res.stop_reason === "max_tokens") {
    throw new Error(
      `Generation stopped at token limit (${res.usage.output_tokens}/7000). The week may be incomplete despite parsing. Try again.`,
    );
  }

  // Assemble menu.
  const today = new Date();
  const slots: MealSlot[] = ["breakfast", "lunch", "dinner"];
  const days = Array.from({ length: 7 }, (_, dayIdx) => {
    const date = new Date(today);
    date.setDate(today.getDate() + dayIdx);
    const start = dayIdx * 3;
    return {
      date: date.toISOString().slice(0, 10),
      breakfast: compactToDish(dishes[start], slots[0], opts.servings),
      lunch: compactToDish(dishes[start + 1], slots[1], opts.servings),
      dinner: compactToDish(dishes[start + 2], slots[2], opts.servings),
    };
  });

  return {
    menu: {
      id: crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      weekStart: today.toISOString().slice(0, 10),
      days,
    },
    cost: calcCost(res.usage),
  };
}

// Compact wire format from tool_use (still used for day + swap — single calls, no rate-limit pressure).
type RawIng = { n: string; q: number; u: string; c: IngredientCategory };
type RawMacros = { p: number; c: number; f: number; k: number };
type RawDish = {
  name: string;
  mins: number;
  ing: RawIng[];
  rec: string[];
  tip?: string;
  m: RawMacros;
};
type ToolDayResult = { breakfast: RawDish; lunch: RawDish; dinner: RawDish };

function unpackTool(
  raw: RawDish,
  cuisine: Cuisine,
  slot: MealSlot,
  servings: number,
): Dish {
  const ingredients: Ingredient[] = (raw.ing || []).map((i) => ({
    name: i.n,
    quantity: i.q,
    unit: i.u,
    category: i.c,
  }));
  return {
    id: crypto.randomUUID(),
    name: raw.name,
    cuisine,
    meal: slot,
    servings,
    totalMinutes: raw.mins,
    ingredients,
    recipe: raw.rec || [],
    tip: raw.tip?.trim() || undefined,
    macros: {
      protein: raw.m.p,
      carbs: raw.m.c,
      fat: raw.m.f,
      calories: raw.m.k,
    },
  };
}

export async function generateDay(
  settings: Settings,
  onProgress?: ProgressCb,
  override?: Partial<RunOptions>,
): Promise<{ menu: WeeklyMenu; cost: RunCost }> {
  const client = getClient(settings);
  const opts = settingsToOptions(settings, override);
  onProgress?.("Generating today's menu…");

  const userMsg = `Plan today's 3 meals (breakfast, lunch, dinner). All 3 differ in cuisine or main protein.

${preferencesBlock(opts)}

Submit via submit_day.`;

  const res = await withRetry(() =>
    client.messages.create({
      model: MODEL_ID,
      max_tokens: 4000,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [
        {
          name: "submit_day",
          description: "Submit today's 3-dish menu using compact field names.",
          input_schema: DAY_SCHEMA as unknown as ToolSchema,
        },
      ],
      tool_choice: { type: "tool", name: "submit_day" },
      messages: [{ role: "user", content: userMsg }],
    }),
  );

  console.log("[generateDay] usage:", res.usage, "stop_reason:", res.stop_reason);

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Model returned no tool use.");
  if (res.stop_reason === "max_tokens") {
    throw new Error(`Truncated at ${res.usage.output_tokens}/4000 tokens. Try again.`);
  }
  const day = toolUse.input as ToolDayResult;
  if (!day?.breakfast?.m || !day?.lunch?.m || !day?.dinner?.m) {
    throw new Error("Got an incomplete menu. Try again.");
  }

  const guess = (s: MealSlot): Cuisine =>
    opts.slotCuisine[s] === "western" ? "western" : "indian";
  const today = new Date().toISOString().slice(0, 10);
  return {
    menu: {
      id: crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      weekStart: today,
      days: [
        {
          date: today,
          breakfast: unpackTool(day.breakfast, guess("breakfast"), "breakfast", opts.servings),
          lunch: unpackTool(day.lunch, guess("lunch"), "lunch", opts.servings),
          dinner: unpackTool(day.dinner, guess("dinner"), "dinner", opts.servings),
        },
      ],
    },
    cost: calcCost(res.usage),
  };
}

export async function swapDish(
  settings: Settings,
  current: WeeklyMenu,
  dayIndex: number,
  slot: MealSlot,
  reason?: string,
): Promise<{ dish: Dish; cost: RunCost }> {
  const client = getClient(settings);
  const opts = settingsToOptions(settings);
  const slots: MealSlot[] = ["breakfast", "lunch", "dinner"];
  const existingNames = current.days
    .flatMap((d, i) =>
      slots
        .filter((s) => !(i === dayIndex && s === slot))
        .map((s) => d[s].name),
    )
    .join(", ");
  const cuisinePref = opts.slotCuisine[slot];

  const userMsg = `Replace the ${slot} for day ${dayIndex + 1}. Must NOT match: ${existingNames}.
${reason ? `User reason: ${reason}.` : ""}
Cuisine: ${cuisinePref === "either" ? "indian or western" : cuisinePref}. Servings: ${opts.servings}. ~${Math.round(opts.proteinTargetG / 3)}g+ protein/serving. Dislikes: ${opts.dislikedIngredients.join(", ") || "none"}.
Submit via submit_dish.`;

  const res = await withRetry(() =>
    client.messages.create({
      model: MODEL_ID,
      max_tokens: 1500,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [
        {
          name: "submit_dish",
          description: "Submit a single replacement dish using compact field names.",
          input_schema: DISH_SCHEMA as unknown as ToolSchema,
        },
      ],
      tool_choice: { type: "tool", name: "submit_dish" },
      messages: [{ role: "user", content: userMsg }],
    }),
  );

  console.log("[swapDish] usage:", res.usage, "stop_reason:", res.stop_reason);

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Swap returned no dish.");
  if (res.stop_reason === "max_tokens") {
    throw new Error(`Swap truncated at ${res.usage.output_tokens}/1500. Try again.`);
  }
  const raw = toolUse.input as RawDish;
  if (!raw?.m) throw new Error("Swap returned incomplete data.");

  const cuisine: Cuisine =
    cuisinePref === "western" ? "western" : "indian";
  return {
    dish: unpackTool(raw, cuisine, slot, opts.servings),
    cost: calcCost(res.usage),
  };
}

export { ZERO_COST };
