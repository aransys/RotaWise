import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { tenantId: ctx.tenantId, userId: ctx.userId, isRead: false },
    data: { isRead: true },
  });
  return NextResponse.json({ ok: true });
}
