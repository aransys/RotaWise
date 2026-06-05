import { getCurrentUser } from "@/lib/session";

/**
 * Returns the active tenantId for the signed-in user, or throws.
 * Every data-access path should funnel through this so queries are
 * always filtered by tenant — the core of multi-tenant isolation.
 */
export async function getTenantId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.tenantId;
}

/** Guard for API routes: returns user or null (caller sends 401). */
export async function tenantContext() {
  const user = await getCurrentUser();
  if (!user) return null;
  return { userId: user.id, tenantId: user.tenantId, role: user.role };
}
