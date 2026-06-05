import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createSwapSchema } from "@/lib/validators";
import { notifyRoles } from "@/lib/notifications";

export async function POST(req: Request) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "swap:request")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSwapSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { shiftId, reason } = parsed.data;

  const employee = await prisma.employee.findFirst({ where: { tenantId: ctx.tenantId, userId: ctx.userId } });
  if (!employee) return NextResponse.json({ error: "Your account isn't linked to an employee profile." }, { status: 400 });

  const shift = await prisma.shift.findFirst({ where: { id: shiftId, tenantId: ctx.tenantId } });
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  if (shift.employeeId !== employee.id) return NextResponse.json({ error: "You can only offer your own shifts." }, { status: 403 });
  if (shift.start <= new Date()) return NextResponse.json({ error: "That shift has already started." }, { status: 400 });

  const existing = await prisma.shiftSwap.findFirst({
    where: { shiftId, status: { in: ["OPEN", "CLAIMED"] } },
  });
  if (existing) return NextResponse.json({ error: "This shift is already up for swap." }, { status: 409 });

  const swap = await prisma.shiftSwap.create({
    data: { tenantId: ctx.tenantId, shiftId, requesterId: employee.id, reason, status: "OPEN" },
  });

  await notifyRoles(ctx.tenantId, ["MANAGER", "BUSINESS_OWNER", "SUPER_ADMIN"], {
    type: "SWAP_REQUESTED",
    title: "Shift offered for swap",
    body: `${employee.firstName} ${employee.lastName} put a shift up for swap.`,
    link: "/swaps",
  });

  return NextResponse.json({ swap }, { status: 201 });
}
