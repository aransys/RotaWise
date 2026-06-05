import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateShiftSchema } from "@/lib/validators";

async function loadOwnedShift(tenantId: string, id: string) {
  return prisma.shift.findFirst({ where: { id, tenantId } });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "schedule:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const shift = await loadOwnedShift(ctx.tenantId, id);
  if (!shift) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateShiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  const nextStart = d.start ? new Date(d.start) : shift.start;
  const nextEnd = d.end ? new Date(d.end) : shift.end;
  if (nextEnd <= nextStart) return NextResponse.json({ error: "End must be after start" }, { status: 400 });

  if (d.employeeId) {
    const emp = await prisma.employee.findFirst({ where: { id: d.employeeId, tenantId: ctx.tenantId } });
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 400 });
  }

  // If skillIds are provided, validate and replace the required-skill set.
  if (d.skillIds !== undefined && d.skillIds.length > 0) {
    const count = await prisma.skill.count({ where: { id: { in: d.skillIds }, tenantId: ctx.tenantId } });
    if (count !== d.skillIds.length) return NextResponse.json({ error: "Unknown skill selected" }, { status: 400 });
  }

  const updated = await prisma.shift.update({
    where: { id },
    data: {
      employeeId: d.employeeId === undefined ? undefined : d.employeeId,
      departmentId: d.departmentId === undefined ? undefined : d.departmentId,
      start: nextStart,
      end: nextEnd,
      breakMinutes: d.breakMinutes ?? undefined,
      notes: d.notes === undefined ? undefined : d.notes,
      ...(d.skillIds !== undefined
        ? { requiredSkills: { deleteMany: {}, create: d.skillIds.map((skillId) => ({ skillId })) } }
        : {}),
    },
  });
  return NextResponse.json({ shift: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "schedule:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const shift = await loadOwnedShift(ctx.tenantId, id);
  if (!shift) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ?series=true deletes this occurrence and all later ones in the same series.
  const series = new URL(req.url).searchParams.get("series") === "true";
  if (series && shift.recurrenceId) {
    const result = await prisma.shift.deleteMany({
      where: { tenantId: ctx.tenantId, recurrenceId: shift.recurrenceId, start: { gte: shift.start } },
    });
    return NextResponse.json({ ok: true, deleted: result.count });
  }

  await prisma.shift.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: 1 });
}
