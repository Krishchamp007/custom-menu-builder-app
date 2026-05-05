import { useState } from "react";
import { CalendarDays, Download, Sun, Sparkles } from "lucide-react";
import { useStore } from "@/lib/storage";
import { useToast } from "@/components/Toast";
import { hasAuth } from "@/lib/anthropic";
import { generateDay, generateWeek, swapDish } from "@/lib/generateWeek";
import { downloadMenuPdf } from "@/lib/pdf";
import { weekMacros, fmtMacro } from "@/lib/macros";
import { DaySection } from "@/components/DaySection";
import { EmptyState } from "@/components/EmptyState";
import { SwapSheet } from "@/components/SwapSheet";
import { PreferencesSheet } from "@/components/PreferencesSheet";
import type { MealSlot, RunOptions } from "@/types";

type GenMode = "day" | "week";

export default function WeekPage() {
  const {
    settings,
    menu,
    generating,
    progress,
    setGenerating,
    setProgress,
    setMenu,
    setSettings,
    swapping,
    setSwapping,
    replaceDish,
  } = useStore();
  const toast = useToast();
  const [sheet, setSheet] = useState<{ dayIndex: number; slot: MealSlot } | null>(null);
  const [prefs, setPrefs] = useState<{ open: boolean; mode: GenMode }>({
    open: false,
    mode: "week",
  });

  const openPrefs = (mode: GenMode) => {
    if (!hasAuth(settings)) {
      toast.push("Set a passcode in Settings first.", "error");
      return;
    }
    setPrefs({ open: true, mode });
  };

  const runGeneration = async (mode: GenMode, override: Partial<RunOptions>) => {
    setGenerating(true);
    setProgress({
      msg: mode === "week" ? "Generating menu…" : "Generating today's menu…",
      done: 0,
      total: 1,
    });
    try {
      const fn = mode === "week" ? generateWeek : generateDay;
      const { menu: m, cost } = await fn(
        settings,
        (msg, done, total) => {
          setProgress({ msg, done: done ?? 0, total: total ?? 1 });
        },
        override,
      );
      setMenu(m);
      toast.push(
        `${mode === "week" ? "Week" : "Day"} generated · $${cost.usd.toFixed(4)}`,
        "success",
      );
    } catch (e) {
      console.error(e);
      toast.push(e instanceof Error ? e.message : "Generation failed.", "error");
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  const handlePrefsConfirm = async (override: Partial<RunOptions>, persist: boolean) => {
    const mode = prefs.mode;
    setPrefs({ open: false, mode });
    if (persist) {
      setSettings({
        proteinTargetG: override.proteinTargetG ?? settings.proteinTargetG,
        caloriesTarget: override.caloriesTarget ?? settings.caloriesTarget,
        servings: override.servings ?? settings.servings,
        slotCuisine: override.slotCuisine ?? settings.slotCuisine,
      });
    }
    await runGeneration(mode, override);
  };

  const handleSwap = (dayIndex: number, slot: MealSlot) => {
    setSheet({ dayIndex, slot });
  };

  const confirmSwap = async (reason?: string) => {
    if (!sheet || !menu) return;
    const { dayIndex, slot } = sheet;
    setSheet(null);
    setSwapping({ dayIndex, slot });
    try {
      const { dish, cost } = await swapDish(settings, menu, dayIndex, slot, reason);
      replaceDish(dayIndex, slot, dish);
      toast.push(`Dish replaced · $${cost.usd.toFixed(4)}`, "success");
    } catch (e) {
      console.error(e);
      toast.push(e instanceof Error ? e.message : "Swap failed.", "error");
    } finally {
      setSwapping(null);
    }
  };

  if (!menu) {
    return (
      <>
        <EmptyState
          hasKey={hasAuth(settings)}
          generating={generating}
          progress={progress}
          onGenerateWeek={() => openPrefs("week")}
          onGenerateDay={() => openPrefs("day")}
        />
        <PreferencesSheet
          open={prefs.open}
          mode={prefs.mode}
          settings={settings}
          onCancel={() => setPrefs({ open: false, mode: prefs.mode })}
          onConfirm={handlePrefsConfirm}
        />
      </>
    );
  }

  const wm = weekMacros(menu);
  const dayCount = menu.days.length;
  const isDaily = dayCount === 1;
  const dishName = sheet ? menu.days[sheet.dayIndex][sheet.slot].name : "";

  return (
    <>
      <div className="space-y-5">
        <header className="space-y-1 pt-1">
          <div className="meal-tag">{isDaily ? "Today" : "This week"}</div>
          <h1 className="display text-3xl font-semibold leading-tight">
            {isDaily ? "Daily menu" : "Weekly menu"}
          </h1>
          <p className="text-sm text-muted">
            High-protein vegetarian · {dayCount} day{dayCount > 1 ? "s" : ""} ·{" "}
            {new Date(menu.generatedAt).toLocaleDateString()}
          </p>
        </header>

        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { v: fmtMacro(wm.protein / dayCount), l: "protein", c: "text-protein" },
              { v: fmtMacro(wm.carbs / dayCount), l: "carbs", c: "text-carbs" },
              { v: fmtMacro(wm.fat / dayCount), l: "fat", c: "text-fat" },
              { v: fmtMacro(wm.calories / dayCount), l: "kcal", c: "text-text" },
            ].map((s) => (
              <div key={s.l} className="bg-elevated rounded-xl py-2 border border-border">
                <div className={`text-base font-semibold ${s.c}`}>{s.v}</div>
                <div className="text-[10px] text-muted leading-tight uppercase tracking-wider">
                  {s.l}/day
                </div>
              </div>
            ))}
          </div>
          {generating ? (
            <button disabled className="btn-ghost w-full">
              <Sparkles size={16} className="animate-pulse text-accent" />
              {progress ? progress.msg : "Generating…"}
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => openPrefs("day")} className="btn-ghost">
                <Sun size={16} /> Day
              </button>
              <button onClick={() => openPrefs("week")} className="btn-ghost">
                <CalendarDays size={16} /> Week
              </button>
              <button
                onClick={() => downloadMenuPdf(menu, settings.servings)}
                className="btn-primary"
              >
                <Download size={16} /> PDF
              </button>
            </div>
          )}
        </div>

        {menu.days.map((day, i) => (
          <DaySection
            key={day.date + i}
            day={day}
            dayIndex={i}
            proteinTarget={settings.proteinTargetG}
            swapping={swapping}
            onSwap={(slot) => handleSwap(i, slot)}
          />
        ))}
      </div>

      <SwapSheet
        open={Boolean(sheet)}
        dishName={dishName}
        onCancel={() => setSheet(null)}
        onConfirm={confirmSwap}
      />
      <PreferencesSheet
        open={prefs.open}
        mode={prefs.mode}
        settings={settings}
        onCancel={() => setPrefs({ open: false, mode: prefs.mode })}
        onConfirm={handlePrefsConfirm}
      />
    </>
  );
}
