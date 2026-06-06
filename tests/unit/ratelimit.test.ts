import { describe, it, expect } from "vitest";
import { hit } from "@/lib/ratelimit";

const uniqueKey = () => `test:${Math.random().toString(36).slice(2)}`;

describe("rate limiter", () => {
  it("allows up to the limit, then blocks", () => {
    const key = uniqueKey();
    expect(hit(key, 3, 60_000).ok).toBe(true);
    expect(hit(key, 3, 60_000).ok).toBe(true);
    expect(hit(key, 3, 60_000).ok).toBe(true);
    expect(hit(key, 3, 60_000).ok).toBe(false);
  });

  it("reports remaining allowance", () => {
    const key = uniqueKey();
    expect(hit(key, 2, 60_000).remaining).toBe(1);
    expect(hit(key, 2, 60_000).remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    const key = uniqueKey();
    expect(hit(key, 1, 1).ok).toBe(true);  // 1ms window
    const start = Date.now();
    while (Date.now() - start < 5) { /* wait past the window */ }
    expect(hit(key, 1, 1).ok).toBe(true);
  });

  it("keeps separate keys independent", () => {
    const a = uniqueKey();
    const b = uniqueKey();
    expect(hit(a, 1, 60_000).ok).toBe(true);
    expect(hit(a, 1, 60_000).ok).toBe(false);
    expect(hit(b, 1, 60_000).ok).toBe(true); // unaffected by a
  });
});
