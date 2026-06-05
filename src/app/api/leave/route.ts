import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createLeaveSchema } from "@/lib/validators";
import { notifyRoles } from "@/lib/notifications";

export async function POST(req: Request) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "leave:request")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createLeaveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const d = parsed.data;

  // The requester must have an Employee record in this tenant.
  const employee = await prisma.employee.findFirst({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
  });
  if (!employee) {
    return NextResponse.json({ error: "Your account isn't linked to an employee profile." }, { status: 400 });
  }

  const leave = await prisma.leaveRequest.create({
    data: {
      tenantId: ctx.tenantId,
      employeeId: employee.id,
      type: d.type,
      customType: d.type === "CUSTOM" ? d.customType : null,
      startDate: new Date(`${d.startDate}T00:00:00`),
      endDate: new Date(`${d.endDate}T00:00:00`),
      reason: d.reason,
      status: "PENDING",
    },
  });

  await notifyRoles(ctx.tenantId, ["MANAGER", "BUSINESS_OWNER", "SUPER_ADMIN"], {
    type: "LEAVE_REQUESTED",
    title: "New leave request",
    body: `${employee.firstName} ${employee.lastName} requested ${d.type.toLowerCase()} leave.`,
    link: "/leave",
  });

  return NextResponse.json({ leave }, { status: 201 });
}
