import type { DayPlan, Macros, WeeklyMenu } from "@/types";

const ZERO: Macros = { protein: 0, carbs: 0, fat: 0, calories: 0 };

export function dayMacros(day: DayPlan): Macros {
  return [day.breakfast, day.lunch, day.dinner].reduce(
    (acc, d) => ({
      protein: acc.protein + d.macros.protein,
      carbs: acc.carbs + d.macros.carbs,
      fat: acc.fat + d.macros.fat,
      calories: acc.calories + d.macros.calories,
    }),
    ZERO,
  );
}

export function weekMacros(menu: WeeklyMenu): Macros {
  return menu.days.reduce(
    (acc, day) => {
      const dm = dayMacros(day);
      return {
        protein: acc.protein + dm.protein,
        carbs: acc.carbs + dm.carbs,
        fat: acc.fat + dm.fat,
        calories: acc.calories + dm.calories,
      };
    },
    { ...ZERO },
  );
}

export function fmtMacro(n: number): string {
  return Math.round(n).toString();
}
