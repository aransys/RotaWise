import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createLocationSchema } from "@/lib/validators";

export async function GET() {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const locations = await prisma.location.findMany({
    where: { tenantId: ctx.tenantId },
    include: { departments: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ locations });
}

export async function POST(req: Request) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "org:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createLocationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const d = parsed.data;

  const location = await prisma.location.create({
    data: {
      tenantId: ctx.tenantId,
      name: d.name,
      address: d.address,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      radius: d.radius,
    },
  });
  return NextResponse.json({ location }, { status: 201 });
}
