import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { copyWeekSchema } from "@/lib/validators";
import { getOrCreateSchedule, assertLocationInTenant } from "@/lib/schedule-service";

export async function POST(req: Request) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "schedule:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = copyWeekSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { locationId, sourceWeekStart, targetWeekStart } = parsed.data;

  try {
    await assertLocationInTenant(ctx.tenantId, locationId);
  } catch {
    return NextResponse.json({ error: "Location not found" }, { status: 400 });
  }

  const source = new Date(sourceWeekStart);
  const target = new Date(targetWeekStart);
  const offsetMs = target.getTime() - source.getTime();

  const sourceSchedule = await prisma.schedule.findUnique({
    where: { locationId_weekStart: { locationId, weekStart: source } },
    include: { shifts: true },
  });
  if (!sourceSchedule || sourceSchedule.shifts.length === 0) {
    return NextResponse.json({ error: "No shifts to copy from the previous week" }, { status: 400 });
  }

  const targetSchedule = await getOrCreateSchedule(ctx.tenantId, locationId, targetWeekStart);

  // Replace only DRAFT shifts in the target so published rotas aren't clobbered.
  await prisma.shift.deleteMany({ where: { scheduleId: targetSchedule.id, status: "DRAFT" } });

  const data = sourceSchedule.shifts.map((s) => ({
    tenantId: ctx.tenantId,
    scheduleId: targetSchedule.id,
    locationId,
    employeeId: s.employeeId,
    departmentId: s.departmentId,
    start: new Date(s.start.getTime() + offsetMs),
    end: new Date(s.end.getTime() + offsetMs),
    breakMinutes: s.breakMinutes,
    notes: s.notes,
    status: "DRAFT" as const,
  }));

  const result = await prisma.shift.createMany({ data });
  return NextResponse.json({ copied: result.count });
}
