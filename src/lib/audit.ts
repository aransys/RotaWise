import { prisma } from "@/lib/prisma";

interface AuditInput {
  tenantId: string;
  userId?: string | null;
  actorName?: string | null;
  action: string;   // dotted verb, e.g. "leave.approve"
  entity: string;   // model name, e.g. "LeaveRequest"
  entityId?: string | null;
  summary: string;  // human-readable
}

/**
 * Append an audit-trail entry. Best-effort — never throws into the caller.
 * `prisma.auditLog` is available after `prisma generate` picks up the new model;
 * the cast keeps this compiling before the client is regenerated.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    let actorName = input.actorName;
    if (actorName === undefined && input.userId) {
      const u = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { name: true, email: true },
      });
      actorName = u?.name ?? u?.email ?? null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        actorName: actorName ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
      },
    });
  } catch (e) {
    console.error("[audit] failed:", e);
  }
}
