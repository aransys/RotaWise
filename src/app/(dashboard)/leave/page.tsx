import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";
import { LeaveManager } from "@/components/leave/leave-manager";

export default async function LeavePage() {
  const user = await requireUser();
  const manager = isManagerOrAbove(user.role);

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const yearEnd = new Date(new Date().getFullYear() + 1, 0, 1);

  const [currentEmployee, requests, approvedHolidays] = await Promise.all([
    prisma.employee.findFirst({ where: { tenantId: user.tenantId, userId: user.id } }),
    prisma.leaveRequest.findMany({
      where: { tenantId: user.tenantId, ...(manager ? {} : { employee: { userId: user.id } }) },
      include: { employee: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.leaveRequest.findMany({
      where: {
        tenantId: user.tenantId, type: "HOLIDAY", status: "APPROVED",
        employee: { userId: user.id },
        startDate: { lt: yearEnd }, endDate: { gte: yearStart },
      },
      select: { startDate: true, endDate: true },
    }),
  ]);

  // Inclusive day count of approved holiday this calendar year.
  const usedDays = approvedHolidays.reduce((sum, r) => {
    const start = r.startDate < yearStart ? yearStart : r.startDate;
    const end = r.endDate;
    return sum + Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  }, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allowance = currentEmployee ? ((currentEmployee as any).holidayAllowance ?? 28) : 0;
  const balance = currentEmployee
    ? { allowance, used: usedDays, remaining: Math.max(0, allowance - usedDays) }
    : null;

  return (
    <LeaveManager
      isManager={manager}
      canRequest={!!currentEmployee}
      balance={balance}
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
