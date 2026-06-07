import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getWeekStart, addDays, shiftHours, DAY_LABELS } from "@/lib/scheduling";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, HBarChart, StatCard, type BarDatum } from "@/components/reports/charts";

function netHours(clockIn: Date, clockOut: Date | null, breakMinutes: number) {
  if (!clockOut) return 0;
  return Math.max(0, (clockOut.getTime() - clockIn.getTime()) / 3_600_000 - breakMinutes / 60);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const user = await requireRole(Role.MANAGER);
  const { week } = await searchParams;
  const weekStart = week ? getWeekStart(new Date(week)) : getWeekStart();
  const weekEnd = addDays(weekStart, 7);
  const now = new Date();

  const [shifts, timesheets, leave, employeeCount] = await Promise.all([
    prisma.shift.findMany({
      where: { tenantId: user.tenantId, start: { gte: weekStart, lt: weekEnd } },
      include: { employee: true, department: true },
    }),
    prisma.timesheet.findMany({
      where: { tenantId: user.tenantId, clockIn: { gte: weekStart, lt: weekEnd }, status: { in: ["COMPLETED", "APPROVED"] } },
      include: { employee: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        tenantId: user.tenantId, status: "APPROVED",
        startDate: { lt: weekEnd }, endDate: { gte: weekStart },
      },
      include: { employee: true },
    }),
    prisma.employee.count({ where: { tenantId: user.tenantId, isActive: true } }),
  ]);

  const assigned = shifts.filter((s) => s.employeeId);
  const openShifts = shifts.length - assigned.length;

  // Labour cost — scheduled (assigned shifts × rate) and per-day.
  const costByDay = Array.from({ length: 7 }, () => 0);
  const hoursByDept = new Map<string, { hours: number; color: string }>();
  let scheduledCost = 0;
  let scheduledHours = 0;
  const hoursByEmployee = new Map<string, { hours: number; contracted: number; rate: number }>();

  for (const s of assigned) {
    const h = shiftHours(s.start, s.end, s.breakMinutes);
    const rate = Number(s.employee?.hourlyRate ?? 0);
    scheduledCost += h * rate;
    scheduledHours += h;
    const di = Math.floor((new Date(s.start.getFullYear(), s.start.getMonth(), s.start.getDate()).getTime() - new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()).getTime()) / 86_400_000);
    if (di >= 0 && di < 7) costByDay[di] += h * rate;
    const deptName = s.department?.name ?? "Unassigned";
    const cur = hoursByDept.get(deptName) ?? { hours: 0, color: s.department?.color ?? "#94a3b8" };
    cur.hours += h;
    hoursByDept.set(deptName, cur);
    if (s.employeeId) {
      const e = hoursByEmployee.get(s.employeeId) ?? { hours: 0, contracted: s.employee?.contractedHours ?? 0, rate };
      e.hours += h;
      hoursByEmployee.set(s.employeeId, e);
    }
  }

  // Actual cost & hours from timesheets.
  let actualCost = 0;
  let actualHours = 0;
  for (const t of timesheets) {
    const h = netHours(t.clockIn, t.clockOut, t.breakMinutes);
    actualHours += h;
    actualCost += h * Number(t.employee.hourlyRate);
  }

  // Overtime: scheduled hours beyond each employee's contracted hours.
  let overtimeHours = 0;
  for (const [, e] of hoursByEmployee) overtimeHours += Math.max(0, e.hours - e.contracted);

  // Attendance: of assigned shifts already started, how many were clocked.
  const dueShifts = assigned.filter((s) => s.start <= now);
  const clockedShiftIds = new Set(timesheets.map((t) => t.shiftId).filter(Boolean) as string[]);
  const attended = dueShifts.filter((s) => clockedShiftIds.has(s.id)).length;
  const attendanceRate = dueShifts.length ? Math.round((attended / dueShifts.length) * 100) : 100;

  // Absence: distinct employees on approved leave this week.
  const onLeave = new Set(leave.map((l) => l.employeeId)).size;

  const coverage = shifts.length ? Math.round((assigned.length / shifts.length) * 100) : 100;

  const costChart: BarDatum[] = DAY_LABELS.map((d, i) => ({
    label: d,
    value: Math.round(costByDay[i]),
    display: formatCurrency(costByDay[i]),
  }));
  const deptChart: BarDatum[] = [...hoursByDept.entries()]
    .map(([name, v]) => ({ label: name, value: Math.round(v.hours * 10) / 10, color: v.color, display: `${(Math.round(v.hours * 10) / 10)}h` }))
    .sort((a, b) => b.value - a.value);

  const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  const prevWeek = addDays(weekStart, -7).toISOString().slice(0, 10);
  const nextWeek = addDays(weekStart, 7).toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Week of {weekLabel}</p>
        </div>
        <div className="flex items-center rounded-md border">
          <Button asChild variant="ghost" size="icon"><Link href={`/reports?week=${prevWeek}`} aria-label="Previous week"><ChevronLeft /></Link></Button>
          <Button asChild variant="ghost" size="sm" className="px-3"><Link href="/reports">This week</Link></Button>
          <Button asChild variant="ghost" size="icon"><Link href={`/reports?week=${nextWeek}`} aria-label="Next week"><ChevronRight /></Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Scheduled labour cost" value={formatCurrency(scheduledCost)} sub={`${scheduledHours.toFixed(1)} scheduled hours`} />
        <StatCard label="Actual labour cost" value={formatCurrency(actualCost)} sub={`${actualHours.toFixed(1)} hours clocked`} />
        <StatCard label="Overtime" value={`${overtimeHours.toFixed(1)}h`} sub="beyond contracted hours" tone={overtimeHours > 0 ? "warning" : "default"} />
        <StatCard label="Coverage" value={`${coverage}%`} sub={openShifts > 0 ? `${openShifts} open shift${openShifts === 1 ? "" : "s"}` : "fully staffed"} tone={openShifts > 0 ? "warning" : "success"} />
        <StatCard label="Attendance" value={`${attendanceRate}%`} sub={`${attended}/${dueShifts.length} shifts clocked`} tone={attendanceRate >= 90 ? "success" : attendanceRate >= 70 ? "default" : "warning"} />
        <StatCard label="On leave" value={String(onLeave)} sub={`of ${employeeCount} staff this week`} />
        <StatCard label="Shifts" value={String(shifts.length)} sub={`${assigned.length} assigned · ${openShifts} open`} />
        <StatCard label="Avg cost / hour" value={scheduledHours ? formatCurrency(scheduledCost / scheduledHours) : "—"} sub="scheduled blended rate" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Scheduled labour cost by day</CardTitle></CardHeader>
          <CardContent><BarChart data={costChart} valuePrefix="£" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Scheduled hours by department</CardTitle></CardHeader>
          <CardContent><HBarChart data={deptChart} /></CardContent>
        </Card>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Scheduled figures come from published &amp; draft shifts; actual cost and attendance come from clocked timesheets. Approve timesheets to keep actuals accurate.
      </p>
    </div>
  );
}
