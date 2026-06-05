import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { reviewTimesheetSchema } from "@/lib/validators";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "timesheet:approve")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = reviewTimesheetSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const ts = await prisma.timesheet.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!ts) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ts.status !== "COMPLETED") {
    return NextResponse.json({ error: "Only completed timesheets can be reviewed." }, { status: 409 });
  }

  const updated = await prisma.timesheet.update({
    where: { id },
    data: { status: parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED" },
  });
  return NextResponse.json({ timesheet: updated });
}
