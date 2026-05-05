# Custom Menu Builder

Mobile-first PWA that generates a 7-day (or single-day) high-protein vegetarian menu — Indian + western — using the Anthropic Claude API. Includes per-meal cuisine preferences, swap-by-dish, aggregated shopping list, recipes written for an Indian home cook, and PDF export.

Live deployment uses a Cloudflare Pages serverless proxy so the API key stays server-side; users authenticate with a shared passcode.

## Local development

```sh
npm install
npm run dev
```

Open `http://localhost:5173/` (or `npm run dev -- --host` for phone testing on the same Wi-Fi).

For local dev, you have two options for auth:

1. **Use your own Anthropic API key** (no backend needed):
   - Create `.env.local`: `VITE_ANTHROPIC_API_KEY=sk-ant-...`
   - Or paste it in **Settings → Advanced**.
2. **Use the deployed proxy**:
   - In Settings → Passcode, enter the same passcode you set on Cloudflare.
   - Requires the deployed app to be running (or `wrangler pages dev` locally).

## Deploying to Cloudflare Workers

This is what powers the shareable link. Deployed as a Worker with Static Assets — `dist/` is served as the static frontend, and `worker.js` proxies `/api/anthropic` to the Anthropic API.

### One-time setup

1. Push your code to GitHub (already done if you cloned this).
2. Sign in to Cloudflare → **Workers & Pages** → **Create** → **Workers** → **Get started → Connect to Git**.
3. Select your `custom-menu-builder-app` repo.
4. The build/deploy commands are auto-detected from `wrangler.jsonc`:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
5. **Click "Advanced settings"** → add environment variables (Encrypt both):
   - `ANTHROPIC_API_KEY` = your `sk-ant-...` key
   - `APP_PASSCODE` = a passcode you'll share with friends
6. Click **Deploy**.

Cloudflare will auto-deploy on every `git push` to `main`.

### Sharing with friends

Send them the URL + the passcode. They open Settings, paste the passcode, hit **Test**, and start generating.

### Why Cloudflare Pages and not Vercel?

Vercel's hobby tier kills serverless functions at 25s, which clips our 30-40s week generation. Cloudflare Pages doesn't count network-wait time as CPU, so the long Anthropic call doesn't time out.

## Architecture overview

See [CLAUDE.md](CLAUDE.md) for the deeper architectural notes (rate-limit math, schema choices, etc.).

- `src/lib/generateWeek.ts` — week generation uses **JSON prefill** (single Anthropic call, model continues `[`, we `JSON.parse` the result). Day + swap use `tool_use` (single call, no rate-limit pressure).
- `src/lib/anthropic.ts` — auth resolution: passcode → proxy via `/api/anthropic`, otherwise direct SDK with the user's key.
- `worker.js` + `wrangler.jsonc` — Cloudflare Worker entry point. Routes `/api/anthropic` to a passcode-gated proxy, falls back to static assets for everything else.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — `tsc -b && vite build`
- `npm run preview` — serve the production build
