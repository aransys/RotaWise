// Pure scheduling helpers + rule engine. No DB / React imports so this is
// trivially unit-testable and safe to run on server or client.

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Monday 00:00 (local) of the week containing `date`. */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Column index 0..6 (Mon..Sun) for a date within the rota week. */
export function dayIndex(weekStart: Date, date: Date): number {
  return Math.floor((startOfDay(date).getTime() - startOfDay(weekStart).getTime()) / 86_400_000);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Paid hours for a shift, minus unpaid break. */
export function shiftHours(start: Date | string, end: Date | string, breakMinutes = 0): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, ms / 3_600_000 - breakMinutes / 60);
}

/** "HH:MM" -> minutes since midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

// ---------------------------------------------------------------------------
// Rule engine
// ---------------------------------------------------------------------------

export interface RuleSettings {
  maxWeeklyHours: number;
  minRestHours: number;
}

export interface RuleShift {
  id: string;
  start: Date;
  end: Date;
  breakMinutes: number;
  requiredSkillIds?: string[];
}

export interface RuleAvailability {
  dayOfWeek: number; // 0 Sun .. 6 Sat
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface RuleEmployee {
  employeeId: string;
  contractedHours: number;
  shifts: RuleShift[];
  availability: RuleAvailability[];
  skillIds?: string[];
}

export type WarningSeverity = "warning" | "error";

export interface RuleWarning {
  employeeId: string;
  severity: WarningSeverity;
  message: string;
}

export function evaluateEmployee(
  emp: RuleEmployee,
  settings: RuleSettings,
  skillNames: Record<string, string> = {}
): RuleWarning[] {
  const warnings: RuleWarning[] = [];
  const shifts = [...emp.shifts].sort((a, b) => a.start.getTime() - b.start.getTime());
  const empSkills = new Set(emp.skillIds ?? []);

  // 1. Weekly hours vs max
  const total = shifts.reduce((sum, s) => sum + shiftHours(s.start, s.end, s.breakMinutes), 0);
  if (total > settings.maxWeeklyHours) {
    warnings.push({
      employeeId: emp.employeeId,
      severity: "error",
      message: `Over max weekly hours (${total.toFixed(1)}h / ${settings.maxWeeklyHours}h)`,
    });
  } else if (emp.contractedHours > 0 && total > emp.contractedHours) {
    warnings.push({
      employeeId: emp.employeeId,
      severity: "warning",
      message: `Overtime: ${total.toFixed(1)}h scheduled vs ${emp.contractedHours}h contracted`,
    });
  }

  // 2. Minimum rest between consecutive shifts
  for (let i = 1; i < shifts.length; i++) {
    const restHours = (shifts[i].start.getTime() - shifts[i - 1].end.getTime()) / 3_600_000;
    if (restHours >= 0 && restHours < settings.minRestHours) {
      warnings.push({
        employeeId: emp.employeeId,
        severity: "warning",
        message: `Only ${restHours.toFixed(1)}h rest before ${DAY_LABELS[(shifts[i].start.getDay() + 6) % 7]} shift (min ${settings.minRestHours}h)`,
      });
    }
  }

  // 3. Availability — only flag days the employee has declared availability for
  for (const s of shifts) {
    const dow = s.start.getDay();
    const windows = emp.availability.filter((a) => a.dayOfWeek === dow && a.isAvailable);
    if (windows.length === 0) continue; // no declared availability => don't flag
    const sStart = minutesOfDay(s.start);
    const sEnd = minutesOfDay(s.end);
    const fits = windows.some((w) => timeToMinutes(w.startTime) <= sStart && timeToMinutes(w.endTime) >= sEnd);
    if (!fits) {
      warnings.push({
        employeeId: emp.employeeId,
        severity: "warning",
        message: `Scheduled outside stated availability on ${DAY_LABELS[(dow + 6) % 7]}`,
      });
    }
  }

  // 4. Skill requirements — assigned employee must hold every required skill
  for (const s of shifts) {
    const required = s.requiredSkillIds ?? [];
    if (required.length === 0) continue;
    const missing = required.filter((id) => !empSkills.has(id));
    if (missing.length > 0) {
      const names = missing.map((id) => skillNames[id] ?? "a required skill").join(", ");
      warnings.push({
        employeeId: emp.employeeId,
        severity: "error",
        message: `Missing skill for ${DAY_LABELS[(s.start.getDay() + 6) % 7]} shift: ${names}`,
      });
    }
  }

  return warnings;
}

export function evaluateAll(
  employees: RuleEmployee[],
  settings: RuleSettings,
  skillNames: Record<string, string> = {}
): Map<string, RuleWarning[]> {
  const map = new Map<string, RuleWarning[]>();
  for (const emp of employees) {
    const w = evaluateEmployee(emp, settings, skillNames);
    if (w.length) map.set(emp.employeeId, w);
  }
  return map;
}
