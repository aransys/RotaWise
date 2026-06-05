import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Scope to the owner so users can only touch their own notifications.
  const result = await prisma.notification.updateMany({
    where: { id, tenantId: ctx.tenantId, userId: ctx.userId },
    data: { isRead: true },
  });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
