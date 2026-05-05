import type Anthropic from "@anthropic-ai/sdk";
import { getClient, MODEL_ID } from "./anthropic";
import { DAY_SCHEMA, DISH_SCHEMA, PLAN_SCHEMA } from "./schemas";
import { mapWithConcurrency, withRetry } from "./concurrency";
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
- 4-5 short numbered steps. One sentence each.
- Use desi verbs: tadka, bhuno, dum.
- Each step has a sensory cue ("until oil separates", "till golden").

Ingredient names: short lowercase. For spices/dals/less-obvious items, embed Hindi like "haldi/turmeric", "jeera", "urad dal", "kasuri methi". Skip Hindi for obvious items: tomato, onion, garlic, salt, oil.

Macros: per serving, realistic.

Output ONLY via the tool. Use the compact field names exactly as defined.`;

// Compact wire format from the model.
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
type PlanSlot = { name: string; cuisine: Cuisine };
type PlanResult = {
  days: Array<{ breakfast: PlanSlot; lunch: PlanSlot; dinner: PlanSlot }>;
};
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

function addCost(a: RunCost, b: RunCost): RunCost {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    usd: a.usd + b.usd,
  };
}

// Compact wire format -> normalized Dish for the rest of the app.
function unpack(
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

async function planMenu(
  client: Anthropic,
  opts: RunOptions,
): Promise<{ plan: PlanResult; cost: RunCost }> {
  const userMsg = `Plan a 7-day menu (21 distinct dishes total). For each day return breakfast/lunch/dinner with name + cuisine ONLY (no recipes yet).

${preferencesBlock(opts)}

Vary breakfast styles (parathas, dosa, oats, eggs, smoothie, poha, chillas). All distinct.

Submit via submit_plan.`;

  const res = await withRetry(() =>
    client.messages.create({
      model: MODEL_ID,
      max_tokens: 700,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [
        {
          name: "submit_plan",
          description: "Submit the 21-dish weekly plan with names + cuisines only.",
          input_schema: PLAN_SCHEMA as unknown as ToolSchema,
        },
      ],
      tool_choice: { type: "tool", name: "submit_plan" },
      messages: [{ role: "user", content: userMsg }],
    }),
  );

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Plan returned no tool use.");
  if (res.stop_reason === "max_tokens") throw new Error("Plan was truncated.");
  const plan = toolUse.input as PlanResult;
  if (!plan.days || plan.days.length !== 7) throw new Error("Plan returned an incomplete week.");
  return { plan, cost: calcCost(res.usage) };
}

async function detailDay(
  client: Anthropic,
  opts: RunOptions,
  planDay: PlanResult["days"][number],
  dayIdx: number,
): Promise<{ day: ToolDayResult; cost: RunCost }> {
  const userMsg = `Write recipes for day ${dayIdx + 1}'s 3 meals. Use these EXACT names and cuisines:
- breakfast: "${planDay.breakfast.name}" (${planDay.breakfast.cuisine})
- lunch: "${planDay.lunch.name}" (${planDay.lunch.cuisine})
- dinner: "${planDay.dinner.name}" (${planDay.dinner.cuisine})

${preferencesBlock(opts)}

Submit all 3 via submit_day.`;

  const res = await withRetry(() =>
    client.messages.create({
      model: MODEL_ID,
      max_tokens: 1300,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [
        {
          name: "submit_day",
          description: "Submit the 3 dishes for this day using compact field names.",
          input_schema: DAY_SCHEMA as unknown as ToolSchema,
        },
      ],
      tool_choice: { type: "tool", name: "submit_day" },
      messages: [{ role: "user", content: userMsg }],
    }),
  );

  console.log(`[detailDay ${dayIdx + 1}] usage:`, res.usage, "stop_reason:", res.stop_reason);

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Day ${dayIdx + 1} returned no tool use.`);
  }
  if (res.stop_reason === "max_tokens") {
    console.error(`[detailDay ${dayIdx + 1}] truncated`, toolUse.input);
    throw new Error(`Day ${dayIdx + 1} truncated at ${res.usage.output_tokens} tokens.`);
  }
  const day = toolUse.input as ToolDayResult;
  if (!day?.breakfast?.m || !day?.lunch?.m || !day?.dinner?.m) {
    throw new Error(`Day ${dayIdx + 1} returned incomplete data.`);
  }
  return { day, cost: calcCost(res.usage) };
}

