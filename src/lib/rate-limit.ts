// Rate limiting em memória (janela deslizante). Interface isolada para trocar por Redis.

type Bucket = number[];
const buckets = new Map<string, Bucket>();

export type RateResult = { allowed: boolean; remaining: number; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateResult {
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    const retry = Math.ceil((windowMs - (now - arr[0])) / 1000);
    buckets.set(key, arr);
    return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, retry) };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { allowed: true, remaining: limit - arr.length, retryAfterSec: 0 };
}

export function resetRateLimits(): void {
  buckets.clear();
}

// Limpeza periódica para não vazar memória.
let lastSweep = Date.now();
export function sweepRateLimits(windowMs = 3_600_000, now = Date.now()): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, arr] of buckets) {
    const fresh = arr.filter((t) => now - t < windowMs);
    if (fresh.length === 0) buckets.delete(k);
    else buckets.set(k, fresh);
  }
}
