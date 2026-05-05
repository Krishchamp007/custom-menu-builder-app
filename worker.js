// Cloudflare Worker entry point.
// Serves the built Vite app from dist/ via the ASSETS binding,
// and proxies /api/anthropic requests to the Anthropic API.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/anthropic") {
      return handleAnthropic(request, env);
    }

    // Everything else: static asset (Vite SPA fallback handled in wrangler.jsonc).
    return env.ASSETS.fetch(request);
  },
};

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });

async function handleAnthropic(request, env) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!env.APP_PASSCODE) {
    return json({ error: "Server is missing APP_PASSCODE env var." }, 500);
  }
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "Server is missing ANTHROPIC_API_KEY env var." }, 500);
  }

  const passcode = request.headers.get("x-passcode") || "";
  if (passcode !== env.APP_PASSCODE) {
    return json({ error: "Invalid passcode." }, 401);
  }

  const body = await request.text();

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body,
  });

  // Buffer the full response before forwarding. Avoids any edge-case
  // streaming/transfer-encoding weirdness — the JSON arrives intact.
  const responseText = await upstream.text();

  console.log(
    "[proxy]",
    upstream.status,
    "in:",
    body.length,
    "out:",
    responseText.length,
  );

  const headers = { "Content-Type": "application/json" };
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) headers["retry-after"] = retryAfter;

  return new Response(responseText, { status: upstream.status, headers });
}
