import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Sparkles, Sun, X } from "lucide-react";
import type { CuisinePref, MealSlot, RunOptions, Settings, SlotCuisine } from "@/types";

type Mode = "day" | "week";

type Props = {
  open: boolean;
  mode: Mode;
  settings: Settings;
  onCancel: () => void;
  onConfirm: (opts: Partial<RunOptions>, persist: boolean) => void;
};

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

const CUISINE_OPTIONS: { value: CuisinePref; label: string }[] = [
  { value: "indian", label: "Indian" },
  { value: "western", label: "Western" },
  { value: "either", label: "Either" },
];

export function PreferencesSheet({ open, mode, settings, onCancel, onConfirm }: Props) {
  const [protein, setProtein] = useState(settings.proteinTargetG);
  const [calories, setCalories] = useState(settings.caloriesTarget);
  const [servings, setServings] = useState(settings.servings);
  const [slotCuisine, setSlotCuisine] = useState<SlotCuisine>(settings.slotCuisine);
  const [notes, setNotes] = useState("");
  const [persist, setPersist] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProtein(settings.proteinTargetG);
    setCalories(settings.caloriesTarget);
    setServings(settings.servings);
    setSlotCuisine(settings.slotCuisine);
    setNotes("");
    setPersist(false);
  }, [open, settings]);

  const headerIcon = useMemo(
    () => (mode === "week" ? CalendarDays : Sun),
    [mode],
  );
  const Icon = headerIcon;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center no-print">
      <button
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md bg-surface rounded-t-3xl shadow-sheet border-t border-border max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-border px-5 py-4 flex items-start justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-elevated border border-border flex items-center justify-center text-accent">
              <Icon size={18} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="display text-lg font-semibold leading-tight">
                {mode === "week" ? "Plan a week" : "Plan today"}
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Tweak preferences for this run.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-elevated flex items-center justify-center text-muted hover:text-text"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="label mb-0">Daily protein target</label>
              <span className="text-accent font-semibold">{protein}g</span>
            </div>
            <input
              type="range"
              min={60}
              max={200}
              step={5}
              value={protein}
              onChange={(e) => setProtein(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-[10px] text-muted mt-1">
              <span>60g</span>
              <span>130g</span>
              <span>200g</span>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="label mb-0">Daily calories</label>
              <span className="text-accent font-semibold">{calories} kcal</span>
            </div>
            <input
              type="range"
              min={1200}
              max={3500}
              step={50}
              value={calories}
              onChange={(e) => setCalories(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-[10px] text-muted mt-1">
              <span>1200</span>
              <span>2350</span>
              <span>3500</span>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="label mb-0">Servings per dish</label>
              <span className="text-accent font-semibold">{servings}</span>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </div>

          <div className="space-y-2.5">
            <label className="label mb-0">Cuisine per meal</label>
            {(["breakfast", "lunch", "dinner"] as const).map((slot) => (
              <div key={slot} className="flex items-center gap-3">
                <span className="w-20 text-sm text-muted">{SLOT_LABELS[slot]}</span>
                <div className="seg grid-cols-3 flex-1">
                  {CUISINE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() =>
                        setSlotCuisine((prev) => ({ ...prev, [slot]: o.value }))
                      }
                      className={`seg-btn ${
                        slotCuisine[slot] === o.value ? "seg-btn-active" : ""
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="label">Anything specific?</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. lighter dinners, no oats, extra paneer"
              className="input resize-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={persist}
              onChange={(e) => setPersist(e.target.checked)}
              className="accent-accent"
            />
            Save these as my defaults
          </label>
        </div>

        <div className="sticky bottom-0 bg-surface border-t border-border px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            onClick={() =>
              onConfirm(
                {
                  proteinTargetG: protein,
                  caloriesTarget: calories,
                  servings,
                  slotCuisine,
                  dislikedIngredients: settings.dislikedIngredients,
                  notes: notes.trim() || undefined,
                },
                persist,
              )
            }
            className="btn-primary w-full"
          >
            <Sparkles size={16} />
            Generate {mode === "week" ? "weekly" : "daily"} menu
          </button>
        </div>
      </div>
    </div>
  );
}
