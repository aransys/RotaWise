import { Role } from "@prisma/client";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { initials } from "@/lib/utils";

interface AuditRow {
  id: string; actorName: string | null; action: string; entity: string;
  summary: string; createdAt: Date;
}

export default async function AuditPage() {
  const user = await requireRole(Role.BUSINESS_OWNER);

  // auditLog is available after `prisma generate`; cast bridges the gap pre-generate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs: AuditRow[] = await (prisma as any).auditLog.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader title="Audit log" description="A record of important actions across your workspace." />
      <Card className="overflow-x-auto">
        {logs.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">When</th>
                <th className="p-3 font-medium">Who</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="whitespace-nowrap p-3 text-muted-foreground">
                    {new Date(l.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                        {initials(l.actorName)}
                      </span>
                      <span>{l.actorName ?? "System"}</span>
                    </div>
                  </td>
                  <td className="p-3"><Badge variant="secondary">{l.action}</Badge></td>
                  <td className="p-3">{l.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
