export async function mapWithConcurrency<I, O>(
  items: I[],
  limit: number,
  fn: (item: I, index: number) => Promise<O>,
): Promise<O[]> {
  const results = new Array<O>(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

function parseRetryDelaySec(err: unknown): number {
  if (!isRecord(err)) return 0;
  const headers = isRecord(err.headers) ? err.headers : undefined;
  const ra = headers?.["retry-after"];
  if (typeof ra === "string") {
    const n = Number(ra);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; onRetry?: (attempt: number, waitMs: number) => void } = {},
): Promise<T> {
  const retries = opts.retries ?? 4;
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      const status = isRecord(e) && typeof e.status === "number" ? e.status : 0;
      const retriable = status === 429 || (status >= 500 && status < 600);
      if (!retriable || attempt >= retries) throw e;
      const hinted = parseRetryDelaySec(e) * 1000;
      const backoff = Math.min(30000, 1500 * Math.pow(2, attempt));
      const wait = Math.max(hinted, backoff) + Math.random() * 500;
      opts.onRetry?.(attempt + 1, wait);
      await new Promise((r) => setTimeout(r, wait));
      attempt++;
    }
  }
}
