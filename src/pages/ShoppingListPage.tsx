import { useMemo } from "react";
import { useStore } from "@/lib/storage";
import {
  aggregateIngredients,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "@/lib/aggregateIngredients";

export default function ShoppingListPage() {
  const { menu, settings } = useStore();
  const agg = useMemo(
    () => (menu ? aggregateIngredients(menu, settings.servings) : null),
    [menu, settings.servings],
  );

  if (!menu || !agg) {
    return (
      <div className="card p-6 text-center text-muted mt-6">
        Generate a menu first to see your shopping list.
      </div>
    );
  }

  const totalCount = CATEGORY_ORDER.reduce((acc, c) => acc + agg[c].length, 0);

  return (
    <div className="space-y-5 mt-1">
      <header className="space-y-1 pt-1">
        <div className="meal-tag">Groceries</div>
        <h1 className="display text-3xl font-semibold">Shopping list</h1>
        <p className="text-sm text-muted">
          {totalCount} ingredient{totalCount === 1 ? "" : "s"} · scaled to {settings.servings} servings per dish
        </p>
      </header>

      {CATEGORY_ORDER.map((cat) => {
        const items = agg[cat];
        if (!items.length) return null;
        return (
          <section key={cat} className="card overflow-hidden">
            <header className="px-4 py-3 bg-elevated border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold">{CATEGORY_LABELS[cat]}</h2>
              <span className="text-xs text-muted">{items.length}</span>
            </header>
            <ul className="divide-y divide-border">
              {items.map((it, i) => (
                <li key={i} className="px-4 py-3 flex justify-between items-baseline gap-3">
                  <div className="min-w-0">
                    <div className="capitalize text-[15px]">{it.name}</div>
                    {it.dishes.length > 1 && (
                      <div className="text-[11px] text-muted mt-1">
                        for {it.dishes.length} dishes
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-medium tabular-nums whitespace-nowrap">
                    {it.quantity} {it.unit}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
