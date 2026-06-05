import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getValidInvite } from "@/lib/invite";

const schema = z.object({
  token: z.string().min(1),
  name: z.string().max(120).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { token, name, password } = parsed.data;

  const invite = await getValidInvite(token);
  if (!invite) return NextResponse.json({ error: "This invite link is invalid or has expired." }, { status: 400 });

  const employee = await prisma.employee.findUnique({ where: { id: invite.employeeId } });
  if (!employee) return NextResponse.json({ error: "Employee no longer exists." }, { status: 400 });
  if (employee.userId) return NextResponse.json({ error: "This invite has already been used." }, { status: 409 });

  const clash = await prisma.user.findFirst({ where: { tenantId: employee.tenantId, email: employee.email } });
  if (clash) return NextResponse.json({ error: "A login already exists for that email." }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        tenantId: employee.tenantId,
        email: employee.email,
        name: name?.trim() || `${employee.firstName} ${employee.lastName}`,
        passwordHash,
        role: Role.EMPLOYEE,
        emailVerified: new Date(),
      },
    });
    await tx.employee.update({ where: { id: employee.id }, data: { userId: user.id } });
    await tx.verificationToken.deleteMany({ where: { identifier: invite.identifier } });
  });

  return NextResponse.json({ ok: true, email: employee.email });
}
