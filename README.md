# Weekly Menu

Mobile-first web app that generates a 7-day high-protein vegetarian menu (Indian + western) using Claude. Each dish includes a step-by-step recipe for the cook, ingredients, and macros. Swap any dish, view a consolidated shopping list, and download the whole week as a PDF.

## Setup

```sh
npm install
npm run dev
```

Open `http://localhost:5173/` on your phone (same Wi-Fi: run `npm run dev -- --host`) or in Chrome DevTools mobile emulation.

## First run

1. Open **Settings** (bottom-right tab).
2. Paste your Anthropic API key (`sk-ant-…`) — get one at [console.anthropic.com](https://console.anthropic.com). Tap **Test** to verify.
3. Adjust daily protein target (default 100 g), servings per dish (default 2), and cuisine mix.
4. Add any disliked ingredients (e.g. `mushrooms`).
5. Go to **Week** → **Generate this week**. ~20–30 seconds.

## Features

- **Weekly menu**: 21 dishes (B/L/D × 7) — high protein, vegetarian, mixed Indian + western, no repeats.
- **Recipes**: tap any dish for a full ingredient list and numbered method.
- **Swap**: shuffle icon on any tile re-rolls a single dish without duplicating the rest of the week. Optional "reason" hint.
- **Shopping list**: ingredients aggregated across the week, scaled to your serving count, grouped by supermarket aisle.
- **Macros everywhere**: per-dish, daily totals, weekly averages.
- **Download PDF**: weekly grid + shopping list + every recipe on its own printable page.
- **PWA**: add to home screen on iPhone/Android for an app-like experience.
- **Local-only**: API key, settings, and saved menu live in your browser. No backend, no login.

## Stack

Vite + React + TypeScript · Tailwind CSS · zustand · `@anthropic-ai/sdk` (Sonnet 4.6 with prompt caching + tool_use) · jsPDF · vite-plugin-pwa.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build (`tsc -b && vite build`)
- `npm run preview` — serve the production build
