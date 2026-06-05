import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createDepartmentSchema } from "@/lib/validators";

export async function POST(req: Request) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "org:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createDepartmentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const d = parsed.data;

  const location = await prisma.location.findFirst({ where: { id: d.locationId, tenantId: ctx.tenantId } });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 400 });

  const department = await prisma.department.create({
    data: { tenantId: ctx.tenantId, locationId: d.locationId, name: d.name, color: d.color },
  });
  return NextResponse.json({ department }, { status: 201 });
}
