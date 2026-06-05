import { describe, it, expect } from "vitest";
import { haversineMeters } from "@/lib/geo";

describe("haversineMeters", () => {
  it("is zero for identical points", () => {
    expect(haversineMeters(53.8, -1.5, 53.8, -1.5)).toBe(0);
  });

  it("approximates ~100m for a small north offset", () => {
    // ~0.0009 deg latitude ≈ 100 m
    const d = haversineMeters(53.7997, -1.5492, 53.8006, -1.5492);
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(110);
  });

  it("is symmetric", () => {
    const a = haversineMeters(51.5, -0.12, 53.8, -1.55);
    const b = haversineMeters(53.8, -1.55, 51.5, -0.12);
    expect(a).toBeCloseTo(b, 5);
  });
});
