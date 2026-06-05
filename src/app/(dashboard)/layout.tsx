import { requireUser } from "@/lib/session";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { Role } from "@prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  BUSINESS_OWNER: "Business Owner",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={user.name} email={user.email} roleLabel={ROLE_LABELS[user.role]} />
        <main className="flex-1 p-6 pb-24 md:pb-6">{children}</main>
        <MobileNav role={user.role} />
      </div>
    </div>
  );
}
