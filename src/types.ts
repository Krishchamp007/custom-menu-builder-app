export type MealSlot = "breakfast" | "lunch" | "dinner";
export type Cuisine = "indian" | "western";
export type CuisinePref = "indian" | "western" | "either";

export type Macros = {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
};

export type IngredientCategory =
  | "produce"
  | "dairy"
  | "grains"
  | "legumes"
  | "spices"
  | "pantry"
  | "other";

export type Ingredient = {
  name: string;
  quantity: number;
  unit: string;
  category: IngredientCategory;
};

export type Dish = {
  id: string;
  name: string;
  cuisine: Cuisine;
  meal: MealSlot;
  servings: number;
  totalMinutes: number;
  ingredients: Ingredient[];
  recipe: string[];
  tip?: string;
  macros: Macros;
};

export type DayPlan = {
  date: string;
  breakfast: Dish;
  lunch: Dish;
  dinner: Dish;
};

export type WeeklyMenu = {
  id: string;
  generatedAt: string;
  weekStart: string;
  days: DayPlan[];
};

export type SlotCuisine = Record<MealSlot, CuisinePref>;

export type Settings = {
  apiKey: string;     // direct mode: user's own Anthropic key (dev / personal use)
  passcode: string;   // proxy mode: shared passcode for the deployed app
  proteinTargetG: number;
  caloriesTarget: number;
  servings: number;
  slotCuisine: SlotCuisine;
  dislikedIngredients: string[];
};

export type RunOptions = {
  proteinTargetG: number;
  caloriesTarget: number;
  servings: number;
  slotCuisine: SlotCuisine;
  dislikedIngredients: string[];
  notes?: string;
};

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  passcode: "",
  proteinTargetG: 100,
  caloriesTarget: 2000,
  servings: 2,
  slotCuisine: { breakfast: "either", lunch: "either", dinner: "either" },
  dislikedIngredients: [],
};
