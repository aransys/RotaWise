import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createEmployeeSchema } from "@/lib/validators";

export async function GET() {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "employee:read")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const employees = await prisma.employee.findMany({
    where: { tenantId: ctx.tenantId, isActive: true },
    include: { department: true, skills: { include: { skill: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return NextResponse.json({ employees });
}

export async function POST(req: Request) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "employee:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createEmployeeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  const dup = await prisma.employee.findFirst({ where: { tenantId: ctx.tenantId, email: d.email } });
  if (dup) return NextResponse.json({ error: "An employee with that email already exists." }, { status: 409 });

  if (d.departmentId) {
    const dep = await prisma.department.findFirst({ where: { id: d.departmentId, tenantId: ctx.tenantId } });
    if (!dep) return NextResponse.json({ error: "Department not found" }, { status: 400 });
  }

  const skillIds = d.skillIds ?? [];
  if (skillIds.length > 0) {
    const count = await prisma.skill.count({ where: { id: { in: skillIds }, tenantId: ctx.tenantId } });
    if (count !== skillIds.length) return NextResponse.json({ error: "Unknown skill selected" }, { status: 400 });
  }

  const employee = await prisma.employee.create({
    data: {
      tenantId: ctx.tenantId,
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      phone: d.phone,
      jobTitle: d.jobTitle,
      employmentType: d.employmentType,
      hourlyRate: d.hourlyRate,
      contractedHours: d.contractedHours,
      departmentId: d.departmentId ?? null,
      startDate: d.startDate ? new Date(`${d.startDate}T00:00:00`) : null,
      skills: skillIds.length ? { create: skillIds.map((skillId) => ({ skillId, level: 1 })) } : undefined,
    },
  });
  return NextResponse.json({ employee }, { status: 201 });
}
