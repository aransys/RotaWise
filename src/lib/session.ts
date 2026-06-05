import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { auth } from "@/auth";
import { hasAtLeast, can, type Permission } from "@/lib/permissions";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(minimum: Role) {
  const user = await requireUser();
  if (!hasAtLeast(user.role, minimum)) redirect("/dashboard");
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/dashboard");
  return user;
}
