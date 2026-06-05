import { requireRole } from "@/lib/session";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pendingInviteEmployeeIds } from "@/lib/invite";
import { EmployeeManager } from "@/components/employees/employee-manager";

export default async function EmployeesPage() {
  const user = await requireRole(Role.MANAGER);

  const [employees, departments, skills, pendingInvites] = await Promise.all([
    prisma.employee.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      include: { department: true, skills: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.department.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.skill.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    pendingInviteEmployeeIds(),
  ]);

  return (
    <EmployeeManager
      departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      skills={skills.map((s) => ({ id: s.id, name: s.name }))}
      employees={employees.map((e) => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone,
        jobTitle: e.jobTitle,
        employmentType: e.employmentType,
        hourlyRate: Number(e.hourlyRate),
        contractedHours: e.contractedHours,
        departmentId: e.departmentId,
        departmentName: e.department?.name ?? null,
        startDate: e.startDate ? e.startDate.toISOString().slice(0, 10) : null,
        hasLogin: !!e.userId,
        invited: pendingInvites.has(e.id),
        skillIds: e.skills.map((s) => s.skillId),
      }))}
    />
  );
}
