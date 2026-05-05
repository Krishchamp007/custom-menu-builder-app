import type { Macros } from "@/types";
import { fmtMacro } from "@/lib/macros";

type Props = { macros: Macros; targetProtein?: number; compact?: boolean };

export function MacroBar({ macros, targetProtein, compact }: Props) {
  const items = [
    { label: "P", value: macros.protein, color: "bg-protein", target: targetProtein },
    { label: "C", value: macros.carbs, color: "bg-carbs" },
    { label: "F", value: macros.fat, color: "bg-fat" },
  ];
  return (
    <div className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${it.color}`} />
          <span className="text-text font-medium">{fmtMacro(it.value)}g</span>
          <span className="text-muted">{it.label}</span>
          {it.target && (
            <span className="text-muted text-[10px]">/ {it.target}g</span>
          )}
        </div>
      ))}
      <div className="ml-auto text-muted">
        <span className="text-text font-medium">{fmtMacro(macros.calories)}</span>{" "}
        <span className={compact ? "text-[10px]" : ""}>kcal</span>
      </div>
    </div>
  );
}
