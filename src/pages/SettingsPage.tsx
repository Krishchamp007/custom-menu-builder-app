import { useState } from "react";
import { Eye, EyeOff, Plus, Trash2, X, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/storage";
import { useToast } from "@/components/Toast";
import { ENV_API_KEY, pingKey } from "@/lib/anthropic";
import type { CuisinePref, MealSlot } from "@/types";

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

export default function SettingsPage() {
  const { settings, setSettings, clearAll } = useStore();
  const toast = useToast();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dislike, setDislike] = useState("");

  const handleTest = async () => {
    if (!settings.apiKey && !ENV_API_KEY) {
      toast.push("Paste a key first, or set VITE_ANTHROPIC_API_KEY in .env.local.", "error");
      return;
    }
    setTesting(true);
    try {
      await pingKey(settings.apiKey);
      toast.push("Key works.", "success");
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Key failed.", "error");
    } finally {
      setTesting(false);
    }
  };

  const addDislike = () => {
    const v = dislike.trim().toLowerCase();
    if (!v) return;
    if (settings.dislikedIngredients.includes(v)) {
      setDislike("");
      return;
    }
    setSettings({ dislikedIngredients: [...settings.dislikedIngredients, v] });
    setDislike("");
  };

  const removeDislike = (v: string) => {
    setSettings({
      dislikedIngredients: settings.dislikedIngredients.filter((x) => x !== v),
    });
  };

  return (
    <div className="space-y-5 mt-1">
      <header className="space-y-1 pt-1">
        <div className="meal-tag">Preferences</div>
        <h1 className="display text-3xl font-semibold">Settings</h1>
      </header>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Anthropic API key</h2>
        {ENV_API_KEY && !settings.apiKey ? (
          <div className="flex items-center gap-2 bg-elevated border border-accent/40 rounded-xl px-3 py-2.5 text-sm">
            <ShieldCheck size={16} className="text-accent" />
            <span>Using key from .env.local</span>
            <button
              onClick={handleTest}
              disabled={testing}
              className="ml-auto btn-subtle py-1.5 px-3 text-xs"
            >
              {testing ? "Testing…" : "Test"}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={showKey ? "text" : "password"}
                placeholder={ENV_API_KEY ? "Override .env.local key…" : "sk-ant-…"}
                value={settings.apiKey}
                onChange={(e) => setSettings({ apiKey: e.target.value })}
                className="input pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-muted hover:text-text"
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button onClick={handleTest} disabled={testing} className="btn-ghost shrink-0">
              {testing ? "Testing…" : "Test"}
            </button>
          </div>
        )}
        <p className="text-xs text-muted">
          {ENV_API_KEY
            ? "Edit .env.local and restart the dev server to change. Field above overrides it."
            : "Stored in your browser only. Get one at console.anthropic.com."}
        </p>
      </section>

      <section className="card p-4 space-y-5">
        <h2 className="text-sm font-semibold">Defaults for every menu</h2>
        <p className="text-xs text-muted -mt-3">
          You'll be asked to confirm or tweak these each time you generate.
        </p>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="label mb-0">Daily protein target</label>
            <span className="text-accent font-semibold">{settings.proteinTargetG}g</span>
          </div>
          <input
            type="range"
            min={60}
            max={200}
            step={5}
            value={settings.proteinTargetG}
            onChange={(e) => setSettings({ proteinTargetG: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="label mb-0">Daily calories</label>
            <span className="text-accent font-semibold">{settings.caloriesTarget} kcal</span>
          </div>
          <input
            type="range"
            min={1200}
            max={3500}
            step={50}
            value={settings.caloriesTarget}
            onChange={(e) => setSettings({ caloriesTarget: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="label mb-0">Servings per dish</label>
            <span className="text-accent font-semibold">{settings.servings}</span>
          </div>
          <input
            type="range"
            min={1}
            max={6}
            step={1}
            value={settings.servings}
            onChange={(e) => setSettings({ servings: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Cuisine preference per meal</h2>
        <p className="text-xs text-muted -mt-1">
          E.g. always Indian breakfast, lunch up to the chef, western dinners.
        </p>
        {(["breakfast", "lunch", "dinner"] as const).map((slot) => (
          <div key={slot} className="flex items-center gap-3">
            <span className="w-20 text-sm text-muted">{SLOT_LABELS[slot]}</span>
            <div className="seg grid-cols-3 flex-1">
              {CUISINE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() =>
                    setSettings({
                      slotCuisine: { ...settings.slotCuisine, [slot]: o.value },
                    })
                  }
                  className={`seg-btn ${
                    settings.slotCuisine[slot] === o.value ? "seg-btn-active" : ""
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Disliked ingredients</h2>
        <div className="flex gap-2">
          <input
            value={dislike}
            onChange={(e) => setDislike(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDislike();
              }
            }}
            placeholder="e.g. mushrooms"
            className="input"
          />
          <button onClick={addDislike} className="btn-ghost shrink-0" aria-label="Add">
            <Plus size={16} />
          </button>
        </div>
        {settings.dislikedIngredients.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {settings.dislikedIngredients.map((d) => (
              <span key={d} className="chip text-text">
                {d}
                <button onClick={() => removeDislike(d)} aria-label={`Remove ${d}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4">
        <button
          onClick={() => {
            if (confirm("Clear API key, settings, and saved menu?")) {
              clearAll();
              toast.push("All data cleared.", "success");
            }
          }}
          className="btn-ghost w-full text-fat"
        >
          <Trash2 size={16} /> Clear all data
        </button>
      </section>
    </div>
  );
}
