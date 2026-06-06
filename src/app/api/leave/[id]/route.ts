import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { reviewLeaveSchema } from "@/lib/validators";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/audit";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "leave:approve")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = reviewLeaveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const leave = await prisma.leaveRequest.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { employee: true },
  });
  if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (leave.status !== "PENDING") {
    return NextResponse.json({ error: "This request has already been reviewed." }, { status: 409 });
  }

  const approved = parsed.data.action === "APPROVE";
  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: { status: approved ? "APPROVED" : "REJECTED", reviewedBy: ctx.userId, reviewedAt: new Date() },
  });

  if (leave.employee.userId) {
    await notify({
      tenantId: ctx.tenantId,
      userId: leave.employee.userId,
      type: approved ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
      title: approved ? "Leave approved" : "Leave declined",
      body: `Your ${leave.type.toLowerCase()} request (${leave.startDate.toLocaleDateString("en-GB")}–${leave.endDate.toLocaleDateString("en-GB")}) was ${approved ? "approved" : "declined"}.`,
      link: "/leave",
    });
  }

  await audit({
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: approved ? "leave.approve" : "leave.reject",
    entity: "LeaveRequest",
    entityId: leave.id,
    summary: `${approved ? "Approved" : "Rejected"} ${leave.type.toLowerCase()} leave for ${leave.employee.firstName} ${leave.employee.lastName}`,
  });

  return NextResponse.json({ leave: updated });
}

// Requester cancels their own still-pending request.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const leave = await prisma.leaveRequest.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { employee: true },
  });
  if (!leave) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = leave.employee.userId === ctx.userId;
  if (!isOwner && !can(ctx.role, "leave:approve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (leave.status !== "PENDING") {
    return NextResponse.json({ error: "Only pending requests can be cancelled." }, { status: 409 });
  }

  await prisma.leaveRequest.update({ where: { id }, data: { status: "CANCELLED" } });
  return NextResponse.json({ ok: true });
}
