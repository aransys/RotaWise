"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

async function fetchNotifications(): Promise<NotificationItem[]> {
  const res = await fetch("/api/notifications");
  if (!res.ok) return [];
  const data = await res.json();
  return data.notifications ?? [];
}

export function NotificationBell() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 120_000, // long fallback; real-time pushes arrive over SSE
  });

  // Live updates via Server-Sent Events. The server signals on every new
  // notification; we refetch on signal. EventSource auto-reconnects on drop.
  React.useEffect(() => {
    const es = new EventSource("/api/notifications/stream");
    const onPush = () => qc.invalidateQueries({ queryKey: ["notifications"] });
    es.addEventListener("notification", onPush);
    return () => {
      es.removeEventListener("notification", onPush);
      es.close();
    };
  }, [qc]);

  const markRead = useMutation({
    mutationFn: (id: string) => fetch(`/api/notifications/${id}`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: () => fetch("/api/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = notifications.filter((n) => !n.isRead).length;

  // Close on outside click / Escape
  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleItemClick(n: NotificationItem) {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" aria-label="Notifications" onClick={() => setOpen((o) => !o)}>
        <Bell />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">You're all caught up.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={cn(
                    "flex w-full gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-accent",
                    !n.isRead && "bg-primary/5"
                  )}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-primary")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{n.title}</span>
                    {n.body && <span className="block text-xs text-muted-foreground">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
