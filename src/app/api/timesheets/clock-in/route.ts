import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { clockSchema } from "@/lib/validators";
import { getCurrentEmployee } from "@/lib/employee";
import { haversineMeters } from "@/lib/geo";

const MATCH_WINDOW_MS = 60 * 60 * 1000; // 1h either side of a scheduled shift

export async function POST(req: Request) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "timesheet:clock")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = clockSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { latitude, longitude } = parsed.data;

  const employee = await getCurrentEmployee(ctx.tenantId, ctx.userId);
  if (!employee) return NextResponse.json({ error: "Your account isn't linked to an employee profile." }, { status: 400 });

  const openOne = await prisma.timesheet.findFirst({
    where: { tenantId: ctx.tenantId, employeeId: employee.id, status: "OPEN" },
  });
  if (openOne) return NextResponse.json({ error: "You're already clocked in." }, { status: 409 });

  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: ctx.tenantId } });
  const hasCoords = typeof latitude === "number" && typeof longitude === "number";
  if (settings?.requireGpsClockIn && !hasCoords) {
    return NextResponse.json({ error: "Location is required to clock in. Please enable GPS." }, { status: 400 });
  }

  const now = new Date();

  // Match to the nearest scheduled shift within the window.
  const candidate = await prisma.shift.findFirst({
    where: {
      tenantId: ctx.tenantId,
      employeeId: employee.id,
      start: { lte: new Date(now.getTime() + MATCH_WINDOW_MS) },
      end: { gte: new Date(now.getTime() - MATCH_WINDOW_MS) },
    },
    include: { location: true },
    orderBy: { start: "asc" },
  });

  // Geofence: if required and the matched location has coordinates, enforce radius.
  if (settings?.requireGpsClockIn && hasCoords && candidate?.location?.latitude != null && candidate.location.longitude != null) {
    const dist = haversineMeters(latitude!, longitude!, candidate.location.latitude, candidate.location.longitude);
    if (dist > candidate.location.radius) {
      return NextResponse.json(
        { error: `You're ${Math.round(dist)}m from ${candidate.location.name} (limit ${candidate.location.radius}m).` },
        { status: 403 }
      );
    }
  }

  const timesheet = await prisma.timesheet.create({
    data: {
      tenantId: ctx.tenantId,
      employeeId: employee.id,
      shiftId: candidate?.id ?? null,
      clockIn: now,
      clockInLat: hasCoords ? latitude : null,
      clockInLng: hasCoords ? longitude : null,
      status: "OPEN",
    },
  });

  return NextResponse.json({ timesheet, matchedShift: !!candidate }, { status: 201 });
}
