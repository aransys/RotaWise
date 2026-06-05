import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { reviewSwapSchema } from "@/lib/validators";
import { notify } from "@/lib/notifications";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "swap:approve")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = reviewSwapSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const swap = await prisma.shiftSwap.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { shift: true, requester: true, claimer: true },
  });
  if (!swap) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (swap.status !== "CLAIMED") {
    return NextResponse.json({ error: "Only claimed swaps can be reviewed." }, { status: 409 });
  }

  const approved = parsed.data.action === "APPROVE";

  if (approved && swap.claimerId) {
    // Reassign the shift to the claimer and close the swap, atomically.
    await prisma.$transaction([
      prisma.shift.update({ where: { id: swap.shiftId }, data: { employeeId: swap.claimerId } }),
      prisma.shiftSwap.update({
        where: { id },
        data: { status: "APPROVED", reviewedBy: ctx.userId, reviewedAt: new Date() },
      }),
    ]);
  } else {
    await prisma.shiftSwap.update({
      where: { id },
      data: { status: "REJECTED", reviewedBy: ctx.userId, reviewedAt: new Date() },
    });
  }

  // Notify both parties.
  const when = swap.shift.start.toLocaleDateString("en-GB");
  for (const emp of [swap.requester, swap.claimer]) {
    if (emp?.userId) {
      await notify({
        tenantId: ctx.tenantId,
        userId: emp.userId,
        type: "SWAP_APPROVED",
        title: approved ? "Shift swap approved" : "Shift swap declined",
        body: approved
          ? `The swap for the ${when} shift was approved.`
          : `The swap for the ${when} shift was declined.`,
        link: "/swaps",
      });
    }
  }

  return NextResponse.json({ ok: true, approved });
}

// Requester cancels their own open/claimed swap (before approval).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const employee = await prisma.employee.findFirst({ where: { tenantId: ctx.tenantId, userId: ctx.userId } });

  const swap = await prisma.shiftSwap.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!swap) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isRequester = !!employee && swap.requesterId === employee.id;
  if (!isRequester && !can(ctx.role, "swap:approve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!["OPEN", "CLAIMED"].includes(swap.status)) {
    return NextResponse.json({ error: "This swap can no longer be cancelled." }, { status: 409 });
  }

  await prisma.shiftSwap.update({ where: { id }, data: { status: "CANCELLED" } });
  return NextResponse.json({ ok: true });
}
