import type { DayPlan, MealSlot } from "@/types";
import { DishCard } from "./DishCard";
import { MacroBar } from "./MacroBar";
import { dayMacros } from "@/lib/macros";

type Props = {
  day: DayPlan;
  dayIndex: number;
  proteinTarget: number;
  swapping: { dayIndex: number; slot: MealSlot } | null;
  onSwap: (slot: MealSlot) => void;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function DaySection({ day, dayIndex, proteinTarget, swapping, onSwap }: Props) {
  const dm = dayMacros(day);
  const d = new Date(day.date);
  const label = Number.isNaN(d.getTime())
    ? `Day ${dayIndex + 1}`
    : `${DAY_LABELS[(d.getDay() + 6) % 7]}, ${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`;

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="display text-xl font-semibold tracking-tight">{label}</h2>
        <span className="text-xs text-muted">Day {dayIndex + 1}</span>
      </div>
      <div className="card px-3.5 py-2.5">
        <MacroBar macros={dm} targetProtein={proteinTarget} />
      </div>
      <div className="grid gap-2.5">
        {(["breakfast", "lunch", "dinner"] as const).map((slot) => (
          <DishCard
            key={slot}
            dish={day[slot]}
            slot={slot}
            dayIndex={dayIndex}
            onSwap={() => onSwap(slot)}
            swapping={
              swapping?.dayIndex === dayIndex && swapping?.slot === slot
            }
          />
        ))}
      </div>
    </section>
  );
}
