import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_SETTINGS, type Dish, type MealSlot, type Settings, type WeeklyMenu } from "@/types";

type State = {
  settings: Settings;
  menu: WeeklyMenu | null;
  generating: boolean;
  progress: { msg: string; done: number; total: number } | null;
  swapping: { dayIndex: number; slot: MealSlot } | null;
};

type Actions = {
  setSettings: (patch: Partial<Settings>) => void;
  setMenu: (menu: WeeklyMenu | null) => void;
  setGenerating: (v: boolean) => void;
  setProgress: (p: State["progress"]) => void;
  setSwapping: (v: State["swapping"]) => void;
  replaceDish: (dayIndex: number, slot: MealSlot, dish: Dish) => void;
  clearAll: () => void;
};

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_SETTINGS,
      menu: null,
      generating: false,
      progress: null,
      swapping: null,
      setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      setMenu: (menu) => set({ menu }),
      setGenerating: (v) => set({ generating: v, progress: v ? get().progress : null }),
      setProgress: (p) => set({ progress: p }),
      setSwapping: (v) => set({ swapping: v }),
      replaceDish: (dayIndex, slot, dish) => {
        const menu = get().menu;
        if (!menu) return;
        const days = menu.days.map((day, i) =>
          i === dayIndex ? { ...day, [slot]: dish } : day,
        );
        set({ menu: { ...menu, days } });
      },
      clearAll: () => {
        localStorage.removeItem("menu-app-store");
        set({ settings: DEFAULT_SETTINGS, menu: null, generating: false, progress: null, swapping: null });
      },
    }),
    {
      name: "menu-app-store",
      partialize: (state) => ({ settings: state.settings, menu: state.menu }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Migrate legacy cuisineMix -> slotCuisine.
        const s = state.settings as unknown as Record<string, unknown>;
        if (!s.slotCuisine) {
          const legacy = s.cuisineMix as string | undefined;
          const pref =
            legacy === "indian-heavy"
              ? "indian"
              : legacy === "western-heavy"
              ? "western"
              : "either";
          state.settings.slotCuisine = {
            breakfast: pref as never,
            lunch: pref as never,
            dinner: pref as never,
          };
        }
        if (typeof state.settings.caloriesTarget !== "number") {
          state.settings.caloriesTarget = 2000;
        }
        const m = state.menu;
        if (!m || !Array.isArray(m.days) || m.days.length === 0) {
          state.menu = null;
          return;
        }
        const ok = m.days.every(
          (d) =>
            d &&
            d.breakfast?.macros &&
            d.lunch?.macros &&
            d.dinner?.macros,
        );
        if (!ok) state.menu = null;
      },
    },
  ),
);
