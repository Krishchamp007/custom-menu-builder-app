import Anthropic from "@anthropic-ai/sdk";
import type { Settings } from "@/types";

export const MODEL_ID = "claude-haiku-4-5-20251001";

export const ENV_API_KEY: string =
  (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined)?.trim() || "";

export type Mode = "direct" | "proxy";

// Auth flow:
// - Deployed app: friends enter the shared passcode → we call /api/anthropic
//   which proxies to Anthropic with the server-held key. Key never reaches the browser.
// - Local dev / personal: user has VITE_ANTHROPIC_API_KEY in .env.local OR pastes a key
//   in Settings → we call Anthropic directly via the SDK.
// - If both are set, passcode wins (you probably want to test the proxy path).
export function resolveAuth(settings: Settings): { mode: Mode; value: string } | null {
  const passcode = settings.passcode?.trim() ?? "";
  if (passcode) return { mode: "proxy", value: passcode };
  const direct = settings.apiKey?.trim() || ENV_API_KEY;
  if (direct) return { mode: "direct", value: direct };
  return null;
}

export function hasAuth(settings: Settings): boolean {
  return resolveAuth(settings) !== null;
}

// Minimal shape the rest of the app uses. Both real SDK + proxy satisfy this.
export type MessagesClient = {
  messages: {
    create: (
      params: Anthropic.Messages.MessageCreateParamsNonStreaming,
    ) => Promise<Anthropic.Messages.Message>;
  };
};

class ProxyClient {
  private passcode: string;

  constructor(passcode: string) {
    this.passcode = passcode;
  }

  messages = {
    create: async (
      params: Anthropic.Messages.MessageCreateParamsNonStreaming,
    ): Promise<Anthropic.Messages.Message> => {
      const res = await fetch("/api/anthropic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-passcode": this.passcode,
        },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const text = await res.text();
        let message = text;
        try {
          message = JSON.parse(text).error || text;
        } catch {
          // body wasn't JSON; use raw
        }
        const err = new Error(`HTTP ${res.status}: ${message}`) as Error & {
          status?: number;
          headers?: Record<string, string>;
        };
        err.status = res.status;
        const retryAfter = res.headers.get("retry-after");
        if (retryAfter) err.headers = { "retry-after": retryAfter };
        throw err;
      }

      return res.json();
    },
  };
}

export function getClient(settings: Settings): MessagesClient {
  const auth = resolveAuth(settings);
  if (!auth) {
    throw new Error("No auth set. Add a passcode (deployed app) or API key (dev) in Settings.");
  }
  if (auth.mode === "proxy") return new ProxyClient(auth.value);
  return new Anthropic({ apiKey: auth.value, dangerouslyAllowBrowser: true }) as unknown as MessagesClient;
}

export async function pingAuth(settings: Settings): Promise<boolean> {
  const client = getClient(settings);
  const res = await client.messages.create({
    model: MODEL_ID,
    max_tokens: 4,
    messages: [{ role: "user", content: "ok" }],
  });
  return Array.isArray(res.content);
}
