"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { hasAtLeast } from "@/lib/permissions";
import { NAV_ITEMS } from "./nav-items";

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => !i.minRole || hasAtLeast(role, i.minRole)).slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background md:hidden">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href}
            className={cn("flex flex-1 flex-col items-center gap-1 py-2 text-[10px]",
              active ? "text-primary" : "text-muted-foreground")}>
            <item.icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
