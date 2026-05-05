import Anthropic from "@anthropic-ai/sdk";

export const MODEL_ID = "claude-haiku-4-5-20251001";

export const ENV_API_KEY: string =
  (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined)?.trim() || "";

export function resolveApiKey(settingsKey: string): string {
  return settingsKey.trim() || ENV_API_KEY;
}

export function getClient(apiKey: string) {
  const resolved = resolveApiKey(apiKey);
  if (!resolved) throw new Error("Anthropic API key not set. Add it in Settings or .env.local.");
  return new Anthropic({ apiKey: resolved, dangerouslyAllowBrowser: true });
}

export async function pingKey(apiKey: string): Promise<boolean> {
  const client = getClient(apiKey);
  const res = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 4,
    messages: [{ role: "user", content: "ok" }],
  });
  return Array.isArray(res.content);
}
