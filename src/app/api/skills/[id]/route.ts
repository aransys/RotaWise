import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "employee:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const skill = await prisma.skill.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // EmployeeSkill / ShiftSkill rows cascade-delete with the skill.
  await prisma.skill.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
