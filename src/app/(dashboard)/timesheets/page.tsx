import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";
import { getCurrentEmployee } from "@/lib/employee";
import { getWeekStart } from "@/lib/scheduling";
import { formatTime } from "@/lib/utils";
import { TimesheetManager } from "@/components/timesheets/timesheet-manager";

function netHours(clockIn: Date, clockOut: Date | null, breakMinutes: number): number {
  if (!clockOut) return 0;
  return Math.max(0, (clockOut.getTime() - clockIn.getTime()) / 3_600_000 - breakMinutes / 60);
}
function dateLabel(d: Date) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function shiftLabel(s: { start: Date; end: Date } | null) {
  return s ? `${formatTime(s.start)}–${formatTime(s.end)}` : null;
}

export default async function TimesheetsPage() {
  const user = await requireUser();
  const manager = isManagerOrAbove(user.role);
  const employee = await getCurrentEmployee(user.tenantId, user.id);
  const settings = await prisma.tenantSettings.findUnique({ where: { tenantId: user.tenantId } });
  const weekStart = getWeekStart();

  const [open, mine, pending] = await Promise.all([
    employee
      ? prisma.timesheet.findFirst({
          where: { tenantId: user.tenantId, employeeId: employee.id, status: "OPEN" },
          include: { shift: true },
        })
      : Promise.resolve(null),
    employee
      ? prisma.timesheet.findMany({
          where: { tenantId: user.tenantId, employeeId: employee.id },
          include: { shift: true },
          orderBy: { clockIn: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    manager
      ? prisma.timesheet.findMany({
          where: { tenantId: user.tenantId, status: "COMPLETED" },
          include: { employee: true, shift: true },
          orderBy: { clockIn: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const myThisWeek = (mine as typeof mine)
    .filter((t) => t.clockIn >= weekStart && t.status !== "REJECTED")
    .reduce((sum, t) => sum + netHours(t.clockIn, t.clockOut, t.breakMinutes), 0);

  return (
    <TimesheetManager
      isManager={manager}
      hasEmployee={!!employee}
      requireGps={settings?.requireGpsClockIn ?? false}
      hoursThisWeek={Number(myThisWeek.toFixed(2))}
      openTimesheet={open ? { id: open.id, clockIn: open.clockIn.toISOString(), shiftLabel: shiftLabel(open.shift) } : null}
      myTimesheets={mine.map((t) => ({
        id: t.id,
        dateLabel: dateLabel(t.clockIn),
        clockIn: t.clockIn.toISOString(),
        clockOut: t.clockOut ? t.clockOut.toISOString() : null,
        breakMinutes: t.breakMinutes,
        hours: Number(netHours(t.clockIn, t.clockOut, t.breakMinutes).toFixed(2)),
        status: t.status,
        shiftLabel: shiftLabel(t.shift),
      }))}
      pending={pending.map((t) => ({
        id: t.id,
        employeeName: `${t.employee.firstName} ${t.employee.lastName}`,
        dateLabel: dateLabel(t.clockIn),
        clockIn: t.clockIn.toISOString(),
        clockOut: t.clockOut ? t.clockOut.toISOString() : null,
        breakMinutes: t.breakMinutes,
        hours: Number(netHours(t.clockIn, t.clockOut, t.breakMinutes).toFixed(2)),
      }))}
    />
  );
}
