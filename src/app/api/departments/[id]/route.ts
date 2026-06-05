import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateDepartmentSchema } from "@/lib/validators";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "org:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.department.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = updateDepartmentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const department = await prisma.department.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ department });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "org:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.department.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Employees/shifts have their departmentId set null on delete (schema rule).
  await prisma.department.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
