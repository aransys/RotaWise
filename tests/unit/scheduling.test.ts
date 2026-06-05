import { describe, it, expect } from "vitest";
import {
  getWeekStart, addDays, shiftHours, timeToMinutes, evaluateEmployee, evaluateAll,
} from "@/lib/scheduling";

const base = new Date("2026-06-01T00:00:00"); // Monday
function at(day: number, h: number, m = 0) {
  const d = new Date(base);
  d.setDate(d.getDate() + day);
  d.setHours(h, m, 0, 0);
  return d;
}

describe("date helpers", () => {
  it("getWeekStart returns the Monday of the week", () => {
    const ws = getWeekStart(new Date("2026-06-03T12:00:00")); // Wednesday
    expect(ws.getDay()).toBe(1);
    expect(ws.toISOString().slice(0, 10)).toBe("2026-06-01");
  });

  it("getWeekStart on a Sunday rolls back to the previous Monday", () => {
    const ws = getWeekStart(new Date("2026-06-07T09:00:00")); // Sunday
    expect(ws.toISOString().slice(0, 10)).toBe("2026-06-01");
  });

  it("addDays adds calendar days", () => {
    expect(addDays(base, 6).toISOString().slice(0, 10)).toBe("2026-06-07");
  });

  it("timeToMinutes parses HH:MM", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("00:00")).toBe(0);
  });
});

describe("shiftHours", () => {
  it("subtracts the unpaid break", () => {
    expect(shiftHours(at(0, 9), at(0, 17), 30)).toBeCloseTo(7.5, 5);
  });
  it("never returns negative", () => {
    expect(shiftHours(at(0, 17), at(0, 9), 0)).toBe(0);
  });
});

describe("rule engine", () => {
  it("flags an error when weekly hours exceed the max", () => {
    const w = evaluateEmployee(
      { employeeId: "e1", contractedHours: 40, availability: [],
        shifts: [{ id: "a", start: at(0, 8), end: at(0, 23), breakMinutes: 0 }] },
      { maxWeeklyHours: 10, minRestHours: 11 }
    );
    expect(w.some((x) => x.severity === "error")).toBe(true);
  });

  it("flags overtime past contracted hours", () => {
    const w = evaluateEmployee(
      { employeeId: "e1", contractedHours: 5, availability: [],
        shifts: [{ id: "a", start: at(0, 9), end: at(0, 17), breakMinutes: 0 }] }, // 8h > 5h
      { maxWeeklyHours: 48, minRestHours: 11 }
    );
    expect(w.some((x) => x.message.toLowerCase().includes("overtime"))).toBe(true);
  });

  it("flags insufficient rest between consecutive shifts", () => {
    const w = evaluateEmployee(
      { employeeId: "e1", contractedHours: 40, availability: [],
        shifts: [
          { id: "a", start: at(0, 9), end: at(0, 22), breakMinutes: 0 },
          { id: "b", start: at(1, 2), end: at(1, 8), breakMinutes: 0 }, // 4h rest
        ] },
      { maxWeeklyHours: 48, minRestHours: 11 }
    );
    expect(w.some((x) => x.message.includes("rest"))).toBe(true);
  });

  it("flags shifts outside stated availability", () => {
    const w = evaluateEmployee(
      { employeeId: "e1", contractedHours: 40,
        availability: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isAvailable: true }],
        shifts: [{ id: "a", start: at(0, 9), end: at(0, 20), breakMinutes: 0 }] }, // ends 20:00 > 17:00
      { maxWeeklyHours: 48, minRestHours: 11 }
    );
    expect(w.some((x) => x.message.toLowerCase().includes("availability"))).toBe(true);
  });

  it("does not flag availability when none is declared for that day", () => {
    const w = evaluateEmployee(
      { employeeId: "e1", contractedHours: 40, availability: [],
        shifts: [{ id: "a", start: at(0, 6), end: at(0, 14), breakMinutes: 0 }] },
      { maxWeeklyHours: 48, minRestHours: 11 }
    );
    expect(w).toHaveLength(0);
  });

  it("evaluateAll only includes employees with warnings", () => {
    const map = evaluateAll(
      [
        { employeeId: "ok", contractedHours: 40, availability: [], shifts: [{ id: "x", start: at(0, 9), end: at(0, 17), breakMinutes: 0 }] },
        { employeeId: "bad", contractedHours: 40, availability: [], shifts: [{ id: "y", start: at(0, 0), end: at(0, 23), breakMinutes: 0 }] },
      ],
      { maxWeeklyHours: 10, minRestHours: 11 }
    );
    expect(map.has("ok")).toBe(false);
    expect(map.has("bad")).toBe(true);
  });
});

describe("skill requirements", () => {
  it("flags a shift whose required skill the employee lacks", () => {
    const w = evaluateEmployee(
      { employeeId: "e1", contractedHours: 40, availability: [], skillIds: ["barista"],
        shifts: [{ id: "a", start: at(0, 9), end: at(0, 17), breakMinutes: 0, requiredSkillIds: ["foodHygiene"] }] },
      { maxWeeklyHours: 48, minRestHours: 11 },
      { foodHygiene: "Food Hygiene L2" }
    );
    expect(w.some((x) => x.severity === "error" && x.message.includes("Food Hygiene L2"))).toBe(true);
  });

  it("passes when the employee holds every required skill", () => {
    const w = evaluateEmployee(
      { employeeId: "e1", contractedHours: 40, availability: [], skillIds: ["barista", "foodHygiene"],
        shifts: [{ id: "a", start: at(0, 9), end: at(0, 17), breakMinutes: 0, requiredSkillIds: ["barista"] }] },
      { maxWeeklyHours: 48, minRestHours: 11 },
      { barista: "Barista" }
    );
    expect(w).toHaveLength(0);
  });

  it("ignores shifts with no required skills", () => {
    const w = evaluateEmployee(
      { employeeId: "e1", contractedHours: 40, availability: [], skillIds: [],
        shifts: [{ id: "a", start: at(0, 9), end: at(0, 17), breakMinutes: 0, requiredSkillIds: [] }] },
      { maxWeeklyHours: 48, minRestHours: 11 }
    );
    expect(w).toHaveLength(0);
  });
});
