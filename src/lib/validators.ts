import { z } from "zod";

export const createShiftSchema = z.object({
  weekStart: z.string().datetime(),       // ISO; identifies/creates the schedule
  locationId: z.string().min(1),
  employeeId: z.string().min(1).nullable().optional(),
  departmentId: z.string().min(1).nullable().optional(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  breakMinutes: z.number().int().min(0).max(480).default(0),
  notes: z.string().max(500).optional(),
  repeatWeeks: z.number().int().min(0).max(52).default(0), // 0 = single shift; N = repeat for N more weeks
  skillIds: z.array(z.string().min(1)).optional(),         // required skills for this shift
}).refine((d) => new Date(d.end) > new Date(d.start), {
  message: "End must be after start",
  path: ["end"],
});

export const updateShiftSchema = z.object({
  employeeId: z.string().min(1).nullable().optional(),
  departmentId: z.string().min(1).nullable().optional(),
  skillIds: z.array(z.string().min(1)).optional(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  breakMinutes: z.number().int().min(0).max(480).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const copyWeekSchema = z.object({
  locationId: z.string().min(1),
  sourceWeekStart: z.string().datetime(),
  targetWeekStart: z.string().datetime(),
});

export const publishSchema = z.object({
  locationId: z.string().min(1),
  weekStart: z.string().datetime(),
});

export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;

// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------

export const createLeaveSchema = z.object({
  type: z.enum(["HOLIDAY", "SICK", "UNPAID", "CUSTOM"]),
  customType: z.string().max(60).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date"),
  reason: z.string().max(500).optional(),
}).refine((d) => d.endDate >= d.startDate, {
  message: "End date can't be before start date",
  path: ["endDate"],
}).refine((d) => d.type !== "CUSTOM" || !!d.customType?.trim(), {
  message: "Name the custom leave type",
  path: ["customType"],
});

export const reviewLeaveSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
});

export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;

// ---------------------------------------------------------------------------
// Shift swaps
// ---------------------------------------------------------------------------

export const createSwapSchema = z.object({
  shiftId: z.string().min(1),
  reason: z.string().max(300).optional(),
});

export const reviewSwapSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
});

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

const employmentType = z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "CASUAL"]);

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  jobTitle: z.string().max(80).optional(),
  employmentType: employmentType.default("FULL_TIME"),
  hourlyRate: z.number().min(0).max(10000).default(0),
  contractedHours: z.number().int().min(0).max(168).default(40),
  holidayAllowance: z.number().int().min(0).max(366).default(28),
  departmentId: z.string().min(1).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  skillIds: z.array(z.string().min(1)).optional(),
});

export const createSkillSchema = z.object({
  name: z.string().min(1).max(60),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Locations & departments
// ---------------------------------------------------------------------------

export const createLocationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  radius: z.number().int().min(10).max(5000).default(150),
});
export const updateLocationSchema = createLocationSchema.partial();

export const createDepartmentSchema = z.object({
  locationId: z.string().min(1),
  name: z.string().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
});
export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// ---------------------------------------------------------------------------
// Time tracking
// ---------------------------------------------------------------------------

export const clockSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const reviewTimesheetSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const updateSettingsSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  timezone: z.string().min(1).max(60).optional(),
  currency: z.string().length(3).optional(),
  maxWeeklyHours: z.number().int().min(1).max(168).optional(),
  minRestHours: z.number().int().min(0).max(48).optional(),
  overtimeThreshold: z.number().int().min(0).max(168).optional(),
  weekStartsOn: z.number().int().min(0).max(1).optional(),
  allowSelfSwap: z.boolean().optional(),
  requireGpsClockIn: z.boolean().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
