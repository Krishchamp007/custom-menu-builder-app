# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mobile-first PWA that generates a high-protein vegetarian weekly (or single-day) menu using the Anthropic Claude API. Each generated dish includes ingredients, recipe steps, and macros. Single-user, no backend, no login — API key + saved menu live in `localStorage`.

## Commands

- `npm run dev` — Vite dev server. Add `-- --host` to expose on LAN for phone testing.
- `npm run build` — `tsc -b && vite build`. Run this for typecheck (the `tsc -b` step) before declaring work done.
- `npm run lint` — ESLint.
- `npm run preview` — serve the production build locally.
- `npx tsc -b` — typecheck only, faster iteration than full build.

There is no test framework wired up.

## How the Claude API integration is structured

The API integration (`src/lib/`) is the heart of this app and has several non-obvious constraints baked in. Read this section before changing anything in `generateWeek.ts`, `schemas.ts`, or `anthropic.ts`.

**Model + key handling** (`anthropic.ts`)
- Uses `claude-haiku-4-5-20251001` for cost. Pricing constants live in `generateWeek.ts` (input/output/cache-read/cache-write per MTok) — keep them in sync with Anthropic's published rates.
- API key is read from `localStorage` (Settings UI) OR `import.meta.env.VITE_ANTHROPIC_API_KEY` (`.env.local`). `resolveApiKey()` falls back env-var → settings.
- SDK is called from the browser with `dangerouslyAllowBrowser: true`. This is justified because it's a personal local-only app with the user's own key. **Do not deploy a public build with a key set** — Vite inlines `VITE_*` env vars into the JS bundle.

**Schema design** (`schemas.ts`) is deliberately compact
- Field names are intentionally short (`mins`, `ing`, `rec`, `m.p/c/f/k`) — every field name in tool_use output costs tokens. Long field names (`prepMinutes`, `quantity`, `category`) added ~40% to per-dish output and caused truncation under the 10K OTPM rate limit.
- The compact wire format is unpacked into the normal `Dish` type at the API boundary in `generateWeek.ts::unpack()`. The rest of the app uses the friendly type. Don't propagate compact names beyond `unpack()`.

**Generation architecture: plan + per-day detail**
- `generateWeek` does **not** generate all 21 dishes in one call. The single-call approach kept hitting `stop_reason: "max_tokens"` against the 10K OTPM ceiling on tier-1 accounts.
- Instead: 1 small `planMenu()` call returns 21 dish names + cuisines, then 7 parallel `detailDay()` calls flesh each day out. Concurrency is capped at 3 in `mapWithConcurrency`.
- Total budget: plan (700) + 7 × 1300 = 9700 tokens, just under the 10K OTPM cap. **Do not raise these limits casually** — test against an actual rate-limited account.
- `generateDay()` is a single call with max_tokens 4000 (only one call → no OTPM concern).
- `swapDish()` regenerates one slot, gets the existing 20 dish names in the prompt to avoid duplicates.

**Caching, retries, errors**
- The system prompt is cached (`cache_control: ephemeral`) on every call so cost stays low across plan + 7 detail + swap calls.
- `withRetry` in `concurrency.ts` honors HTTP 429 `retry-after`. Don't bypass it.
- All generation functions check `stop_reason === "max_tokens"` and throw a specific error. `console.log` of `res.usage` is intentional — kept for debugging future schema-size changes.

## App architecture

- **Routing**: `App.tsx` mounts `BrowserRouter` with 4 routes (`/`, `/dish/:dayIndex/:slot`, `/shopping`, `/settings`). `BottomNav` is the persistent thumb-friendly tab bar.
- **State**: single zustand store in `src/lib/storage.ts` with localStorage `persist`. Holds `settings`, `menu`, transient `generating`/`progress`/`swapping` flags. `partialize` keeps only `settings` + `menu` in storage.
- **Storage hydration validates** the persisted menu shape (every day must have all three slots with macros) and clears it if invalid — guards against truncated past saves rendering as a blank screen. It also migrates the legacy `cuisineMix` field to per-slot `slotCuisine`.
- **Error boundary**: `ErrorBoundary` wraps the routes. Its fallback offers a "Clear menu & reload" button that calls `setMenu(null)` — escape hatch when a future schema change makes a stored menu un-renderable.
- **Theme**: Tailwind v3 with custom Claude.ai-inspired palette (warm cream `#f5f4ee`, copper accent `#cc785c`, serif headings via Charter/Iowan/Georgia stack). Component classes (`.card`, `.btn-primary`, `.seg-btn`) live in `src/index.css` `@layer components`. **Important**: Tailwind splits camelCase color keys to kebab-case utilities — use `"accent-deep"` (quoted kebab) in the config, never `accentDeep`.

## Data flow

1. User taps **Plan this week** or **Just today** → `PreferencesSheet` slides up with sliders pre-filled from `settings`.
2. User confirms → `runGeneration(mode, override)` in `WeekPage` → `generateWeek` or `generateDay` in `lib/generateWeek.ts`.
3. Generated `WeeklyMenu` is set on the store; `aggregateIngredients` re-derives the shopping list, `weekMacros`/`dayMacros` re-derive totals.
4. Per-dish swaps go through `swapDish` and call `replaceDish` on the store.
5. PDF export (`lib/pdf.ts`) walks the menu and emits a printable doc: weekly grid → shopping list → one recipe per page (with a YouTube search link).

## PWA in dev

`vite-plugin-pwa` has `devOptions: { enabled: false }` set — the service worker only runs in production builds. This was intentional: dev-mode SW caching repeatedly served stale JS during iteration. Don't re-enable in dev.

## Dependencies (selected)

- **State**: `zustand` (with `persist` middleware) — no Redux.
- **Routing**: `react-router-dom` v7.
- **PDF**: `jspdf` + `jspdf-autotable`.
- **Icons**: `lucide-react` v1.x — note this is an older version, some icon names differ from the current lucide. If `import { Foo } from "lucide-react"` fails, check the actual installed icons in `node_modules/lucide-react/dist/esm/icons/` before assuming the name is wrong.
- **Anthropic**: `@anthropic-ai/sdk` used directly in the browser. The SDK pulls in Node-only credential modules that Vite externalizes harmlessly (warnings during build are expected, not errors).
