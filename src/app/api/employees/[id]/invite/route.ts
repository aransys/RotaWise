import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createInviteToken } from "@/lib/invite";
import { sendEmail, inviteEmailHtml, appUrl } from "@/lib/email";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "employee:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const employee = await prisma.employee.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (employee.userId) return NextResponse.json({ error: "This employee already has a login." }, { status: 409 });

  const clash = await prisma.user.findFirst({ where: { tenantId: ctx.tenantId, email: employee.email } });
  if (clash) return NextResponse.json({ error: "A login already exists for that email." }, { status: 409 });

  const token = await createInviteToken(employee.id);
  const link = appUrl(`/invite/${token}`);

  const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { name: true } });
  await sendEmail({
    to: employee.email,
    subject: `You're invited to join ${tenant?.name ?? "RotaWise"}`,
    html: inviteEmailHtml(tenant?.name ?? "RotaWise", link),
  });

  return NextResponse.json({ token, email: employee.email }, { status: 201 });
}
