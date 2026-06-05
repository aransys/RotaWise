import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { notifyRoles } from "@/lib/notifications";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "swap:request")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const employee = await prisma.employee.findFirst({ where: { tenantId: ctx.tenantId, userId: ctx.userId } });
  if (!employee) return NextResponse.json({ error: "Your account isn't linked to an employee profile." }, { status: 400 });

  const swap = await prisma.shiftSwap.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { shift: true },
  });
  if (!swap) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (swap.status !== "OPEN") return NextResponse.json({ error: "This swap is no longer open." }, { status: 409 });
  if (swap.requesterId === employee.id) return NextResponse.json({ error: "You can't claim your own shift." }, { status: 400 });

  // Prevent double-booking: claimer must not already have an overlapping shift.
  const overlap = await prisma.shift.findFirst({
    where: {
      tenantId: ctx.tenantId,
      employeeId: employee.id,
      start: { lt: swap.shift.end },
      end: { gt: swap.shift.start },
    },
  });
  if (overlap) return NextResponse.json({ error: "You already have a shift that overlaps this one." }, { status: 409 });

  const updated = await prisma.shiftSwap.update({
    where: { id },
    data: { status: "CLAIMED", claimerId: employee.id },
  });

  await notifyRoles(ctx.tenantId, ["MANAGER", "BUSINESS_OWNER", "SUPER_ADMIN"], {
    type: "SWAP_CLAIMED",
    title: "Swap needs approval",
    body: `${employee.firstName} ${employee.lastName} claimed an offered shift. Approve to reassign it.`,
    link: "/swaps",
  });

  return NextResponse.json({ swap: updated });
}
