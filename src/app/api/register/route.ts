import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  companyName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { companyName, name, email, password } = parsed.data;

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  // Unique slug
  let slug = slugify(companyName) || "company";
  let n = 1;
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${slugify(companyName)}-${n++}`;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // New company => the registrant is the Business Owner of a fresh tenant.
  const tenant = await prisma.tenant.create({
    data: {
      name: companyName,
      slug,
      settings: { create: {} },
      users: {
        create: {
          email,
          name,
          passwordHash,
          role: Role.BUSINESS_OWNER,
          emailVerified: new Date(),
        },
      },
    },
    include: { users: true },
  });

  const owner = tenant.users[0];
  const [firstName, ...rest] = name.split(" ");
  await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      userId: owner.id,
      firstName: firstName || name,
      lastName: rest.join(" ") || "",
      email,
      jobTitle: "Owner",
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
