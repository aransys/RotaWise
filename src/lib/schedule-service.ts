import { prisma } from "@/lib/prisma";

/** Find or create the Schedule row for a location's rota week. */
export async function getOrCreateSchedule(tenantId: string, locationId: string, weekStartIso: string) {
  const weekStart = new Date(weekStartIso);

  const existing = await prisma.schedule.findUnique({
    where: { locationId_weekStart: { locationId, weekStart } },
  });
  if (existing) return existing;

  return prisma.schedule.create({
    data: {
      tenantId,
      locationId,
      weekStart,
      name: `Week of ${weekStart.toISOString().slice(0, 10)}`,
      status: "DRAFT",
    },
  });
}

/** Verify a location belongs to the tenant (multi-tenant guard). */
export async function assertLocationInTenant(tenantId: string, locationId: string) {
  const loc = await prisma.location.findFirst({ where: { id: locationId, tenantId } });
  if (!loc) throw new Error("LOCATION_NOT_FOUND");
  return loc;
}
