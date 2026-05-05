import { Link } from "react-router-dom";
import { Shuffle, Clock } from "lucide-react";
import type { Dish, MealSlot } from "@/types";
import { MacroBar } from "./MacroBar";

type Props = {
  dish: Dish;
  slot: MealSlot;
  dayIndex: number;
  onSwap: () => void;
  swapping: boolean;
};

const slotLabel: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export function DishCard({ dish, slot, dayIndex, onSwap, swapping }: Props) {
  return (
    <div className="card p-4 flex flex-col gap-3 relative overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="meal-tag">{slotLabel[slot]}</div>
          <Link
            to={`/dish/${dayIndex}/${slot}`}
            className="block mt-1 text-base font-semibold leading-tight truncate hover:text-accent"
          >
            {dish.name}
          </Link>
        </div>
        <button
          onClick={onSwap}
          disabled={swapping}
          aria-label="Swap dish"
          className="shrink-0 w-9 h-9 rounded-full bg-elevated border border-border flex items-center justify-center text-muted hover:text-accent hover:border-accent active:scale-95 disabled:opacity-50 transition"
        >
          <Shuffle size={15} className={swapping ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="chip capitalize">{dish.cuisine}</span>
        <span className="inline-flex items-center gap-1">
          <Clock size={11} />
          {dish.totalMinutes} min
        </span>
      </div>
      <MacroBar macros={dish.macros} compact />
    </div>
  );
}
