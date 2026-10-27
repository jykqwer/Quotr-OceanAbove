/**
 * Fixed-window limiter for credential endpoints. In-memory on purpose: a single
 * local instance is the deployment target, and a restart clearing counters is
 * acceptable. Not a substitute for a real edge limiter.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface Limit {
  /** Attempts allowed per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export const LOGIN_LIMIT: Limit = { max: 8, windowMs: 60_000 };
export const REGISTER_LIMIT: Limit = { max: 5, windowMs: 10 * 60_000 };

export function hit(key: string, limit: Limit, now = Date.now()): { ok: boolean; retryAfter: number } {
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + limit.windowMs });
    return { ok: true, retryAfter: 0 };
  }
  current.count += 1;
  if (current.count > limit.max) {
    return { ok: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

export function reset(key: string): void {
  windows.delete(key);
}
