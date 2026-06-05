"use client";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { initials } from "@/lib/utils";

export function Topbar({ name, email, roleLabel }: { name?: string | null; email?: string | null; roleLabel: string }) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur">
      <div />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <NotificationBell />
        <div className="ml-2 flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {initials(name)}
          </div>
          <div className="hidden text-sm leading-tight sm:block">
            <div className="font-medium">{name ?? email}</div>
            <div className="text-xs text-muted-foreground">{roleLabel}</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut />
        </Button>
      </div>
    </header>
  );
}
