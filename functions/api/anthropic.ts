// Cloudflare Pages serverless function.
// Proxies Anthropic Messages API calls so the API key stays server-side.
// Friends authenticate with a shared passcode set as an environment variable.
//
// Required env vars (configure in the Cloudflare Pages dashboard):
//   ANTHROPIC_API_KEY — your sk-ant-... key
//   APP_PASSCODE      — the shared passcode you give friends

interface Env {
  ANTHROPIC_API_KEY: string;
  APP_PASSCODE: string;
}

const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });

export const onRequestPost = async (context: {
  request: Request;
  env: Env;
}): Promise<Response> => {
  const { request, env } = context;

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

  // Forward retry-after so client-side withRetry() can honor rate limits.
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) headers["retry-after"] = retryAfter;

  return new Response(upstream.body, { status: upstream.status, headers });
};

// Block other methods.
export const onRequest = async () =>
  json({ error: "Method not allowed." }, 405);
