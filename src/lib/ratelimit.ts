import { NextResponse } from "next/server";

// Fixed-window rate limiter. In-memory (per Node instance) — fine for single-instance
// deployments and dev. For multi-instance, back `hit()` with Redis using the same shape.
interface Bucket {
  count: number;
  resetAt: number;
}

const globalForRl = globalThis as unknown as { rlStore?: Map<string, Bucket> };
const store = globalForRl.rlStore ?? new Map<string, Bucket>();
if (process.env.NODE_ENV !== "production") globalForRl.rlStore = store;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function hit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  bucket.count += 1;
  return { ok: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Enforce a rate limit for a named action keyed by client IP.
 * Returns a 429 NextResponse when exceeded, or null to continue.
 */
export function enforceRateLimit(
  req: Request,
  name: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const result = hit(`${name}:${clientIp(req)}`, limit, windowMs);
  if (result.ok) return null;
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
