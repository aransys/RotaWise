import { NextResponse } from "next/server";
import { tenantContext } from "@/lib/tenant";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createSkillSchema } from "@/lib/validators";

export async function GET() {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const skills = await prisma.skill.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ skills });
}

export async function POST(req: Request) {
  const ctx = await tenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(ctx.role, "employee:write")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSkillSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });

  const name = parsed.data.name.trim();
  const existing = await prisma.skill.findFirst({ where: { tenantId: ctx.tenantId, name } });
  if (existing) return NextResponse.json({ skill: existing }, { status: 200 });

  const skill = await prisma.skill.create({ data: { tenantId: ctx.tenantId, name } });
  return NextResponse.json({ skill }, { status: 201 });
}
