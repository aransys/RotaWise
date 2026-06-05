import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";
import { LeaveManager } from "@/components/leave/leave-manager";

export default async function LeavePage() {
  const user = await requireUser();
  const manager = isManagerOrAbove(user.role);

  const [currentEmployee, requests] = await Promise.all([
    prisma.employee.findFirst({ where: { tenantId: user.tenantId, userId: user.id } }),
    prisma.leaveRequest.findMany({
      where: { tenantId: user.tenantId, ...(manager ? {} : { employee: { userId: user.id } }) },
      include: { employee: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <LeaveManager
      isManager={manager}
      canRequest={!!currentEmployee}
      requests={requests.map((r) => ({
        id: r.id,
        employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
        type: r.type,
        customType: r.customType,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        reason: r.reason,
        status: r.status,
        isOwn: r.employee.userId === user.id,
      }))}
    />
  );
}
