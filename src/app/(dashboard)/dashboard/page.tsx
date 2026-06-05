import { CalendarDays, Users, Plane, Clock } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { formatTime } from "@/lib/utils";

function startOfWeekMonday(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() + ((day === 0 ? -6 : 1) - day));
  date.setHours(0, 0, 0, 0);
  return date;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const tenantId = user.tenantId;
  const weekStart = startOfWeekMonday();
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

  const [employeeCount, openShifts, pendingLeave, todayShifts] = await Promise.all([
    prisma.employee.count({ where: { tenantId, isActive: true } }),
    prisma.shift.count({ where: { tenantId, employeeId: null, start: { gte: weekStart, lt: weekEnd } } }),
    prisma.leaveRequest.count({ where: { tenantId, status: "PENDING" } }),
    prisma.shift.findMany({
      where: { tenantId, start: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lt: new Date(new Date().setHours(23, 59, 59, 999)) } },
      include: { employee: true, department: true },
      orderBy: { start: "asc" },
    }),
  ]);

  const stats = [
    { label: "Active employees", value: employeeCount, icon: Users },
    { label: "Open shifts (this week)", value: openShifts, icon: CalendarDays },
    { label: "Pending leave", value: pendingLeave, icon: Plane },
    { label: "Shifts today", value: todayShifts.length, icon: Clock },
  ];

  return (
    <div>
      <PageHeader title={`Welcome, ${user.name?.split(" ")[0] ?? "there"}`} description="Here's what's happening across your team." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Today's shifts</CardTitle></CardHeader>
        <CardContent>
          {todayShifts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No shifts scheduled for today.</p>
          ) : (
            <ul className="divide-y">
              {todayShifts.map((shift) => (
                <li key={shift.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-block size-2 rounded-full" style={{ background: shift.department?.color ?? "#6366f1" }} />
                    <div>
                      <div className="text-sm font-medium">
                        {shift.employee ? `${shift.employee.firstName} ${shift.employee.lastName}` : "Open shift"}
                      </div>
                      <div className="text-xs text-muted-foreground">{shift.department?.name ?? "—"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums">{formatTime(shift.start)}–{formatTime(shift.end)}</span>
                    {!shift.employee && <Badge variant="warning">Unfilled</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
