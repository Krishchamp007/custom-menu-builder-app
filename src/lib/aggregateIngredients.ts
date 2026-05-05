import type { Ingredient, IngredientCategory, WeeklyMenu } from "@/types";

const CATEGORY_ORDER: IngredientCategory[] = [
  "produce",
  "dairy",
  "legumes",
  "grains",
  "pantry",
  "spices",
  "other",
];

export type AggregatedItem = Ingredient & { dishes: string[] };

export function aggregateIngredients(
  menu: WeeklyMenu,
  targetServings: number,
): Record<IngredientCategory, AggregatedItem[]> {
  const map = new Map<string, AggregatedItem>();

  const dishes = menu.days.flatMap((d) => [d.breakfast, d.lunch, d.dinner]);
  for (const dish of dishes) {
    const scale = targetServings / Math.max(1, dish.servings);
    for (const ing of dish.ingredients) {
      const key = `${ing.name.trim().toLowerCase()}|${ing.unit}`;
      const existing = map.get(key);
      const scaled = ing.quantity * scale;
      if (existing) {
        existing.quantity += scaled;
        if (!existing.dishes.includes(dish.name)) existing.dishes.push(dish.name);
      } else {
        map.set(key, {
          ...ing,
          name: ing.name.trim().toLowerCase(),
          quantity: scaled,
          dishes: [dish.name],
        });
      }
    }
  }

  const out: Record<IngredientCategory, AggregatedItem[]> = {
    produce: [],
    dairy: [],
    legumes: [],
    grains: [],
    pantry: [],
    spices: [],
    other: [],
  };
  for (const item of map.values()) {
    out[item.category].push({
      ...item,
      quantity: Math.round(item.quantity * 10) / 10,
    });
  }
  for (const cat of CATEGORY_ORDER) {
    out[cat].sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}

export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  produce: "Produce",
  dairy: "Dairy & eggs",
  legumes: "Legumes & beans",
  grains: "Grains & flour",
  pantry: "Pantry",
  spices: "Spices",
  other: "Other",
};

export { CATEGORY_ORDER };
