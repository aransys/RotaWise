import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { publishSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "schedule:publish")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = publishSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { locationId, weekStart } = parsed.data;

  const schedule = await prisma.schedule.findFirst({
    where: { tenantId: ctx.tenantId, locationId, weekStart: new Date(weekStart) },
    include: { shifts: { where: { employeeId: { not: null } }, include: { employee: true } } },
  });
  if (!schedule) return NextResponse.json({ error: "Nothing to publish" }, { status: 400 });

  await prisma.$transaction([
    prisma.schedule.update({
      where: { id: schedule.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    }),
    prisma.shift.updateMany({
      where: { scheduleId: schedule.id, status: "DRAFT" },
      data: { status: "PUBLISHED" },
    }),
  ]);

  // Notify assigned employees who have a linked user account.
  const notifications = schedule.shifts
    .map((s) => s.employee?.userId)
    .filter((uid, i, arr): uid is string => !!uid && arr.indexOf(uid) === i)
    .map((userId) => ({
      tenantId: ctx.tenantId,
      userId,
      type: "SCHEDULE_PUBLISHED" as const,
      title: "New schedule published",
      body: `The rota for week of ${new Date(weekStart).toLocaleDateString("en-GB")} is now live.`,
      link: "/schedule",
    }));
  if (notifications.length) await prisma.notification.createMany({ data: notifications });

  await audit({
    tenantId: ctx.tenantId, userId: ctx.userId,
    action: "schedule.publish", entity: "Schedule", entityId: schedule.id,
    summary: `Published rota for week of ${new Date(weekStart).toLocaleDateString("en-GB")} (${schedule.shifts.length} shifts)`,
  });

  return NextResponse.json({ ok: true, published: schedule.shifts.length });
}
