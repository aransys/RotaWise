import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isManagerOrAbove } from "@/lib/permissions";
import { getWeekStart, evaluateAll, type RuleEmployee } from "@/lib/scheduling";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { RotaEditor } from "@/components/schedule/rota-editor";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await requireUser();
  const { week } = await searchParams;
  const weekStart = week ? getWeekStart(new Date(week)) : getWeekStart();
  const canEdit = isManagerOrAbove(user.role);

  const location = await prisma.location.findFirst({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "asc" },
  });

  if (!location) {
    return (
      <div>
        <PageHeader title="Schedule" description="Build and publish weekly rotas." />
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No location yet. Add a location before building a schedule.
        </Card>
      </div>
    );
  }

  const [employees, departments, settings, schedule, allSkills] = await Promise.all([
    prisma.employee.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      include: { availability: true, department: true, skills: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.department.findMany({ where: { tenantId: user.tenantId, locationId: location.id }, orderBy: { name: "asc" } }),
    prisma.tenantSettings.findUnique({ where: { tenantId: user.tenantId } }),
    prisma.schedule.findUnique({
      where: { locationId_weekStart: { locationId: location.id, weekStart } },
      include: { shifts: { include: { requiredSkills: true } } },
    }),
    prisma.skill.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
  ]);

  const shifts = schedule?.shifts ?? [];
  const ruleSettings = {
    maxWeeklyHours: settings?.maxWeeklyHours ?? 48,
    minRestHours: settings?.minRestHours ?? 11,
  };
  const skillNames: Record<string, string> = Object.fromEntries(allSkills.map((s) => [s.id, s.name]));
  const shiftSkillIds = (sid: string) =>
    shifts.find((s) => s.id === sid)?.requiredSkills.map((rs) => rs.skillId) ?? [];

  // Compute rule warnings server-side.
  const ruleEmployees: RuleEmployee[] = employees.map((e) => ({
    employeeId: e.id,
    contractedHours: e.contractedHours,
    skillIds: e.skills.map((s) => s.skillId),
    shifts: shifts
      .filter((s) => s.employeeId === e.id)
      .map((s) => ({
        id: s.id, start: s.start, end: s.end, breakMinutes: s.breakMinutes,
        requiredSkillIds: s.requiredSkills.map((rs) => rs.skillId),
      })),
    availability: e.availability.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
      isAvailable: a.isAvailable,
    })),
  }));
  const warningMap = evaluateAll(ruleEmployees, ruleSettings, skillNames);
  const warnings: Record<string, { severity: string; message: string }[]> = {};
  for (const [k, v] of warningMap) warnings[k] = v.map((w) => ({ severity: w.severity, message: w.message }));

  return (
    <RotaEditor
      weekStartIso={weekStart.toISOString()}
      locationName={location.name}
      locationId={location.id}
      canEdit={canEdit}
      status={schedule?.status ?? "DRAFT"}
      employees={employees.map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        jobTitle: e.jobTitle ?? e.department?.name ?? "",
        departmentId: e.departmentId,
        contractedHours: e.contractedHours,
      }))}
      departments={departments.map((d) => ({ id: d.id, name: d.name, color: d.color }))}
      shifts={shifts.map((s) => ({
        id: s.id,
        employeeId: s.employeeId,
        departmentId: s.departmentId,
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        breakMinutes: s.breakMinutes,
        status: s.status,
        notes: s.notes,
        recurrenceId: s.recurrenceId,
        requiredSkillIds: shiftSkillIds(s.id),
      }))}
      skills={allSkills.map((s) => ({ id: s.id, name: s.name }))}
      warnings={warnings}
    />
  );
}
