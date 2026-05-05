import { Sparkles, KeyRound, Sun, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";

type Props = {
  hasKey: boolean;
  generating: boolean;
  progress?: { msg: string; done: number; total: number } | null;
  onGenerateWeek: () => void;
  onGenerateDay: () => void;
};

export function EmptyState({
  hasKey,
  generating,
  progress,
  onGenerateWeek,
  onGenerateDay,
}: Props) {
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : null;

  return (
    <div className="space-y-5 mt-2">
      <header className="space-y-1.5 pt-2">
        <div className="meal-tag">Welcome</div>
        <h1 className="display text-3xl font-semibold leading-tight">
          Plan a healthy menu.
        </h1>
        <p className="text-sm text-muted leading-relaxed">
          High-protein vegetarian, mixing Indian and western dishes. Recipes
          written for an Indian home cook, with bilingual ingredient names and
          a printable shopping list.
        </p>
      </header>

      {generating && progress ? (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Sparkles size={18} className="text-accent animate-pulse" />
            <div className="text-sm text-text">{progress.msg}</div>
          </div>
          <div className="h-1.5 bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500 ease-out"
              style={{ width: `${pct ?? 8}%` }}
            />
          </div>
        </div>
      ) : hasKey ? (
        <div className="grid gap-2.5">
          <button onClick={onGenerateWeek} className="btn-primary py-3.5 text-base">
            <CalendarDays size={18} />
            Plan this week
          </button>
          <button onClick={onGenerateDay} className="btn-ghost py-3.5 text-base">
            <Sun size={18} />
            Just today
          </button>
        </div>
      ) : (
        <Link to="/settings" className="btn-ghost py-3.5 text-base">
          <KeyRound size={16} />
          Enter passcode to start
        </Link>
      )}
    </div>
  );
}
