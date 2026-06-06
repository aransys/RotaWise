import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateSettingsSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export async function PATCH(req: Request) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "settings:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updateSettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: ctx.tenantId },
      data: { name: d.name, timezone: d.timezone, currency: d.currency },
    }),
    prisma.tenantSettings.upsert({
      where: { tenantId: ctx.tenantId },
      update: {
        maxWeeklyHours: d.maxWeeklyHours,
        minRestHours: d.minRestHours,
        overtimeThreshold: d.overtimeThreshold,
        weekStartsOn: d.weekStartsOn,
        allowSelfSwap: d.allowSelfSwap,
        requireGpsClockIn: d.requireGpsClockIn,
      },
      create: {
        tenantId: ctx.tenantId,
        maxWeeklyHours: d.maxWeeklyHours ?? 48,
        minRestHours: d.minRestHours ?? 11,
        overtimeThreshold: d.overtimeThreshold ?? 40,
        weekStartsOn: d.weekStartsOn ?? 1,
        allowSelfSwap: d.allowSelfSwap ?? true,
        requireGpsClockIn: d.requireGpsClockIn ?? false,
      },
    }),
  ]);

  await audit({
    tenantId: ctx.tenantId, userId: ctx.userId,
    action: "settings.update", entity: "TenantSettings", entityId: ctx.tenantId,
    summary: "Updated company settings",
  });

  return NextResponse.json({ ok: true });
}
