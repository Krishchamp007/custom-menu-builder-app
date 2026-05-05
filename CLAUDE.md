# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mobile-first PWA that generates a high-protein vegetarian weekly (or single-day) menu using the Anthropic Claude API. Each generated dish includes ingredients, recipe steps, and macros. Originally built as a personal local-only app; also deployable to Cloudflare Workers so a small group can share access via a passcode.

## Commands

- `npm run dev` — Vite dev server. Add `-- --host` to expose on LAN for phone testing.
- `npm run build` — `tsc -b && vite build`. Run this for typecheck (the `tsc -b` step) before declaring work done.
- `npm run lint` — ESLint.
- `npm run preview` — serve the production build locally.
- `npx tsc -b` — typecheck only, faster iteration than full build.
- `npx wrangler deploy` — push the built `dist/` + `worker.js` to Cloudflare. Worker reads `APP_PASSCODE` and `ANTHROPIC_API_KEY` from Cloudflare secrets (set with `wrangler secret put`).

There is no test framework wired up.

## How the Claude API integration is structured

The API integration (`src/lib/`) is the heart of this app. Several non-obvious constraints are baked in — read this before changing `generateWeek.ts`, `schemas.ts`, `anthropic.ts`, or `worker.js`.

**Auth: two modes** (`anthropic.ts`)
- `getClient(settings)` returns a `MessagesClient` — a minimal interface (`messages.create(...)`) that both real-SDK and proxy implementations satisfy. The rest of `lib/` programs against this interface, not the SDK directly.
- **Direct mode (dev / personal):** API key from `localStorage` (Settings UI) or `import.meta.env.VITE_ANTHROPIC_API_KEY`. Uses the `@anthropic-ai/sdk` directly in the browser with `dangerouslyAllowBrowser: true`.
- **Proxy mode (deployed / shared):** user enters a shared passcode in Settings. `ProxyClient` POSTs to `/api/anthropic` with an `x-passcode` header. The Cloudflare Worker (`worker.js`) validates the passcode and forwards to Anthropic with the server-held key. The browser never sees the real key.
- `resolveAuth()` precedence: passcode wins if both are set (so testing the proxy path is easy when you have both).
- Uses model `claude-haiku-4-5-20251001` for cost. Pricing constants live in `generateWeek.ts` (input/output/cache-read/cache-write per MTok) — keep them in sync with Anthropic's published rates.
- **Do not deploy a public build with `VITE_ANTHROPIC_API_KEY` set** — Vite inlines `VITE_*` vars into the JS bundle. The deployed app should rely on the proxy + passcode.

**Schema design — a deliberate split** (`schemas.ts` + inline format in `generateWeek.ts`)
- **Tool_use calls (`generateDay`, `swapDish`)** use **verbose** field names defined in `schemas.ts` (`name`, `cuisine`, `meal`, `totalMinutes`, `ingredients`, `recipe`, `macros.{protein,carbs,fat,calories}`). An earlier compact tool_use schema was unreliable — the model occasionally dropped fields under tool_use mode. Verbose names made it dramatically more consistent.
- **`generateWeek`** uses a different format: a **compact** JSON shape (`n`, `c`, `t`, `i`, `r`, `m.{p,c,f,k}`, `x`) defined INLINE in the prompt as `COMPACT_FORMAT_INSTRUCTIONS`, NOT in `schemas.ts`. This is because `generateWeek` emits 21 dishes in one response and short field names cut output tokens significantly (every field name repeated 21x).
- The verbose tool_use shape is unpacked via `unpackTool()`. The compact prefilled-JSON shape is unpacked via `compactToDish()` + `parseIngredient()` (regex-parses strings like `"200 g paneer"` into structured ingredients).
- The rest of the app uses the friendly `Dish` type — don't propagate either wire format past `unpackTool` / `compactToDish`.

**Generation architecture: prefilled JSON for the week, tool_use for day/swap**
- `generateWeek` uses **prefilled JSON, not tool_use**. The user message asks for a JSON array, the assistant message is prefilled with `[`, and the model continues writing the array. Switched to from a multi-call plan+detail approach (commit `3fab8f3`) — both simplifies the code and stays under the OTPM cap by using the compact wire format.
  - `max_tokens: 7000` for this call. Don't raise without watching `usage.output_tokens`.
  - Response is reconstructed: `"[" + textBlock.text`, then trimmed at the last `]` to handle any trailing prose despite instructions.
  - Validates: parse succeeds, length is 21, every dish has `n`, `m`, `i[]`, `r[]`. Throws specific errors when these fail (the user can just re-tap "Plan this week").
- `generateDay` is a tool_use call (`submit_day`) with `max_tokens: 4000`. **Validation + retry-once**: if any of the three slots fails `isCompleteRawDish`, calls `callDay` again with a stricter reminder appended to the user message. If still incomplete, throws. Cost is summed across both attempts via `addCost`.
- `swapDish` is a tool_use call (`submit_dish`) with `max_tokens: 1500`. Validates with `isCompleteRawDish`. Receives the existing 20 dish names in the prompt to avoid duplicates. No auto-retry — single call, user re-clicks if it fails.

**Caching, retries, errors**
- The system prompt is cached (`cache_control: ephemeral`) on every call, so cost stays low across week + day + swap calls within the cache TTL.
- `withRetry` in `concurrency.ts` honors HTTP 429 `retry-after`. Used on every API call. Don't bypass it.
- All generation functions check `stop_reason === "max_tokens"` and throw a specific error.
- `console.log` of `res.usage` and `stop_reason` is intentional — kept for debugging future schema-size or rate-limit issues.

## Cloudflare deployment (`worker.js`, `wrangler.jsonc`)

- `worker.js` is the Workers entry: routes `/api/anthropic` to the proxy handler, everything else to the static-asset binding (`env.ASSETS`).
- `wrangler.jsonc` mounts `./dist` as static assets with `not_found_handling: "single-page-application"` so client-side routes resolve to `index.html`.
- The proxy buffers the upstream response (`upstream.text()`) before returning instead of streaming the body — this avoids edge-case streaming/transfer-encoding issues that occasionally caused the SDK on the browser side to receive a malformed payload. Don't switch back to streaming without testing.
- `retry-after` from the upstream response is propagated so `withRetry` on the client side can honor it.
- Two Cloudflare env vars required: `APP_PASSCODE` (the shared passcode) and `ANTHROPIC_API_KEY`. Set with `wrangler secret put <NAME>`.
- `.npmrc` sets `legacy-peer-deps=true` so the Cloudflare build pipeline (which runs `npm install`) succeeds with a transitive peer-dep mismatch in the deps tree. Don't remove without verifying the build still works.

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
- **Anthropic**: `@anthropic-ai/sdk` used directly in the browser in dev/personal mode. The SDK pulls in Node-only credential modules that Vite externalizes harmlessly (warnings during build are expected, not errors).
- **Cloudflare**: `wrangler` for deploy; `worker.js` is hand-written, no framework.
