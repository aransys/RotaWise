import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateLocationSchema } from "@/lib/validators";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "org:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.location.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = updateLocationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;

  const location = await prisma.location.update({
    where: { id },
    data: {
      name: d.name,
      address: d.address,
      latitude: d.latitude === undefined ? undefined : d.latitude,
      longitude: d.longitude === undefined ? undefined : d.longitude,
      radius: d.radius,
    },
  });
  return NextResponse.json({ location });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "org:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.location.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Block deletion if shifts exist, to avoid wiping schedule history by cascade.
  const shiftCount = await prisma.shift.count({ where: { locationId: id } });
  if (shiftCount > 0) {
    return NextResponse.json({ error: "This location has shifts. Remove or reassign them first." }, { status: 409 });
  }

  await prisma.location.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
