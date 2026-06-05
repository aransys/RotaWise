import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { clockSchema } from "@/lib/validators";
import { getCurrentEmployee } from "@/lib/employee";

export async function POST(req: Request) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "timesheet:clock")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = clockSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { latitude, longitude } = parsed.data;

  const employee = await getCurrentEmployee(ctx.tenantId, ctx.userId);
  if (!employee) return NextResponse.json({ error: "Your account isn't linked to an employee profile." }, { status: 400 });

  const open = await prisma.timesheet.findFirst({
    where: { tenantId: ctx.tenantId, employeeId: employee.id, status: "OPEN" },
    include: { shift: true },
  });
  if (!open) return NextResponse.json({ error: "You're not clocked in." }, { status: 409 });

  const hasCoords = typeof latitude === "number" && typeof longitude === "number";
  // Carry the scheduled break onto the timesheet if it matched a shift.
  const breakMinutes = open.shift?.breakMinutes ?? 0;

  const timesheet = await prisma.timesheet.update({
    where: { id: open.id },
    data: {
      clockOut: new Date(),
      clockOutLat: hasCoords ? latitude : null,
      clockOutLng: hasCoords ? longitude : null,
      breakMinutes,
      status: "COMPLETED",
    },
  });

  return NextResponse.json({ timesheet });
}
