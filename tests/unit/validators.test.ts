import { describe, it, expect } from "vitest";
import {
  createShiftSchema, createLeaveSchema, createEmployeeSchema, createDepartmentSchema, updateSettingsSchema,
} from "@/lib/validators";

const iso = (s: string) => new Date(s).toISOString();

describe("createShiftSchema", () => {
  const valid = {
    weekStart: iso("2026-06-01T00:00:00"),
    locationId: "loc1",
    start: iso("2026-06-01T09:00:00"),
    end: iso("2026-06-01T17:00:00"),
    breakMinutes: 30,
  };
  it("accepts a valid shift", () => {
    expect(createShiftSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects end before start", () => {
    expect(createShiftSchema.safeParse({ ...valid, start: valid.end, end: valid.start }).success).toBe(false);
  });
  it("rejects a missing location", () => {
    expect(createShiftSchema.safeParse({ ...valid, locationId: "" }).success).toBe(false);
  });
});

describe("createLeaveSchema", () => {
  it("rejects an end date before the start date", () => {
    expect(createLeaveSchema.safeParse({ type: "HOLIDAY", startDate: "2026-06-05", endDate: "2026-06-01" }).success).toBe(false);
  });
  it("requires a name for custom leave", () => {
    expect(createLeaveSchema.safeParse({ type: "CUSTOM", startDate: "2026-06-01", endDate: "2026-06-02" }).success).toBe(false);
    expect(createLeaveSchema.safeParse({ type: "CUSTOM", customType: "Jury", startDate: "2026-06-01", endDate: "2026-06-02" }).success).toBe(true);
  });
});

describe("createEmployeeSchema", () => {
  it("rejects an invalid email", () => {
    expect(createEmployeeSchema.safeParse({ firstName: "A", lastName: "B", email: "nope" }).success).toBe(false);
  });
  it("applies defaults and accepts the minimum fields", () => {
    const r = createEmployeeSchema.safeParse({ firstName: "A", lastName: "B", email: "a@b.com" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.employmentType).toBe("FULL_TIME");
      expect(r.data.contractedHours).toBe(40);
    }
  });
});

describe("misc schemas", () => {
  it("createDepartmentSchema rejects a bad colour", () => {
    expect(createDepartmentSchema.safeParse({ locationId: "l", name: "FOH", color: "red" }).success).toBe(false);
    expect(createDepartmentSchema.safeParse({ locationId: "l", name: "FOH", color: "#ff0000" }).success).toBe(true);
  });
  it("updateSettingsSchema bounds weekStartsOn to 0..1", () => {
    expect(updateSettingsSchema.safeParse({ weekStartsOn: 3 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ weekStartsOn: 0 }).success).toBe(true);
  });
});
