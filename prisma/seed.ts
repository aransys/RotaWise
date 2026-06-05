import { PrismaClient, Role, EmploymentType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function startOfWeekMonday(d = new Date()): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function main() {
  console.log("Seeding RotaWise...");

  // Clean slate (dev only)
  await prisma.tenant.deleteMany({ where: { slug: "acme-cafe" } });

  const passwordHash = await bcrypt.hash("Password123!", 10);

  const tenant = await prisma.tenant.create({
    data: {
      name: "Acme Cafe",
      slug: "acme-cafe",
      settings: { create: {} },
    },
  });

  // Users
  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "owner@acme.test",
      name: "Olivia Owner",
      role: Role.BUSINESS_OWNER,
      passwordHash,
      emailVerified: new Date(),
    },
  });

  const manager = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "manager@acme.test",
      name: "Marcus Manager",
      role: Role.MANAGER,
      passwordHash,
      emailVerified: new Date(),
    },
  });

  const empUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "employee@acme.test",
      name: "Ethan Employee",
      role: Role.EMPLOYEE,
      passwordHash,
      emailVerified: new Date(),
    },
  });

  // Location + departments
  const location = await prisma.location.create({
    data: {
      tenantId: tenant.id,
      name: "City Centre Branch",
      address: "12 High Street, Leeds",
      latitude: 53.7997,
      longitude: -1.5492,
    },
  });

  const foh = await prisma.department.create({
    data: { tenantId: tenant.id, locationId: location.id, name: "Front of House", color: "#6366f1" },
  });
  const kitchen = await prisma.department.create({
    data: { tenantId: tenant.id, locationId: location.id, name: "Kitchen", color: "#f59e0b" },
  });

  // Skills
  const barista = await prisma.skill.create({ data: { tenantId: tenant.id, name: "Barista" } });
  const foodHygiene = await prisma.skill.create({ data: { tenantId: tenant.id, name: "Food Hygiene L2" } });

  // Employees
  const empOwner = await prisma.employee.create({
    data: {
      tenantId: tenant.id, userId: owner.id, departmentId: foh.id,
      firstName: "Olivia", lastName: "Owner", email: owner.email,
      jobTitle: "Owner", employmentType: EmploymentType.FULL_TIME, hourlyRate: 0, contractedHours: 40,
    },
  });

  const empManager = await prisma.employee.create({
    data: {
      tenantId: tenant.id, userId: manager.id, departmentId: foh.id,
      firstName: "Marcus", lastName: "Manager", email: manager.email,
      jobTitle: "Shift Manager", employmentType: EmploymentType.FULL_TIME, hourlyRate: 15.5, contractedHours: 40,
    },
  });

  const emp1 = await prisma.employee.create({
    data: {
      tenantId: tenant.id, userId: empUser.id, departmentId: foh.id,
      firstName: "Ethan", lastName: "Employee", email: empUser.email, phone: "07700 900123",
      jobTitle: "Barista", employmentType: EmploymentType.PART_TIME, hourlyRate: 11.44, contractedHours: 20,
      skills: { create: [{ skillId: barista.id, level: 3 }] },
      availability: {
        create: [
          { dayOfWeek: 1, startTime: "08:00", endTime: "18:00" },
          { dayOfWeek: 2, startTime: "08:00", endTime: "18:00" },
          { dayOfWeek: 3, startTime: "08:00", endTime: "18:00" },
        ],
      },
    },
  });

  const emp2 = await prisma.employee.create({
    data: {
      tenantId: tenant.id, departmentId: kitchen.id,
      firstName: "Priya", lastName: "Patel", email: "priya@acme.test", phone: "07700 900456",
      jobTitle: "Chef", employmentType: EmploymentType.FULL_TIME, hourlyRate: 14.0, contractedHours: 38,
      skills: { create: [{ skillId: foodHygiene.id, level: 4 }] },
    },
  });

  // A published schedule for the current week with a few shifts
  const weekStart = startOfWeekMonday();
  const schedule = await prisma.schedule.create({
    data: {
      tenantId: tenant.id, locationId: location.id,
      name: `Week of ${weekStart.toISOString().slice(0, 10)}`,
      weekStart, status: "PUBLISHED", publishedAt: new Date(),
    },
  });

  function shiftAt(dayOffset: number, startH: number, endH: number) {
    const start = new Date(weekStart); start.setDate(start.getDate() + dayOffset); start.setHours(startH, 0, 0, 0);
    const end = new Date(weekStart); end.setDate(end.getDate() + dayOffset); end.setHours(endH, 0, 0, 0);
    return { start, end };
  }

  await prisma.shift.createMany({
    data: [
      { tenantId: tenant.id, scheduleId: schedule.id, locationId: location.id, departmentId: foh.id, employeeId: emp1.id, status: "PUBLISHED", breakMinutes: 30, ...shiftAt(0, 8, 16) },
      { tenantId: tenant.id, scheduleId: schedule.id, locationId: location.id, departmentId: foh.id, employeeId: emp1.id, status: "PUBLISHED", breakMinutes: 30, ...shiftAt(1, 8, 16) },
      { tenantId: tenant.id, scheduleId: schedule.id, locationId: location.id, departmentId: kitchen.id, employeeId: emp2.id, status: "PUBLISHED", breakMinutes: 60, ...shiftAt(0, 7, 17) },
      { tenantId: tenant.id, scheduleId: schedule.id, locationId: location.id, departmentId: foh.id, employeeId: null, status: "PUBLISHED", breakMinutes: 30, ...shiftAt(2, 12, 20) },
    ],
  });

  await prisma.leaveRequest.create({
    data: {
      tenantId: tenant.id, employeeId: emp1.id, type: "HOLIDAY",
      startDate: new Date(weekStart.getTime() + 9 * 86400000),
      endDate: new Date(weekStart.getTime() + 11 * 86400000),
      reason: "Long weekend away", status: "PENDING",
    },
  });

  console.log("Seed complete.");
  console.log("Login with:");
  console.log("  owner@acme.test    / Password123!  (Business Owner)");
  console.log("  manager@acme.test  / Password123!  (Manager)");
  console.log("  employee@acme.test / Password123!  (Employee)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
