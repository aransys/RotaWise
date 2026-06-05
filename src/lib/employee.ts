import { prisma } from "@/lib/prisma";

/** The Employee record linked to the signed-in user in this tenant, or null. */
export async function getCurrentEmployee(tenantId: string, userId: string) {
  return prisma.employee.findFirst({ where: { tenantId, userId } });
}
