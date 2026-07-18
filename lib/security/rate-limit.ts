/**
 * Process-local rate limit adapter.
 *
 * Limitation: not durable across instances or restarts. Production traffic
 * should replace this adapter with a shared store (e.g. Upstash Redis) when
 * multi-instance deployment is used. Deduplication in Supabase remains the
 * durable duplicate control.
 */

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const DEFAULT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_MAX = 5;

export function checkRateLimit(
  key: string,
  options?: { windowMs?: number; max?: number; now?: number },
): RateLimitDecision {
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
  const max = options?.max ?? DEFAULT_MAX;
  const now = options?.now ?? Date.now();

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (existing.count >= max) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return { allowed: true };
}

/** Test helper only. */
export function resetRateLimitBucketsForTests(): void {
  buckets.clear();
}
