import { requireRole } from "@/lib/session";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LocationManager } from "@/components/locations/location-manager";

export default async function LocationsPage() {
  const user = await requireRole(Role.MANAGER);

  const locations = await prisma.location.findMany({
    where: { tenantId: user.tenantId },
    include: {
      departments: { orderBy: { name: "asc" }, include: { _count: { select: { employees: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <LocationManager
      locations={locations.map((l) => ({
        id: l.id,
        name: l.name,
        address: l.address,
        latitude: l.latitude,
        longitude: l.longitude,
        radius: l.radius,
        departments: l.departments.map((d) => ({
          id: d.id, name: d.name, color: d.color, employeeCount: d._count.employees,
        })),
      }))}
    />
  );
}
