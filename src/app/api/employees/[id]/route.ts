import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateEmployeeSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "employee:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.employee.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = updateEmployeeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  if (d.email && d.email !== existing.email) {
    const dup = await prisma.employee.findFirst({
      where: { tenantId: ctx.tenantId, email: d.email, NOT: { id } },
    });
    if (dup) return NextResponse.json({ error: "Another employee already uses that email." }, { status: 409 });
  }
  if (d.departmentId) {
    const dep = await prisma.department.findFirst({ where: { id: d.departmentId, tenantId: ctx.tenantId } });
    if (!dep) return NextResponse.json({ error: "Department not found" }, { status: 400 });
  }

  if (d.skillIds !== undefined && d.skillIds.length > 0) {
    const count = await prisma.skill.count({ where: { id: { in: d.skillIds }, tenantId: ctx.tenantId } });
    if (count !== d.skillIds.length) return NextResponse.json({ error: "Unknown skill selected" }, { status: 400 });
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: {
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
      jobTitle: d.jobTitle,
      employmentType: d.employmentType,
      hourlyRate: d.hourlyRate,
      contractedHours: d.contractedHours,
      holidayAllowance: d.holidayAllowance,
      departmentId: d.departmentId === undefined ? undefined : d.departmentId,
      startDate: d.startDate ? new Date(`${d.startDate}T00:00:00`) : undefined,
      isActive: d.isActive,
      ...(d.skillIds !== undefined
        ? { skills: { deleteMany: {}, create: d.skillIds.map((skillId) => ({ skillId, level: 1 })) } }
        : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
  await audit({
    tenantId: ctx.tenantId, userId: ctx.userId,
    action: "employee.update", entity: "Employee", entityId: id,
    summary: `Updated employee ${existing.firstName} ${existing.lastName}`,
  });
  return NextResponse.json({ employee });
}

// Soft-delete: deactivate so historical shifts/timesheets are preserved.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "employee:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.employee.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.employee.update({ where: { id }, data: { isActive: false } });
  await audit({
    tenantId: ctx.tenantId, userId: ctx.userId,
    action: "employee.deactivate", entity: "Employee", entityId: id,
    summary: `Deactivated employee ${existing.firstName} ${existing.lastName}`,
  });
  return NextResponse.json({ ok: true });
}
