import { Role } from "@prisma/client";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const user = await requireRole(Role.BUSINESS_OWNER);
  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, include: { settings: true } });
  if (!tenant) return null;
  const s = tenant.settings;

  return (
    <SettingsForm
      initial={{
        name: tenant.name,
        slug: tenant.slug,
        timezone: tenant.timezone,
        currency: tenant.currency,
        maxWeeklyHours: s?.maxWeeklyHours ?? 48,
        minRestHours: s?.minRestHours ?? 11,
        overtimeThreshold: s?.overtimeThreshold ?? 40,
        weekStartsOn: s?.weekStartsOn ?? 1,
        allowSelfSwap: s?.allowSelfSwap ?? true,
        requireGpsClockIn: s?.requireGpsClockIn ?? false,
      }}
    />
  );
}
