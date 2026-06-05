import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";
import { formatTime } from "@/lib/utils";
import { SwapManager } from "@/components/swaps/swap-manager";

function shiftLabel(start: Date, end: Date, dept?: string | null) {
  const date = start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `${date} · ${formatTime(start)}–${formatTime(end)}${dept ? ` · ${dept}` : ""}`;
}

export default async function SwapsPage() {
  const user = await requireUser();
  const manager = isManagerOrAbove(user.role);
  const now = new Date();

  const employee = await prisma.employee.findFirst({ where: { tenantId: user.tenantId, userId: user.id } });

  const [myShifts, openPool, mySwaps, approvalQueue] = await Promise.all([
    employee
      ? prisma.shift.findMany({
          where: { tenantId: user.tenantId, employeeId: employee.id, start: { gt: now }, status: "PUBLISHED" },
          include: { department: true, swaps: { where: { status: { in: ["OPEN", "CLAIMED"] } } } },
          orderBy: { start: "asc" },
        })
      : Promise.resolve([]),
    prisma.shiftSwap.findMany({
      where: { tenantId: user.tenantId, status: "OPEN", ...(employee ? { requesterId: { not: employee.id } } : {}) },
      include: { shift: { include: { department: true } }, requester: true },
      orderBy: { createdAt: "desc" },
    }),
    employee
      ? prisma.shiftSwap.findMany({
          where: { tenantId: user.tenantId, requesterId: employee.id },
          include: { shift: { include: { department: true } }, claimer: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    manager
      ? prisma.shiftSwap.findMany({
          where: { tenantId: user.tenantId, status: "CLAIMED" },
          include: { shift: { include: { department: true } }, requester: true, claimer: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <SwapManager
      isManager={manager}
      hasEmployee={!!employee}
      offerable={myShifts
        .filter((s) => s.swaps.length === 0)
        .map((s) => ({ id: s.id, label: shiftLabel(s.start, s.end, s.department?.name) }))}
      openPool={openPool.map((sw) => ({
        id: sw.id,
        requesterName: `${sw.requester.firstName} ${sw.requester.lastName}`,
        label: shiftLabel(sw.shift.start, sw.shift.end, sw.shift.department?.name),
        reason: sw.reason,
      }))}
      mySwaps={mySwaps.map((sw) => ({
        id: sw.id,
        status: sw.status,
        label: shiftLabel(sw.shift.start, sw.shift.end, sw.shift.department?.name),
        claimerName: sw.claimer ? `${sw.claimer.firstName} ${sw.claimer.lastName}` : null,
      }))}
      approvalQueue={approvalQueue.map((sw) => ({
        id: sw.id,
        requesterName: `${sw.requester.firstName} ${sw.requester.lastName}`,
        claimerName: sw.claimer ? `${sw.claimer.firstName} ${sw.claimer.lastName}` : "—",
        label: shiftLabel(sw.shift.start, sw.shift.end, sw.shift.department?.name),
      }))}
    />
  );
}
