import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createShiftSchema } from "@/lib/validators";
import { getOrCreateSchedule, assertLocationInTenant } from "@/lib/schedule-service";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "schedule:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = createShiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  try {
    await assertLocationInTenant(ctx.tenantId, d.locationId);

    // Guard: employee (if any) and department (if any) must belong to the tenant.
    if (d.employeeId) {
      const emp = await prisma.employee.findFirst({ where: { id: d.employeeId, tenantId: ctx.tenantId } });
      if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 400 });
    }
    if (d.departmentId) {
      const dep = await prisma.department.findFirst({ where: { id: d.departmentId, tenantId: ctx.tenantId } });
      if (!dep) return NextResponse.json({ error: "Department not found" }, { status: 400 });
    }

    // Validate any required skills belong to the tenant.
    const skillIds = d.skillIds ?? [];
    if (skillIds.length > 0) {
      const count = await prisma.skill.count({ where: { id: { in: skillIds }, tenantId: ctx.tenantId } });
      if (count !== skillIds.length) return NextResponse.json({ error: "Unknown skill selected" }, { status: 400 });
    }
    const skillCreate = skillIds.map((id) => ({ skillId: id }));

    const baseStart = new Date(d.start);
    const baseEnd = new Date(d.end);
    const baseWeek = new Date(d.weekStart);

    // Single shift — the common case.
    if (!d.repeatWeeks || d.repeatWeeks < 1) {
      const schedule = await getOrCreateSchedule(ctx.tenantId, d.locationId, d.weekStart);
      const shift = await prisma.shift.create({
        data: {
          tenantId: ctx.tenantId,
          scheduleId: schedule.id,
          locationId: d.locationId,
          employeeId: d.employeeId ?? null,
          departmentId: d.departmentId ?? null,
          start: baseStart,
          end: baseEnd,
          breakMinutes: d.breakMinutes,
          notes: d.notes,
          status: "DRAFT",
          requiredSkills: skillCreate.length ? { create: skillCreate } : undefined,
        },
      });
      return NextResponse.json({ shift }, { status: 201 });
    }

    // Recurring series: this week plus `repeatWeeks` following weeks, same weekday/time.
    // Created one-by-one so each occurrence can carry its own required-skill rows.
    const recurrenceId = randomUUID();
    let created = 0;
    for (let k = 0; k <= d.repeatWeeks; k++) {
      const weekIso = new Date(baseWeek.getTime() + k * WEEK_MS).toISOString();
      const schedule = await getOrCreateSchedule(ctx.tenantId, d.locationId, weekIso);
      await prisma.shift.create({
        data: {
          tenantId: ctx.tenantId,
          scheduleId: schedule.id,
          locationId: d.locationId,
          employeeId: d.employeeId ?? null,
          departmentId: d.departmentId ?? null,
          start: new Date(baseStart.getTime() + k * WEEK_MS),
          end: new Date(baseEnd.getTime() + k * WEEK_MS),
          breakMinutes: d.breakMinutes,
          notes: d.notes,
          status: "DRAFT",
          isRecurring: true,
          recurrenceId,
          requiredSkills: skillCreate.length ? { create: skillCreate } : undefined,
        },
      });
      created++;
    }
    return NextResponse.json({ created, recurrenceId }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const code = msg === "LOCATION_NOT_FOUND" ? 400 : 500;
    return NextResponse.json({ error: msg }, { status: code });
  }
}