export async function generateWeek(
  settings: Settings,
  onProgress?: ProgressCb,
  override?: Partial<RunOptions>,
): Promise<{ menu: WeeklyMenu; cost: RunCost }> {
  const client = getClient(settings.apiKey);
  const opts = settingsToOptions(settings, override);

  onProgress?.("Planning your week…");
  const planRes = await planMenu(client, opts);
  let totalCost = planRes.cost;

  let done = 0;
  const total = 7;
  onProgress?.(`Cooking 0/${total} days…`, 0, total);

  const detailResults = await mapWithConcurrency(
    planRes.plan.days,
    3,
    async (planDay, i) => {
      const result = await detailDay(client, opts, planDay, i);
      done++;
      onProgress?.(`Cooking ${done}/${total} days…`, done, total);
      return { ...result, planDay };
    },
  );

  for (const r of detailResults) totalCost = addCost(totalCost, r.cost);

  const today = new Date();
  const days = detailResults.map((r, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    return {
      date: date.toISOString().slice(0, 10),
      breakfast: unpack(r.day.breakfast, r.planDay.breakfast.cuisine, "breakfast", opts.servings),
      lunch: unpack(r.day.lunch, r.planDay.lunch.cuisine, "lunch", opts.servings),
      dinner: unpack(r.day.dinner, r.planDay.dinner.cuisine, "dinner", opts.servings),
    };
  });

  return {
    menu: {
      id: crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      weekStart: today.toISOString().slice(0, 10),
      days,
    },
    cost: totalCost,
  };
}

export async function generateDay(
  settings: Settings,
  onProgress?: ProgressCb,
  override?: Partial<RunOptions>,
): Promise<{ menu: WeeklyMenu; cost: RunCost }> {
  const client = getClient(settings.apiKey);
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
  if (!toolUse || toolUse.type !== "tool_use") {
    console.error("[generateDay] non-tool content:", res.content);
    throw new Error("Model did not return a menu.");
  }
  if (res.stop_reason === "max_tokens") {
    console.error("[generateDay] truncated. partial input:", toolUse.input);
    throw new Error(
      `Truncated at ${res.usage.output_tokens} output tokens (limit 4000). Schema still too verbose — file an issue.`,
    );
  }
  const day = toolUse.input as ToolDayResult;
  if (!day?.breakfast?.m || !day?.lunch?.m || !day?.dinner?.m) {
    console.error("[generateDay] incomplete day:", day);
    throw new Error("Got an incomplete menu. Try again.");
  }

  // Infer cuisine from slot pref or fallback.
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
          breakfast: unpack(day.breakfast, guess("breakfast"), "breakfast", opts.servings),
          lunch: unpack(day.lunch, guess("lunch"), "lunch", opts.servings),
          dinner: unpack(day.dinner, guess("dinner"), "dinner", opts.servings),
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
  const client = getClient(settings.apiKey);
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
      max_tokens: 600,
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

  const toolUse = res.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Swap returned no dish.");
  if (res.stop_reason === "max_tokens") throw new Error("Swap was truncated. Try again.");
  const raw = toolUse.input as RawDish;
  if (!raw?.m) throw new Error("Swap returned incomplete data.");

  const cuisine: Cuisine =
    cuisinePref === "western" ? "western" : cuisinePref === "indian" ? "indian" : "indian";
  return {
    dish: unpack(raw, cuisine, slot, opts.servings),
    cost: calcCost(res.usage),
  };
}

export { ZERO_COST };
