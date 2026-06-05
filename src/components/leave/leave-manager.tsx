"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
type LeaveRow = {
  id: string; employeeName: string; type: string; customType: string | null;
  startDate: string; endDate: string; reason: string | null; status: LeaveStatus; isOwn: boolean;
};

const STATUS_VARIANT: Record<LeaveStatus, "warning" | "success" | "destructive" | "secondary"> = {
  PENDING: "warning", APPROVED: "success", REJECTED: "destructive", CANCELLED: "secondary",
};

const LEAVE_TYPES = [
  { value: "HOLIDAY", label: "Holiday" },
  { value: "SICK", label: "Sick" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "CUSTOM", label: "Custom" },
];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function days(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1;
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function LeaveManager({ isManager, canRequest, requests }: { isManager: boolean; canRequest: boolean; requests: LeaveRow[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    type: "HOLIDAY", customType: "", startDate: todayStr(), endDate: todayStr(), reason: "",
  });

  async function submit() {
    setBusyId("new");
    setError(null);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          customType: form.type === "CUSTOM" ? form.customType : undefined,
          startDate: form.startDate,
          endDate: form.endDate,
          reason: form.reason || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not submit request");
      setOpen(false);
      setForm({ type: "HOLIDAY", customType: "", startDate: todayStr(), endDate: todayStr(), reason: "" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  async function review(id: string, action: "APPROVE" | "REJECT") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Failed"); }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/leave/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "Failed"); }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Leave"
        description={isManager ? "Review and approve time-off requests." : "Request time off and track your requests."}
        action={canRequest ? <Button onClick={() => setOpen(true)}><Plus /> Request leave</Button> : undefined}
      />

      {error && <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <Card className="divide-y">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
            <Plane className="size-6" /> No leave requests yet.
          </div>
        ) : requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.employeeName}</span>
                <Badge variant={STATUS_VARIANT[r.status]}>{r.status.toLowerCase()}</Badge>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {(r.type === "CUSTOM" ? r.customType : r.type.toLowerCase())} · {fmt(r.startDate)} – {fmt(r.endDate)} · {days(r.startDate, r.endDate)} day{days(r.startDate, r.endDate) === 1 ? "" : "s"}
              </div>
              {r.reason && <div className="mt-1 text-sm text-muted-foreground">{r.reason}</div>}
            </div>
            <div className="flex items-center gap-2">
              {isManager && r.status === "PENDING" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => review(r.id, "REJECT")} disabled={busyId === r.id}>Reject</Button>
                  <Button size="sm" onClick={() => review(r.id, "APPROVE")} disabled={busyId === r.id}>
                    {busyId === r.id ? <Loader2 className="animate-spin" /> : null} Approve
                  </Button>
                </>
              )}
              {r.isOwn && r.status === "PENDING" && !isManager && (
                <Button size="sm" variant="ghost" onClick={() => cancel(r.id)} disabled={busyId === r.id}>Cancel</Button>
              )}
            </div>
          </div>
        ))}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request leave</DialogTitle>
            <DialogDescription>Submit a time-off request for approval.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {LEAVE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </div>

            {form.type === "CUSTOM" && (
              <div className="grid gap-2">
                <Label>Custom type name</Label>
                <Input value={form.customType} onChange={(e) => setForm({ ...form, customType: e.target.value })} placeholder="e.g. Compassionate" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Start date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>End date</Label>
                <Input type="date" value={form.endDate} min={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Reason (optional)</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Add any context for your manager" />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busyId === "new"}>Cancel</Button>
            <Button onClick={submit} disabled={busyId === "new"}>
              {busyId === "new" ? <Loader2 className="animate-spin" /> : null} Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
