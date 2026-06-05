"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Square, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { formatTime } from "@/lib/utils";

type TsStatus = "OPEN" | "COMPLETED" | "APPROVED" | "REJECTED";
const STATUS_VARIANT: Record<TsStatus, "warning" | "success" | "destructive" | "secondary"> = {
  OPEN: "warning", COMPLETED: "secondary", APPROVED: "success", REJECTED: "destructive",
};

interface Props {
  isManager: boolean;
  hasEmployee: boolean;
  requireGps: boolean;
  hoursThisWeek: number;
  openTimesheet: { id: string; clockIn: string; shiftLabel: string | null } | null;
  myTimesheets: {
    id: string; dateLabel: string; clockIn: string; clockOut: string | null;
    breakMinutes: number; hours: number; status: TsStatus; shiftLabel: string | null;
  }[];
  pending: {
    id: string; employeeName: string; dateLabel: string; clockIn: string;
    clockOut: string | null; breakMinutes: number; hours: number;
  }[];
}

function getCoords(): Promise<{ latitude?: number; longitude?: number }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve({}),
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
}

function useElapsed(sinceIso: string | undefined) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!sinceIso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sinceIso]);
  if (!sinceIso) return "";
  const ms = now - new Date(sinceIso).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimesheetManager(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const elapsed = useElapsed(props.openTimesheet?.clockIn);

  async function clock(action: "clock-in" | "clock-out") {
    setBusy(true);
    setError(null);
    const coords = await getCoords();
    try {
      const res = await fetch(`/api/timesheets/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coords),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function review(id: string, action: "APPROVE" | "REJECT") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/timesheets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Failed"); }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const clockedIn = !!props.openTimesheet;

  return (
    <div>
      <PageHeader title="Timesheets" description="Clock in and out, and review hours." />

      {error && <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {props.hasEmployee && (
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-4">
              <div className={`grid size-14 place-items-center rounded-2xl ${clockedIn ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-primary/10 text-primary"}`}>
                <Clock className="size-7" />
              </div>
              <div>
                {clockedIn ? (
                  <>
                    <div className="text-sm text-muted-foreground">Clocked in since {formatTime(props.openTimesheet!.clockIn)}{props.openTimesheet!.shiftLabel ? ` · shift ${props.openTimesheet!.shiftLabel}` : ""}</div>
                    <div className="font-mono text-2xl font-bold tabular-nums">{elapsed}</div>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-semibold">You're clocked out</div>
                    <div className="text-sm text-muted-foreground">{props.hoursThisWeek}h logged this week</div>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {props.requireGps && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3.5" /> GPS required</span>}
              {clockedIn ? (
                <Button size="lg" variant="destructive" onClick={() => clock("clock-out")} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <Square />} Clock out
                </Button>
              ) : (
                <Button size="lg" onClick={() => clock("clock-in")} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <Play />} Clock in
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manager approval queue */}
      {props.isManager && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Awaiting approval</CardTitle></CardHeader>
          <CardContent>
            {props.pending.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No timesheets to review.</p>
            ) : (
              <ul className="divide-y">
                {props.pending.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <div className="text-sm font-medium">{t.employeeName}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.dateLabel} · {formatTime(t.clockIn)}–{t.clockOut ? formatTime(t.clockOut) : "—"} · {t.hours}h{t.breakMinutes ? ` (${t.breakMinutes}m break)` : ""}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => review(t.id, "REJECT")} disabled={busy}>Reject</Button>
                      <Button size="sm" onClick={() => review(t.id, "APPROVE")} disabled={busy}>Approve</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Personal history */}
      <Card>
        <CardHeader><CardTitle className="text-base">Your recent timesheets</CardTitle></CardHeader>
        <CardContent>
          {props.myTimesheets.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No timesheets yet. Clock in to start.</p>
          ) : (
            <ul className="divide-y">
              {props.myTimesheets.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="text-sm font-medium">{t.dateLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatTime(t.clockIn)}–{t.clockOut ? formatTime(t.clockOut) : "in progress"}
                      {t.shiftLabel ? ` · shift ${t.shiftLabel}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular-nums">{t.status === "OPEN" ? "—" : `${t.hours}h`}</span>
                    <Badge variant={STATUS_VARIANT[t.status]}>{t.status.toLowerCase()}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
