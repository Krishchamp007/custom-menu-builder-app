import { Link, useParams } from "react-router-dom";
import { ChevronLeft, CirclePlay, Clock, Lightbulb, Printer, Users } from "lucide-react";
import { useStore } from "@/lib/storage";
import { MacroBar } from "@/components/MacroBar";
import type { MealSlot } from "@/types";

function youtubeSearchUrl(name: string, cuisine: string): string {
  const q = cuisine === "indian" ? `${name} recipe hindi` : `${name} recipe`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export default function DishPage() {
  const { dayIndex, slot } = useParams<{ dayIndex: string; slot: MealSlot }>();
  const { menu } = useStore();
  const di = Number(dayIndex);
  const day = menu?.days[di];
  const dish = day && slot ? day[slot] : undefined;

  if (!dish || !day) {
    return (
      <div className="card p-6 text-center text-muted mt-6">
        Dish not found.{" "}
        <Link to="/" className="text-accent">
          Back to menu
        </Link>
      </div>
    );
  }

  const totalMin = dish.totalMinutes;
  const ytUrl = youtubeSearchUrl(dish.name, dish.cuisine);

  return (
    <article className="space-y-5 recipe-page mt-1">
      <div className="no-print">
        <Link to="/" className="inline-flex items-center text-sm text-muted hover:text-text">
          <ChevronLeft size={16} /> Menu
        </Link>
      </div>

      <header className="space-y-2">
        <div className="meal-tag capitalize">
          {slot} · {dish.cuisine}
        </div>
        <h1 className="display text-3xl font-semibold leading-tight">{dish.name}</h1>
        <div className="flex flex-wrap gap-3 text-sm text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock size={14} /> {totalMin} min total
          </span>
          <span className="inline-flex items-center gap-1">
            <Users size={14} /> Serves {dish.servings}
          </span>
        </div>
      </header>

      <a
        href={ytUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="card p-3.5 flex items-center gap-3 hover:bg-elevated transition no-print"
      >
        <div className="w-10 h-10 rounded-xl bg-elevated border border-border flex items-center justify-center text-accent-deep">
          <CirclePlay size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Watch how it's made</div>
          <div className="text-xs text-muted truncate">YouTube · "{dish.name}"</div>
        </div>
        <ChevronLeft size={16} className="rotate-180 text-muted" />
      </a>

      <div className="card p-4">
        <div className="meal-tag mb-2">Per serving</div>
        <MacroBar macros={dish.macros} />
      </div>

      <section className="card p-4">
        <h2 className="display text-lg font-semibold mb-3">Ingredients</h2>
        <ul className="divide-y divide-border">
          {dish.ingredients.map((ing, i) => (
            <li key={i} className="flex justify-between items-baseline gap-3 py-2.5">
              <span className="capitalize">{ing.name}</span>
              <span className="text-muted text-sm tabular-nums whitespace-nowrap">
                {ing.quantity} {ing.unit}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-4">
        <h2 className="display text-lg font-semibold mb-3">Method</h2>
        <ol className="space-y-3.5">
          {dish.recipe.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-7 h-7 rounded-full bg-elevated border border-border text-accent text-sm font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="leading-relaxed text-[15px] pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {dish.tip && (
        <section className="card p-4 bg-elevated">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={16} className="text-accent" />
            <h2 className="display text-lg font-semibold">Cook's tip</h2>
          </div>
          <p className="text-sm leading-relaxed">{dish.tip}</p>
        </section>
      )}

      <button onClick={() => window.print()} className="btn-ghost w-full no-print">
        <Printer size={16} /> Print recipe
      </button>
    </article>
  );
}
